-- ═══════════════════════════════════════════════════════════════════
-- 164 · Cas limites du mode entreprise (audit 2026-09-24, étapes 3 et 4)
-- ═══════════════════════════════════════════════════════════════════
--
-- Écrite APRÈS les 160-163 et 170, appliquées en production le 2026-09-25.
-- Chaque fonction redéfinie ici part de son corps LU AU CATALOGUE ce jour-là
-- (`pg_get_functiondef`), jamais du fichier du dépôt : la 161 du dépôt et la
-- production divergeaient déjà (`deleted_at IS NULL` ajouté après coup).
--
--   1 · Projet mené par plusieurs équipes : `team_project_teams`. L'équipe
--       du projet (`team_id`) reste l'équipe PRINCIPALE ; les équipes
--       associées élargissent la lecture, jamais au-delà de l'organisation.
--       Leur suppression ne fait que RÉTRÉCIR l'audience (CASCADE sûr, M5).
--   2 · Projet archivé : ses assignés, son responsable et ses abonnés sont
--       prévenus (`project_archived`). Ses tâches quittaient « Mes tâches »
--       sans un mot.
--   3 · Changement de position : la personne déplacée, le manager qui perd
--       son dernier subordonné et celui qui gagne le premier sont prévenus
--       (`role_changed`). Le passage manager → membre était silencieux.
--   4 · Projet supprimé : `purge_archived_team_project`, INVOKER, ne purge
--       qu'un projet DÉJÀ archivé. La policy DELETE (`project.delete`) reste
--       la frontière.
--   5 · Départ : l'assistant transfère enfin les projets PORTÉS (M2 a posé
--       `owner_id`, la 161 annonçait 0), et un mode `transfer` transmet les
--       responsabilités sans faire partir la personne.
--   6 · Retrait et départ volontaire : plus d'assignation fantôme. Les tâches
--       OUVERTES perdent l'assigné qui n'a plus accès, les projets perdent
--       leur responsable, les abonnements tombent.
--   7 · Revues hebdomadaires : lisibles aussi par le responsable de l'équipe
--       ou du projet revu, pas seulement par leur auteur et les admins.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1 · Équipes associées d'un projet ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_project_teams (
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  -- CASCADE, et c'est voulu : retirer une équipe ASSOCIÉE rétrécit l'audience.
  -- Seule l'équipe principale (`team_projects.team_id`) est en NO ACTION (151).
  team_id    UUID NOT NULL REFERENCES public.org_teams(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_team_project_teams_team ON public.team_project_teams (team_id);
CREATE INDEX IF NOT EXISTS idx_team_project_teams_org ON public.team_project_teams (org_id);
CREATE INDEX IF NOT EXISTS idx_team_project_teams_added_by ON public.team_project_teams (added_by);

ALTER TABLE public.team_project_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_project_teams_select" ON public.team_project_teams;
CREATE POLICY "team_project_teams_select" ON public.team_project_teams FOR SELECT
  USING (public.can_access_team_project(project_id));

-- Associer une équipe change QUI LIT le projet : c'est un geste d'audience,
-- donc `project.edit` (règle M5), jamais le simple responsable.
DROP POLICY IF EXISTS "team_project_teams_insert" ON public.team_project_teams;
CREATE POLICY "team_project_teams_insert" ON public.team_project_teams FOR INSERT
  WITH CHECK (
    public.my_project_edit_perm(org_id)
    AND added_by = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.team_projects p
                 WHERE p.id = team_project_teams.project_id AND p.org_id = team_project_teams.org_id)
    AND EXISTS (SELECT 1 FROM public.org_teams t
                 WHERE t.id = team_project_teams.team_id AND t.org_id = team_project_teams.org_id)
  );

DROP POLICY IF EXISTS "team_project_teams_delete" ON public.team_project_teams;
CREATE POLICY "team_project_teams_delete" ON public.team_project_teams FOR DELETE
  USING (public.my_project_edit_perm(org_id));

REVOKE ALL ON public.team_project_teams FROM anon;

