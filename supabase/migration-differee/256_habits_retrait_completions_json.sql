-- ═══════════════════════════════════════════════════════════════════
-- 256 · Retrait de `habits.completions` (DAT-02, phase « contract »)
--
-- 🔴 À APPLIQUER SEULEMENT APRÈS que plus aucun lecteur ni écrivain de la
-- colonne ne subsiste, et après vérification :
--   1. le front livré avec « habitudes sur `habit_completions` seule » est en
--      production depuis au moins sept jours (onglets restés sur un ancien
--      bundle rechargés : `NewVersionBanner`) : l'ancien bundle lit la colonne
--      (`getPage`) et recrée une habitude « Annuler » par la colonne ;
--   2. le CLI agent (`scripts/cosmo/api.mjs`) lit `get_my_habits` et bascule par
--      `toggle_habit_completion_v2` (la v1, retirée ici, écrivait la colonne) ;
--   3. relecture au catalogue : 0 habitude dont un jour `true` de la colonne
--      manque dans la table (requête en tête de la preuve 256) ; la garde
--      ci-dessous le refait et REFUSE sinon. Un jour présent en table et absent
--      de la colonne est NORMAL : un « Annuler » n'écrit plus que la table ;
--   4. la preuve 256 rend « PREUVE-ANNULEE 0 ECHEC ».
-- Rangée dans `supabase/migration-differee/` : aucune base rejouée ne la voit
-- (la CI teste l'état de transition, celui de la production). Le jour de
-- l'application, la DÉPLACER dans `supabase/migration/` dans le même commit que
-- la relecture du catalogue, puis régénérer le contrat de données (schéma,
-- inventaire RPC, types) et faire entrer `habit_completions` dans `EXPORTS` de
-- `scripts/check-portability-export.mjs` (RGPD art. 20 : le jour où la colonne
-- disparaît, la table devient la seule source de l'historique exporté).
--
-- ── CE QUE FAIT CE FICHIER ─────────────────────────────────────────
--
--   · garde : verrou de `habits`, puis vérification qu'aucun jour de la colonne
--     ne manque dans la table (inclusion, pas égalité : la table peut avoir plus) ;
--   · retire le trigger `trg_habit_completions_mirror` et sa fonction ;
--   · recrée `toggle_habit_completion_v2` SANS la recopie dans la colonne (corps
--     de la 254, à la lettre, moins ce `UPDATE`) ;
--   · retire `toggle_habit_completion(uuid, text)` (v1) : elle bascule la
--     colonne, elle n'a plus d'objet ;
--   · retire la colonne `habits.completions`.
-- `get_my_habits` et `get_work_time_stats` lisent déjà la table (248, 254) :
-- ils ne sont pas touchés. `habit_day_from_key` reste (utilisée par le toggle).
--
-- Rejouable : sans la colonne, la garde ne lit rien et les DROP sont
-- `IF EXISTS`. Preuve : `supabase/proofs/256.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

-- ── Garde ──────────────────────────────────────────────────────────
-- Le verrou tient jusqu'au COMMIT : aucune coche ne peut s'écrire entre la
-- comparaison et le retrait.
LOCK TABLE public.habits IN SHARE ROW EXCLUSIVE MODE;

DO $garde$
DECLARE
  n bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'habits' AND column_name = 'completions'
  ) THEN
    EXECUTE $q$
      SELECT count(*) FROM public.habits h
       WHERE EXISTS (
         SELECT 1 FROM jsonb_each(COALESCE(h.completions, '{}'::jsonb)) e
          WHERE e.value = 'true'::jsonb
            AND public.habit_day_from_key(e.key) IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.habit_completions c
                             WHERE c.habit_id = h.id AND c.user_id = h.user_id
                               AND c.day = public.habit_day_from_key(e.key)))
    $q$ INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION '256 : % habitude(s) dont des jours de la colonne completions manquent dans habit_completions, rien n''est retire', n;
    END IF;
  END IF;
END
$garde$;

-- ── Plus de recopie colonne → table ────────────────────────────────
DROP TRIGGER IF EXISTS trg_habit_completions_mirror ON public.habits;
DROP FUNCTION IF EXISTS public.habit_completions_mirror();

-- ── Bascule sans recopie colonne ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_habit_completion_v2(
  p_habit_id UUID,
  p_date     TEXT,
  p_days     INTEGER DEFAULT 400,
  p_today    DATE    DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  name                  TEXT,
  description           TEXT,
  frequency             TEXT,
  estimated_time        INTEGER,
  color                 TEXT,
  icon                  TEXT,
  completions           JSONB,
  user_id               UUID,
  created_at            TIMESTAMPTZ,
  streak_current        INTEGER,
  streak_best           INTEGER,
  completions_total     INTEGER,
  first_completion_date DATE,
  window_days           INTEGER,
  scheduled_days        SMALLINT[],
  schedule_history      JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid     UUID := (SELECT auth.uid());
  v_id      UUID;
  v_day     DATE;
  v_on      BOOLEAN;
  v_planned BOOLEAN;
  v_win     INTEGER := GREATEST(1, LEAST(COALESCE(p_days, 400), 3650));
  v_today   DATE := GREATEST(CURRENT_DATE - 1,
                             LEAST(COALESCE(p_today, CURRENT_DATE), CURRENT_DATE + 1));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Forme ET calendrier : `2026-02-30` est refusé ici (mig. 248).
  v_day := public.habit_day_from_key(p_date);
  IF v_day IS NULL THEN
    RAISE EXCEPTION 'Invalid date format (expected YYYY-MM-DD)';
  END IF;

  -- Verrou de la ligne d'habitude : deux bascules concurrentes du même jour
  -- se sérialisent (correctif TOCTOU-1, mig. 023). Ne JAMAIS décider sans.
  SELECT h.id,
         (h.scheduled_days IS NOT NULL OR jsonb_array_length(h.schedule_history) > 0)
    INTO v_id, v_planned
    FROM public.habits h
   WHERE h.id = p_habit_id
     AND h.user_id = v_uid   -- défense en profondeur (la RLS filtre déjà)
   FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;

  -- Un jour non prévu n'est PAS refusé : décocher une coche ancienne doit
  -- rester possible, et la coche y est neutre pour la série.
  DELETE FROM public.habit_completions c
   WHERE c.habit_id = v_id AND c.user_id = v_uid AND c.day = v_day;
  v_on := NOT FOUND;
  IF v_on THEN
    INSERT INTO public.habit_completions (habit_id, user_id, day)
    VALUES (v_id, v_uid, v_day);
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT c.day AS d
    FROM public.habit_completions c
    WHERE c.habit_id = v_id
      AND c.user_id = v_uid
      AND c.day <= v_today
  ),
  totals AS (
    SELECT COUNT(*)::int AS total, MIN(d) AS first_day FROM days
  ),
  -- ── Sans jours prévus : calcul de la 248, à la lettre ──
  grouped AS (
    SELECT d, d - (row_number() OVER (ORDER BY d))::int AS island
    FROM days WHERE NOT v_planned
  ),
  runs AS (
    SELECT island, COUNT(*)::int AS len, MAX(d) AS last_day
    FROM grouped GROUP BY island
  ),
  agg_plain AS (
    SELECT MAX(r.len) AS best,
           COALESCE(MAX(r.len) FILTER (WHERE r.last_day >= (v_today - 1)), 0) AS current
    FROM runs r
  ),
  -- ── Avec jours prévus : même méthode que get_my_habits ──
  sched AS (
    SELECT g.d::date AS d,
           (dy.d IS NOT NULL) AS is_done,
           row_number() OVER (ORDER BY g.d) AS rn
    FROM public.habits h
    CROSS JOIN totals t
    CROSS JOIN LATERAL generate_series(
      GREATEST(t.first_day, v_today - 3650), v_today, interval '1 day'
    ) AS g(d)
    LEFT JOIN days dy ON dy.d = g.d::date
    WHERE v_planned
      AND h.id = v_id
      AND t.first_day IS NOT NULL
      AND public.habit_day_scheduled(h.scheduled_days, h.schedule_history, g.d::date)
  ),
  last_sched AS (
    SELECT rn AS last_rn, d AS last_d, is_done AS last_done
    FROM sched ORDER BY rn DESC LIMIT 1
  ),
  islands AS (
    SELECT rn, rn - row_number() OVER (ORDER BY rn) AS island
    FROM sched WHERE is_done
  ),
  sruns AS (
    SELECT island, COUNT(*)::int AS len, MAX(rn) AS end_rn
    FROM islands GROUP BY island
  ),
  agg_planned AS (
    SELECT MAX(r.len) AS best,
           COALESCE(MAX(r.len) FILTER (
             WHERE r.end_rn >= ls.last_rn
                   - CASE WHEN ls.last_d = v_today AND NOT ls.last_done THEN 1 ELSE 0 END
           ), 0) AS current
    FROM sruns r CROSS JOIN last_sched ls
  ),
  agg AS (
    SELECT best, current FROM agg_plain WHERE NOT v_planned
    UNION ALL
    SELECT best, current FROM agg_planned WHERE v_planned
  )
  SELECT
    h.id, h.name, h.description, h.frequency, h.estimated_time, h.color, h.icon,
    COALESCE(
      (SELECT jsonb_object_agg(to_char(c.day, 'YYYY-MM-DD'), true)
         FROM public.habit_completions c
        WHERE c.habit_id = v_id
          AND c.user_id = v_uid
          AND c.day >= v_today - v_win),
      '{}'::jsonb
    ),
    h.user_id, h.created_at,
    COALESCE((SELECT a.current FROM agg a), 0)::int,
    COALESCE((SELECT a.best    FROM agg a), 0)::int,
    COALESCE((SELECT t.total   FROM totals t), 0)::int,
    (SELECT t.first_day FROM totals t),
    v_win,
    h.scheduled_days,
    h.schedule_history
  FROM public.habits h
  WHERE h.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER, DATE) TO authenticated;

COMMENT ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER, DATE) IS
  'Bascule d un jour dans habit_completions, sous verrou de la ligne d habitude '
  '(mig. 248). Series sur les seuls jours PREVUS (mig. 254). La colonne '
  'habits.completions n existe plus (mig. 256). `p_today` : date LOCALE du client (mig. 122).';

-- ── Plus de v1 ─────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.toggle_habit_completion(uuid, text);

-- ── Plus de colonne ────────────────────────────────────────────────
ALTER TABLE public.habits DROP COLUMN IF EXISTS completions;

COMMENT ON TABLE public.habit_completions IS
  'DAT-02 : un jour coche par ligne (date LOCALE du client, fuseaux geles C-03). '
  'Absence = non coche. Seule source de l historique des habitudes depuis la '
  'mig. 256 (habits.completions retiree).';

COMMENT ON FUNCTION public.habit_day_from_key(text) IS
  'Cle YYYY-MM-DD vers une date, ou NULL si ce n est pas une date reelle. '
  'Ne leve jamais (mig. 248).';
