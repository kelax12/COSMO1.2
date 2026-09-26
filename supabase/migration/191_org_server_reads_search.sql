-- ═══════════════════════════════════════════════════════════════════
-- 191 · Les chiffres se comptent en base, et tout se CHERCHE en base
--        (recommandations de l'étape 6, 2026-09-25)
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE.
--
--   1. « Chiffres faux, objets masqués ». L'avancement d'un projet (Projets),
--      la charge d'un membre (annuaire) se calculaient dans le navigateur, sur
--      l'ensemble de travail plafonné à 1 000 tâches. Au-delà, le plafond
--      coupait des tâches EN SILENCE, et la barre d'avancement d'un projet
--      mentait sans que rien ne le dise (le bandeau `TruncatedDataNotice`
--      prévient qu'une liste est tronquée, pas qu'un pourcentage est faux).
--   2. « Rien n'est trouvable ». La palette (Ctrl+K) ne cherchait côté serveur
--      que les tâches ; projets, OKR, équipes et membres étaient filtrés dans
--      des caches qu'elle faisait CHARGER EN ENTIER à la première frappe.
--      Jalons et résultats clés n'étaient pas cherchables du tout.
--
-- ── RÈGLES ─────────────────────────────────────────────────────────
--
--   · Toutes ces fonctions sont `SECURITY INVOKER` : elles AGRÈGENT des
--     lectures (`get_my_team_tasks`, `get_my_team_projects`, …) dont
--     l'autorisation est déjà écrite ailleurs. Agréger des lectures, oui ;
--     réécrire des autorisations, jamais (mig. 129).
--   · La date du jour vient du CLIENT (`p_today`, date locale) : `current_date`
--     est celle du serveur, en UTC, et un retard ne commence pas à minuit UTC
--     pour quelqu'un à Montréal (règle du fuseau, `src/lib/CLAUDE.md`).
--   · Recherche : jokers d'ILIKE échappés, requête d'au moins 2 caractères,
--     résultats bornés PAR TYPE (une borne globale laisserait les tâches
--     noyer tout le reste).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Avancement des projets, compté en base ──────────────────────

CREATE OR REPLACE FUNCTION public.get_team_project_task_stats(p_org uuid, p_today date)
RETURNS TABLE (
  project_id    uuid,
  total         integer,
  completed     integer,
  overdue       integer,
  in_review     integer,
  next_deadline date
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT t.project_id,
         count(*)::int,
         count(*) FILTER (WHERE t.completed)::int,
         count(*) FILTER (WHERE NOT t.completed AND t.deadline < p_today)::int,
         count(*) FILTER (WHERE t.status = 'review')::int,
         min(t.deadline) FILTER (WHERE NOT t.completed AND t.deadline >= p_today)
    FROM public.get_my_team_tasks(p_org) t
   GROUP BY t.project_id;
$function$;

REVOKE ALL ON FUNCTION public.get_team_project_task_stats(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_project_task_stats(uuid, date) TO authenticated;

-- ── 2. Charge des membres, comptée en base ────────────────────────

CREATE OR REPLACE FUNCTION public.get_team_member_workload(p_org uuid, p_today date)
RETURNS TABLE (
  user_id     uuid,
  open_tasks  integer,
  overdue     integer,
  due_7_days  integer,
  estimated_minutes integer
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT a.uid,
         count(*)::int,
         count(*) FILTER (WHERE t.deadline < p_today)::int,
         count(*) FILTER (WHERE t.deadline >= p_today AND t.deadline < p_today + 7)::int,
         COALESCE(sum(t.estimated_time), 0)::int
    FROM public.get_my_team_tasks(p_org) t
   CROSS JOIN LATERAL unnest(COALESCE(t.assignee_ids, ARRAY[]::uuid[])) AS a(uid)
   WHERE NOT t.completed
   GROUP BY a.uid;
$function$;

REVOKE ALL ON FUNCTION public.get_team_member_workload(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_member_workload(uuid, date) TO authenticated;

-- ── 3. Recherche globale ──────────────────────────────────────────
--
-- Une ligne par résultat : `kind` (project, milestone, task, okr, kr, team,
-- member), l'identifiant, un libellé, un détail court et l'identifiant du
-- parent (projet d'un jalon ou d'une tâche, objectif d'un KR). Chaque
-- branche lit par un chemin déjà autorisé :
--   · projets, jalons, tâches : RPC indexables (`my_team_project_ids`) ;
--   · objectifs et KR : `team_okrs` / `team_key_results` sous leur RLS
--     (`can_access_team_okr`, qui exclut la corbeille des OKR, mig. 193) ;
--   · équipes et membres : sous la RLS de `org_teams`, `organization_members`
--     et `profiles`.

CREATE OR REPLACE FUNCTION public.search_org(p_org uuid, p_query text, p_limit integer DEFAULT 8)
RETURNS TABLE (
  kind      text,
  id        uuid,
  label     text,
  detail    text,
  parent_id uuid
)
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
  (SELECT 'milestone'::text, m.id, m.name, m.due_date::text, m.project_id
     FROM public.get_my_team_project_milestones(p_org) m
    WHERE m.name ILIKE v_like
    ORDER BY m.due_date
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

REVOKE ALL ON FUNCTION public.search_org(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_org(uuid, text, integer) TO authenticated;

COMMIT;

-- ── Vérifications (à jouer après application) ─────────────────────
--   SELECT prosecdef FROM pg_proc WHERE proname IN
--     ('search_org', 'get_team_project_task_stats', 'get_team_member_workload');  -- false ×3
--   SELECT has_function_privilege('anon', 'public.search_org(uuid,text,integer)', 'EXECUTE');  -- false
