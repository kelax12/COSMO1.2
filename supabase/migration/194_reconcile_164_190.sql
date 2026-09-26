-- ═══════════════════════════════════════════════════════════════════
-- 194 · Réconciliation des migrations 164 et 190 (2026-09-26)
--
-- 164 (cas limites, branche swgi0u) et 190 (rôles par projet, branche do9du9)
-- ont été écrites EN PARALLÈLE, chacune depuis le catalogue du 2026-09-25, et
-- redéfinissent toutes les deux quatre fonctions :
--
--   · can_access_team_project   164 : équipes associées (team_project_teams)
--                               190 : membres directs (team_project_members)
--   · my_team_project_ids       mêmes deux ajouts, version ensembliste
--   · member_departure_impact   164 : projets actifs hors modèles
--                               190 : + co-pilotages (role = 'lead')
--   · offboard_org_member       164 : mode `transfer`, responsable retiré
--                               190 : co-pilotages transmis
--
-- Un `CREATE OR REPLACE` écrase : appliquée en second, chacune effaçait l'ajout
-- de l'autre. Une personne d'une équipe ASSOCIÉE perdait la vue du projet
-- (190 après 164), ou un membre direct la perdait (164 après 190), et le mode
-- `transfer` du départ disparaissait.
--
-- 🔴 Ordre : 164, puis 190 à 193, PUIS celle-ci. Elle ne crée rien, elle ne
--    fait que réécrire les quatre corps avec l'UNION des deux versions. Les
--    droits (`GRANT`/`REVOKE`) posés par 161, 164 et 190 sont conservés : un
--    `CREATE OR REPLACE` garde l'ACL de la fonction.
-- ⚠️ Écrite le 2026-09-26, NON appliquée, NON prouvée en transaction annulée.
-- ═══════════════════════════════════════════════════════════════════

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
        -- Équipe porteuse OU équipe associée (mig. 164), pour moi ou mon sous-arbre.
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
        -- Membre direct du projet, quel que soit son rôle (mig. 190).
        OR EXISTS (
          SELECT 1 FROM public.team_project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
  );
$$;

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
  -- Équipes associées (mig. 164).
  SELECT ptt.project_id
  FROM public.team_project_teams ptt
  WHERE ptt.org_id = p_org
    AND ptt.team_id IN (SELECT team_id FROM visible_teams)
  UNION
  -- Membre direct du projet (mig. 190, index user_id, org_id).
  SELECT pm.project_id
  FROM public.team_project_members pm
  WHERE pm.org_id = p_org
    AND pm.user_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM my_membership);
$$;

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
    -- Projets PORTÉS actifs hors modèles (mig. 164) + co-pilotages (mig. 190).
    'projects', (SELECT count(*) FROM public.team_projects
                  WHERE org_id = p_org AND owner_id = p_user AND archived_at IS NULL
                    AND NOT is_template)
              + (SELECT count(*) FROM public.team_project_members
                  WHERE org_id = p_org AND user_id = p_user AND role = 'lead'),
    'krs', (SELECT count(*) FROM public.team_key_results
             WHERE org_id = p_org AND assignee_id = p_user)
  ) END;
$$;

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
  -- `transfer` (mig. 164) : transmettre sans partir.
  IF p_mode NOT IN ('remove', 'suspend', 'transfer') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = 'P0001';
  END IF;

  SELECT manager_id INTO v_parent FROM public.organization_members
   WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Toute cible doit être un membre de l'organisation, et pas la personne qui part.
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
       -- Corbeille (mig. 152) : une tâche supprimée ne se transmet pas.
       AND t.deleted_at IS NULL
       AND p_user = ANY (t.assignee_ids);
    GET DIAGNOSTICS v_tasks = ROW_COUNT;
  END IF;

  -- Subordonnés directs. Si la cible est elle-même un subordonné direct, elle
  -- remonte d'abord d'un cran : sinon elle deviendrait sa propre supérieure.
  IF p_mode <> 'transfer' OR p_reports_to IS NOT NULL THEN
    UPDATE public.organization_members
       SET manager_id = v_parent
     WHERE org_id = p_org AND user_id = p_reports_to AND manager_id = p_user;
    UPDATE public.organization_members
       SET manager_id = COALESCE(p_reports_to, v_parent)
     WHERE org_id = p_org AND manager_id = p_user;
    GET DIAGNOSTICS v_reports = ROW_COUNT;
  END IF;

  -- Rôles de responsable d'équipe : transmis, puis retirés à qui les cède.
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

  -- Projets portés ET co-pilotages (mig. 190).
  IF p_mode <> 'transfer' OR p_projects_to IS NOT NULL THEN
    UPDATE public.team_projects SET owner_id = p_projects_to
     WHERE org_id = p_org AND owner_id = p_user;
    GET DIAGNOSTICS v_projects = ROW_COUNT;
    IF p_projects_to IS NOT NULL THEN
      INSERT INTO public.team_project_members (project_id, user_id, org_id, role)
        SELECT pm.project_id, p_projects_to, p_org, 'lead'
          FROM public.team_project_members pm
         WHERE pm.org_id = p_org AND pm.user_id = p_user AND pm.role = 'lead'
      ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'lead';
    END IF;
  END IF;

  -- KR : responsable transféré, contributeur retiré (sauf en `transfer`).
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
