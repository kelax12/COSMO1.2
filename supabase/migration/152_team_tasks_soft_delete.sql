-- ═══════════════════════════════════════════════════════════════════
-- 152, une tâche d'équipe supprimée va à la CORBEILLE, pas au néant (M4)
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE. Trois défauts qui, ensemble, faisaient
-- d'un nettoyage maladroit une perte définitive :
--
--   1. La suppression était un `DELETE` sur `team_tasks`. Les commentaires,
--      sous-tâches, étiquettes, dépendances et l'historique partaient avec
--      elle, en cascade.
--   2. Le toast « Annuler » RECRÉAIT une tâche neuve avec sept champs. Ni le
--      statut, ni la catégorie, ni les sous-tâches, ni les dépendances, ni les
--      commentaires, ni l'historique : trois semaines de commentaires client
--      ne revenaient pas, et le toast disait pourtant « annulé ».
--   3. Par défaut, TOUT membre avait `task.deleteAny` (mig. 115). Un stagiaire
--      pouvait vider un projet entier en sélection multiple.
--
-- ── CE QUE FAIT CETTE MIGRATION ─────────────────────────────────────
--
--   · `deleted_at` / `deleted_by` : supprimer, c'est poser une date.
--   · La policy SELECT cache une tâche supprimée, et `can_access_team_task`
--     aussi : ses commentaires, sous-tâches, étiquettes et son historique
--     disparaissent avec elle, puis REVIENNENT intacts à la restauration.
--   · Trois RPC `SECURITY DEFINER`, chacune avec son autorisation écrite en
--     clair : `trash_team_task`, `restore_team_task`, `get_team_trash`.
--   · Purge quotidienne des tâches supprimées depuis plus de 30 jours
--     (pg_cron), la durée annoncée à l'écran.
--   · `task.deleteAny` devient un droit de MANAGER par défaut. Un membre
--     supprime toujours ce qu'il a créé (la règle `created_by` est inchangée).
--
-- ── POURQUOI DES RPC, ET PAS UN UPDATE ──────────────────────────────
--
-- 🔴 Une policy SELECT qui exclut `deleted_at IS NOT NULL` rend un UPDATE qui
-- pose `deleted_at` impossible par PostgREST : la ligne produite n'est plus
-- visible, et PostgreSQL la refuse dès qu'on la relit. Le passage par une
-- fonction n'est donc pas un confort, c'est le seul chemin. Et puisque c'est
-- une fonction `DEFINER`, l'autorisation y est ÉCRITE, miroir exact de
-- l'ancienne policy DELETE.
--
-- ❌ Un UPDATE direct de `deleted_at` / `deleted_by` par un client est REFUSÉ
-- par le trigger `team_task_before_update` : sans ça, un assigné (qui a le
-- droit d'UPDATE) pourrait supprimer ou restaurer en contournant la règle.
-- Le trigger reconnaît l'appel légitime au rôle courant : dans une fonction
-- `DEFINER`, `current_user` est le propriétaire, jamais `authenticated`.
--
-- ⚠️ Le `DELETE` physique n'est plus ouvert qu'aux admins. Une suppression
-- d'organisation ou de projet emporte toujours ses tâches en cascade : une
-- cascade ne passe pas par la RLS.
--
-- ⚠️ « Restaurable par le responsable du projet » attend M2 (le projet n'a
-- pas encore de responsable). Aujourd'hui : un admin, la personne qui a
-- supprimé, ou un détenteur de `task.deleteAny` qui voit le projet.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Colonnes ────────────────────────────────────────────────────

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- La corbeille se lit par organisation et par date ; la purge par date.
CREATE INDEX IF NOT EXISTS idx_team_tasks_trash
  ON public.team_tasks (org_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- ── 2. Personne ne pose ni ne retire `deleted_at` en direct ────────
--
-- Corps repris de la mig. 062 (org_id et created_by immuables), plus la
-- garde de corbeille. INVOKER, comme toute garde.

CREATE OR REPLACE FUNCTION public.team_task_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  -- org_id immuable. created_by immuable SAUF passage à NULL (cascade
  -- ON DELETE SET NULL lors d'une suppression de compte RGPD) — on interdit
  -- seulement la réaffectation vers un AUTRE utilisateur.
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'org_id is immutable';
  END IF;
  IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable';
  END IF;
  -- Corbeille (mig. 152) : seules `trash_team_task` / `restore_team_task`
  -- (DEFINER, donc `current_user` = propriétaire) touchent ces colonnes.
  -- `deleted_by` passant à NULL par la cascade RGPD reste permis.
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
          OR (NEW.deleted_by IS NOT NULL AND NEW.deleted_by IS DISTINCT FROM OLD.deleted_by)) THEN
    RAISE EXCEPTION 'team_task_trash_direct_write' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

-- ── 3. Une tâche supprimée n'est lisible par personne ─────────────
--
-- REMPLACEMENT des policies existantes, jamais ajout (mig. 049).

DROP POLICY IF EXISTS team_tasks_select ON public.team_tasks;
CREATE POLICY team_tasks_select ON public.team_tasks
  FOR SELECT
  USING (deleted_at IS NULL AND public.can_access_team_project(project_id));

DROP POLICY IF EXISTS team_tasks_delete ON public.team_tasks;
CREATE POLICY team_tasks_delete ON public.team_tasks
  FOR DELETE
  USING (public.is_org_admin(org_id));

-- Commentaires, sous-tâches, étiquettes, historique : tous gardés par ce
-- helper. Une tâche à la corbeille les emporte, et les rend en revenant.
CREATE OR REPLACE FUNCTION public.can_access_team_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_tasks t
    WHERE t.id = p_task
      AND t.deleted_at IS NULL
      AND public.can_access_team_project(t.project_id)
  );
$function$;

-- ── 4. Les lectures DEFINER, qui ne passent pas par la policy ──────

CREATE OR REPLACE FUNCTION public.get_my_team_tasks(p_org uuid)
RETURNS SETOF public.team_tasks
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT t.*
  FROM public.team_tasks t
  WHERE t.org_id = p_org
    AND t.deleted_at IS NULL
    AND t.project_id IN (SELECT public.my_team_project_ids(p_org));
$function$;

-- Une dépendance dont UN des deux bouts est à la corbeille disparaît avec
-- lui, et revient avec lui.
CREATE OR REPLACE FUNCTION public.get_my_team_task_dependencies(p_org uuid)
RETURNS SETOF public.team_task_dependencies
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT d.*
  FROM public.team_task_dependencies d
  JOIN public.team_tasks t ON t.id = d.task_id
  JOIN public.team_tasks b ON b.id = d.depends_on_id
  WHERE d.org_id = p_org
    AND t.deleted_at IS NULL
    AND b.deleted_at IS NULL
    AND t.project_id IN (SELECT public.my_team_project_ids(p_org));
$function$;

CREATE OR REPLACE FUNCTION public.my_org_badge_tasks()
RETURNS TABLE(org_id uuid, id uuid, name text, created_at timestamp with time zone, kind text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH my_orgs AS (
    SELECT om.org_id
    FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
      AND (select auth.uid()) IS NOT NULL
  ),
  visible_projects AS (
    SELECT o.org_id, p.project_id
    FROM my_orgs o
    CROSS JOIN LATERAL (
      SELECT public.my_team_project_ids(o.org_id) AS project_id
    ) p
  ),
  assigned AS (
    SELECT t.org_id, t.id, t.name, t.created_at, 'assigned'::text AS kind,
           row_number() OVER (PARTITION BY t.org_id ORDER BY t.created_at DESC) AS rn
    FROM public.team_tasks t
    JOIN visible_projects vp
      ON vp.org_id = t.org_id AND vp.project_id = t.project_id
    WHERE t.completed = false
      AND t.deleted_at IS NULL
      AND t.assignee_ids @> ARRAY[(select auth.uid())]
      AND t.created_by IS DISTINCT FROM (select auth.uid())
  ),
  unread_task_ids AS (
    SELECT DISTINCT n.task_id
    FROM public.org_notifications n
    WHERE n.user_id = (select auth.uid())
      AND (select auth.uid()) IS NOT NULL
      AND n.read_at IS NULL
      AND n.task_id IS NOT NULL
  ),
  notified AS (
    SELECT t.org_id, t.id, t.name, t.created_at, 'notified'::text AS kind,
           row_number() OVER (PARTITION BY t.org_id ORDER BY t.created_at DESC) AS rn
    FROM public.team_tasks t
    JOIN visible_projects vp
      ON vp.org_id = t.org_id AND vp.project_id = t.project_id
    WHERE t.id IN (SELECT u.task_id FROM unread_task_ids u)
      AND t.deleted_at IS NULL
  )
  SELECT a.org_id, a.id, a.name, a.created_at, a.kind
  FROM assigned a WHERE a.rn <= 200
  UNION ALL
  SELECT n.org_id, n.id, n.name, n.created_at, n.kind
  FROM notified n WHERE n.rn <= 50;
$function$;

-- Pas de rappel de retard pour une tâche à la corbeille.
CREATE OR REPLACE FUNCTION public.run_overdue_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
  SELECT
    t.org_id,
    assignee,
    NULL,
    'task_overdue',
    t.id
  FROM public.team_tasks t
  CROSS JOIN LATERAL unnest(COALESCE(t.assignee_ids, ARRAY[]::uuid[])) AS assignee
  WHERE t.completed = false
    AND t.deleted_at IS NULL
    AND t.deadline IS NOT NULL
    AND t.deadline < CURRENT_DATE
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$function$;

-- ── 5. Les trois RPC de la corbeille ───────────────────────────────

-- Mettre à la corbeille : miroir EXACT de l'ancienne policy DELETE
-- (`task.deleteAny` OU créateur), plus la visibilité du projet.
CREATE OR REPLACE FUNCTION public.trash_team_task(p_task uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_task record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT t.id, t.org_id, t.project_id, t.created_by
    INTO v_task
    FROM public.team_tasks t
   WHERE t.id = p_task AND t.deleted_at IS NULL
   FOR UPDATE;
  -- Même réponse pour « n'existe pas » et « ne vous est pas visible » :
  -- une fonction DEFINER ne doit pas servir d'oracle d'existence.
  IF NOT FOUND OR NOT public.can_access_team_project(v_task.project_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (public.my_org_perm(v_task.org_id, 'task.deleteAny') OR v_task.created_by = v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.team_tasks
     SET deleted_at = NOW(), deleted_by = v_uid
   WHERE id = p_task;
END;
$function$;

-- Qui peut restaurer : un admin, la personne qui a supprimé, ou un
-- détenteur de `task.deleteAny` qui voit le projet.
CREATE OR REPLACE FUNCTION public.can_restore_team_task(
  p_org uuid, p_project uuid, p_deleted_by uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT (select auth.uid()) IS NOT NULL
     AND public.is_org_member(p_org)
     AND (
       public.is_org_admin(p_org)
       OR p_deleted_by = (select auth.uid())
       OR (public.my_org_perm(p_org, 'task.deleteAny') AND public.can_access_team_project(p_project))
     );
$function$;

CREATE OR REPLACE FUNCTION public.restore_team_task(p_task uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_task record;
BEGIN
  SELECT t.id, t.org_id, t.project_id, t.deleted_by
    INTO v_task
    FROM public.team_tasks t
   WHERE t.id = p_task AND t.deleted_at IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND
     OR NOT public.can_restore_team_task(v_task.org_id, v_task.project_id, v_task.deleted_by) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.team_tasks
     SET deleted_at = NULL, deleted_by = NULL
   WHERE id = p_task;
END;
$function$;

-- La corbeille : ce que l'appelant peut restaurer, et rien d'autre.
-- ❌ Jamais `SELECT t.*` : on rend l'intitulé et les métadonnées de
-- suppression, pas la description (le contenu reste derrière la restauration).
CREATE OR REPLACE FUNCTION public.get_team_trash(p_org uuid)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  name text,
  deleted_at timestamptz,
  deleted_by uuid,
  created_by uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT t.id, t.project_id, t.name, t.deleted_at, t.deleted_by, t.created_by
    FROM public.team_tasks t
   WHERE t.org_id = p_org
     AND t.deleted_at IS NOT NULL
     AND t.deleted_at > NOW() - INTERVAL '30 days'
     AND public.can_restore_team_task(t.org_id, t.project_id, t.deleted_by)
   ORDER BY t.deleted_at DESC
   LIMIT 200;
$function$;

REVOKE ALL ON FUNCTION public.trash_team_task(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_team_task(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_team_trash(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_restore_team_task(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trash_team_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_team_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_trash(uuid) TO authenticated;

-- ── 6. Purge à 30 jours ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_team_task_trash()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.team_tasks
   WHERE deleted_at IS NOT NULL
     AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_team_task_trash() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('cosmo-purge-team-task-trash')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-purge-team-task-trash');

-- 03:45 UTC : après la purge des invitations (03:30, mig. 112), avant le
-- rappel des retards (07:00, mig. 096).
SELECT cron.schedule(
  'cosmo-purge-team-task-trash',
  '45 3 * * *',
  $cron$SELECT public.purge_team_task_trash();$cron$
);

-- ── 7. `task.deleteAny` devient un droit de manager ────────────────
--
-- Corps repris de la mig. 115 ; seule la ligne des défauts change.
-- Une surcharge explicite (`org_member_permissions.can_delete_task`) reste
-- prioritaire : une organisation qui l'a décidé garde sa décision.

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
        WHEN p_key IN ('task.deleteAny', 'project.create', 'project.delete', 'okr.create', 'okr.delete',
                       'category.manage', 'team.create', 'member.invite')
          THEN public.is_org_manager(p_org)
        ELSE false
      END
    )
  END;
$function$;

COMMIT;
