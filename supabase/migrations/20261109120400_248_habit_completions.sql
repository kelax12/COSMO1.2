-- ═══════════════════════════════════════════════════════════════════
-- 248 · Historique des habitudes en table : `habit_completions` (DAT-02, vagues 13.3 et 13.4)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Les jours cochés vivaient dans `habits.completions`, un JSONB
-- `{ "YYYY-MM-DD": true|false }` qui gagne une clé par jour et par habitude,
-- sans fin (12,7 o/jour mesurés, mig. 119). Chaque lecture de série, de total
-- ou de temps investi dépliait ce JSON en entier (`jsonb_each`), aucune
-- requête ne pouvait s'appuyer sur un index de date, et la mig. 119 a dû
-- BORNER la lecture pour tenir le poids. La note de la mig. 002 annonçait déjà
-- la cible : une table dédiée.
--
-- ── CE QUE POSE CE FICHIER ─────────────────────────────────────────
--
--   · `habit_completions` : UNE LIGNE PAR HABITUDE ET PAR JOUR COCHÉ, le jour
--     étant la date LOCALE du client, exactement la clé du JSON (fuseaux
--     gelés, C-03 : `src/modules/habits/CLAUDE.md`). Un jour décoché n'a pas
--     de ligne : la présence vaut `true`, l'absence vaut `false`.
--   · clé étrangère COMPOSÉE `(habit_id, user_id)` vers `habits (id, user_id)` :
--     une ligne ne peut porter que le propriétaire de son habitude, et part
--     avec elle (suppression d'habitude ou de compte, RGPD art. 17).
--   · RLS dans ce fichier (règle 9) : chacun lit, ajoute et retire SES jours,
--     rien pour `anon`, aucun UPDATE (une ligne ne se modifie pas).
--   · `get_my_habits`, `toggle_habit_completion_v2` et `get_work_time_stats`
--     lisent la TABLE. Mêmes signatures, même forme de retour, mêmes règles
--     (`p_today` du client borné à ± 1 jour, mig. 122) : le front n'a rien à
--     changer, ni avant ni après application.
--   · rétro-remplissage idempotent depuis la colonne.
--
-- ── TRANSITION : LA COLONNE RESTE JUSTE ────────────────────────────
--
-- `habits.completions` n'est PAS supprimée. Elle est encore lue par le CLI
-- agent (`scripts/cosmo/api.mjs`, qui bascule par la v1), par l'export de
-- portabilité, par `getPage` et par tout onglet resté ouvert sur l'ancienne
-- version. Elle reste donc EXACTE :
--   · le toggle v2 écrit la table, puis recopie le jour dans la colonne ;
--   · toute écriture de la colonne (v1 du toggle, « Annuler » qui recrée une
--     habitude avec ses jours, mise à jour directe) est recopiée dans la table
--     par le trigger `habit_completions_mirror`, sur les SEULES clés qui ont
--     changé. Le trigger est INVOKER (règle 10) : il écrit avec les droits et
--     sous la RLS de l'appelant.
-- La suppression de la colonne, de la recopie et du trigger fera l'objet
-- d'une migration ULTÉRIEURE, une fois plus aucun lecteur de la colonne.
--
-- ── CE QUI CHANGE À LA LECTURE (voulu, sans effet visible) ─────────
--
-- La fenêtre `completions` rendue par les deux RPC ne contient plus que les
-- jours COCHÉS : un jour décoché y figurait avec `false`, il en est absent.
-- Tous les écrans lisent `completions[jour]` comme un booléen (absent = non
-- coché). Séries, records, totaux, premier jour et temps investi sont
-- INCHANGÉS : `supabase/proofs/248.proof.sql` les compare avant et après,
-- acteur par acteur, et sur toutes les habitudes de la base.
--
-- Une clé qui n'est pas une date réelle (`2026-1-5`, `demain`, `2026-02-30`)
-- n'entre pas dans la table. Elle était déjà ignorée par les agrégats.
--
-- ── APPLICATION ────────────────────────────────────────────────────
--
-- En UNE transaction (`apply_migration` le fait) : le verrou posé avant le
-- rétro-remplissage tient jusqu'au COMMIT, si bien qu'aucune coche faite
-- pendant l'application ne peut manquer à la table.
-- Idempotente / rejouable. Preuve : `supabase/proofs/248.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

-- ── Jour valide ou NULL ────────────────────────────────────────────
--
-- `'2026-02-30'::date` LÈVE : un cast nu sur une clé du JSON casserait la
-- lecture entière. Ce test vérifie la forme ET le calendrier sans jamais
-- lever (les CASE imbriqués fixent l'ordre d'évaluation, un AND ne le fait
-- pas).
CREATE OR REPLACE FUNCTION public.habit_day_from_key(p_key text)
RETURNS date
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
         AND left(p_key, 4) <> '0000'
    THEN CASE
      WHEN substr(p_key, 9, 2)::int <= extract(day from (
             make_date(left(p_key, 4)::int, substr(p_key, 6, 2)::int, 1)
             + interval '1 month' - interval '1 day'))::int
      THEN p_key::date
    END
  END;
$$;

REVOKE ALL ON FUNCTION public.habit_day_from_key(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.habit_day_from_key(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.habit_day_from_key(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.habit_day_from_key(text) IS
  'Cle YYYY-MM-DD de habits.completions vers une date, ou NULL si ce n est pas '
  'une date reelle. Ne leve jamais (mig. 248).';

-- ── Table ──────────────────────────────────────────────────────────

-- La clé étrangère composée vise un index UNIQUE sur `habits (id, user_id)`.
-- `id` est déjà unique : l'index ne refuse rien, il rend la paire référençable.
CREATE UNIQUE INDEX IF NOT EXISTS habits_id_user_id_key ON public.habits (id, user_id);

CREATE TABLE IF NOT EXISTS public.habit_completions (
  habit_id   uuid NOT NULL,
  -- Cascade DIRECTE en plus de la clé composée : la ligne part avec le compte
  -- même si un chemin de suppression ne passait pas par `habits` (art. 17).
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  day        date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- `habit_id` détermine `user_id` : la clé dit « un jour par habitude », et
  -- son préfixe couvre la clé étrangère (advisor unindexed_foreign_keys).
  CONSTRAINT habit_completions_pkey PRIMARY KEY (habit_id, user_id, day),
  CONSTRAINT habit_completions_habit_fkey FOREIGN KEY (habit_id, user_id)
    REFERENCES public.habits (id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.habit_completions IS
  'DAT-02 : un jour coche par ligne (date LOCALE du client, fuseaux geles C-03). '
  'Absence = non coche. Lue par get_my_habits, toggle_habit_completion_v2 et '
  'get_work_time_stats (mig. 248). habits.completions en est le miroir le temps '
  'de la transition.';

-- Série, total et temps investi d'UN compte sur une plage de jours : c'est le
-- prédicat de la RLS et de `get_work_time_stats`.
CREATE INDEX IF NOT EXISTS habit_completions_user_day_idx
  ON public.habit_completions (user_id, day);

ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.habit_completions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.habit_completions TO authenticated;

DROP POLICY IF EXISTS "habit_completions_select" ON public.habit_completions;
CREATE POLICY "habit_completions_select" ON public.habit_completions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "habit_completions_insert" ON public.habit_completions;
CREATE POLICY "habit_completions_insert" ON public.habit_completions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "habit_completions_delete" ON public.habit_completions;
CREATE POLICY "habit_completions_delete" ON public.habit_completions
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Aucun UPDATE n'est accordé ; le trigger tient quand même la règle 15, au
-- cas où un droit serait ouvert plus tard.
DROP TRIGGER IF EXISTS trg_habit_completions_user_id_immutable ON public.habit_completions;
CREATE TRIGGER trg_habit_completions_user_id_immutable
  BEFORE UPDATE ON public.habit_completions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

-- ── Recopie colonne → table ────────────────────────────────────────
--
-- Ne traite QUE les clés dont la valeur a changé : une coche ne recopie
-- qu'un jour, une habitude recréée par « Annuler » recopie tous les siens.
-- Après le toggle v2 (qui a déjà écrit la table) elle ne trouve rien à faire.
CREATE OR REPLACE FUNCTION public.habit_completions_mirror()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_old jsonb := '{}'::jsonb;
  v_on  date[];
  v_off date[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old := COALESCE(OLD.completions, '{}'::jsonb);
  END IF;

  SELECT array_agg(d.day) FILTER (WHERE d.nv = 'true'::jsonb),
         array_agg(d.day) FILTER (WHERE d.nv IS DISTINCT FROM 'true'::jsonb)
    INTO v_on, v_off
    FROM (
      SELECT public.habit_day_from_key(COALESCE(n.key, o.key)) AS day, n.value AS nv
        FROM jsonb_each(COALESCE(NEW.completions, '{}'::jsonb)) n
        FULL JOIN jsonb_each(v_old) o ON o.key = n.key
       WHERE n.value IS DISTINCT FROM o.value
    ) d
   WHERE d.day IS NOT NULL;

  IF v_off IS NOT NULL THEN
    DELETE FROM public.habit_completions c
     WHERE c.habit_id = NEW.id
       AND c.user_id = NEW.user_id
       AND c.day = ANY (v_off);
  END IF;

  IF v_on IS NOT NULL THEN
    INSERT INTO public.habit_completions (habit_id, user_id, day)
    SELECT NEW.id, NEW.user_id, x.day FROM unnest(v_on) AS x(day)
    ON CONFLICT (habit_id, user_id, day) DO NOTHING;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.habit_completions_mirror() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_habit_completions_mirror ON public.habits;
CREATE TRIGGER trg_habit_completions_mirror
  AFTER INSERT OR UPDATE OF completions ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.habit_completions_mirror();

-- ── Rétro-remplissage ──────────────────────────────────────────────
--
-- Le verrou bloque toute écriture de `habits` pendant le rétro-remplissage : une
-- coche concurrente attend, puis passe par le trigger ci-dessus. Rien ne manque.
-- `ON CONFLICT DO NOTHING` : rejouer ne duplique rien et n'efface rien.
-- Dans un bloc DO (ROB-02, 2026-11-10) : la CLI Supabase n'ouvre pas de
-- transaction autour d'un fichier, et `LOCK TABLE` nu y est refusé (25P01).
-- Le bloc est UNE instruction : le verrou tient jusqu'à la fin de l'insertion.
DO $retro$
BEGIN
  LOCK TABLE public.habits IN SHARE ROW EXCLUSIVE MODE;

  INSERT INTO public.habit_completions (habit_id, user_id, day)
  SELECT h.id, h.user_id, v.day
    FROM public.habits h
   CROSS JOIN LATERAL jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
   CROSS JOIN LATERAL (SELECT public.habit_day_from_key(kv.key) AS day) v
   WHERE kv.value = 'true'::jsonb
     AND v.day IS NOT NULL
  ON CONFLICT (habit_id, user_id, day) DO NOTHING;
END
$retro$;

-- ═══════════════════════════════════════════════════════════════════
-- get_my_habits : lecture de liste, depuis la table
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_my_habits(
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
  window_days           INTEGER
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
  days AS (
    SELECT c.habit_id, c.day AS d
    FROM public.habit_completions c
    CROSS JOIN params p
    -- Jours futurs exclus, relativement au client (mig. 122).
    WHERE c.day <= p.today
  ),
  grouped AS (
    SELECT habit_id, d,
           d - (row_number() OVER (PARTITION BY habit_id ORDER BY d))::int AS island
    FROM days
  ),
  runs AS (
    SELECT habit_id, island, COUNT(*)::int AS len, MAX(d) AS last_day
    FROM grouped
    GROUP BY habit_id, island
  ),
  agg AS (
    SELECT
      r.habit_id,
      MAX(r.len) AS best,
      -- Série EN COURS : celle qui touche aujourd'hui ou hier, du point de vue
      -- du client. Même règle que `streak.ts`, à la lettre.
      COALESCE(MAX(r.len) FILTER (
        WHERE r.last_day >= ((SELECT today FROM params) - 1)
      ), 0) AS current,
      SUM(r.len)::int AS total,
      MIN(r.last_day - (r.len - 1)) AS first_day
    FROM runs r
    GROUP BY r.habit_id
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
    COALESCE(a.total, 0)::int,
    a.first_day,
    p.win
  FROM public.habits h
  CROSS JOIN params p
  LEFT JOIN agg a ON a.habit_id = h.id
  ORDER BY h.created_at DESC, h.id DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_habits(INTEGER, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_habits(INTEGER, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_habits(INTEGER, DATE) TO authenticated;

COMMENT ON FUNCTION public.get_my_habits(INTEGER, DATE) IS
  'Lecture bornee des habitudes, depuis habit_completions (mig. 248). '
  '`completions` = jours coches des p_days derniers jours ; series et totaux '
  'calcules sur l historique ENTIER. `p_today` est la date LOCALE du client '
  '(bornee a CURRENT_DATE +/- 1, mig. 122).';

-- ═══════════════════════════════════════════════════════════════════
-- toggle_habit_completion_v2 : bascule dans la table, recopie dans la colonne
-- ═══════════════════════════════════════════════════════════════════
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
  window_days           INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid   UUID := (SELECT auth.uid());
  v_id    UUID;
  v_day   DATE;
  v_on    BOOLEAN;
  v_win   INTEGER := GREATEST(1, LEAST(COALESCE(p_days, 400), 3650));
  v_today DATE := GREATEST(CURRENT_DATE - 1,
                           LEAST(COALESCE(p_today, CURRENT_DATE), CURRENT_DATE + 1));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Forme ET calendrier : `2026-02-30` est refusé ici, et non plus par un
  -- cast qui levait plus loin, dans la lecture.
  v_day := public.habit_day_from_key(p_date);
  IF v_day IS NULL THEN
    RAISE EXCEPTION 'Invalid date format (expected YYYY-MM-DD)';
  END IF;

  -- Verrou de la ligne d'habitude : deux bascules concurrentes du même jour
  -- (deux onglets) se sérialisent, la seconde voit l'état laissé par la
  -- première (correctif TOCTOU-1, mig. 023). Ne JAMAIS décider sans ce verrou.
  SELECT h.id INTO v_id
    FROM public.habits h
   WHERE h.id = p_habit_id
     AND h.user_id = v_uid   -- défense en profondeur (la RLS filtre déjà)
   FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;

  DELETE FROM public.habit_completions c
   WHERE c.habit_id = v_id AND c.user_id = v_uid AND c.day = v_day;
  v_on := NOT FOUND;
  IF v_on THEN
    INSERT INTO public.habit_completions (habit_id, user_id, day)
    VALUES (v_id, v_uid, v_day);
  END IF;

  -- Miroir de transition : la colonne reste exacte pour ses lecteurs
  -- (CLI, export, onglets anciens). Le trigger n'y trouve rien à refaire.
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
  grouped AS (
    SELECT d, d - (row_number() OVER (ORDER BY d))::int AS island FROM days
  ),
  runs AS (
    SELECT island, COUNT(*)::int AS len, MAX(d) AS last_day
    FROM grouped GROUP BY island
  ),
  agg AS (
    SELECT MAX(r.len) AS best,
           COALESCE(MAX(r.len) FILTER (WHERE r.last_day >= (v_today - 1)), 0) AS current,
           SUM(r.len)::int AS total,
           MIN(r.last_day - (r.len - 1)) AS first_day
    FROM runs r
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
    COALESCE((SELECT a.total   FROM agg a), 0)::int,
    (SELECT a.first_day FROM agg a),
    v_win
  FROM public.habits h
  WHERE h.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER, DATE) TO authenticated;

COMMENT ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER, DATE) IS
  'Bascule d un jour dans habit_completions, sous verrou de la ligne d habitude, '
  'recopiee dans habits.completions le temps de la transition (mig. 248). Retour '
  'borne, meme forme que get_my_habits. `p_today` : date LOCALE du client (mig. 122).';

-- ═══════════════════════════════════════════════════════════════════
-- get_work_time_stats : temps des habitudes depuis la table
--
-- Corps de la mig. 136 À LA LETTRE, sauf la CTE `habit_days`.
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
-- Une ligne par (habitude, jour coché), lue dans `habit_completions`
-- (mig. 248) par l'index (user_id, day). Le jour est déjà une date LOCALE
-- validée : plus de dépliage du JSON ni de filtre de forme.
habit_days AS MATERIALIZED (
  SELECT c.day AS d, h.estimated_time AS v
  FROM habit_completions c
  JOIN habits h ON h.id = c.habit_id AND h.user_id = c.user_id, me, bounds b
  WHERE c.user_id = me.uid
    AND c.day BETWEEN b.lo AND b.hi
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
  'du journal kr_completions (mig. 136), le temps des habitudes de '
  'habit_completions (mig. 248). Les filtres user_id = auth.uid() sont le '
  'correctif A-1 (mig. 085), ne pas les retirer.';

REVOKE ALL ON FUNCTION public.get_work_time_stats(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_work_time_stats(jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_work_time_stats(jsonb, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- Relecture, à exécuter APRÈS application (catalogue, pas ledger)
-- ═══════════════════════════════════════════════════════════════════
--
-- a) Table, RLS, droits :
--   select relrowsecurity from pg_class where oid = 'public.habit_completions'::regclass;  -- true
--   select grantee, string_agg(privilege_type, ',' order by privilege_type)
--     from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'habit_completions' group by 1;
--   -- authenticated : DELETE,INSERT,SELECT ; anon : aucune ligne
--
-- b) Le rétro-remplissage est complet (attendu : 0) :
--   select count(*) from public.habits h
--    where (select coalesce(array_agg(c.day order by c.day), '{}') from public.habit_completions c where c.habit_id = h.id)
--      <> (select coalesce(array_agg(public.habit_day_from_key(k) order by 1), '{}')
--            from jsonb_each(h.completions) e(k, v)
--           where v = 'true'::jsonb and public.habit_day_from_key(k) is not null);
--
-- c) Les corps vivants sont ceux du fichier :
--   select pg_get_functiondef('public.get_my_habits(integer,date)'::regprocedure) like '%habit_completions%';
--   select pg_get_functiondef('public.toggle_habit_completion_v2(uuid,text,integer,date)'::regprocedure) like '%habit_completions%';
--   select pg_get_functiondef('public.get_work_time_stats(jsonb,text)'::regprocedure) like '%habit_completions%';
--   -- trois fois true
