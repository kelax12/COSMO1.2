-- ═══════════════════════════════════════════════════════════════════
-- 251 · Habitudes : jours prévus (ex-242 du chantier, réécrite sur la 248)
--
-- ── CE QUE FAIT LA FONCTIONNALITÉ ──────────────────────────────────
--
-- Une habitude peut ne valoir que certains jours de la semaine (lun, mer,
-- ven…). Règles produit :
--   · absent = tous les jours (NULL en base, défaut de toute ligne
--     existante : AUCUNE série existante ne bouge à l'application) ;
--   · un jour non prévu est NEUTRE pour la série : elle passe d'un jour
--     prévu au suivant sans casser ni s'allonger ;
--   · changer les jours ne rejuge pas le passé : chaque changement est daté
--     dans `schedule_history`, un jour se juge avec le réglage en vigueur CE
--     jour-là, et avant le premier changement daté, tous les jours valent.
--
-- ── CE QUE POSE CE FICHIER ─────────────────────────────────────────
--
--   · `habits.scheduled_days SMALLINT[] NULL` (0 = dimanche … 6 = samedi,
--     `Date.getDay()` côté client, `EXTRACT(DOW)` ici) et
--     `habits.schedule_history JSONB NOT NULL DEFAULT '[]'`
--     ([{"from":"YYYY-MM-DD","days":[1,3,5]}, …], 100 entrées au plus),
--     chacune bornée par un CHECK ;
--   · `habit_day_scheduled(days, history, d)` : « ce jour est-il prévu ? »,
--     miroir de `isHabitScheduledOn` (`src/modules/habits/schedule.ts`) ;
--   · `get_my_habits` et `toggle_habit_completion_v2` : corps de la 248
--     (lecture de la TABLE `habit_completions`, miroir de la colonne
--     conservé dans le toggle, `p_today` du client borné à ± 1 jour,
--     mig. 122), plus deux colonnes de retour (`scheduled_days`,
--     `schedule_history`). Une habitude SANS jours prévus garde le calcul de
--     la 248 à la lettre (îlots de dates consécutives) ; une habitude AVEC
--     jours prévus compte ses séries sur la suite de ses seuls jours prévus.
--     `completions_total` et `first_completion_date` gardent leur sens :
--     toutes les coches, prévues ou non. Cocher un jour non prévu reste
--     permis (décocher une coche ancienne doit rester possible).
--   · `get_work_time_stats` n'est PAS touchée : le temps investi compte
--     toutes les coches, prévues ou non.
--
-- ⚠️ Les deux RPC changent de type de retour : `CREATE OR REPLACE` le
-- refuse, d'où DROP puis CREATE dans la même transaction, droits reposés à
-- l'identique (REVOKE PUBLIC/anon, GRANT authenticated).
--
-- ── ORDRE DE DÉPLOIEMENT ───────────────────────────────────────────
--
-- À appliquer AVANT le front qui écrit les colonnes. L'ancien front n'est
-- pas gêné : il n'écrit pas ces colonnes (défaut NULL / '[]'), et les deux
-- colonnes de retour en plus sont ignorées par son mapper.
--
-- Idempotente / rejouable. Preuve : `supabase/proofs/251.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

-- ── Validation de l'historique (pour le CHECK) ─────────────────────
--
-- Une clé `from` invalide ferait lever le cast `::date` à la lecture et
-- rendrait toutes les habitudes de la personne illisibles : refusée à
-- l'écriture. `habit_day_from_key` (mig. 248) ne lève jamais.
CREATE OR REPLACE FUNCTION public.habit_schedule_history_valid(p_history jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT p_history IS NULL
    OR (jsonb_typeof(p_history) = 'array'
        AND jsonb_array_length(p_history) <= 100
        AND NOT EXISTS (
          SELECT 1
            FROM jsonb_array_elements(p_history) e
           WHERE jsonb_typeof(e) <> 'object'
              OR jsonb_typeof(e -> 'from') IS DISTINCT FROM 'string'
              OR public.habit_day_from_key(e ->> 'from') IS NULL
              OR jsonb_typeof(e -> 'days') IS DISTINCT FROM 'array'
              OR jsonb_array_length(e -> 'days') NOT BETWEEN 1 AND 7
              OR EXISTS (
                   SELECT 1
                     FROM jsonb_array_elements(e -> 'days') d
                    WHERE jsonb_typeof(d) <> 'number'
                       OR d::text !~ '^[0-6]$')));
$$;

REVOKE ALL ON FUNCTION public.habit_schedule_history_valid(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.habit_schedule_history_valid(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.habit_schedule_history_valid(jsonb) TO authenticated, service_role;

-- ── Colonnes ───────────────────────────────────────────────────────
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS scheduled_days   smallint[] NULL,
  ADD COLUMN IF NOT EXISTS schedule_history jsonb      NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_scheduled_days_check;
ALTER TABLE public.habits ADD CONSTRAINT habits_scheduled_days_check CHECK (
  scheduled_days IS NULL
  OR (cardinality(scheduled_days) BETWEEN 1 AND 7
      AND scheduled_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
      AND array_position(scheduled_days, NULL) IS NULL)
);

ALTER TABLE public.habits DROP CONSTRAINT IF EXISTS habits_schedule_history_check;
ALTER TABLE public.habits ADD CONSTRAINT habits_schedule_history_check CHECK (
  public.habit_schedule_history_valid(schedule_history)
);

COMMENT ON COLUMN public.habits.scheduled_days IS
  'Jours prevus en vigueur, 0 = dimanche (EXTRACT(DOW)). NULL = tous les jours (mig. 251).';
COMMENT ON COLUMN public.habits.schedule_history IS
  'Changements dates des jours prevus [{from, days}] : un jour se juge avec le reglage '
  'en vigueur ce jour-la, le passe n est jamais rejuge (mig. 251).';

-- ── « Ce jour est-il prévu ? » (miroir de `isHabitScheduledOn`) ────
--
-- Avec un historique : l'entrée la plus récente dont `from` <= d (à `from`
-- égal, la dernière écrite l'emporte, comme en JS) ; avant la première,
-- tous les jours. Sans historique : `scheduled_days`, NULL = tous les jours.
CREATE OR REPLACE FUNCTION public.habit_day_scheduled(p_days smallint[], p_history jsonb, p_d date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN COALESCE(jsonb_array_length(p_history), 0) > 0 THEN
      COALESCE((
        SELECT (e.value -> 'days') @> to_jsonb(EXTRACT(DOW FROM p_d)::int)
          FROM jsonb_array_elements(p_history) WITH ORDINALITY AS e(value, pos)
         WHERE (e.value ->> 'from')::date <= p_d
         ORDER BY (e.value ->> 'from')::date DESC, e.pos DESC
         LIMIT 1
      ), true)
    ELSE
      p_days IS NULL
      OR cardinality(p_days) = 0
      OR EXTRACT(DOW FROM p_d)::smallint = ANY (p_days)
  END;
$$;

REVOKE ALL ON FUNCTION public.habit_day_scheduled(smallint[], jsonb, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.habit_day_scheduled(smallint[], jsonb, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.habit_day_scheduled(smallint[], jsonb, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.habit_day_scheduled(smallint[], jsonb, date) IS
  'Vrai si le jour est prevu pour l habitude (reglage en vigueur ce jour-la). '
  'Miroir de isHabitScheduledOn, src/modules/habits/schedule.ts (mig. 251).';

-- ═══════════════════════════════════════════════════════════════════
-- get_my_habits : corps de la 248, séries sur les jours prévus
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_my_habits(INTEGER, DATE);

CREATE FUNCTION public.get_my_habits(
  p_days  INTEGER DEFAULT 400,
  p_today DATE    DEFAULT NULL
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
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH params AS (
    SELECT
      GREATEST(1, LEAST(COALESCE(p_days, 400), 3650)) AS win,
      -- « Aujourd'hui » selon le CLIENT, borné à ± 1 jour autour du serveur
      -- (mig. 122 : la base est en UTC, les jours sont en date locale).
      GREATEST(CURRENT_DATE - 1,
               LEAST(COALESCE(p_today, CURRENT_DATE), CURRENT_DATE + 1)) AS today
  ),
  hab AS (
    -- Une habitude « planifiée » a un réglage autre que tous les jours.
    SELECT h.id, h.scheduled_days, h.schedule_history,
           (h.scheduled_days IS NOT NULL
            OR jsonb_array_length(h.schedule_history) > 0) AS planned
    FROM public.habits h
  ),
  days AS (
    SELECT c.habit_id, c.day AS d
    FROM public.habit_completions c
    CROSS JOIN params p
    -- Jours futurs exclus, relativement au client (mig. 122).
    WHERE c.day <= p.today
  ),
  totals AS (
    SELECT habit_id, COUNT(*)::int AS total, MIN(d) AS first_day
    FROM days GROUP BY habit_id
  ),
  -- ── Sans jours prévus : calcul de la 248, à la lettre ──
  grouped AS (
    SELECT dy.habit_id, dy.d,
           dy.d - (row_number() OVER (PARTITION BY dy.habit_id ORDER BY dy.d))::int AS island
    FROM days dy
    JOIN hab ON hab.id = dy.habit_id AND NOT hab.planned
  ),
  runs AS (
    SELECT habit_id, island, COUNT(*)::int AS len, MAX(d) AS last_day
    FROM grouped
    GROUP BY habit_id, island
  ),
  agg_plain AS (
    SELECT
      r.habit_id,
      MAX(r.len) AS best,
      -- Série EN COURS : celle qui touche aujourd'hui ou hier, du point de vue
      -- du client. Même règle que `streak.ts`, à la lettre.
      COALESCE(MAX(r.len) FILTER (
        WHERE r.last_day >= ((SELECT today FROM params) - 1)
      ), 0) AS current
    FROM runs r
    GROUP BY r.habit_id
  ),
  -- ── Avec jours prévus : îlots sur la suite des seuls jours prévus ──
  -- Les jours prévus du premier jour coché à aujourd'hui (3 650 au plus),
  -- numérotés (rn). Deux jours prévus successifs cochés sont consécutifs même
  -- si un jour non prévu les sépare ; une coche un jour non prévu est neutre.
  sched AS (
    SELECT hab.id AS habit_id, g.d::date AS d,
           (dy.d IS NOT NULL) AS is_done,
           row_number() OVER (PARTITION BY hab.id ORDER BY g.d) AS rn
    FROM hab
    JOIN totals t ON t.habit_id = hab.id
    CROSS JOIN params p
    CROSS JOIN LATERAL generate_series(
      GREATEST(t.first_day, p.today - 3650), p.today, interval '1 day'
    ) AS g(d)
    LEFT JOIN days dy ON dy.habit_id = hab.id AND dy.d = g.d::date
    WHERE hab.planned
      AND public.habit_day_scheduled(hab.scheduled_days, hab.schedule_history, g.d::date)
  ),
  last_sched AS (
    SELECT DISTINCT ON (habit_id) habit_id, rn AS last_rn, d AS last_d, is_done AS last_done
    FROM sched ORDER BY habit_id, rn DESC
  ),
  islands AS (
    SELECT habit_id, rn, rn - row_number() OVER (PARTITION BY habit_id ORDER BY rn) AS island
    FROM sched WHERE is_done
  ),
  sruns AS (
    SELECT habit_id, island, COUNT(*)::int AS len, MAX(rn) AS end_rn
    FROM islands GROUP BY habit_id, island
  ),
  agg_planned AS (
    -- Série EN COURS : l'îlot qui touche le dernier jour prévu <= today, ou
    -- l'avant-dernier si ce dernier est AUJOURD'HUI et pas encore coché (la
    -- journée n'est pas finie). Même règle que `streak.ts`.
    SELECT r.habit_id,
           MAX(r.len) AS best,
           COALESCE(MAX(r.len) FILTER (
             WHERE r.end_rn >= ls.last_rn
                   - CASE WHEN ls.last_d = (SELECT today FROM params) AND NOT ls.last_done
                          THEN 1 ELSE 0 END
           ), 0) AS current
    FROM sruns r
    JOIN last_sched ls ON ls.habit_id = r.habit_id
    GROUP BY r.habit_id
  ),
  agg AS (
    SELECT habit_id, best, current FROM agg_plain
    UNION ALL
    SELECT habit_id, best, current FROM agg_planned
  )
  SELECT
    h.id, h.name, h.description, h.frequency, h.estimated_time, h.color, h.icon,
    -- Fenêtre bornée : seuls les jours cochés (l'absence vaut « non coché »).
    COALESCE(
      (SELECT jsonb_object_agg(to_char(c.day, 'YYYY-MM-DD'), true)
         FROM public.habit_completions c
        WHERE c.habit_id = h.id
          AND c.user_id = h.user_id
          AND c.day >= p.today - p.win),
      '{}'::jsonb
    ) AS completions,
    h.user_id, h.created_at,
    COALESCE(a.current, 0)::int,
    COALESCE(a.best, 0)::int,
    COALESCE(t.total, 0)::int,
    t.first_day,
    p.win,
    h.scheduled_days,
    h.schedule_history
  FROM public.habits h
  CROSS JOIN params p
  LEFT JOIN totals t ON t.habit_id = h.id
  LEFT JOIN agg a ON a.habit_id = h.id
  ORDER BY h.created_at DESC, h.id DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_habits(INTEGER, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_habits(INTEGER, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_habits(INTEGER, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_my_habits(INTEGER, DATE) IS
  'Lecture bornee des habitudes, depuis habit_completions (mig. 248). '
  '`completions` = jours coches des p_days derniers jours ; series sur les seuls '
  'jours PREVUS (mig. 251) et totaux sur l historique ENTIER. `p_today` est la '
  'date LOCALE du client (bornee a CURRENT_DATE +/- 1, mig. 122).';

-- ═══════════════════════════════════════════════════════════════════
-- toggle_habit_completion_v2 : corps de la 248, même calcul, une habitude
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.toggle_habit_completion_v2(UUID, TEXT, INTEGER, DATE);

CREATE FUNCTION public.toggle_habit_completion_v2(
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

  -- Miroir de transition (mig. 248) : la colonne reste exacte pour ses
  -- lecteurs (CLI, export, onglets anciens). Le trigger n'y trouve rien à refaire.
  UPDATE public.habits h
     SET completions = jsonb_set(COALESCE(h.completions, '{}'::jsonb),
                                 ARRAY[p_date], to_jsonb(v_on), true)
   WHERE h.id = v_id;

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
  'Bascule d un jour dans habit_completions, sous verrou de la ligne d habitude, '
  'recopiee dans habits.completions le temps de la transition (mig. 248). Series '
  'sur les seuls jours PREVUS (mig. 251). `p_today` : date LOCALE du client (mig. 122).';

-- ═══════════════════════════════════════════════════════════════════
-- Vérification, à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
-- a) Une signature par fonction, anon sans EXECUTE :
--   select p.proname, pg_get_function_identity_arguments(p.oid),
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('get_my_habits','toggle_habit_completion_v2',
--                        'habit_day_scheduled','habit_schedule_history_valid');
--   Attendu : une ligne chacune, anon_exec = false, auth_exec = true.
-- b) select column_name, data_type, is_nullable, column_default
--      from information_schema.columns
--     where table_schema = 'public' and table_name = 'habits'
--       and column_name in ('scheduled_days', 'schedule_history');
-- c) pg_get_functiondef('public.get_my_habits(integer,date)'::regprocedure)
--    contient `habit_day_scheduled` ET `habit_completions` ; de même pour
--    `public.toggle_habit_completion_v2(uuid,text,integer,date)`.
