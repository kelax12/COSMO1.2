-- ═══════════════════════════════════════════════════════════════════
-- 136 — `get_work_time_stats` : le temps OKR vient de `kr_completions`
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE. La CTE `okr_days` de la mig. 127 lisait
-- `kr.elem->'history'`, un tableau `{date, increment}` porté par chaque Key
-- Result dans le JSONB `okrs.key_results`.
--
-- **Ce champ n'existe pas.** Il est absent de l'interface `KeyResult`
-- (`src/modules/okrs/types.ts`), absent des mappers, et aucun écrivain du
-- produit ne le pose (vérifié le 2026-09-02 : `grep "history:" src` rend zéro
-- résultat). `COALESCE(kr.elem->'history', '[]'::jsonb)` rendait donc toujours
-- un tableau vide, `okr_days` était toujours vide, et **`okrTime` valait
-- structurellement 0** — pour tout le monde, depuis que la fonction existe.
--
-- La page Statistiques affichait donc « 0 min » sur les OKR en production,
-- pendant que les deux graphiques du tableau de bord affichaient le bon
-- chiffre : eux lisaient `kr_completions`, chacun avec sa propre copie du
-- calcul. Trois implémentations, deux justes, et c'est la fausse qui servait
-- l'écran dédié aux statistiques.
--
-- ── LA SOURCE RÉELLE ────────────────────────────────────────────────
--
-- `kr_completions` (mig. 009) est le journal append-only des complétions :
-- **une ligne = une rep**, écrite par `recordKRReps`
-- (`src/modules/okrs/supabase.repository.ts`). C'est le remplaçant de
-- `history`, et la seule source qui existe réellement.
--
-- Le temps investi sur les OKR pendant une plage vaut donc :
--
--     Σ (minutes estimées du KR référencé) pour chaque complétion de la plage
--
-- ce qui est exactement le calcul du client après ce correctif
-- (`okrTimeForPeriod`, `src/lib/workTimeCalculator.ts`). Les deux sont
-- désormais la même formule sur la même table.
--
-- ── POURQUOI UN REPLI SUR LE JSONB ─────────────────────────────────
--
-- `kr_completions.kr_id` n'a PAS de clé étrangère vers `key_results`, et c'est
-- délibéré : les OKR créés avant la table dédiée (mig. 008) n'ont leurs KR que
-- dans le JSONB `okrs.key_results`, et le repository sait encore les lire par
-- ce chemin. Une jointure interne sur `key_results` ferait donc silencieusement
-- retomber ces comptes-là à zéro, c'est-à-dire remplacerait un bug par le même
-- bug pour une partie des utilisateurs.
--
-- `kr_minutes` réunit donc les deux sources, la table d'abord (`src = 1`), le
-- JSONB en repli (`src = 2`), et `DISTINCT ON` tranche. Sans ce classement, un
-- KR présent des deux côtés avec deux valeurs produirait DEUX lignes, donc un
-- double comptage.
--
-- ── CE QUI NE CHANGE PAS ────────────────────────────────────────────
--
--   • La signature, donc aucun changement côté client.
--   • `SECURITY INVOKER` : la RLS s'applique toujours.
--   • 🔴 Les filtres `user_id = auth.uid()` (correctif A-1, mig. 085) sont
--     conservés partout, `kr_completions` comprise. « La RLS dit ce qu'on a le
--     DROIT de lire, jamais ce qu'on VEUT compter. »
--   • Le motif « une lecture par table, puis agrégation en mémoire » de la
--     mig. 127 : `kr_completions` et les deux sources de minutes sont lues une
--     fois chacune, jamais une fois par plage.
--   • Le plafond de 32 plages.
--
-- ⚠️ Cette migration CHANGE UN RÉSULTAT, contrairement à la 127 qui devait le
-- préserver à l'identique. C'est le but : `okrTime` passe de 0 à sa vraie
-- valeur. Ne pas la valider en comparant avant/après.
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
-- Minutes estimées par KR. Table dédiée d'abord, JSONB en repli pour les OKR
-- antérieurs à la mig. 008 (cf. l'en-tête : une jointure interne les perdrait).
kr_minutes_raw AS (
  SELECT kr.id AS kr_id, kr.estimated_time::numeric AS minutes, 1 AS src
  FROM key_results kr, me
  WHERE kr.user_id = me.uid
  UNION ALL
  SELECT (e.elem->>'id')::uuid,
         COALESCE(NULLIF(e.elem->>'estimatedTime', '')::numeric, 0),
         2
  FROM okrs o
  CROSS JOIN LATERAL jsonb_array_elements(o.key_results) AS e(elem), me
  WHERE o.user_id = me.uid
    -- Les KR les plus anciens portaient un id non-UUID (`${Date.now()}-${i}`) ;
    -- sans ce filtre, le cast `::uuid` LÈVE et casse toute la fonction.
    AND e.elem->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (e.elem->>'estimatedTime' IS NULL OR (e.elem->>'estimatedTime') ~ '^\d+(\.\d+)?$')
),
kr_minutes AS MATERIALIZED (
  -- `DISTINCT ON` tranche entre les deux sources. Sans lui, un KR présent des
  -- deux côtés avec deux valeurs produirait deux lignes, donc un DOUBLE
  -- COMPTAGE de chacune de ses complétions.
  SELECT DISTINCT ON (kr_id) kr_id, minutes
  FROM kr_minutes_raw
  ORDER BY kr_id, src
),
-- Une ligne par complétion de KR : le journal `kr_completions` fait foi.
-- Une complétion dont le KR a disparu compte 0 minute (LEFT JOIN) plutôt que
-- de disparaître : on n'invente pas une durée, on ne perd pas la trace.
okr_days AS MATERIALIZED (
  SELECT (c.completed_at AT TIME ZONE p_tz)::date AS d,
         COALESCE(m.minutes, 0) AS v
  FROM kr_completions c
  LEFT JOIN kr_minutes m ON m.kr_id = c.kr_id, me, bounds b
  WHERE c.user_id = me.uid
    AND (c.completed_at AT TIME ZONE p_tz)::date BETWEEN b.lo AND b.hi
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
  'Temps investi par plage. Une lecture par table (mig. 127). Le temps OKR vient '
  'du journal kr_completions (mig. 136) : la version precedente lisait un champ '
  'kr.history qui n''existe pas, donc okrTime valait toujours 0. Les filtres '
  'user_id = auth.uid() sont le correctif A-1 (mig. 085), ne pas les retirer.';

-- Index de lecture du journal par compte et par date : c'est exactement le
-- prédicat de `okr_days`. Sans lui, la CTE balaie tout `kr_completions`.
CREATE INDEX IF NOT EXISTS idx_kr_completions_user_completed_at
  ON public.kr_completions (user_id, completed_at);

-- Droits inchangés, re-posés parce que CREATE OR REPLACE ne les touche pas mais
-- qu'un fichier de migration doit décrire l'état complet qu'il garantit.
REVOKE ALL ON FUNCTION public.get_work_time_stats(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_work_time_stats(jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_work_time_stats(jsonb, text) TO authenticated;

-- ── Vérification, à exécuter APRÈS application ──
--
-- ⚠️ Ne PAS valider en comparant avant/après : cette migration change
-- volontairement `okrTime`. Ce qu'il faut vérifier, c'est qu'il cesse d'être
-- nul là où des complétions existent, et que rien d'autre ne bouge.
--
-- 1. Les droits n'ont pas bougé (doit renvoyer f / t) :
--
--    SELECT has_function_privilege('anon', 'public.get_work_time_stats(jsonb,text)', 'EXECUTE') AS anon,
--           has_function_privilege('authenticated', 'public.get_work_time_stats(jsonb,text)', 'EXECUTE') AS authenticated;
--
-- 2. `okrTime` n'est plus nul pour un compte qui a des complétions. Choisir un
--    <UID> tel que `SELECT count(*) FROM kr_completions WHERE user_id = '<UID>'`
--    soit non nul, puis :
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
-- 3. Le SQL et le client rendent le MÊME chiffre. Le client calcule
--    `Σ estimated_time du KR` par complétion de la plage ; la même chose en SQL,
--    pour une plage donnée, doit correspondre bucket à bucket :
--
--    SELECT SUM(COALESCE(kr.estimated_time, 0))
--    FROM kr_completions c
--    LEFT JOIN key_results kr ON kr.id = c.kr_id
--    WHERE c.user_id = '<UID>'
--      AND (c.completed_at AT TIME ZONE 'Europe/Paris')::date BETWEEN '<lo>' AND '<hi>';
--
-- 4. Les trois autres catégories sont INCHANGÉES. Comparer `tasksTime`,
--    `eventsTime` et `habitsTime` à une capture prise avant l'application :
--    seules les valeurs `okrTime` et `totalTime` doivent différer.
