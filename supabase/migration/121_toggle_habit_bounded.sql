-- ═══════════════════════════════════════════════════════════════════
-- Migration 121 — `toggle_habit_completion_v2` : retour borné
--
-- CONTEXTE. La mig. 119 a borné la LECTURE DE LISTE des habitudes
-- (`get_my_habits`), parce que `completions` gagnait une entrée par jour et
-- par habitude sans aucune borne (12,7 o/jour mesurés). Elle laissait un
-- chemin non borné : le TOGGLE.
--
--   toggle_habit_completion(...) RETURNS public.habits
--
-- `RETURNS public.habits`, donc la ligne ENTIÈRE, tout l'historique compris,
-- renvoyée à CHAQUE coche. ~14 ko par clic à trois ans. Le coût ne croît pas
-- avec le nombre d'habitudes (une seule ligne), mais il croît avec le temps,
-- et c'est l'action la plus fréquente du produit.
--
-- Pire : le retour était JETÉ. Le hook invalidait `habitKeys.lists()` juste
-- après, ce qui déclenchait un `get_my_habits()` COMPLET (toutes les
-- habitudes) pour retrouver un état qu'on venait de calculer. Chaque coche
-- coûtait donc deux allers-retours, dont un inutile.
--
-- LE CORRECTIF. Une v2 qui renvoie EXACTEMENT la même forme que
-- `get_my_habits` : ligne bornée à `p_days` + les quatre agrégats calculés
-- sur l'historique entier. Le client peut alors écrire directement la ligne
-- fraîche dans le cache et SUPPRIMER le refetch de liste.
--
-- ⚠️ POURQUOI UNE `_v2` ET PAS UN `CREATE OR REPLACE`. Postgres refuse de
-- changer le type de retour d'une fonction existante par `CREATE OR REPLACE`.
-- Il faudrait `DROP` puis `CREATE` — mais entre les deux, tout client déjà
-- déployé qui coche une habitude reçoit `function does not exist`. La v1 est
-- donc CONSERVÉE, intacte : le déploiement est réversible sans downtime, et
-- un onglet resté ouvert sur l'ancienne version continue de fonctionner.
-- Convention déjà en place dans ce dépôt (`toggle_task_complete_v2`,
-- `accept_friend_request_v2`).
--
-- ⚠️ La logique de bascule est reprise À LA LETTRE de la mig. 023 : même
-- `jsonb_set` atomique (lecture + écriture dans UN seul statement, sous
-- verrou de ligne — c'est le correctif TOCTOU-1, ne pas le défaire), même
-- garde de format de date, même `user_id = auth.uid()` en défense en
-- profondeur, même `SECURITY INVOKER`.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.toggle_habit_completion_v2(
  p_habit_id UUID,
  p_date     TEXT,
  p_days     INTEGER DEFAULT 400
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
  v_id  UUID;
  v_win INTEGER := GREATEST(1, LEAST(COALESCE(p_days, 400), 3650));
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Garde de format : sans elle, une clé arbitraire entrerait dans le JSONB
  -- (abus de `jsonb_set`) et casserait ensuite le cast `::date` des agrégats.
  IF p_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid date format (expected YYYY-MM-DD)';
  END IF;

  -- Bascule ATOMIQUE : lecture + écriture dans un seul statement, sous verrou
  -- de ligne. Un toggle concurrent depuis un autre onglet sérialise derrière
  -- (correctif TOCTOU-1, mig. 023). Ne JAMAIS revenir à SELECT puis UPDATE.
  UPDATE public.habits h
  SET completions = jsonb_set(
        COALESCE(h.completions, '{}'::jsonb),
        ARRAY[p_date],
        to_jsonb(NOT COALESCE((h.completions->>p_date)::boolean, false)),
        true
      )
  WHERE h.id = p_habit_id
    AND h.user_id = (SELECT auth.uid())   -- défense en profondeur (la RLS filtre déjà)
  RETURNING h.id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;

  -- Même forme de sortie que `get_my_habits` : ligne bornée + agrégats
  -- calculés sur l'historique ENTIER. C'est ce qui permet au client de se
  -- passer du refetch de liste.
  RETURN QUERY
  WITH days AS (
    SELECT (kv.key)::date AS d
    FROM public.habits h
    CROSS JOIN LATERAL jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
    WHERE h.id = v_id
      AND kv.value = 'true'::jsonb
      AND kv.key ~ '^\d{4}-\d{2}-\d{2}$'
      -- Jours futurs exclus : `streak.ts` part d'aujourd'hui et REMONTE.
      AND (kv.key)::date <= CURRENT_DATE
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
           COALESCE(MAX(r.len) FILTER (WHERE r.last_day >= (CURRENT_DATE - 1)), 0) AS current,
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
          AND (kv.key)::date >= CURRENT_DATE - v_win),
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

REVOKE ALL ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.toggle_habit_completion_v2(UUID, TEXT, INTEGER) IS
  'Bascule atomique d une completion, avec retour BORNE (meme forme que '
  'get_my_habits) : ligne limitee a p_days + agregats calcules sur l historique '
  'entier. La v1 renvoyait la ligne ENTIERE a chaque coche (~14 ko a trois ans) '
  'et son retour etait jete au profit d un refetch complet de la liste. La v1 '
  'est conservee intacte : changer un type de retour impose DROP+CREATE, ce qui '
  'casserait tout onglet deja ouvert pendant le deploiement.';

-- ═══════════════════════════════════════════════════════════════════
-- Vérification — à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
--
-- a) Droits :
--   select has_function_privilege('anon','public.toggle_habit_completion_v2(uuid,text,integer)','EXECUTE'),
--          has_function_privilege('authenticated','public.toggle_habit_completion_v2(uuid,text,integer)','EXECUTE');
--   Attendu : false / true
--
-- b) La v1 existe TOUJOURS (rollback sans downtime) :
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and p.proname='toggle_habit_completion';
--   Attendu : 1
--
-- c) Aller-retour sur une vraie habitude (le toggle est idempotent en aller
--    simple : rejouer le meme appel remet l etat initial) :
--   select id, streak_current, completions_total,
--          (select count(*) from jsonb_object_keys(completions)) as jours_dans_la_fenetre
--     from toggle_habit_completion_v2('<habit_uuid>', to_char(current_date,'YYYY-MM-DD'));
--   -- puis rejouer le MEME appel pour revenir a l etat de depart.
