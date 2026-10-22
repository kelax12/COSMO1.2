-- ═══════════════════════════════════════════════════════════════════
-- 213 · Entonnoir des accueils (perso et entreprise), console admin
--
-- POURQUOI. Les deux accueils ont été refaits le 2026-10-03 pour une raison
-- chiffrée : 50 % des inscrits ne revenaient jamais après leur session
-- d'inscription (mesuré le 2026-08-28). Sans mesure, impossible de dire si la
-- refonte change quoi que ce soit. Or il n'existe AUCUN traçage client pour
-- les comptes connectés, et c'est voulu (`src/lib/audience.ts` : aucun
-- script tiers ne doit pouvoir lire un jeton de session). La mesure se fait
-- donc ici, côté base, à partir de ce que les accueils CRÉENT : une tâche,
-- une habitude, un objectif, un créneau relié à une tâche ; pour une
-- entreprise, une équipe, un projet, un objectif d'entreprise.
--
-- Aucune donnée nouvelle n'est collectée : la fonction compte des lignes qui
-- existent déjà, par cohorte d'inscription, et ne renvoie que des totaux.
--
-- Fenêtre : « dans les 24 h après l'inscription » pour l'accueil (c'est la
-- session d'inscription et sa reprise du lendemain), « revenu » = une
-- activité entre J+7 et J+14 (`user_activity_days`, déjà tenue).
--
-- Garde : `is_admin()` (allowlist ET session aal2, mig. 131), jamais
-- `admin_allowlisted()`. Comptes exclus : la SEULE liste du dépôt
-- (`admin_stats_excluded_uids()`, mig. 149).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_admin_onboarding_funnel(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  excluded uuid[];
  since    timestamptz;
  result   jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  excluded := public.admin_stats_excluded_uids();
  -- Bornée : une fenêtre absurde ne doit pas balayer toute la base.
  since := NOW() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365));

  WITH cohort AS (
    SELECT u.id, u.created_at, COALESCE(p.account_type, 'personal') AS account_type
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.created_at >= since
      AND u.id <> ALL(excluded)
  ),
  perso AS (
    SELECT
      c.id,
      EXISTS (SELECT 1 FROM public.tasks t WHERE t.user_id = c.id
                AND t.created_at < c.created_at + INTERVAL '1 day') AS has_task,
      EXISTS (SELECT 1 FROM public.events e WHERE e.user_id = c.id AND e.task_id IS NOT NULL
                AND e.created_at < c.created_at + INTERVAL '1 day') AS has_slot,
      EXISTS (SELECT 1 FROM public.habits h WHERE h.user_id = c.id
                AND h.created_at < c.created_at + INTERVAL '1 day') AS has_habit,
      EXISTS (SELECT 1 FROM public.okrs o WHERE o.user_id = c.id
                AND o.created_at < c.created_at + INTERVAL '1 day') AS has_okr,
      EXISTS (SELECT 1 FROM public.user_activity_days a WHERE a.user_id = c.id
                AND a.day >= (c.created_at + INTERVAL '7 days')::date
                AND a.day <  (c.created_at + INTERVAL '14 days')::date) AS came_back,
      c.created_at <= NOW() - INTERVAL '14 days' AS mature
    FROM cohort c
  ),
  orgs AS (
    SELECT
      o.id,
      EXISTS (SELECT 1 FROM public.org_teams t WHERE t.org_id = o.id
                AND t.created_at < o.created_at + INTERVAL '1 day') AS has_team,
      EXISTS (SELECT 1 FROM public.team_projects tp WHERE tp.org_id = o.id
                AND tp.created_at < o.created_at + INTERVAL '1 day') AS has_project,
      EXISTS (SELECT 1 FROM public.team_okrs k WHERE k.org_id = o.id
                AND k.created_at < o.created_at + INTERVAL '1 day') AS has_okr,
      (SELECT COUNT(*) FROM public.organization_members m WHERE m.org_id = o.id) > 1 AS has_member
    FROM public.organizations o
    WHERE o.created_at >= since
      AND o.owner_id <> ALL(excluded)
  )
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'window_days', LEAST(GREATEST(COALESCE(p_days, 30), 1), 365),
    'perso', (
      SELECT jsonb_build_object(
        'signups', COUNT(*),
        'with_task', COUNT(*) FILTER (WHERE has_task),
        'with_slot', COUNT(*) FILTER (WHERE has_slot),
        'with_habit', COUNT(*) FILTER (WHERE has_habit),
        'with_okr', COUNT(*) FILTER (WHERE has_okr),
        -- Le retour ne se juge que sur les inscrits d'au moins 14 jours.
        'mature', COUNT(*) FILTER (WHERE mature),
        'came_back', COUNT(*) FILTER (WHERE mature AND came_back),
        'came_back_with_task', COUNT(*) FILTER (WHERE mature AND came_back AND has_task),
        'mature_with_task', COUNT(*) FILTER (WHERE mature AND has_task)
      ) FROM perso
    ),
    'business_signups', (SELECT COUNT(*) FROM cohort WHERE account_type = 'business'),
    'orgs', (
      SELECT jsonb_build_object(
        'created', COUNT(*),
        'with_team', COUNT(*) FILTER (WHERE has_team),
        'with_member', COUNT(*) FILTER (WHERE has_member),
        'with_project', COUNT(*) FILTER (WHERE has_project),
        'with_okr', COUNT(*) FILTER (WHERE has_okr)
      ) FROM orgs
    )
  ) INTO result;

  RETURN result;
END;
$function$;

COMMENT ON FUNCTION public.get_admin_onboarding_funnel(integer) IS
  'Entonnoir des accueils perso et entreprise, par cohorte d''inscription (mig. 213). '
  'Totaux seulement, garde is_admin().';

REVOKE ALL ON FUNCTION public.get_admin_onboarding_funnel(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_onboarding_funnel(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_onboarding_funnel(integer) TO authenticated;
