-- ═══════════════════════════════════════════════════════════════════
-- 074_work_time_stats.sql — RPC d'agrégation « temps investi »
-- ═══════════════════════════════════════════════════════════════════
--
-- Déplace le calcul du graphique « Temps investi » de StatisticsPage
-- (audit perf 2026-07-15) du client vers Postgres : au lieu de charger
-- toutes les entités puis réduire en JS, le client reçoit un bucket
-- d'agrégats par plage de dates (payload ~1 kB).
--
-- SÉMANTIQUE : réplique exactement src/lib/workTimeCalculator.ts
-- (calculateWorkTimeForPeriod) — dates LOCALES inclusives, d'où le
-- paramètre p_tz (fuseau IANA du navigateur) :
--   - tasksTime  = Σ estimated_time des tâches complétées dans la plage
--   - eventsTime = Σ durée (minutes) des events dont le début est dans la plage
--   - habitsTime = Σ (complétions dans la plage × estimated_time)
--   - okrTime    = Σ (increments d'history dans la plage × estimatedTime du KR)
--                  (history vit dans le JSONB okrs.key_results — cf. TOCTOU-4)
--
-- SÉCURITÉ : SECURITY INVOKER — la RLS de tasks/events/habits/okrs
-- filtre les lignes de l'utilisateur appelant. Aucune donnée d'autrui
-- n'est accessible. Garde anti-abus : max 32 plages par appel.

CREATE OR REPLACE FUNCTION get_work_time_stats(p_ranges jsonb, p_tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH ranges AS (
  SELECT ord,
         (elem->>'start')::date AS d_start,
         (elem->>'end')::date   AS d_end
  FROM jsonb_array_elements(p_ranges) WITH ORDINALITY AS t(elem, ord)
  WHERE ord <= 32
    AND (elem->>'start') ~ '^\d{4}-\d{2}-\d{2}$'
    AND (elem->>'end')   ~ '^\d{4}-\d{2}-\d{2}$'
),
agg AS (
  SELECT
    r.ord,
    COALESCE((
      SELECT SUM(t.estimated_time)
      FROM tasks t
      WHERE t.completed
        AND t.completed_at IS NOT NULL
        AND (t.completed_at AT TIME ZONE p_tz)::date BETWEEN r.d_start AND r.d_end
    ), 0) AS tasks_time,
    COALESCE((
      SELECT SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 60)
      FROM events e
      WHERE (e.start_time AT TIME ZONE p_tz)::date BETWEEN r.d_start AND r.d_end
    ), 0) AS events_time,
    COALESCE((
      SELECT SUM(c.cnt * h.estimated_time)
      FROM habits h
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM jsonb_each(h.completions) AS kv(day, done)
        WHERE kv.done = 'true'::jsonb
          AND kv.day ~ '^\d{4}-\d{2}-\d{2}$'
          AND kv.day::date BETWEEN r.d_start AND r.d_end
      ) c
    ), 0) AS habits_time,
    COALESCE((
      SELECT SUM(
        (hist.elem->>'increment')::numeric
        * COALESCE((kr.elem->>'estimatedTime')::numeric, 0)
      )
      FROM okrs o
      CROSS JOIN LATERAL jsonb_array_elements(o.key_results) AS kr(elem)
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(kr.elem->'history', '[]'::jsonb)) AS hist(elem)
      WHERE hist.elem->>'date' ~ '^\d{4}-\d{2}-\d{2}'
        AND (hist.elem->>'increment') ~ '^-?\d+(\.\d+)?$'
        AND (kr.elem->>'estimatedTime' IS NULL OR (kr.elem->>'estimatedTime') ~ '^\d+(\.\d+)?$')
        AND substring(hist.elem->>'date' FROM 1 FOR 10)::date BETWEEN r.d_start AND r.d_end
    ), 0) AS okr_time
  FROM ranges r
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'tasksTime',  ROUND(tasks_time)::int,
  'eventsTime', ROUND(events_time)::int,
  'habitsTime', ROUND(habits_time)::int,
  'okrTime',    ROUND(okr_time)::int,
  'totalTime',  ROUND(tasks_time + events_time + habits_time + okr_time)::int
) ORDER BY ord), '[]'::jsonb)
FROM agg;
$$;

-- Réservée aux utilisateurs connectés (la RLS fait le reste).
REVOKE ALL ON FUNCTION get_work_time_stats(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_work_time_stats(jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION get_work_time_stats(jsonb, text) TO authenticated;
