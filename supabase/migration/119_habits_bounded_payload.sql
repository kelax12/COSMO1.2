-- ═══════════════════════════════════════════════════════════════════
-- Migration 119 — `habits.completions` : payload borné, chiffres exacts
--
-- LE PROBLÈME, MESURÉ (et il n'était dans aucun audit).
--
-- `habits.completions` est un JSONB `{ "2026-08-24": true, … }` qui gagne une
-- entrée PAR JOUR et PAR HABITUDE, sans aucune borne. Mesuré en prod le
-- 2026-08-24 : **12,7 octets par jour** (1 538 o pour 121 jours d'historique).
--
--   1 an   →  ~4,6 ko par habitude
--   3 ans  →  ~14 ko par habitude, soit **~280 ko par lecture de liste**
--             pour 20 habitudes, à chaque ouverture de la page Habitudes.
--
-- C'est le vrai point de rupture de payload du produit. Le finding
-- « `select('*')` sur 5 modules » de `docs/SCALABILITY.md` §4 visait à côté :
-- trimmer des colonnes aurait gagné 6 % sur `events`, pendant que cette
-- colonne-ci croît linéairement et sans fin.
--
-- POURQUOI ON NE PEUT PAS SE CONTENTER DE TRONQUER.
--
-- Deux consommateurs ont besoin de l'historique COMPLET, et les tronquer
-- afficherait des chiffres FAUX, ce qui est pire qu'un gros payload :
--
--   • la SÉRIE (`src/modules/habits/streak.ts`) remonte jusqu'à 3 650 jours.
--     Un utilisateur assidu depuis trois ans a une série de ~1 000 jours ;
--     avec une fenêtre de 400, on lui afficherait 400.
--   • la vue « Tout » de `HabitGlobalTracking` part de la création de
--     l'habitude.
--
-- LE CORRECTIF : déplacer le CALCUL, pas seulement couper la donnée.
--
-- `get_my_habits(p_days)` renvoie :
--   • `completions` filtré aux `p_days` derniers jours → payload BORNÉ, il ne
--     croît plus après la fenêtre ;
--   • `streak_current`, `streak_best`, `completions_total`,
--     `first_completion_date` calculés côté serveur sur l'historique ENTIER
--     → chiffres EXACTS sans transférer l'historique.
--
-- 400 jours : le même seuil que la rétention des mig. 114. C'est le plus petit
-- qui préserve une comparaison d'une année sur l'autre, et il couvre largement
-- le heatmap (26 semaines = 182 jours) et toutes les vues datées.
--
-- ⚠️ SECURITY INVOKER (défaut), et c'est délibéré : la policy de `habits` est
-- un simple `user_id = auth.uid()`, indexable, sans le `OR` qui avait forcé
-- `get_my_tasks` en DEFINER (mig. 085). Aucun périmètre à ré-implémenter,
-- donc aucun périmètre à prouver — la RLS fait le travail. Ne PAS « aligner »
-- cette fonction sur les autres en la passant en DEFINER : ce serait ajouter
-- une surface à protéger pour rien.
--
-- ⚠️ AUCUNE DONNÉE N'EST SUPPRIMÉE. La colonne garde tout ; c'est la LECTURE
-- qui est bornée. Un export CSV ou une reprise d'historique lit toujours la
-- table directement.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_habits(p_days INTEGER DEFAULT 400)
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
  WITH bounded AS (
    SELECT
      h.id,
      -- Borne DURE : 1 à 3 650 jours. Sans elle, un client pourrait demander
      -- p_days = 100000 et réintroduire exactement le problème qu'on corrige.
      GREATEST(1, LEAST(COALESCE(p_days, 400), 3650)) AS win
    FROM public.habits h
  ),
  -- Jours réellement cochés, une ligne par (habitude, jour).
  -- ⚠️ Le filtre `~ '^\d{4}-\d{2}-\d{2}$'` n'est pas cosmétique : une clé
  -- malformée ferait LEVER le cast `::date` et casserait la lecture de TOUTES
  -- les habitudes de l'utilisateur, pas seulement celle en cause.
  days AS (
    SELECT h.id AS habit_id, (kv.key)::date AS d
    FROM public.habits h
    CROSS JOIN LATERAL jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
    WHERE kv.value = 'true'::jsonb
      AND kv.key ~ '^\d{4}-\d{2}-\d{2}$'
      -- Jours FUTURS exclus : `streak.ts` part d'aujourd'hui et REMONTE, il
      -- ne les voit jamais. Sans ce filtre, une date future (import, bug,
      -- horloge client en avance) gonflerait la serie cote serveur et les
      -- deux chiffres divergeraient — le pire des resultats, puisque
      -- l'utilisateur verrait un nombre different selon l'ecran.
      AND (kv.key)::date <= CURRENT_DATE
  ),
  -- Îlots de jours consécutifs : `d - row_number()` est constant sur une suite.
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
      -- Série EN COURS : la suite qui touche aujourd'hui, ou hier (la journée
      -- n'est pas finie — même règle que `streak.ts`, à la lettre).
      COALESCE(MAX(r.len) FILTER (
        WHERE r.last_day >= (CURRENT_DATE - 1)
      ), 0) AS current,
      SUM(r.len)::int AS total,
      MIN(r.last_day - (r.len - 1)) AS first_day
    FROM runs r
    GROUP BY r.habit_id
  )
  SELECT
    h.id,
    h.name,
    h.description,
    h.frequency,
    h.estimated_time,
    h.color,
    h.icon,
    -- Le payload borné : on ne garde que les clés dans la fenêtre.
    COALESCE(
      (SELECT jsonb_object_agg(kv.key, kv.value)
         FROM jsonb_each(COALESCE(h.completions, '{}'::jsonb)) kv
        WHERE kv.key ~ '^\d{4}-\d{2}-\d{2}$'
          AND (kv.key)::date >= CURRENT_DATE - b.win),
      '{}'::jsonb
    ) AS completions,
    h.user_id,
    h.created_at,
    COALESCE(a.current, 0)::int,
    COALESCE(a.best, 0)::int,
    COALESCE(a.total, 0)::int,
    a.first_day,
    b.win
  FROM public.habits h
  JOIN bounded b ON b.id = h.id
  LEFT JOIN agg a ON a.habit_id = h.id
  ORDER BY h.created_at DESC, h.id DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_habits(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_habits(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_habits(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_my_habits(INTEGER) IS
  'Lecture bornee des habitudes. `completions` est filtre aux p_days derniers '
  'jours (defaut 400, cap 3650) pour borner un payload qui croissait de 12,7 '
  'octets PAR JOUR et par habitude, sans fin. Les agregats qui ont besoin de '
  'l historique complet (serie en cours, meilleure serie, total, premiere '
  'completion) sont calcules SERVEUR sur la totalite : le payload est borne, '
  'les chiffres restent exacts. SECURITY INVOKER : la RLS de habits est un '
  'simple user_id = auth.uid(), il n y a aucun perimetre a re-implementer.';

-- ═══════════════════════════════════════════════════════════════════
-- Vérification — à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
--
-- a) Droits :
--   select has_function_privilege('anon','public.get_my_habits(integer)','EXECUTE'),
--          has_function_privilege('authenticated','public.get_my_habits(integer)','EXECUTE');
--   Attendu : false / true
--
-- b) La serie calculee en SQL est IDENTIQUE a celle calculee en JS. C'est LE
--    point a verifier : un ecart afficherait un chiffre faux a l'utilisateur.
--   select id, name, streak_current, streak_best, completions_total,
--          first_completion_date, jsonb_object_keys_count
--     from get_my_habits(400) g
--     join lateral (select count(*) as jsonb_object_keys_count
--                     from jsonb_object_keys(g.completions)) k on true;
--
-- c) Le payload est bien borne (comparer avant/apres sur un gros compte) :
--   select sum(pg_column_size(completions)) as apres from get_my_habits(400);
--   select sum(pg_column_size(completions)) as avant from public.habits;
