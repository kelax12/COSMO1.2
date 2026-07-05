-- ═══════════════════════════════════════════════════════════════════
-- Migration 057 — Stats admin v2 (pack avancé)
-- Étend get_admin_stats() (mig. 056) de façon ADDITIVE (les clés
-- existantes sont conservées à l'identique — un client 056 encore en
-- cache Vercel continue de fonctionner) :
--   totals.inactive_30d_plus, signups_by_provider, adoption,
--   activation_24h, tasks_completion, collaboration, retention_j7,
--   stickiness (dau/mau).
-- Même garde admin (RAISE 42501), même style (SECURITY DEFINER,
-- search_path = '', agrégations par jour/semaine en UTC — voulu).
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

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

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
