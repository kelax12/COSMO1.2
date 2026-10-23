-- Migration 225 · `get_admin_stats` rend l'activation 48 h par jour d'inscription.
--
-- ÉTAT : APPLIQUÉE le 2026-10-23, ledger `20261023142003` (CLI `db query -f`,
-- fichier verbatim, ligne de ledger insérée dans la même transaction).
-- Prouvée AVANT en transaction annulée, session admin aal2 simulée : sommes
-- par jour = cumul (38 inscrits, 22 activés, 32 jours) ; corps vivant relu
-- identique hors commentaires et hors cette clé ; md5 de prod inchangé après
-- le ROLLBACK. Après : clé présente, anon refusé, authenticated autorisé.
--
-- ── Le défaut ─────────────────────────────────────────────────────────────
-- COSMO Analytics, vue d'ensemble, « Parcours des utilisateurs » : Visiteurs et
-- Inscrits suivent la période choisie (7 j, 30 j…), mais « Activés sous 48 h »
-- lisait `activation_48h`, un cumul depuis le premier compte. Relevé le
-- 2026-10-20 sur 7 jours : 2 inscrits → 20 activés. L'étape ne se lisait plus.
--
-- ── Ce que fait la 225 ────────────────────────────────────────────────────
-- Ajoute UNE clé, `activation_48h_by_day` : [{day, activated, total}] par jour
-- UTC d'inscription, calculée sur la même CTE `u` que `activation_48h` (même
-- définition de l'activation, mêmes comptes exclus). Le tableau de bord en fait
-- la somme sur la période. Aucune autre clé ne change : le corps est celui relu
-- au catalogue le 2026-10-20, recopié tel quel hors cette clé. Garde, ACL,
-- SECURITY DEFINER et search_path inchangés.
--
-- Vérification après application (lecture seule, session admin aal2) :
--   SELECT (SELECT sum((x->>'total')::int) FROM jsonb_array_elements(s->'activation_48h_by_day') x)
--        = (s->'activation_48h'->>'total')::int
--      AND (SELECT sum((x->>'activated')::int) FROM jsonb_array_elements(s->'activation_48h_by_day') x)
--        = (s->'activation_48h'->>'activated')::int
--   FROM (SELECT public.get_admin_stats() s) t;   -- doit rendre true

