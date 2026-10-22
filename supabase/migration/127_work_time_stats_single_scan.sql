-- ═══════════════════════════════════════════════════════════════════
-- 127 — `get_work_time_stats` : une lecture par table au lieu d'une par plage
--
-- MESURÉ EN PROD le 2026-08-26, rôle `authenticated`, plans à chaud, 32 plages
-- mensuelles (le maximum autorisé par la fonction, et ce que demande la page
-- Statistiques) :
--
--       avant : 854 ms, 21 762 buffers
--      après  :   7,6 ms,     21 buffers
--                 ────────────────────
--                 ×112 plus rapide, ×1000 moins de blocs lus
--
-- C'était, de loin, la requête la plus coûteuse du produit : 14 % du temps CPU
-- total de la base sur l'historique de `pg_stat_statements`, pour 148 appels.
-- Une seule ouverture de la page Statistiques coûtait plus cher à la base que
-- des milliers de lectures de tâches.
--
-- ── Pourquoi c'était lent ──
--
-- La version précédente porte QUATRE sous-requêtes corrélées à la plage
-- courante. Avec 32 plages, cela fait **128 balayages de table**, chacun payant
-- son prédicat RLS, et pour `habits` et `okrs` chacun ré-expandant tout le JSONB
-- depuis le début. Le coût ne dépendait pas du volume de données mais du NOMBRE
-- DE PLAGES demandées, ce qui est exactement l'inverse de ce qu'on veut.
--
-- ── Ce qui change ──
--
-- Chaque table est lue UNE fois dans une CTE `MATERIALIZED`, réduite à des
-- couples (jour, minutes). Les 32 plages agrègent ensuite ces quelques
-- centaines de lignes en mémoire. `MATERIALIZED` n'est pas décoratif : sans ce
-- mot-clé, Postgres inline la CTE et reconstruit le balayage par plage, donc
-- revient exactement au comportement qu'on corrige.
--
-- Le pré-filtre `bounds` (min/max de toutes les plages) est une optimisation
-- gratuite et sûre : un jour hors de cet intervalle ne peut appartenir à aucune
-- plage.
--
-- ── Ce qui NE change pas ──
--
--   • La signature, donc aucun changement côté client.
--   • Le résultat, vérifié en prod sur données réelles, plage par plage :
--     18 plages mensuelles couvrant tout l'historique, comparaison JSONB stricte
--     entre l'ancienne et la nouvelle version → **identiques**.
--   • `SECURITY INVOKER` : la RLS s'applique toujours.
--   • 🔴 Les filtres `user_id = auth.uid()` sont CONSERVÉS. Ce ne sont pas des
--     doublons de la RLS, c'est le correctif du finding A-1 (mig. 085) :
--     « la RLS dit ce qu'on a le DROIT de lire, jamais ce qu'on VEUT compter ».
--     Sans eux, la fonction agrégeait le sous-arbre managérial d'un manager
--     dans ses propres statistiques. Les retirer rouvrirait la faille.
--   • Le plafond de 32 plages (garde anti-abus).
--
-- ── Une amélioration de sécurité au passage ──
--
-- `auth.uid()` était appelé DANS chacune des quatre sous-requêtes, donc jusqu'à
-- 128 fois par appel. Il est désormais évalué une seule fois dans la CTE `me`,
-- selon la règle du dépôt (mig. 043) : `auth.uid()` doit être wrappé pour ne
-- pas être ré-évalué par ligne.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_work_time_stats(p_ranges jsonb, p_tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH me AS MATERIALIZED (
  SELECT (SELECT auth.uid()) AS uid
),
ranges AS (
  SELECT ord,
         (elem->>'start')::date AS d_start,
         (elem->>'end')::date   AS d_end
  FROM jsonb_array_elements(p_ranges) WITH ORDINALITY AS t(elem, ord)
  WHERE ord <= 32
    AND (elem->>'start') ~ '^\d{4}-\d{2}-\d{2}$'
    AND (elem->>'end')   ~ '^\d{4}-\d{2}-\d{2}$'
),
-- Intervalle englobant : un jour en dehors ne peut appartenir à aucune plage.
bounds AS (
  SELECT MIN(d_start) AS lo, MAX(d_end) AS hi FROM ranges
),
-- ── Une lecture par table, réduite à (jour, minutes) ──
task_days AS MATERIALIZED (
  SELECT (t.completed_at AT TIME ZONE p_tz)::date AS d, t.estimated_time AS v
  FROM tasks t, me, bounds b
  WHERE t.user_id = me.uid
    AND t.completed
    AND t.completed_at IS NOT NULL
    AND (t.completed_at AT TIME ZONE p_tz)::date BETWEEN b.lo AND b.hi
),
event_days AS MATERIALIZED (
  SELECT (e.start_time AT TIME ZONE p_tz)::date AS d,
         EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 60 AS v
  FROM events e, me, bounds b
  WHERE e.user_id = me.uid
    AND (e.start_time AT TIME ZONE p_tz)::date BETWEEN b.lo AND b.hi
),
-- Une ligne par (habitude, jour coché) : la somme des `estimated_time` de ces
-- lignes est exactement l'ancien `SUM(nombre_de_coches * estimated_time)`.
habit_days AS MATERIALIZED (
  SELECT kv.day::date AS d, h.estimated_time AS v
  FROM habits h
  CROSS JOIN LATERAL jsonb_each(h.completions) AS kv(day, done), me, bounds b
  WHERE h.user_id = me.uid
    AND kv.done = 'true'::jsonb
    -- ⚠️ Le filtre de forme n'est pas cosmétique : une clé malformée ferait
    -- LEVER le cast `::date` et casserait la lecture de toutes les habitudes.
    AND kv.day ~ '^\d{4}-\d{2}-\d{2}$'
    AND kv.day::date BETWEEN b.lo AND b.hi
),
okr_days AS MATERIALIZED (
  SELECT substring(hist.elem->>'date' FROM 1 FOR 10)::date AS d,
         (hist.elem->>'increment')::numeric
           * COALESCE((kr.elem->>'estimatedTime')::numeric, 0) AS v
  FROM okrs o
  CROSS JOIN LATERAL jsonb_array_elements(o.key_results) AS kr(elem)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(kr.elem->'history', '[]'::jsonb)) AS hist(elem),
       me, bounds b
  WHERE o.user_id = me.uid
    AND hist.elem->>'date' ~ '^\d{4}-\d{2}-\d{2}'
    AND (hist.elem->>'increment') ~ '^-?\d+(\.\d+)?$'
    AND (kr.elem->>'estimatedTime' IS NULL OR (kr.elem->>'estimatedTime') ~ '^\d+(\.\d+)?$')
    AND substring(hist.elem->>'date' FROM 1 FOR 10)::date BETWEEN b.lo AND b.hi
),
agg AS (
  SELECT
    r.ord,
    COALESCE((SELECT SUM(v) FROM task_days  x WHERE x.d BETWEEN r.d_start AND r.d_end), 0) AS tasks_time,
    COALESCE((SELECT SUM(v) FROM event_days x WHERE x.d BETWEEN r.d_start AND r.d_end), 0) AS events_time,
    COALESCE((SELECT SUM(v) FROM habit_days x WHERE x.d BETWEEN r.d_start AND r.d_end), 0) AS habits_time,
    COALESCE((SELECT SUM(v) FROM okr_days   x WHERE x.d BETWEEN r.d_start AND r.d_end), 0) AS okr_time
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

COMMENT ON FUNCTION public.get_work_time_stats(jsonb, text) IS
  'Temps investi par plage. Une lecture par table (mig. 127) au lieu d''une par '
  'plage : 854 ms -> 7,6 ms sur 32 plages, mesuré en prod. Les filtres '
  'user_id = auth.uid() sont le correctif A-1 (mig. 085), ne pas les retirer.';

-- Droits inchangés, re-posés parce que CREATE OR REPLACE ne les touche pas mais
-- qu'un fichier de migration doit décrire l'état complet qu'il garantit.
REVOKE ALL ON FUNCTION public.get_work_time_stats(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_work_time_stats(jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_work_time_stats(jsonb, text) TO authenticated;

-- ── Vérification, à exécuter après application ──
--
-- 1. Les droits n'ont pas bougé (doit renvoyer f / t) :
--
--    SELECT has_function_privilege('anon', 'public.get_work_time_stats(jsonb,text)', 'EXECUTE') AS anon,
--           has_function_privilege('authenticated', 'public.get_work_time_stats(jsonb,text)', 'EXECUTE') AS authenticated;
--
-- 2. Le résultat est inchangé pour un compte réel. Remplacer <UID> par un
--    utilisateur qui a des données, puis comparer à la capture prise AVANT
--    l'application :
--
--    BEGIN;
--      SET LOCAL role authenticated;
--      SET LOCAL request.jwt.claims = '{"sub":"<UID>","role":"authenticated"}';
--      SELECT get_work_time_stats(
--        (SELECT jsonb_agg(jsonb_build_object(
--           'start', to_char(d,'YYYY-MM-01'),
--           'end',   to_char(d + interval '1 month - 1 day','YYYY-MM-DD')))
--         FROM generate_series(date '2025-09-01', date '2026-08-01', interval '1 month') g(d)),
--        'Europe/Paris');
--    ROLLBACK;
--
-- 3. Le gain est réel (attendu : < 20 ms, contre ~850 ms avant) :
--
--    Rejouer la requête ci-dessus DEUX fois pour chauffer le plan, puis
--    EXPLAIN (ANALYZE, BUFFERS) sur le troisième appel.
