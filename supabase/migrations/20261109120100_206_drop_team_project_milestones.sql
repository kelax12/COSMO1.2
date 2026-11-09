-- ═══════════════════════════════════════════════════════════════════
-- 206 · Retrait des jalons de projet (2026-09-30)
--
-- Les jalons (mig. 153) doublaient l'échéance d'une tâche de projet : une
-- tâche datée joue déjà ce rôle, et le jalon n'était relié à rien (ni tâche,
-- ni avancement, ni alerte). Le front ne les lit plus depuis le commit
-- « chore(entreprise): retire les jalons de projet ».
--
-- Relu au catalogue le 2026-09-30, AVANT écriture :
--   · `team_project_milestones` : 0 ligne, aucune clé étrangère entrante,
--     aucune vue dépendante ;
--   · quatre fonctions citent la table : `team_project_milestone_before_write`,
--     `get_my_team_project_milestones`, `search_org`, `create_team_project_with_tasks`.
--     Les deux dernières sont réécrites ici DEPUIS `pg_get_functiondef`
--     (identiques aux fichiers 153 et 191), jalons en moins.
--
-- 🔴 ORDRE : appliquer APRÈS le déploiement du front qui ne lit plus les
-- jalons. L'ancien front appelle `get_my_team_project_milestones` à chaque
-- ouverture de l'onglet Projets : appliquée avant, cette migration lui
-- renverrait une erreur.
--
-- `create_team_project_with_tasks` GARDE sa signature à quatre arguments :
-- un onglet resté ouvert sur l'ancien bundle envoie encore `p_milestones`.
-- Le paramètre est accepté et ignoré. `CREATE OR REPLACE` conserve les droits
-- (authenticated oui, anon non), relus au catalogue.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Création atomique : sans jalons ────────────────────────────

CREATE OR REPLACE FUNCTION public.create_team_project_with_tasks(p_org uuid, p_project jsonb, p_tasks jsonb DEFAULT '[]'::jsonb, p_milestones jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_id   uuid := gen_random_uuid();
  v_task jsonb;
BEGIN
  -- `p_milestones` : ignoré depuis la mig. 206, gardé pour les anciens bundles.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF jsonb_typeof(COALESCE(p_tasks, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'create_team_project_with_tasks: tasks must be an array';
  END IF;
  IF jsonb_array_length(COALESCE(p_tasks, '[]'::jsonb)) > 200 THEN
    RAISE EXCEPTION 'create_team_project_with_tasks: too many items (200 tasks)';
  END IF;

  INSERT INTO public.team_projects (
    id, org_id, created_by, name, color, team_id, category_id,
    description, owner_id, status, start_date, due_date, is_template, template_payload
  ) VALUES (
    v_id, p_org, v_uid,
    p_project->>'name',
    COALESCE(NULLIF(p_project->>'color', ''), 'blue'),
    NULLIF(p_project->>'team_id', '')::uuid,
    NULLIF(p_project->>'category_id', '')::uuid,
    NULLIF(p_project->>'description', ''),
    NULLIF(p_project->>'owner_id', '')::uuid,
    COALESCE(NULLIF(p_project->>'status', ''), 'active'),
    NULLIF(p_project->>'start_date', '')::date,
    NULLIF(p_project->>'due_date', '')::date,
    COALESCE((p_project->>'is_template')::boolean, false),
    CASE WHEN jsonb_typeof(p_project->'template_payload') = 'object'
         THEN p_project->'template_payload' END
  );

  FOR v_task IN SELECT * FROM jsonb_array_elements(COALESCE(p_tasks, '[]'::jsonb)) LOOP
    INSERT INTO public.team_tasks (
      org_id, created_by, project_id, name, description, priority,
      deadline, start_date, estimated_time, assignee_ids, status, category_id
    ) VALUES (
      p_org, v_uid, v_id,
      v_task->>'name',
      NULLIF(v_task->>'description', ''),
      COALESCE((v_task->>'priority')::int, 3),
      NULLIF(v_task->>'deadline', '')::date,
      NULLIF(v_task->>'start_date', '')::date,
      (v_task->>'estimated_time')::int,
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_task->'assignee_ids', '[]'::jsonb))::uuid),
        ARRAY[]::uuid[]
      ),
      'todo',
      NULLIF(v_task->>'category_id', '')::uuid
    );
  END LOOP;

  RETURN v_id;