CREATE OR REPLACE FUNCTION public.get_admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  result   jsonb;
  v3       jsonb;
  excluded uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  excluded := public.admin_stats_excluded_uids();

  -- ══ v1 (mig. 056) + v2 (mig. 057) ══════════════════════════════════
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'excluded_accounts', COALESCE(array_length(excluded, 1), 0),
    'totals', jsonb_build_object(
      'users', (SELECT COUNT(*) FROM auth.users WHERE id <> ALL(excluded)),
      'active_today', (SELECT COUNT(*) FROM public.profiles
                       WHERE id <> ALL(excluded)
                         AND last_seen_at >= date_trunc('day', NOW())),
      'active_7d', (SELECT COUNT(*) FROM public.profiles
                    WHERE id <> ALL(excluded)
                      AND last_seen_at >= NOW() - INTERVAL '7 days'),
      'inactive_7d_plus', (SELECT COUNT(*) FROM public.profiles
                           WHERE id <> ALL(excluded)
                             AND (last_seen_at IS NULL
                                  OR last_seen_at < NOW() - INTERVAL '7 days')),
      'inactive_30d_plus', (SELECT COUNT(*) FROM public.profiles
                            WHERE id <> ALL(excluded)
                              AND (last_seen_at IS NULL
                                   OR last_seen_at < NOW() - INTERVAL '30 days'))
    ),
    'signups_by_day', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS cnt
        FROM auth.users WHERE id <> ALL(excluded) GROUP BY 1
      ) d
    ),
    'dau', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', a.day, 'count', a.cnt) ORDER BY a.day), '[]'::jsonb)
      FROM (
        SELECT day, COUNT(*) AS cnt FROM public.user_activity_days
        WHERE user_id <> ALL(excluded) GROUP BY day
      ) a
    ),
    -- ⚠️ `demo_devices` compte des APPAREILS, pas des comptes : non filtrée.
    'demo', (
      SELECT jsonb_build_object(
        'visitors', COUNT(*),
        'converted', COUNT(converted_at),
        'conversion_pct', COALESCE(ROUND(100.0 * COUNT(converted_at) / NULLIF(COUNT(*), 0), 1), 0)
      ) FROM public.demo_devices
    ),
    'usage', jsonb_build_object(
      'tasks',        (SELECT COUNT(*) FROM public.tasks  WHERE user_id <> ALL(excluded)),
      'habits',       (SELECT COUNT(*) FROM public.habits WHERE user_id <> ALL(excluded)),
      'events',       (SELECT COUNT(*) FROM public.events WHERE user_id <> ALL(excluded)),
      'okrs',         (SELECT COUNT(*) FROM public.okrs   WHERE user_id <> ALL(excluded)),
      'shared_tasks', (SELECT COUNT(*) FROM public.shared_tasks st
                       WHERE st.shared_by <> ALL(excluded))
    ),
    'signups_by_provider', (
      SELECT COALESCE(jsonb_object_agg(p.provider, p.cnt), '{}'::jsonb)
      FROM (
        SELECT COALESCE(raw_app_meta_data->>'provider', 'email') AS provider, COUNT(*) AS cnt
        FROM auth.users WHERE id <> ALL(excluded) GROUP BY 1
      ) p
    ),
    'adoption', jsonb_build_object(
      'tasks_users',  (SELECT COUNT(DISTINCT user_id) FROM public.tasks  WHERE user_id <> ALL(excluded)),
      'habits_users', (SELECT COUNT(DISTINCT user_id) FROM public.habits WHERE user_id <> ALL(excluded)),
      'events_users', (SELECT COUNT(DISTINCT user_id) FROM public.events WHERE user_id <> ALL(excluded)),
      'okrs_users',   (SELECT COUNT(DISTINCT user_id) FROM public.okrs   WHERE user_id <> ALL(excluded))
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
      ) FROM auth.users u WHERE u.id <> ALL(excluded)
    ),
    'tasks_completion', (
      SELECT jsonb_build_object(
        'completed', COUNT(*) FILTER (WHERE completed),
        'total', COUNT(*)
      ) FROM public.tasks WHERE user_id <> ALL(excluded)
    ),
    'collaboration', jsonb_build_object(
      'sharers', (SELECT COUNT(DISTINCT t.user_id)
                  FROM public.shared_tasks st JOIN public.tasks t ON t.id = st.task_id
                  WHERE t.user_id <> ALL(excluded)),
      'users_with_friends', (SELECT COUNT(DISTINCT user_id) FROM public.friends
                             WHERE user_id <> ALL(excluded)),
      'accepted_requests', (SELECT COUNT(*) FROM public.friend_requests
                            WHERE status = 'accepted' AND sender_id <> ALL(excluded))
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
        WHERE u.id <> ALL(excluded)
        GROUP BY 1
      ) c
    ),
    'stickiness', jsonb_build_object(
      'dau', (SELECT COUNT(DISTINCT user_id) FROM public.user_activity_days
              WHERE day = CURRENT_DATE AND user_id <> ALL(excluded)),
      'mau', (SELECT COUNT(DISTINCT user_id) FROM public.user_activity_days
              WHERE day >= CURRENT_DATE - 29 AND user_id <> ALL(excluded))
    )
  ) INTO result;

  -- ══ v3 (mig. 099), pack acquisition ═══════════════════════════════
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
      (au.created_at <= NOW() - INTERVAL '14 days') AS d7_eligible,
      EXISTS (
        SELECT 1 FROM public.user_activity_days a
        WHERE a.user_id = au.id
          AND a.day BETWEEN (au.created_at AT TIME ZONE 'UTC')::date + 7
                        AND (au.created_at AT TIME ZONE 'UTC')::date + 13
      ) AS retained_d7
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id <> ALL(excluded)
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
    -- ── 225 : la même activation, par jour UTC d'inscription ──────────
    'activation_48h_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', a.signup_day, 'activated', a.activated, 'total', a.total)
        ORDER BY a.signup_day
      ), '[]'::jsonb)
      FROM (
        SELECT signup_day,
               COUNT(*) FILTER (WHERE activated_48h) AS activated,
               COUNT(*) AS total
        FROM u GROUP BY 1
      ) a
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
    -- ⚠️ `organizations` n'est PAS filtrée (cf. mig. 099).
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
$function$;
