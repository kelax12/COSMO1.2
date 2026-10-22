-- ═══════════════════════════════════════════════════════════════════
-- Migration 099 — Stats admin v3 (pack acquisition)
--
-- Étend get_admin_stats() (mig. 056 puis 057) de façon STRICTEMENT
-- ADDITIVE — règle posée par la 057 : les clés existantes sont conservées
-- à l'identique, un client 056/057 encore en cache Vercel continue de
-- fonctionner. Les nouvelles clés sont ajoutées par `result || v3`.
--
-- Nouvelles clés :
--   signups_by_source          — inscriptions par canal (?ref=, mig. 097)
--   signups_by_source_by_day   — la même chose ventilée par jour : c'est la
--                                vue qui pilote les décisions « couper /
--                                doubler » du plan d'acquisition 30 jours
--   activation_48h             — activation à 48 h, globale ET par canal
--                                (dit si un canal amène des curieux ou des
--                                utilisateurs)
--   orgs                       — objectif « 10 Entreprise » : il se compte
--                                en orgs ayant ≥ 3 membres DISTINCTS, pas en
--                                orgs créées (une org à 1 membre est un
--                                compte perso avec un chapeau)
--   retention_d7_by_source     — rétention J+7 par canal, sur les seules
--                                cohortes dont la fenêtre est complète
--
-- Le canal est lu sur profiles.acquisition_source (mig. 097) ; NULL (compte
-- créé avant l'attribution, ou visiteur direct) est agrégé sous 'unknown' —
-- jamais masqué, sinon les totaux ne se réconcilient plus.
--
-- Même garde admin (RAISE 42501), même style (SECURITY DEFINER,
-- search_path = '', agrégations par jour/semaine en UTC — voulu).
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  v3     jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- ══ v1 (mig. 056) + v2 (mig. 057) — inchangé ═══════════════════════
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'totals', jsonb_build_object(
      'users', (SELECT COUNT(*) FROM auth.users),
      'active_today', (SELECT COUNT(*) FROM public.profiles
                       WHERE last_seen_at >= date_trunc('day', NOW())),
      'active_7d', (SELECT COUNT(*) FROM public.profiles
                    WHERE last_seen_at >= NOW() - INTERVAL '7 days'),
      'inactive_7d_plus', (SELECT COUNT(*) FROM public.profiles
                           WHERE last_seen_at IS NULL
                              OR last_seen_at < NOW() - INTERVAL '7 days'),
      'inactive_30d_plus', (SELECT COUNT(*) FROM public.profiles
                            WHERE last_seen_at IS NULL
                               OR last_seen_at < NOW() - INTERVAL '30 days')
    ),
    'signups_by_day', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS cnt
        FROM auth.users GROUP BY 1
      ) d
    ),
    'dau', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', a.day, 'count', a.cnt) ORDER BY a.day), '[]'::jsonb)
      FROM (
        SELECT day, COUNT(*) AS cnt FROM public.user_activity_days GROUP BY day
      ) a
    ),
    'demo', (
      SELECT jsonb_build_object(
        'visitors', COUNT(*),
        'converted', COUNT(converted_at),
        'conversion_pct', COALESCE(ROUND(100.0 * COUNT(converted_at) / NULLIF(COUNT(*), 0), 1), 0)
      ) FROM public.demo_devices
    ),
    'usage', jsonb_build_object(
      'tasks',        (SELECT COUNT(*) FROM public.tasks),
      'habits',       (SELECT COUNT(*) FROM public.habits),
      'events',       (SELECT COUNT(*) FROM public.events),
      'okrs',         (SELECT COUNT(*) FROM public.okrs),
      'shared_tasks', (SELECT COUNT(*) FROM public.shared_tasks)
    ),
    -- ── v2 (mig. 057) ────────────────────────────────────────────────
    'signups_by_provider', (
      SELECT COALESCE(jsonb_object_agg(p.provider, p.cnt), '{}'::jsonb)
      FROM (
        SELECT COALESCE(raw_app_meta_data->>'provider', 'email') AS provider, COUNT(*) AS cnt
        FROM auth.users GROUP BY 1
      ) p
    ),
    'adoption', jsonb_build_object(
      'tasks_users',  (SELECT COUNT(DISTINCT user_id) FROM public.tasks),
      'habits_users', (SELECT COUNT(DISTINCT user_id) FROM public.habits),
      'events_users', (SELECT COUNT(DISTINCT user_id) FROM public.events),
      'okrs_users',   (SELECT COUNT(DISTINCT user_id) FROM public.okrs)
    ),
    'activation_24h', (
      SELECT jsonb_build_object(
        'activated', COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.user_id = u.id AND t.created_at <= u.created_at + INTERVAL '24 hours'
          ) OR EXISTS (
            SELECT 1 FROM public.habits h
            WHERE h.user_id = u.id AND h.created_at <= u.created_at + INTERVAL '24 hours'
          ) OR EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.user_id = u.id AND e.created_at <= u.created_at + INTERVAL '24 hours'
          ) OR EXISTS (
            SELECT 1 FROM public.okrs o
            WHERE o.user_id = u.id AND o.created_at <= u.created_at + INTERVAL '24 hours'
          )),
        'total', COUNT(*)
      ) FROM auth.users u
    ),
    'tasks_completion', (
      SELECT jsonb_build_object(
        'completed', COUNT(*) FILTER (WHERE completed),
        'total', COUNT(*)
      ) FROM public.tasks
    ),
    'collaboration', jsonb_build_object(
      'sharers', (SELECT COUNT(DISTINCT t.user_id)
                  FROM public.shared_tasks st JOIN public.tasks t ON t.id = st.task_id),
      'users_with_friends', (SELECT COUNT(DISTINCT user_id) FROM public.friends),
      'accepted_requests', (SELECT COUNT(*) FROM public.friend_requests WHERE status = 'accepted')
    ),
    'retention_j7', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('week', c.week, 'signups', c.signups, 'retained', c.retained)
        ORDER BY c.week
      ), '[]'::jsonb)
      FROM (
        SELECT
          date_trunc('week', u.created_at)::date AS week,
          COUNT(*) AS signups,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM public.user_activity_days a
            WHERE a.user_id = u.id
              AND a.day BETWEEN (u.created_at AT TIME ZONE 'UTC')::date + 7
                            AND (u.created_at AT TIME ZONE 'UTC')::date + 13
          )) AS retained
        FROM auth.users u
        GROUP BY 1
      ) c
    ),
    'stickiness', jsonb_build_object(
      'dau', (SELECT COUNT(DISTINCT user_id) FROM public.user_activity_days WHERE day = CURRENT_DATE),
      'mau', (SELECT COUNT(DISTINCT user_id) FROM public.user_activity_days
              WHERE day >= CURRENT_DATE - 29)
    )
  ) INTO result;

  -- ══ v3 (mig. 099) — pack acquisition ═══════════════════════════════
  -- Une seule passe sur auth.users ⋈ profiles : le canal, la date
  -- d'inscription et les flags d'activation/rétention sont calculés
  -- ensemble, puis agrégés de quatre façons.
  WITH u AS (
    SELECT
      au.id,
      au.created_at,
      (au.created_at AT TIME ZONE 'UTC')::date AS signup_day,
      COALESCE(NULLIF(p.acquisition_source, ''), 'unknown') AS source,
      (
        EXISTS (SELECT 1 FROM public.tasks t
                WHERE t.user_id = au.id AND t.created_at <= au.created_at + INTERVAL '48 hours')
        OR EXISTS (SELECT 1 FROM public.habits h
                   WHERE h.user_id = au.id AND h.created_at <= au.created_at + INTERVAL '48 hours')
        OR EXISTS (SELECT 1 FROM public.events e
                   WHERE e.user_id = au.id AND e.created_at <= au.created_at + INTERVAL '48 hours')
        OR EXISTS (SELECT 1 FROM public.okrs o
                   WHERE o.user_id = au.id AND o.created_at <= au.created_at + INTERVAL '48 hours')
      ) AS activated_48h,
      -- Cohorte J+7 « éligible » : la fenêtre J+7..J+13 doit être écoulée,
      -- sinon un canal lancé hier afficherait 0 % de rétention et serait coupé
      -- à tort.
      (au.created_at <= NOW() - INTERVAL '14 days') AS d7_eligible,
      EXISTS (
        SELECT 1 FROM public.user_activity_days a
        WHERE a.user_id = au.id
          AND a.day BETWEEN (au.created_at AT TIME ZONE 'UTC')::date + 7
                        AND (au.created_at AT TIME ZONE 'UTC')::date + 13
      ) AS retained_d7
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
  )
  SELECT jsonb_build_object(
    'signups_by_source', (
      SELECT COALESCE(jsonb_object_agg(s.source, s.cnt), '{}'::jsonb)
      FROM (SELECT source, COUNT(*) AS cnt FROM u GROUP BY 1) s
    ),
    'signups_by_source_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', d.signup_day, 'source', d.source, 'count', d.cnt)
        ORDER BY d.signup_day, d.source
      ), '[]'::jsonb)
      FROM (
        SELECT signup_day, source, COUNT(*) AS cnt FROM u GROUP BY 1, 2
      ) d
    ),
    'activation_48h', jsonb_build_object(
      'activated', (SELECT COUNT(*) FILTER (WHERE activated_48h) FROM u),
      'total',     (SELECT COUNT(*) FROM u),
      'by_source', (
        SELECT COALESCE(jsonb_object_agg(
          a.source, jsonb_build_object('activated', a.activated, 'total', a.total)
        ), '{}'::jsonb)
        FROM (
          SELECT source,
                 COUNT(*) FILTER (WHERE activated_48h) AS activated,
                 COUNT(*) AS total
          FROM u GROUP BY 1
        ) a
      )
    ),
    'retention_d7_by_source', (
      SELECT COALESCE(jsonb_object_agg(
        r.source, jsonb_build_object('signups', r.signups, 'retained', r.retained)
      ), '{}'::jsonb)
      FROM (
        SELECT source,
               COUNT(*) AS signups,
               COUNT(*) FILTER (WHERE retained_d7) AS retained
        FROM u WHERE d7_eligible GROUP BY 1
      ) r
    ),
    'orgs', (
      SELECT jsonb_build_object(
        'total',                   COUNT(*),
        'created_30d',             COUNT(*) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days'),
        'with_3plus_members',      COUNT(*) FILTER (WHERE m.members >= 3),
        'with_3plus_members_30d',  COUNT(*) FILTER (WHERE m.members >= 3
                                                      AND o.created_at >= NOW() - INTERVAL '30 days')
      )
      FROM public.organizations o
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT om.user_id) AS members
        FROM public.organization_members om
        WHERE om.org_id = o.id
      ) m ON TRUE
    )
  ) INTO v3;

  RETURN result || v3;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
