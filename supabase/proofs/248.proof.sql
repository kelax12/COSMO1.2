-- Preuve de la mig. 248 (historique des habitudes en table, DAT-02, vagues 13.3 et 13.4).
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/preuves-dette-sql.test.ts`) : la preuve se
-- joue AVANT application et s'annule avec elle, rétro-remplissage compris.
--   supabase db query --linked -f supabase/proofs/248.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | info … | ok … »
--
-- ⚠️ La preuve pose un verrou SHARE ROW EXCLUSIVE sur `habits` le temps de
-- son exécution (quelques secondes) : une coche faite pendant ce temps
-- attend, puis passe. Sans lui, une coche concurrente entre les deux relevés
-- passerait pour une divergence.
--
-- Ce qui est vérifié :
--   · AVANT puis APRÈS la migration, pour trois acteurs (A : 510 jours dont
--     une série de 500, plus longue que la fenêtre de 400 ; B : aucun jour ;
--     C : seulement des jours décochés) et trois « aujourd'hui » (veille, jour,
--     lendemain, la borne ± 1 de la mig. 122) : série en cours, record, total,
--     premier jour, fenêtre (jours cochés) et temps investi sur trois plages
--     sont IDENTIQUES avant et après, et égaux à l'ANCIEN CALCUL (corps de la
--     mig. 122 rejoué directement sur la colonne JSON) ;
--   · valeurs attendues écrites en dur pour A (500 / 500 / 510, 401 jours de
--     fenêtre, 390 min sur 30 jours) : un calcul faux des deux côtés ne passe
--     pas ;
--   · TOUTE la base, rôle propriétaire : `get_my_habits` avant = après, et la
--     table = les jours `true` valides de la colonne, habitude par habitude ;
--   · écritures après migration : bascule v2 aller et retour (table + miroir
--     de la colonne), date impossible refusée, v1 du CLI recopiée par le
--     trigger, « Annuler » (habitude recréée avec ses jours), retrait d'une
--     clé, suppression d'habitude qui emporte ses jours ;
--   · isolement : B ne voit aucun jour de A, ne bascule pas l'habitude de A,
--     n'insère ni pour A (RLS) ni sur l'habitude de A (clé composée), ne
--     supprime rien, n'a pas d'UPDATE ; `anon` n'a aucun droit.
-- TÉMOIN ROUGE (dans la preuve) : un jour retiré de la table au milieu de la
-- série de A doit faire tomber la série à 249 et le total à 509, donc rendre
-- la comparaison fausse ; puis l'annulation de ce sous-bloc rend les 511
-- lignes. Un comparateur aveugle échoue ici.
-- Passe témoin à la main : jouée SANS la migration (retirer l'EXECUTE), elle
-- échoue dès la première écriture sur la table absente.

DO $proof$
DECLARE
  r       text[] := '{}';
  ko      int := 0;
  t0      constant date := CURRENT_DATE;
  u_a     constant uuid := gen_random_uuid();
  u_b     constant uuid := gen_random_uuid();
  u_c     constant uuid := gen_random_uuid();
  h_a1    constant uuid := gen_random_uuid();
  h_a2    constant uuid := gen_random_uuid();
  h_b1    constant uuid := gen_random_uuid();
  h_c1    constant uuid := gen_random_uuid();
  h_r     constant uuid := gen_random_uuid();
  acteurs uuid[] := ARRAY[u_a, u_b, u_c];
  noms    text[] := ARRAY['A', 'B', 'C'];
  jours   date[] := ARRAY[t0 - 1, t0, t0 + 1];
  plages  jsonb := jsonb_build_array(
                     jsonb_build_object('start', t0 - 30,  'end', t0),
                     jsonb_build_object('start', t0 - 800, 'end', t0 + 5),
                     jsonb_build_object('start', t0,       'end', t0));
  snap    jsonb := '{}';
  g1      jsonb;
  g2      jsonb;
  s1      jsonb;
  s2      jsonb;
  v       jsonb;
  n       int;
  m       int;
  e       text;
  k1      text := to_char(t0 - 1, 'YYYY-MM-DD');
  k2      text := to_char(t0 - 2, 'YYYY-MM-DD');
  phase   int;
  i       int;
  jour    date;
BEGIN
  LOCK TABLE public.habits IN SHARE ROW EXCLUSIVE MODE;

  r := r || format('info avant : habit_completions %s, %s habitudes, %s jours coches dans la colonne',
    coalesce(to_regclass('public.habit_completions')::text, 'absente'),
    (SELECT count(*) FROM public.habits),
    (SELECT count(*) FROM public.habits h CROSS JOIN LATERAL jsonb_each(h.completions) kv WHERE kv.value = 'true'::jsonb));

  -- ── Fixtures (rôle propriétaire), écrites AVANT la migration ──────
  INSERT INTO auth.users(id, email) VALUES
    (u_a, 'a248@proof.invalid'), (u_b, 'b248@proof.invalid'), (u_c, 'c248@proof.invalid');

  -- A1 : série de 500 jours finissant hier, îlot de 10 jours 600 jours plus
  -- tôt, un jour futur coché (hors agrégats, dans la fenêtre), un décoché.
  SELECT jsonb_object_agg(to_char(t0 - k, 'YYYY-MM-DD'), true)
         || jsonb_build_object(to_char(t0 + 3, 'YYYY-MM-DD'), true, to_char(t0 + 1, 'YYYY-MM-DD'), false)
    INTO v
    FROM (SELECT generate_series(1, 500) AS k UNION ALL SELECT generate_series(600, 609)) s;
  INSERT INTO public.habits(id, user_id, name, estimated_time, completions) VALUES
    (h_a1, u_a, 'A1 preuve 248', 10, v);
  -- A2 : aujourd'hui, avant-hier et le jour d'avant ; hier décoché ; une clé
  -- mal formée, ignorée des deux côtés.
  INSERT INTO public.habits(id, user_id, name, estimated_time, completions) VALUES
    (h_a2, u_a, 'A2 preuve 248', 30, jsonb_build_object(
       to_char(t0, 'YYYY-MM-DD'), true, k2, true, to_char(t0 - 3, 'YYYY-MM-DD'), true,
       k1, false, '2026-1-5', true)),
    (h_b1, u_b, 'B1 preuve 248', 20, '{}'::jsonb),
    (h_c1, u_c, 'C1 preuve 248', 15, jsonb_build_object(k1, false, k2, false, to_char(t0 - 700, 'YYYY-MM-DD'), false));

  -- ── Relevés AVANT (1) puis APRÈS (2) la migration ─────────────────
  FOR phase IN 1 .. 2 LOOP
    IF phase = 2 THEN
  EXECUTE $mig$
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
-- Le verrou bloque toute écriture de `habits` jusqu'au COMMIT : une coche
-- concurrente attend, puis passe par le trigger ci-dessus. Rien ne manque.
-- `ON CONFLICT DO NOTHING` : rejouer ne duplique rien et n'efface rien.
LOCK TABLE public.habits IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO public.habit_completions (habit_id, user_id, day)
SELECT h.id, h.user_id, v.day
  FROM public.habits h
 CROSS JOIN LATERAL jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
 CROSS JOIN LATERAL (SELECT public.habit_day_from_key(kv.key) AS day) v
 WHERE kv.value = 'true'::jsonb
   AND v.day IS NOT NULL
ON CONFLICT (habit_id, user_id, day) DO NOTHING;

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
$mig$;
    END IF;

    -- Toute la base, rôle propriétaire (la RLS ne filtre pas).
    SELECT coalesce(jsonb_object_agg(g.id, jsonb_build_array(
             g.streak_current, g.streak_best, g.completions_total, g.first_completion_date, g.window_days,
             (SELECT coalesce(jsonb_object_agg(w.k, w.x), '{}'::jsonb)
                FROM jsonb_each(g.completions) w(k, x) WHERE w.x = 'true'::jsonb))), '{}'::jsonb)
      INTO v
      FROM public.get_my_habits(400, t0) g;
    IF phase = 1 THEN g1 := v; ELSE g2 := v; END IF;

    EXECUTE 'SET LOCAL ROLE authenticated';
    FOR i IN 1 .. array_length(acteurs, 1) LOOP
      PERFORM set_config('request.jwt.claim.sub', acteurs[i]::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', acteurs[i], 'role', 'authenticated')::text, true);
      FOREACH jour IN ARRAY jours LOOP
        -- Ce que rend la RPC (fenêtre réduite aux jours cochés).
        SELECT coalesce(jsonb_object_agg(g.id, jsonb_build_array(
                 g.streak_current, g.streak_best, g.completions_total, g.first_completion_date, g.window_days,
                 (SELECT coalesce(jsonb_object_agg(w.k, w.x), '{}'::jsonb)
                    FROM jsonb_each(g.completions) w(k, x) WHERE w.x = 'true'::jsonb))), '{}'::jsonb)
          INTO s1
          FROM public.get_my_habits(400, jour) g;

        -- L'ANCIEN CALCUL : corps de la mig. 122, rejoué sur la colonne JSON.
        WITH days AS (
          SELECT h.id AS habit_id, (kv.key)::date AS d
            FROM public.habits h
           CROSS JOIN LATERAL jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
           WHERE kv.value = 'true'::jsonb
             AND CASE WHEN kv.key ~ '^\d{4}-\d{2}-\d{2}$' THEN (kv.key)::date <= jour ELSE false END
        ),
        grouped AS (
          SELECT habit_id, d, d - (row_number() OVER (PARTITION BY habit_id ORDER BY d))::int AS island
            FROM days
        ),
        runs AS (
          SELECT habit_id, island, COUNT(*)::int AS len, MAX(d) AS last_day
            FROM grouped GROUP BY habit_id, island
        ),
        agg AS (
          SELECT habit_id, MAX(len) AS best,
                 COALESCE(MAX(len) FILTER (WHERE last_day >= jour - 1), 0) AS current,
                 SUM(len)::int AS total,
                 MIN(last_day - (len - 1)) AS first_day
            FROM runs GROUP BY habit_id
        )
        SELECT coalesce(jsonb_object_agg(h.id, jsonb_build_array(
                 COALESCE(a.current, 0), COALESCE(a.best, 0), COALESCE(a.total, 0), a.first_day, 400,
                 COALESCE((SELECT jsonb_object_agg(kv.key, kv.value)
                             FROM jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
                            WHERE kv.value = 'true'::jsonb
                              AND CASE WHEN kv.key ~ '^\d{4}-\d{2}-\d{2}$' THEN (kv.key)::date >= jour - 400 ELSE false END),
                          '{}'::jsonb))), '{}'::jsonb)
          INTO s2
          FROM public.habits h
          LEFT JOIN agg a ON a.habit_id = h.id;

        snap := snap || jsonb_build_object(format('%s|%s|%s', phase, i, jour - t0), jsonb_build_object(
                  'rpc', s1, 'ref', s2, 'ws', public.get_work_time_stats(plages, 'UTC')));
      END LOOP;
    END LOOP;
    EXECUTE 'RESET ROLE';
  END LOOP;

  -- ── Avant = après = ancien calcul, acteur par acteur ──────────────
  FOR i IN 1 .. array_length(acteurs, 1) LOOP
    FOREACH jour IN ARRAY jours LOOP
      s1 := snap -> format('1|%s|%s', i, jour - t0);
      s2 := snap -> format('2|%s|%s', i, jour - t0);
      IF s1 -> 'rpc' = s2 -> 'rpc' AND s1 -> 'rpc' = s1 -> 'ref' AND s2 -> 'rpc' = s2 -> 'ref'
         AND s1 -> 'ws' = s2 -> 'ws' THEN
        r := r || format('ok %s, aujourd''hui %s : series, records, totaux, premier jour, fenetre, temps investi identiques avant/apres et = ancien calcul',
                         noms[i], jour - t0);
      ELSE
        ko := ko + 1;
        r := r || format('ECHEC %s, aujourd''hui %s : avant %s | apres %s | ancien %s | temps %s -> %s',
                         noms[i], jour - t0, left((s1 -> 'rpc')::text, 300), left((s2 -> 'rpc')::text, 300),
                         left((s2 -> 'ref')::text, 300), s1 -> 'ws', s2 -> 'ws');
      END IF;
    END LOOP;
  END LOOP;

  -- ── Valeurs attendues, écrites en dur (A, aujourd'hui) ────────────
  v := snap -> '2|1|0' -> 'rpc';
  IF (v -> h_a1::text) - 5 = jsonb_build_array(500, 500, 510, t0 - 609, 400)
     AND (SELECT count(*) FROM jsonb_object_keys(v -> h_a1::text -> 5)) = 401
     AND (v -> h_a2::text) - 5 = jsonb_build_array(1, 2, 3, t0 - 3, 400)
     AND v -> h_a2::text -> 5 = jsonb_build_object(to_char(t0, 'YYYY-MM-DD'), true, k2, true, to_char(t0 - 3, 'YYYY-MM-DD'), true) THEN
    r := r || 'ok A attendu : serie 500 au-dela de la fenetre, record 500, total 510, premier jour J-609, 401 jours de fenetre ; A2 1/2/3';
  ELSE
    ko := ko + 1;
    r := r || format('ECHEC A attendu 500/500/510/J-609 et 1/2/3/J-3 : obtenu %s / %s', (v -> h_a1::text) - 5, v -> h_a2::text);
  END IF;
  v := snap -> '2|1|0' -> 'ws';
  IF (v -> 0 ->> 'habitsTime')::int = 390 AND (v -> 1 ->> 'habitsTime')::int = 5200 AND (v -> 2 ->> 'habitsTime')::int = 30 THEN
    r := r || 'ok A temps investi : 390 min sur 30 jours, 5200 sur 806 jours, 30 aujourd''hui';
  ELSE
    ko := ko + 1;
    r := r || format('ECHEC A temps investi attendu 390 / 5200 / 30 : %s', v);
  END IF;
  IF snap -> '2|2|0' -> 'rpc' = jsonb_build_object(h_b1, jsonb_build_array(0, 0, 0, NULL, 400, '{}'::jsonb))
     AND snap -> '2|3|0' -> 'rpc' = jsonb_build_object(h_c1, jsonb_build_array(0, 0, 0, NULL, 400, '{}'::jsonb)) THEN
    r := r || 'ok B (aucun jour) et C (jours decoches seulement) : zeros, fenetre vide';
  ELSE
    ko := ko + 1;
    r := r || format('ECHEC B / C attendus a zero : %s / %s', snap -> '2|2|0' -> 'rpc', snap -> '2|3|0' -> 'rpc');
  END IF;

  -- ── Toute la base : avant = après ─────────────────────────────────
  SELECT count(*) INTO n
    FROM jsonb_each(g1) a FULL JOIN jsonb_each(g2) b ON b.key = a.key
   WHERE a.value IS DISTINCT FROM b.value;
  IF n = 0 THEN
    r := r || format('ok base entiere : %s habitudes, get_my_habits identique avant/apres', (SELECT count(*) FROM jsonb_object_keys(g2)));
  ELSE
    ko := ko + 1;
    r := r || format('ECHEC base entiere : %s habitude(s) sur %s changent de serie, total ou fenetre', n, (SELECT count(*) FROM jsonb_object_keys(g2)));
  END IF;

  -- ── Rétro-remplissage : table = jours `true` valides de la colonne ─
  SELECT count(*), count(*) FILTER (WHERE x.table_jours IS DISTINCT FROM x.colonne_jours)
    INTO n, m
    FROM (
      SELECT (SELECT coalesce(array_agg(c.day ORDER BY c.day), '{}') FROM public.habit_completions c WHERE c.habit_id = h.id) AS table_jours,
             (SELECT coalesce(array_agg(public.habit_day_from_key(w.k) ORDER BY public.habit_day_from_key(w.k)), '{}')
                FROM jsonb_each(h.completions) w(k, x)
               WHERE w.x = 'true'::jsonb AND public.habit_day_from_key(w.k) IS NOT NULL) AS colonne_jours
        FROM public.habits h
    ) x;
  IF m = 0 THEN
    r := r || format('ok retro-remplissage : %s habitudes, table = colonne pour chacune (%s jours en table)', n, (SELECT count(*) FROM public.habit_completions));
  ELSE
    ko := ko + 1;
    r := r || format('ECHEC retro-remplissage : %s habitude(s) sur %s ou la table differe de la colonne', m, n);
  END IF;

  -- ── Écritures après migration, en A ───────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);

  SELECT g.streak_current, g.completions INTO n, v
    FROM public.toggle_habit_completion_v2(h_a2, k1, 400, t0) g;
  IF n = 4 AND v ? k1
     AND EXISTS (SELECT 1 FROM public.habit_completions c WHERE c.habit_id = h_a2 AND c.day = t0 - 1)
     AND (SELECT h.completions ->> k1 FROM public.habits h WHERE h.id = h_a2) = 'true' THEN
    r := r || 'ok A coche hier : serie 4, ligne en table, colonne recopiee a true';
  ELSE
    ko := ko + 1;
    r := r || format('ECHEC A coche hier : serie %s, fenetre %s', n, v);
  END IF;

  SELECT g.streak_current, g.completions INTO n, v
    FROM public.toggle_habit_completion_v2(h_a2, k1, 400, t0) g;
  IF n = 1 AND NOT v ? k1
     AND NOT EXISTS (SELECT 1 FROM public.habit_completions c WHERE c.habit_id = h_a2 AND c.day = t0 - 1)
     AND (SELECT h.completions ->> k1 FROM public.habits h WHERE h.id = h_a2) = 'false' THEN
    r := r || 'ok A decoche hier : serie 1, ligne retiree, jour absent de la fenetre, colonne a false';
  ELSE
    ko := ko + 1;
    r := r || format('ECHEC A decoche hier : serie %s, fenetre %s', n, v);
  END IF;

  BEGIN
    PERFORM public.toggle_habit_completion_v2(h_a2, '2026-02-30', 400, t0);
    e := 'acceptee';
  EXCEPTION WHEN OTHERS THEN e := SQLERRM;
  END;
  IF e LIKE 'Invalid date format%' THEN r := r || 'ok 30 fevrier refuse (Invalid date format)';
  ELSE ko := ko + 1; r := r || format('ECHEC 30 fevrier : %s', e); END IF;

  PERFORM public.toggle_habit_completion(h_a2, to_char(t0 - 5, 'YYYY-MM-DD'));
  IF EXISTS (SELECT 1 FROM public.habit_completions c WHERE c.habit_id = h_a2 AND c.day = t0 - 5) THEN
    r := r || 'ok v1 du CLI : le jour ecrit dans la colonne est recopie en table par le trigger';
  ELSE ko := ko + 1; r := r || 'ECHEC v1 du CLI : jour absent de la table'; END IF;

  INSERT INTO public.habits(id, user_id, name, completions)
    VALUES (h_r, u_a, 'R preuve 248', jsonb_build_object(k1, true, k2, true));
  SELECT g.streak_current INTO n FROM public.get_my_habits(400, t0) g WHERE g.id = h_r;
  SELECT count(*) INTO m FROM public.habit_completions c WHERE c.habit_id = h_r;
  IF n = 2 AND m = 2 THEN r := r || 'ok Annuler (habitude recreee avec ses jours) : 2 lignes, serie 2';
  ELSE ko := ko + 1; r := r || format('ECHEC Annuler : %s ligne(s), serie %s', m, n); END IF;

  UPDATE public.habits h SET completions = h.completions - k1 WHERE h.id = h_r;
  SELECT count(*) INTO m FROM public.habit_completions c WHERE c.habit_id = h_r;
  IF m = 1 THEN r := r || 'ok cle retiree de la colonne : ligne retiree de la table';
  ELSE ko := ko + 1; r := r || format('ECHEC cle retiree : %s ligne(s)', m); END IF;

  DELETE FROM public.habits h WHERE h.id = h_r;
  SELECT count(*) INTO m FROM public.habit_completions c WHERE c.habit_id = h_r;
  IF m = 0 THEN r := r || 'ok suppression de l habitude : ses jours partent avec elle';
  ELSE ko := ko + 1; r := r || format('ECHEC suppression : %s ligne(s) orpheline(s)', m); END IF;

  -- ── Isolement, en B ───────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', u_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM public.habit_completions;
  IF n = 0 THEN r := r || 'ok B ne lit aucun jour (A en a 511)';
  ELSE ko := ko + 1; r := r || format('ECHEC B lit %s jour(s)', n); END IF;

  BEGIN
    PERFORM public.toggle_habit_completion_v2(h_a1, k1, 400, t0);
    e := 'acceptee';
  EXCEPTION WHEN OTHERS THEN e := SQLERRM;
  END;
  IF e = 'Habit not found' THEN r := r || 'ok B ne bascule pas l habitude de A (Habit not found)';
  ELSE ko := ko + 1; r := r || format('ECHEC B bascule A : %s', e); END IF;

  BEGIN
    INSERT INTO public.habit_completions(habit_id, user_id, day) VALUES (h_a1, u_a, t0);
    e := 'acceptee';
  EXCEPTION WHEN OTHERS THEN e := SQLSTATE;
  END;
  IF e = '42501' THEN r := r || 'ok B n insere pas au nom de A (42501, RLS)';
  ELSE ko := ko + 1; r := r || format('ECHEC B insere au nom de A : %s', e); END IF;

  BEGIN
    INSERT INTO public.habit_completions(habit_id, user_id, day) VALUES (h_a1, u_b, t0);
    e := 'acceptee';
  EXCEPTION WHEN OTHERS THEN e := SQLSTATE;
  END;
  IF e = '23503' THEN r := r || 'ok B n insere pas sur l habitude de A (23503, cle composee)';
  ELSE ko := ko + 1; r := r || format('ECHEC B insere sur l habitude de A : %s', e); END IF;

  DELETE FROM public.habit_completions c WHERE c.habit_id = h_a1;
  GET DIAGNOSTICS n = ROW_COUNT;
  BEGIN
    UPDATE public.habit_completions c SET day = c.day WHERE c.habit_id = h_b1;
    e := 'acceptee';
  EXCEPTION WHEN OTHERS THEN e := SQLSTATE;
  END;
  IF n = 0 AND e = '42501' THEN r := r || 'ok B ne supprime aucun jour de A, et n a pas d UPDATE (42501)';
  ELSE ko := ko + 1; r := r || format('ECHEC B supprime %s jour(s) de A, UPDATE : %s', n, e); END IF;

  -- ── anon ──────────────────────────────────────────────────────────
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  BEGIN
    PERFORM count(*) FROM public.habit_completions;
    e := 'lisible';
  EXCEPTION WHEN OTHERS THEN e := SQLSTATE;
  END;
  IF e = '42501' THEN r := r || 'ok anon : aucun droit sur habit_completions (42501)';
  ELSE ko := ko + 1; r := r || format('ECHEC anon : %s', e); END IF;
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO n FROM public.habit_completions c WHERE c.habit_id = h_a1;
  IF n = 511 THEN r := r || 'ok A garde ses 511 jours apres les tentatives de B';
  ELSE ko := ko + 1; r := r || format('ECHEC A n a plus que %s jours', n); END IF;

  -- ── TÉMOIN ROUGE : un jour perdu doit se voir ─────────────────────
  BEGIN
    DELETE FROM public.habit_completions c WHERE c.habit_id = h_a1 AND c.day = t0 - 250;
    SELECT jsonb_build_array(g.streak_current, g.streak_best, g.completions_total) INTO v
      FROM public.get_my_habits(400, t0) g WHERE g.id = h_a1;
    RAISE EXCEPTION 'TEMOIN %', v;
  EXCEPTION WHEN raise_exception THEN e := SQLERRM;
  END;
  SELECT count(*) INTO n FROM public.habit_completions c WHERE c.habit_id = h_a1;
  IF e = format('TEMOIN %s', jsonb_build_array(249, 250, 509))
     AND jsonb_build_array(249, 250, 509) <> ((snap -> '2|1|0' -> 'rpc' -> h_a1::text) - 5 - 4 - 3)
     AND n = 511 THEN
    r := r || 'ok temoin : un jour retire de la table fait tomber la serie a 249 et le total a 509 (la comparaison le voit), puis l annulation rend les 511 jours';
  ELSE
    ko := ko + 1;
    r := r || format('ECHEC temoin aveugle : %s, %s jour(s) apres annulation', e, n);
  END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
