-- ═══════════════════════════════════════════════════════════════════
-- 151 · Gouvernance du mode entreprise (audit 2026-09-23, M4 + M5)
-- ═══════════════════════════════════════════════════════════════════
--
-- Trois défauts, un seul thème : un geste ordinaire produisait une perte ou
-- une fuite que personne n'avait décidée.
--
--   1. M4 · tout membre supprimait DÉFINITIVEMENT n'importe quelle tâche
--      (`task.deleteAny` vrai par défaut), et l'« annuler » du client recréait
--      une tâche neuve sans commentaires, sous-tâches ni dépendances.
--      → `task.deleteAny` devient un droit de MANAGER par défaut (une ligne
--        de surcharge le rend toujours à qui on veut), et toute suppression
--        directe passe par une CORBEILLE restaurable 30 jours.
--
--   2. M5 · supprimer une équipe rendait ses projets et ses OKR visibles par
--      TOUTE l'entreprise : `team_projects.team_id` est en ON DELETE SET NULL,
--      et NULL veut dire « projet d'organisation ». `team_okr_teams` est en
--      CASCADE : un OKR rattaché à cette seule équipe passait à `teamIds = []`,
--      soit « objectif d'entreprise ».
--      → un trigger refuse la suppression tant que l'équipe porte du travail,
--        et `delete_org_team()` fait choisir : réaffecter à une autre équipe,
--        ou publier explicitement (admin seulement).
--
--   3. La contrainte `org_notifications_kind_check` posée par la mig. 110 ne
--      contient plus `org_removed`, que `remove_member` (mig. 106) insère :
--      reposée ici avec les cinq valeurs réellement écrites.
--
-- ⚠️ À appliquer AVANT le déploiement du front de la branche
-- `feat/entreprise-audit` : le client appelle `delete_org_team`,
-- `restore_team_task` et lit `team_task_trash`.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 0 · Contrainte des notifications ───────────────────────────────

ALTER TABLE public.org_notifications
  DROP CONSTRAINT IF EXISTS org_notifications_kind_check;
ALTER TABLE public.org_notifications
  ADD CONSTRAINT org_notifications_kind_check
  CHECK (kind IN ('task_assigned', 'mention', 'task_overdue', 'comment', 'org_removed'));

-- ─── 1 · `task.deleteAny` : droit de manager par défaut ──────────────
--
-- Seul le bloc des DÉFAUTS change. Les surcharges existantes gardent leur
-- sens (une ligne `can_delete_task = true` posée sur un membre le reste), et
-- un membre supprime toujours les tâches qu'il a créées : la policy
-- `team_tasks_delete` porte `created_by = auth.uid()` à part.