END;
$function$;

-- ── 2. Recherche globale : sans la branche `milestone` ────────────

CREATE OR REPLACE FUNCTION public.search_org(p_org uuid, p_query text, p_limit integer DEFAULT 8)
 RETURNS TABLE(kind text, id uuid, label text, detail text, parent_id uuid)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_q     text := btrim(COALESCE(p_query, ''));
  v_like  text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20);
BEGIN
  IF (SELECT auth.uid()) IS NULL OR char_length(v_q) < 2 OR NOT public.is_org_member(p_org) THEN
    RETURN;
  END IF;
  v_q := left(v_q, 100);
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  (SELECT 'project'::text, p.id, p.name,
          CASE WHEN p.archived_at IS NOT NULL THEN 'archived' ELSE p.status END,
          NULL::uuid
     FROM public.get_my_team_projects(p_org) p
    WHERE NOT p.is_template
      AND (p.name ILIKE v_like OR p.description ILIKE v_like)
    ORDER BY (p.archived_at IS NOT NULL), (p.name ILIKE v_like) DESC, p.name
    LIMIT v_limit)
  UNION ALL
  (SELECT 'task'::text, t.id, t.name,
          CASE WHEN t.completed THEN 'done' ELSE t.status END, t.project_id
     FROM public.get_my_team_tasks(p_org) t
    WHERE t.name ILIKE v_like
    ORDER BY t.completed, t.created_at DESC
    LIMIT v_limit)
  UNION ALL
  (SELECT 'okr'::text, o.id, o.title, o.end_date::text, NULL::uuid
     FROM public.team_okrs o
    WHERE o.org_id = p_org
      AND (o.title ILIKE v_like OR o.description ILIKE v_like)
    ORDER BY o.created_at DESC
    LIMIT v_limit)
  UNION ALL
  (SELECT 'kr'::text, k.id, k.title, NULL::text, k.okr_id
     FROM public.team_key_results k
    WHERE k.org_id = p_org
      AND k.title ILIKE v_like
    ORDER BY k.completed, k.title
    LIMIT v_limit)
  UNION ALL
  (SELECT 'team'::text, tm.id, tm.name, NULL::text, NULL::uuid
     FROM public.org_teams tm
    WHERE tm.org_id = p_org
      AND tm.name ILIKE v_like
    ORDER BY tm.name
    LIMIT v_limit)
  UNION ALL
  (SELECT 'member'::text, om.user_id, COALESCE(NULLIF(pr.display_name, ''), pr.email, ''),
          pr.email, NULL::uuid
     FROM public.organization_members om
     JOIN public.profiles pr ON pr.id = om.user_id
    WHERE om.org_id = p_org
      AND (pr.display_name ILIKE v_like OR pr.email ILIKE v_like)
    ORDER BY pr.display_name
    LIMIT v_limit);
END;
$function$;

-- ── 3. La table et ce qui n'existe que pour elle ──────────────────
-- Pas de CASCADE : une dépendance oubliée doit faire ÉCHOUER la migration,
-- pas disparaître en silence. Le trigger, les index et les policies partent
-- avec la table.

DROP FUNCTION public.get_my_team_project_milestones(uuid);
DROP TABLE public.team_project_milestones;
DROP FUNCTION public.team_project_milestone_before_write();

COMMIT;

-- ── Vérifications (à jouer après application) ─────────────────────
--   SELECT to_regclass('public.team_project_milestones');                     -- NULL
--   SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
--     AND pg_get_functiondef(oid) ILIKE '%team_project_milestone%';          -- 0
--   SELECT has_function_privilege('anon',
--     'public.create_team_project_with_tasks(uuid,jsonb,jsonb,jsonb)', 'EXECUTE'); -- false
--   SELECT has_function_privilege('authenticated',
--     'public.search_org(uuid,text,integer)', 'EXECUTE');                   -- true