-- `my_team_project_ids` : corps de production du 2026-09-25, plus UNE branche
-- (équipes associées). ⚠️ La ligne `AND public.is_org_member(p_org)` de
-- `my_membership` est celle de la 161 : un membre suspendu ne lit rien.
CREATE OR REPLACE FUNCTION public.my_team_project_ids(p_org UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH my_membership AS (
    SELECT om.role
    FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
      AND om.org_id = p_org
      AND (select auth.uid()) IS NOT NULL
      AND public.is_org_member(p_org)
  ),
  my_teams AS (
    SELECT tm.team_id
    FROM public.org_team_members tm
    WHERE tm.user_id = (select auth.uid())
      AND tm.org_id = p_org
      AND (select auth.uid()) IS NOT NULL
      AND EXISTS (SELECT 1 FROM my_membership)
  ),
  my_subtree AS (
    SELECT public.get_subtree(p_org, (select auth.uid())) AS user_id
    WHERE EXISTS (SELECT 1 FROM my_membership)
  ),
  subordinate_teams AS (
    SELECT DISTINCT tm.team_id
    FROM public.org_team_members tm
    JOIN my_subtree s ON s.user_id = tm.user_id
    WHERE tm.org_id = p_org
  ),
  visible_teams AS (
    SELECT team_id FROM my_teams
    UNION
    SELECT team_id FROM subordinate_teams
  )
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.team_id IS NULL
    AND EXISTS (SELECT 1 FROM my_membership)
  UNION
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND EXISTS (SELECT 1 FROM my_membership WHERE role = 'admin')
  UNION
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.team_id IN (SELECT team_id FROM visible_teams)
  UNION
  SELECT ptt.project_id
  FROM public.team_project_teams ptt
  WHERE ptt.org_id = p_org
    AND ptt.team_id IN (SELECT team_id FROM visible_teams);
$$;
REVOKE ALL ON FUNCTION public.my_team_project_ids(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_team_project_ids(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_team_project_ids(UUID) FROM authenticated;

-- `can_access_team_project` : corps de production, plus les équipes associées.
CREATE OR REPLACE FUNCTION public.can_access_team_project(p_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project
      AND public.is_org_member(p.org_id)
      AND (
        p.team_id IS NULL
        OR public.is_org_admin(p.org_id)
        OR EXISTS (
          SELECT 1 FROM public.org_team_members tm
          WHERE (
              tm.team_id = p.team_id
              OR tm.team_id IN (SELECT ptt.team_id FROM public.team_project_teams ptt
                                 WHERE ptt.project_id = p.id)
            )
            AND (
              tm.user_id = auth.uid()
              OR tm.user_id IN (SELECT public.get_subtree(p.org_id, auth.uid()))
            )
        )
      )
  );
$$;

-- ─── 2 · Notifications : deux types de plus ─────────────────────────
--
-- Liste de la production du 2026-09-25 (dix types), plus deux. La 110 du dépôt
-- avait perdu `org_removed` : ne jamais reposer cette contrainte de mémoire.

ALTER TABLE public.org_notifications
  DROP CONSTRAINT IF EXISTS org_notifications_kind_check;
ALTER TABLE public.org_notifications
  ADD CONSTRAINT org_notifications_kind_check
  CHECK (kind IN (
    'task_assigned', 'mention', 'task_overdue', 'comment', 'org_removed',
    'status_changed', 'unblocked', 'project_at_risk', 'kr_due', 'event_scheduled',
    'project_archived', 'role_changed'
  ));

-- AFTER + SECURITY DEFINER, comme `notify_task_comment` (110) et les
-- déclencheurs de la 162 : la ligne a passé la RLS, la fonction n'écrit que
-- des notifications et ne renvoie aucun message.
CREATE OR REPLACE FUNCTION public.notify_team_project_archived()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF OLD.archived_at IS NOT NULL OR NEW.archived_at IS NULL OR NEW.is_template THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, project_id, meta)
  SELECT NEW.org_id, r.uid, v_actor, 'project_archived', NEW.id,
         jsonb_build_object('project_name', NEW.name)
    FROM (
      SELECT DISTINCT unnest(t.assignee_ids) AS uid
        FROM public.team_tasks t
       WHERE t.project_id = NEW.id AND NOT t.completed AND t.deleted_at IS NULL
      UNION
      SELECT NEW.owner_id WHERE NEW.owner_id IS NOT NULL
      UNION
      SELECT f.user_id FROM public.team_project_followers f WHERE f.project_id = NEW.id
    ) r
    JOIN public.organization_members om ON om.org_id = NEW.org_id AND om.user_id = r.uid
   WHERE r.uid IS DISTINCT FROM v_actor;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_team_project_archived() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_team_project_archived ON public.team_projects;
CREATE TRIGGER trg_notify_team_project_archived
  AFTER UPDATE OF archived_at ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_team_project_archived();

-- « Manager » est une POSITION dérivée de la pyramide : la perdre ou la gagner
-- change ce qu'on voit (Pyramide, Statistiques, sous-arbre). Personne n'en
-- était prévenu.
CREATE OR REPLACE FUNCTION public.notify_member_position_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  -- Posé par `remove_member`, `leave_organization` et l'assistant de départ :
  -- la personne qui PART ne reçoit pas « vous n'encadrez plus personne ».
  v_leaving text := current_setting('cosmo.departing_member', true);
BEGIN
  IF OLD.manager_id IS NOT DISTINCT FROM NEW.manager_id THEN
    RETURN NEW;
  END IF;

  -- La personne déplacée : son supérieur direct a changé.
  IF NEW.user_id IS DISTINCT FROM v_actor THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
    VALUES (NEW.org_id, NEW.user_id, v_actor, 'role_changed',
            jsonb_build_object('change', 'manager_changed', 'manager_id', NEW.manager_id));
  END IF;

  -- L'ancien manager qui n'encadre plus personne.
  IF OLD.manager_id IS NOT NULL AND OLD.manager_id IS DISTINCT FROM v_actor
     AND OLD.manager_id::text IS DISTINCT FROM NULLIF(v_leaving, '')
     AND NOT EXISTS (SELECT 1 FROM public.organization_members
                      WHERE org_id = NEW.org_id AND manager_id = OLD.manager_id)
     AND EXISTS (SELECT 1 FROM public.organization_members
                  WHERE org_id = NEW.org_id AND user_id = OLD.manager_id) THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
    VALUES (NEW.org_id, OLD.manager_id, v_actor, 'role_changed',
            jsonb_build_object('change', 'no_longer_manager'));
  END IF;

  -- Le nouveau manager qui encadre quelqu'un pour la première fois.
  IF NEW.manager_id IS NOT NULL AND NEW.manager_id IS DISTINCT FROM v_actor
     AND (SELECT count(*) FROM public.organization_members
           WHERE org_id = NEW.org_id AND manager_id = NEW.manager_id) = 1 THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
    VALUES (NEW.org_id, NEW.manager_id, v_actor, 'role_changed',
            jsonb_build_object('change', 'now_manager', 'report_id', NEW.user_id));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_member_position_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_member_position_change ON public.organization_members;
CREATE TRIGGER trg_notify_member_position_change
  AFTER UPDATE OF manager_id ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_member_position_change();

-- ─── 3 · Purger un projet archivé ───────────────────────────────────
--
-- INVOKER : c'est la policy DELETE (`project.delete`) qui décide. La fonction
-- n'ajoute qu'une règle, que la policy ne sait pas dire : on ne purge qu'un
-- projet déjà archivé. Tâches, jalons, dépendances, abonnements et
-- notifications partent par CASCADE (clés relues au catalogue le 2026-09-25).
CREATE OR REPLACE FUNCTION public.purge_archived_team_project(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_archived timestamptz;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT archived_at INTO v_archived FROM public.team_projects WHERE id = p_project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_archived IS NULL THEN
    RAISE EXCEPTION 'project_not_archived' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.team_projects WHERE id = p_project;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_archived_team_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_archived_team_project(uuid) TO authenticated;

-- ─── 4 · Assistant de départ, version 2 ─────────────────────────────
--
-- Corps de production du 2026-09-25, trois changements :
--   · `p_mode = 'transfer'` : transmettre sans faire partir ni suspendre ;
--   · les projets PORTÉS (`owner_id`, M2) sont transférés ;
--   · un rôle de responsable transféré est RETIRÉ à la source (la 161 le
--     dupliquait : en suspension, l'équipe gardait deux responsables).
CREATE OR REPLACE FUNCTION public.offboard_org_member(
  p_org uuid,
  p_user uuid,
  p_tasks_to uuid DEFAULT NULL,
  p_reports_to uuid DEFAULT NULL,
  p_leads_to uuid DEFAULT NULL,
  p_projects_to uuid DEFAULT NULL,
  p_krs_to uuid DEFAULT NULL,
  p_mode text DEFAULT 'remove'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_parent uuid;
  v_tasks integer := 0;
  v_reports integer := 0;
  v_leads integer := 0;
  v_projects integer := 0;
  v_krs integer := 0;
  v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_mode NOT IN ('remove', 'suspend', 'transfer') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = 'P0001';
  END IF;

  SELECT manager_id INTO v_parent FROM public.organization_members
   WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  FOREACH v_target IN ARRAY ARRAY[p_tasks_to, p_reports_to, p_leads_to, p_projects_to, p_krs_to] LOOP
    IF v_target IS NOT NULL AND (
      v_target = p_user
      OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = p_org AND user_id = v_target)
    ) THEN
      RAISE EXCEPTION 'invalid_target' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  IF p_mode <> 'transfer' THEN
    PERFORM set_config('cosmo.departing_member', p_user::text, true);
  END IF;

  -- En `transfer`, une cible absente veut dire « ne pas toucher » : on ne
  -- désassigne pas quelqu'un qui reste, sauf si on nomme qui reprend.
  IF p_mode <> 'transfer' OR p_tasks_to IS NOT NULL THEN
    UPDATE public.team_tasks t
       SET assignee_ids = (
             SELECT COALESCE(array_agg(DISTINCT u), ARRAY[]::uuid[])
               FROM unnest(array_remove(t.assignee_ids, p_user) ||
                           CASE WHEN p_tasks_to IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[p_tasks_to] END) u
           )
     WHERE t.org_id = p_org
       AND NOT t.completed
       AND t.deleted_at IS NULL
       AND p_user = ANY (t.assignee_ids);
    GET DIAGNOSTICS v_tasks = ROW_COUNT;
  END IF;

  IF p_mode <> 'transfer' OR p_reports_to IS NOT NULL THEN
    UPDATE public.organization_members
       SET manager_id = v_parent
     WHERE org_id = p_org AND user_id = p_reports_to AND manager_id = p_user;
    UPDATE public.organization_members
       SET manager_id = COALESCE(p_reports_to, v_parent)
     WHERE org_id = p_org AND manager_id = p_user;
    GET DIAGNOSTICS v_reports = ROW_COUNT;
  END IF;

  IF p_leads_to IS NOT NULL THEN
    INSERT INTO public.org_team_members (team_id, org_id, user_id, is_lead)
      SELECT tm.team_id, p_org, p_leads_to, true
        FROM public.org_team_members tm
       WHERE tm.org_id = p_org AND tm.user_id = p_user AND tm.is_lead
    ON CONFLICT (team_id, user_id) DO UPDATE SET is_lead = true;
    GET DIAGNOSTICS v_leads = ROW_COUNT;
    UPDATE public.org_team_members SET is_lead = false
     WHERE org_id = p_org AND user_id = p_user AND is_lead;
  END IF;

  IF p_mode <> 'transfer' OR p_projects_to IS NOT NULL THEN
    UPDATE public.team_projects SET owner_id = p_projects_to
     WHERE org_id = p_org AND owner_id = p_user;
    GET DIAGNOSTICS v_projects = ROW_COUNT;
  END IF;

  IF p_mode <> 'transfer' OR p_krs_to IS NOT NULL THEN
    UPDATE public.team_key_results SET assignee_id = p_krs_to
     WHERE org_id = p_org AND assignee_id = p_user;
    GET DIAGNOSTICS v_krs = ROW_COUNT;
  END IF;
  IF p_mode <> 'transfer' THEN
    UPDATE public.team_key_results SET contributor_ids = array_remove(contributor_ids, p_user)
     WHERE org_id = p_org AND p_user = ANY (contributor_ids);
  END IF;

  IF p_mode = 'remove' THEN
    PERFORM public.remove_member(p_org, p_user);
  ELSIF p_mode = 'suspend' THEN
    IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org AND owner_id = p_user) THEN
      RAISE EXCEPTION 'cannot_restrict_owner' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.organization_members SET suspended_at = now()
     WHERE org_id = p_org AND user_id = p_user;
  END IF;

  RETURN jsonb_build_object(
    'tasks', v_tasks, 'reports', v_reports, 'leads', v_leads,
    'projects', v_projects, 'krs', v_krs
  );
END;
$$;
REVOKE ALL ON FUNCTION public.offboard_org_member(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offboard_org_member(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.member_departure_impact(p_org uuid, p_user uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE WHEN NOT public.is_org_admin(p_org) THEN NULL ELSE jsonb_build_object(
    'tasks', (SELECT count(*) FROM public.team_tasks
               WHERE org_id = p_org AND NOT completed AND deleted_at IS NULL
                 AND p_user = ANY (assignee_ids)),
    'reports', (SELECT count(*) FROM public.organization_members
                 WHERE org_id = p_org AND manager_id = p_user),
    'leads', (SELECT count(*) FROM public.org_team_members
               WHERE org_id = p_org AND user_id = p_user AND is_lead),
    'projects', (SELECT count(*) FROM public.team_projects
                  WHERE org_id = p_org AND owner_id = p_user AND archived_at IS NULL
                    AND NOT is_template),
    'krs', (SELECT count(*) FROM public.team_key_results
             WHERE org_id = p_org AND assignee_id = p_user)
  ) END;
$$;
REVOKE ALL ON FUNCTION public.member_departure_impact(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_departure_impact(uuid, uuid) TO authenticated;

-- ─── 5 · Plus d'assignation fantôme ─────────────────────────────────
--
-- Appelé par `remove_member` et `leave_organization` AVANT la suppression de
-- l'appartenance. Les tâches TERMINÉES gardent leur assigné : c'est
-- l'historique de qui a fait quoi, pas une assignation.
CREATE OR REPLACE FUNCTION public.release_member_work(p_org uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.team_tasks
     SET assignee_ids = array_remove(assignee_ids, p_user)
   WHERE org_id = p_org AND NOT completed AND deleted_at IS NULL
     AND assignee_ids @> ARRAY[p_user];
  UPDATE public.team_projects SET owner_id = NULL
   WHERE org_id = p_org AND owner_id = p_user;
  UPDATE public.team_key_results SET contributor_ids = array_remove(contributor_ids, p_user)
   WHERE org_id = p_org AND contributor_ids @> ARRAY[p_user];
  DELETE FROM public.team_task_followers WHERE org_id = p_org AND user_id = p_user;
  DELETE FROM public.team_project_followers WHERE org_id = p_org AND user_id = p_user;
END;
$$;
-- Jamais appelable directement : elle ne vérifie aucun droit, ses deux
-- appelants (DEFINER) l'ont fait avant elle.
REVOKE ALL ON FUNCTION public.release_member_work(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.remove_member(p_org uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_role TEXT;
  v_parent UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can remove members';
  END IF;

  SELECT role, manager_id INTO v_role, v_parent FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;

  PERFORM set_config('cosmo.departing_member', p_user::text, true);

  UPDATE public.organization_members
  SET manager_id = v_parent
  WHERE org_id = p_org AND manager_id = p_user;

  PERFORM public.release_member_work(p_org, p_user);

  DELETE FROM public.org_team_members
  WHERE org_id = p_org AND user_id = p_user;

  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind)
  VALUES (p_org, p_user, auth.uid(), 'org_removed');

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user;

  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = p_user) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = p_user;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_organization(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_role TEXT;
  v_parent UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, manager_id INTO v_role, v_parent FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Transfer the admin role before leaving';
  END IF;

  PERFORM set_config('cosmo.departing_member', auth.uid()::text, true);

  UPDATE public.organization_members
  SET manager_id = v_parent
  WHERE org_id = p_org AND manager_id = auth.uid();

  PERFORM public.release_member_work(p_org, auth.uid());

  DELETE FROM public.org_team_members
  WHERE org_id = p_org AND user_id = auth.uid();

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid();

  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid()) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = auth.uid();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.leave_organization(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_organization(UUID) TO authenticated;

-- ─── 6 · Revues lisibles par qui pilote le périmètre revu ───────────
--
-- Une seule policy SELECT (règle de la mig. 049) : on élargit son OR.
DROP POLICY IF EXISTS "org_weekly_reviews_select" ON public.org_weekly_reviews;
CREATE POLICY "org_weekly_reviews_select" ON public.org_weekly_reviews FOR SELECT
  USING (
    created_by = (SELECT auth.uid())
    OR public.is_org_admin(org_id)
    OR (scope_type = 'team' AND public.is_org_member(org_id) AND EXISTS (
          SELECT 1 FROM public.org_team_members tm
           WHERE tm.team_id = org_weekly_reviews.scope_id
             AND tm.user_id = (SELECT auth.uid()) AND tm.is_lead))
    OR (scope_type = 'project' AND public.is_org_member(org_id) AND EXISTS (
          SELECT 1 FROM public.team_projects p
           WHERE p.id = org_weekly_reviews.scope_id
             AND p.owner_id = (SELECT auth.uid())))
  );

COMMIT;