CREATE OR REPLACE FUNCTION public.my_org_perm(p_org uuid, p_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN NOT public.is_org_member(p_org) THEN false
    WHEN public.is_org_admin(p_org) THEN true
    ELSE COALESCE(
      (
        SELECT CASE p_key
          WHEN 'task.create'     THEN p.can_create_task
          WHEN 'task.editAny'    THEN p.can_edit_any_task
          WHEN 'task.deleteAny'  THEN p.can_delete_task
          WHEN 'project.create'  THEN p.can_create_project
          WHEN 'project.delete'  THEN p.can_delete_project
          WHEN 'okr.create'      THEN p.can_create_okr
          WHEN 'okr.delete'      THEN p.can_delete_okr
          WHEN 'category.manage' THEN p.can_manage_category
          WHEN 'team.create'     THEN p.can_create_team
          WHEN 'member.invite'   THEN p.can_invite_member
        END
        FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      CASE
        WHEN p_key IN ('task.create', 'task.editAny') THEN true
        WHEN p_key IN ('task.deleteAny', 'project.create', 'project.delete', 'okr.create',
                       'okr.delete', 'category.manage', 'team.create', 'member.invite')
          THEN public.is_org_manager(p_org)
        ELSE false
      END
    )
  END;
$function$;
REVOKE ALL ON FUNCTION public.my_org_perm(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_org_perm(uuid, text) TO authenticated;

-- ─── 2 · Suppression d'équipe : jamais de publication implicite ──────

-- Ce qu'une suppression d'équipe emporterait. Compte seulement ; rend des
-- zéros à qui n'est pas membre de l'organisation de l'équipe, pour ne pas
-- devenir un oracle sur des équipes étrangères.
CREATE OR REPLACE FUNCTION public.org_team_deletion_impact(p_team uuid)
RETURNS TABLE (projects integer, okrs integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    (SELECT count(*)::int FROM public.team_projects p WHERE p.team_id = t.id),
    (SELECT count(*)::int FROM public.team_okr_teams ot
      WHERE ot.team_id = t.id
        AND NOT EXISTS (
          SELECT 1 FROM public.team_okr_teams o2
          WHERE o2.okr_id = ot.okr_id AND o2.team_id <> t.id
        ))
  FROM public.org_teams t
  WHERE t.id = p_team
    AND public.is_org_member(t.org_id);
$$;
REVOKE ALL ON FUNCTION public.org_team_deletion_impact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_team_deletion_impact(uuid) TO authenticated;

-- Trigger SECURITY INVOKER (règle 064b / 094b). `pg_trigger_depth() > 1` :
-- suppression en cascade de l'organisation entière, où il n'y a plus
-- personne à qui publier quoi que ce soit.
CREATE OR REPLACE FUNCTION public.guard_org_team_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_projects integer;
  v_okrs integer;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  SELECT i.projects, i.okrs INTO v_projects, v_okrs
    FROM public.org_team_deletion_impact(OLD.id) i;
  IF COALESCE(v_projects, 0) > 0 OR COALESCE(v_okrs, 0) > 0 THEN
    RAISE EXCEPTION 'team_has_dependents' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_org_team_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_org_team_delete ON public.org_teams;
CREATE TRIGGER trg_guard_org_team_delete
  BEFORE DELETE ON public.org_teams
  FOR EACH ROW EXECUTE FUNCTION public.guard_org_team_delete();

-- Le seul chemin client pour supprimer une équipe qui porte du travail.
--   · p_target_team : ses projets et ses OKR passent à cette équipe ;
--   · p_make_public : ils deviennent visibles par toute l'organisation,
--     décision réservée à un ADMIN (c'est une publication) ;
--   · ni l'un ni l'autre : n'aboutit que si l'équipe ne porte rien.
CREATE OR REPLACE FUNCTION public.delete_org_team(
  p_team uuid,
  p_target_team uuid DEFAULT NULL,
  p_make_public boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_org uuid;
  v_target_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT org_id INTO v_org FROM public.org_teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND OR NOT public.can_manage_team(p_team) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF p_target_team IS NOT NULL THEN
    SELECT org_id INTO v_target_org FROM public.org_teams WHERE id = p_target_team;
    IF p_target_team = p_team OR v_target_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'invalid_target' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.team_projects SET team_id = p_target_team WHERE team_id = p_team;
    INSERT INTO public.team_okr_teams (okr_id, org_id, team_id, added_by)
      SELECT ot.okr_id, ot.org_id, p_target_team, auth.uid()
        FROM public.team_okr_teams ot
       WHERE ot.team_id = p_team
      ON CONFLICT DO NOTHING;
    DELETE FROM public.team_okr_teams WHERE team_id = p_team;
  ELSIF p_make_public THEN
    IF NOT public.is_org_admin(v_org) THEN
      RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
    END IF;
    UPDATE public.team_projects SET team_id = NULL WHERE team_id = p_team;
    DELETE FROM public.team_okr_teams WHERE team_id = p_team;
  END IF;

  -- Le trigger refuse encore si du travail reste rattaché.
  DELETE FROM public.org_teams WHERE id = p_team;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_org_team(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_org_team(uuid, uuid, boolean) TO authenticated;

-- ─── 3 · Corbeille des tâches d'équipe ──────────────────────────────
--
-- Une tâche supprimée est photographiée, avec ce qui en dépend et que la
-- cascade emporterait (sous-tâches, commentaires, dépendances, étiquettes,
-- journal), AVANT la suppression. La restauration réinsère le tout sous le
-- MÊME identifiant : les liens profonds et les notifications futures
-- continuent de pointer au bon endroit.
--
-- Pas de colonne `user_id` : `deleted_by` est en SET NULL (le travail
-- d'équipe survit au compte, comme `created_by`), et la purge à 30 jours
-- borne ce que le `payload` retient.

CREATE TABLE IF NOT EXISTS public.team_task_trash (
  task_id    UUID PRIMARY KEY,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload    JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_task_trash_org_deleted
  ON public.team_task_trash (org_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_task_trash_project
  ON public.team_task_trash (project_id);

ALTER TABLE public.team_task_trash ENABLE ROW LEVEL SECURITY;

-- Lecture : ce que j'ai supprimé, ou tout ce que je pourrais restaurer,
-- sur un projet que je vois. Aucune policy d'écriture : la corbeille ne
-- s'écrit que par le trigger et ne se vide que par la restauration ou la purge.
DROP POLICY IF EXISTS "team_task_trash_select" ON public.team_task_trash;
CREATE POLICY "team_task_trash_select"
  ON public.team_task_trash FOR SELECT
  USING (
    public.can_access_team_project(project_id)
    AND (
      deleted_by = (SELECT auth.uid())
      OR public.my_org_perm(org_id, 'task.deleteAny')
    )
  );

-- Photographie. SECURITY DEFINER pour lire les tables filles en entier et
-- écrire une table sans policy d'écriture ; ne s'exécute QUE depuis un
-- trigger (`pg_trigger_depth() = 0` → refus) : appelée en RPC, elle
-- permettrait de fabriquer une entrée de corbeille.
CREATE OR REPLACE FUNCTION public.snapshot_team_task_to_trash(p_task uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.team_task_trash (task_id, org_id, project_id, name, deleted_by, payload)
  SELECT t.id, t.org_id, t.project_id, t.name, auth.uid(),
    jsonb_build_object(
      'task', to_jsonb(t),
      'subtasks', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.team_task_subtasks s WHERE s.task_id = t.id), '[]'::jsonb),
      'comments', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.team_task_comments c WHERE c.task_id = t.id), '[]'::jsonb),
      'dependencies', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.team_task_dependencies d
                                 WHERE d.task_id = t.id OR d.depends_on_id = t.id), '[]'::jsonb),
      'labels', COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM public.team_task_labels l WHERE l.task_id = t.id), '[]'::jsonb),
      'activity', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.team_task_activity a WHERE a.task_id = t.id), '[]'::jsonb)
    )
  FROM public.team_tasks t
  WHERE t.id = p_task
  ON CONFLICT (task_id) DO UPDATE
    SET payload = EXCLUDED.payload,
        deleted_at = now(),
        deleted_by = EXCLUDED.deleted_by;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_team_task_to_trash(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_team_task_to_trash(uuid) TO authenticated;

-- Trigger SECURITY INVOKER. Ne photographie que la suppression DIRECTE d'un
-- utilisateur connecté : une cascade (projet, organisation) ou une purge
-- service_role (auth.uid() NULL, suppression de compte) ne remplit rien.
CREATE OR REPLACE FUNCTION public.trash_team_task_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND auth.uid() IS NOT NULL THEN
    PERFORM public.snapshot_team_task_to_trash(OLD.id);
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.trash_team_task_before_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trash_team_task ON public.team_tasks;
CREATE TRIGGER trg_trash_team_task
  BEFORE DELETE ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trash_team_task_before_delete();

-- La portée d'assignation ne juge que les AJOUTS faits par l'utilisateur.
-- Une restauration remet des assignations qui existaient : on la laisse
-- passer. Le drapeau est transactionnel et n'est posable que par une
-- fonction du serveur (même motif que `cosmo.allow_code_regen`, mig. 067).
CREATE OR REPLACE FUNCTION public.enforce_team_task_assign_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_old uuid[] := CASE WHEN TG_OP = 'UPDATE'
                       THEN COALESCE(OLD.assignee_ids, ARRAY[]::uuid[])
                       ELSE ARRAY[]::uuid[] END;
  v_uid uuid;
BEGIN
  IF current_setting('cosmo.restoring_task', true) = 'on' THEN
    RETURN NEW;
  END IF;
  FOREACH v_uid IN ARRAY COALESCE(NEW.assignee_ids, ARRAY[]::uuid[]) LOOP
    IF NOT (v_uid = ANY (v_old)) AND NOT public.can_assign_to(NEW.org_id, v_uid) THEN
      RAISE EXCEPTION 'team_tasks: your assignment scope does not cover this member';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_team_task_assign_scope() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.restore_team_task(p_task uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row  public.team_task_trash;
  v_task public.team_tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM public.team_task_trash WHERE task_id = p_task FOR UPDATE;
  IF NOT FOUND
     OR NOT public.can_access_team_project(v_row.project_id)
     OR NOT (v_row.deleted_by = auth.uid() OR public.my_org_perm(v_row.org_id, 'task.deleteAny'))
  THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('cosmo.restoring_task', 'on', true);

  v_task := jsonb_populate_record(NULL::public.team_tasks, v_row.payload -> 'task');
  -- Un assigné parti entre-temps ne revient pas : il n'a plus accès.
  v_task.assignee_ids := ARRAY(
    SELECT u FROM unnest(COALESCE(v_task.assignee_ids, ARRAY[]::uuid[])) u
     WHERE EXISTS (SELECT 1 FROM public.organization_members m
                    WHERE m.org_id = v_task.org_id AND m.user_id = u)
  );
  IF v_task.assignee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.org_id = v_task.org_id AND m.user_id = v_task.assignee_id
  ) THEN
    v_task.assignee_id := NULL;
  END IF;
  INSERT INTO public.team_tasks SELECT (v_task).*;

  INSERT INTO public.team_task_subtasks
    SELECT * FROM jsonb_populate_recordset(NULL::public.team_task_subtasks, v_row.payload -> 'subtasks');

  INSERT INTO public.team_task_comments
    SELECT * FROM jsonb_populate_recordset(NULL::public.team_task_comments, v_row.payload -> 'comments');

  INSERT INTO public.team_task_dependencies
    SELECT d.* FROM jsonb_populate_recordset(NULL::public.team_task_dependencies, v_row.payload -> 'dependencies') d
     WHERE EXISTS (SELECT 1 FROM public.team_tasks x WHERE x.id = d.task_id)
       AND EXISTS (SELECT 1 FROM public.team_tasks y WHERE y.id = d.depends_on_id)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.team_task_labels
    SELECT l.* FROM jsonb_populate_recordset(NULL::public.team_task_labels, v_row.payload -> 'labels') l
     WHERE EXISTS (SELECT 1 FROM public.team_labels x WHERE x.id = l.label_id)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.team_task_activity
    SELECT * FROM jsonb_populate_recordset(NULL::public.team_task_activity, v_row.payload -> 'activity')
    ON CONFLICT DO NOTHING;

  -- Les triggers de commentaire ont renotifié des événements anciens :
  -- `now()` est l'horodatage de la TRANSACTION, il ne désigne donc que ce
  -- que cette restauration vient de produire.
  DELETE FROM public.org_notifications
   WHERE task_id = p_task
     AND kind IN ('comment', 'mention')
     AND created_at = now();

  DELETE FROM public.team_task_trash WHERE task_id = p_task;

  PERFORM set_config('cosmo.restoring_task', 'off', true);
  RETURN p_task;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_team_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_team_task(uuid) TO authenticated;

-- Purge à 30 jours, quotidienne.
CREATE OR REPLACE FUNCTION public.purge_team_task_trash()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.team_task_trash WHERE deleted_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_team_task_trash() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('cosmo-purge-team-task-trash')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-purge-team-task-trash');

SELECT cron.schedule(
  'cosmo-purge-team-task-trash',
  '45 3 * * *',
  $cron$SELECT public.purge_team_task_trash();$cron$
);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION
--
--   -- défaut : un membre sans surcharge ne supprime plus que ses tâches
--   SELECT pg_get_functiondef('public.my_org_perm(uuid,text)'::regprocedure)
--     LIKE '%''task.deleteAny'', ''project.create''%';            -- attendu : true
--
--   -- les triggers existent
--   SELECT tgname FROM pg_trigger
--    WHERE tgname IN ('trg_guard_org_team_delete', 'trg_trash_team_task');
--
--   -- la photographie refuse un appel direct
--   SELECT public.snapshot_team_task_to_trash(gen_random_uuid()); -- attendu : 42501
--
--   -- le job de purge
--   SELECT jobname, schedule, active FROM cron.job
--    WHERE jobname = 'cosmo-purge-team-task-trash';
-- ═══════════════════════════════════════════════════════════════════
