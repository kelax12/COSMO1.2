-- ═══════════════════════════════════════════════════════════════════
-- Migration 122 — `habits` : « aujourd'hui » est la date LOCALE du client
--
-- 🔴 CORRECTIF D'UNE RÉGRESSION INTRODUITE PAR LA MIG. 119.
--
-- Les mig. 119 et 121 ont déplacé le calcul de la série côté serveur. Elles
-- jugent « aujourd'hui » avec `CURRENT_DATE`, et la base de production est en
-- **UTC** (vérifié : `current_setting('TimeZone') = 'UTC'`).
--
-- Or les clés de `completions` sont écrites en date LOCALE du navigateur :
-- `toLocaleDateString('en-CA')`, aussi bien par `streak.ts` que par le client
-- qui envoie `p_date` au toggle. C'est la convention du projet, et elle est
-- déjà gravée dans la mémoire d'équipe (« classe de bugs timezone éradiquée,
-- convention date locale en-CA », audit du 2026-06-11). La mig. 119 l'a
-- enfreinte côté SQL.
--
-- Depuis la 119, `habitStreak()` PRÉFÈRE la valeur serveur : c'est donc le
-- chiffre faux qui gagne. Avant, le calcul était en JS, donc juste.
--
-- MESURÉ (données synthétiques, logique déployée) :
--
--   Scénario                                        serveur   streak.ts
--   New York 21 h, série finissant hier local          0          30
--   Paris 00 h 30, vient de cocher aujourd'hui        29          30
--   Même fuseau (témoin)                              30          30
--
-- DEUX EFFETS RÉELS :
--   • Amériques, de ~19 h à minuit local : quiconque n'a pas encore coché sa
--     journée voit sa série tomber à ZÉRO. `last_day >= CURRENT_DATE - 1`
--     exclut la série qui finit hier local. 4 à 8 h d'exposition par jour.
--   • Europe (marché principal), de 00 h à 02 h locales : cocher fait BAISSER
--     le compteur. L'optimistic update incrémente, puis la réponse serveur
--     écrit une valeur qui ne voit pas encore ce jour — il est « futur » pour
--     elle, donc filtré par la garde `<= CURRENT_DATE`.
--
-- LE CORRECTIF. Le client passe sa date locale ; le serveur ne devine plus.
--
-- ⚠️ `p_today` vient du client, donc il est manipulable. C'est acceptable, et
-- borné :
--   • la série est PERSONNELLE, elle n'est affichée qu'à son propriétaire ;
--   • le client peut déjà cocher n'importe quelle date via `p_date` ;
--   • la valeur est contrainte à `CURRENT_DATE ± 1`. Le décalage de fuseau
--     maximal réel est de UTC-12 à UTC+14, donc un jour de part et d'autre
--     couvre la Terre entière et rend inutile toute date fantaisiste.
--
-- ⚠️ Ne PAS « simplifier » en revenant à `CURRENT_DATE`. Un serveur ne peut
-- pas connaître le jour de l'utilisateur, et c'est l'utilisateur qui décide
-- de ce qu'est « aujourd'hui » pour sa série.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- 1) get_my_habits — lecture de liste
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
      -- « Aujourd'hui » selon le CLIENT, borné à ± 1 jour autour du serveur.
      GREATEST(CURRENT_DATE - 1,
               LEAST(COALESCE(p_today, CURRENT_DATE), CURRENT_DATE + 1)) AS today
  ),
  days AS (
    SELECT h.id AS habit_id, (kv.key)::date AS d
    FROM public.habits h
    CROSS JOIN LATERAL jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
    CROSS JOIN params p
    WHERE kv.value = 'true'::jsonb
      AND kv.key ~ '^\d{4}-\d{2}-\d{2}$'
      -- Jours futurs exclus, mais RELATIVEMENT AU CLIENT : c'est ce « today »
      -- qui rendait la complétion du jour invisible entre minuit et 2 h en
      -- Europe, parce qu'elle était future pour un serveur resté à la veille.
      AND (kv.key)::date <= p.today
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
    COALESCE(
      (SELECT jsonb_object_agg(kv.key, kv.value)
         FROM jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
        WHERE kv.key ~ '^\d{4}-\d{2}-\d{2}$'
          AND (kv.key)::date >= p.today - p.win),
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
  'Lecture bornee des habitudes. `completions` limite a p_days jours ; series et '
  'totaux calcules sur l historique ENTIER. `p_today` est la date LOCALE du '
  'client (bornee a CURRENT_DATE +/- 1) : la base est en UTC et les cles de '
  'completions sont ecrites en date locale, juger avec CURRENT_DATE affichait '
  'une serie fausse hors UTC (mig. 122).';


-- ═══════════════════════════════════════════════════════════════════
-- 2) toggle_habit_completion_v2 — même correction
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
  v_id    UUID;
  v_win   INTEGER := GREATEST(1, LEAST(COALESCE(p_days, 400), 3650));
  v_today DATE := GREATEST(CURRENT_DATE - 1,
                           LEAST(COALESCE(p_today, CURRENT_DATE), CURRENT_DATE + 1));
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid date format (expected YYYY-MM-DD)';
  END IF;

  -- Bascule ATOMIQUE, inchangée (correctif TOCTOU-1, mig. 023).
  UPDATE public.habits h
  SET completions = jsonb_set(
        COALESCE(h.completions, '{}'::jsonb),
        ARRAY[p_date],
        to_jsonb(NOT COALESCE((h.completions->>p_date)::boolean, false)),
        true
      )
  WHERE h.id = p_habit_id
    AND h.user_id = (SELECT auth.uid())
  RETURNING h.id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT (kv.key)::date AS d
    FROM public.habits h
    CROSS JOIN LATERAL jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
    WHERE h.id = v_id
      AND kv.value = 'true'::jsonb
      AND kv.key ~ '^\d{4}-\d{2}-\d{2}$'
      AND (kv.key)::date <= v_today
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
      (SELECT jsonb_object_agg(kv.key, kv.value)
         FROM jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
        WHERE kv.key ~ '^\d{4}-\d{2}-\d{2}$'
          AND (kv.key)::date >= v_today - v_win),
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
  'Bascule atomique avec retour borne. `p_today` est la date LOCALE du client '
  '(bornee a CURRENT_DATE +/- 1) : sans elle, cocher entre minuit et 2 h en '
  'Europe faisait BAISSER le compteur, le jour etant futur pour un serveur UTC '
  'reste a la veille (mig. 122).';


-- ═══════════════════════════════════════════════════════════════════
-- 3) Ménage : retirer les anciennes signatures
-- ═══════════════════════════════════════════════════════════════════
--
-- `CREATE OR REPLACE` ne remplace PAS une fonction dont la liste d'arguments
-- diffère : il en crée une SURCHARGE. Sans ce ménage, les deux versions
-- coexisteraient et PostgREST pourrait résoudre l'ancienne — celle qui a le
-- bug — quand le client n'envoie pas `p_today`.
DROP FUNCTION IF EXISTS public.get_my_habits(INTEGER);
DROP FUNCTION IF EXISTS public.toggle_habit_completion_v2(UUID, TEXT, INTEGER);

-- ═══════════════════════════════════════════════════════════════════
-- Vérification — à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
--
-- a) UNE seule signature par fonction (pas de surcharge résiduelle) :
--   select p.proname, pg_get_function_identity_arguments(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('get_my_habits','toggle_habit_completion_v2')
--    order by 1;
--   Attendu : get_my_habits(integer, date)
--             toggle_habit_completion_v2(uuid, text, integer, date)
--
-- b) La divergence de fuseau est fermée. Sur une habitude dont la série finit
--    HIER en date locale, avec un client en avance sur le serveur :
--   select streak_current from get_my_habits(400, CURRENT_DATE + 1);
--   -- doit rester cohérent, et non retomber à 0.
