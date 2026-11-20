-- Preuve de la mig. 266 (`get_admin_usage_by_feature`), acteur par acteur.
--
-- Forme de `265.proof.sql` : un SEUL bloc `DO` terminé par `RAISE EXCEPTION`,
-- migration EMBARQUÉE (texte identique au fichier). Attendu :
--   « PREUVE-ANNULEE 0 ECHEC | … »
--
-- Acteurs : A admin allowlisté (aal2, puis aal1) · U compte ordinaire · anon
--           · X1 à X3 trois comptes qui créent chacun une tâche.
--
-- Vérifié APRÈS la migration :
--   · catalogue : rien pour anon, EXECUTE pour authenticated ;
--   · admin aal2 : 13 fonctionnalités rendues, jamais de compte de 1 ou 2
--     (seuil d'affichage : sous 3 la valeur est NULL) ;
--   · trois nouveaux comptes ayant créé une tâche : actifs 30 j et actions des
--     tâches égaux à un décompte direct de la table (la base peut déjà porter
--     des comptes, donc pas d'écart « +3 » : la base lue avant serait masquée) ;
--   · admin en aal1, compte ordinaire et anon : refusés.
--
-- Procédure d'application en production (après accord d'Axel) :
--   1. relire le ledger : jamais d'entrée `266_` ;
--   2. `npm run preuve:preprod -- 266` : « PREUVE-ANNULEE 0 ECHEC » ;
--   3. appliquer le fichier sous le nom `266_admin_usage_by_feature`,
--      AVANT le front qui appelle la fonction ;
--   4. relire au catalogue : `public.get_admin_usage_by_feature()`.

DO $proof$
DECLARE
  r   text[] := '{}';
  ko  int := 0;
  A   constant uuid := '00000000-0000-0000-0000-0000000a0266';
  U   constant uuid := '00000000-0000-0000-0000-0000000b0266';
  X1  constant uuid := '00000000-0000-0000-0000-0000000c0266';
  X2  constant uuid := '00000000-0000-0000-0000-0000000d0266';
  X3  constant uuid := '00000000-0000-0000-0000-0000000e0266';
  j0  jsonb; j1 jsonb;
  ok_ boolean;
  t1  int; ac1 int; e_a int; e_ac int;
BEGIN
  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 266 · Usage par fonctionnalité, console admin (PRD-01)
--
-- POURQUOI. La maturité produit était notée 3/10 faute de signal d'usage :
-- on sait combien de comptes existent, pas quelles fonctions servent. La
-- mesure se fait ICI, côté base, à partir de lignes que l'app crée déjà
-- (`created_at`, `completed_at`, complétions). Aucune collecte nouvelle,
-- aucun traceur (ADR 0007), aucune donnée personnelle rendue.
--
-- Pour chaque fonctionnalité : utilisateurs DISTINCTS actifs sur 7 et sur
-- 30 jours, et volume d'actions sur 30 jours. Une « action » est une ligne
-- créée dans la fenêtre (tâche créée ou terminée, complétion d'habitude,
-- événement, etc.).
--
-- Seuil d'affichage : un compte d'utilisateurs inférieur à 3 est rendu NULL
-- (et le volume d'actions avec lui quand moins de 3 actifs sur 30 jours),
-- pour qu'une fonction utilisée par une ou deux personnes n'en désigne pas.
--
-- Les catégories créées dans le jour qui suit l'inscription sont ignorées :
-- ce sont celles du jeu par défaut, pas un usage.
--
-- Garde : `is_admin()` (allowlist ET session aal2, mig. 131), jamais
-- `admin_allowlisted()`. Comptes exclus : la SEULE liste du dépôt
-- (`admin_stats_excluded_uids()`, mig. 149).
--
-- ORDRE : à appliquer AVANT le front qui appelle `get_admin_usage_by_feature`
-- (la porte de déploiement, CI-05, attend de toute façon la migration).
-- Idempotente / rejouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_admin_usage_by_feature()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  excluded  uuid[];
  min_users constant integer := 3;
  result    jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  excluded := public.admin_stats_excluded_uids();

  WITH ev AS (
    SELECT 1 AS ord, 'tasks'::text AS feature, t.user_id AS actor, t.created_at AS ts
      FROM public.tasks t WHERE t.created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT 1, 'tasks', t.user_id, t.completed_at
      FROM public.tasks t WHERE t.completed_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT 2, 'shared_tasks', s.shared_by, s.created_at
      FROM public.shared_tasks s WHERE s.created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT 3, 'task_dependencies', d.user_id, d.created_at
      FROM public.task_dependencies d WHERE d.created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT 4, 'lists', l.user_id, l.created_at
      FROM public.lists l
     WHERE l.created_at >= NOW() - INTERVAL '30 days' AND NOT l.is_default
    UNION ALL
    SELECT 5, 'habits', c.user_id, c.created_at
      FROM public.habit_completions c WHERE c.created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT 6, 'habit_auto_tasks', a.user_id, a.created_at
      FROM public.habit_auto_tasks a WHERE a.created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT 7, 'agenda', e.user_id, e.created_at
      FROM public.events e WHERE e.created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT 8, 'okr', k.user_id, k.created_at
      FROM public.kr_completions k WHERE k.created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT 9, 'categories', g.user_id, g.created_at
      FROM public.categories g
      JOIN auth.users u ON u.id = g.user_id
     WHERE g.created_at >= NOW() - INTERVAL '30 days'
       AND g.created_at > u.created_at + INTERVAL '1 day'
    UNION ALL
    SELECT 10, 'friends', f.user_id, f.created_at
      FROM public.friends f WHERE f.created_at >= NOW() - INTERVAL '30 days'
    -- Espace entreprise : l'acteur est l'organisation (organisations actives).
    UNION ALL
    SELECT 11, 'org_active', x.org_id, x.ts FROM (
      SELECT tt.org_id, tt.created_at AS ts FROM public.team_tasks tt
       WHERE tt.created_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT tp.org_id, tp.created_at FROM public.team_projects tp
       WHERE tp.created_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT ok.org_id, ok.created_at FROM public.team_okrs ok
       WHERE ok.created_at >= NOW() - INTERVAL '30 days'
    ) x
    JOIN public.organizations o ON o.id = x.org_id AND o.owner_id <> ALL(excluded)
    UNION ALL
    SELECT 12, 'team_tasks', tt.created_by, tt.created_at
      FROM public.team_tasks tt WHERE tt.created_at >= NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT 13, 'team_projects', tp.created_by, tp.created_at
      FROM public.team_projects tp WHERE tp.created_at >= NOW() - INTERVAL '30 days'
  ),
  agg AS (
    SELECT
      ord,
      feature,
      COUNT(DISTINCT actor) FILTER (WHERE ts >= NOW() - INTERVAL '7 days')  AS a7,
      COUNT(DISTINCT actor)                                                  AS a30,
      COUNT(*)                                                               AS actions
    FROM ev
    WHERE ts IS NOT NULL
      AND (feature = 'org_active' OR actor <> ALL(excluded))
    GROUP BY ord, feature
  ),
  all_features AS (
    SELECT v.ord, v.feature FROM (VALUES
      (1,'tasks'),(2,'shared_tasks'),(3,'task_dependencies'),(4,'lists'),
      (5,'habits'),(6,'habit_auto_tasks'),(7,'agenda'),(8,'okr'),
      (9,'categories'),(10,'friends'),(11,'org_active'),(12,'team_tasks'),
      (13,'team_projects')
    ) AS v(ord, feature)
  )
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'min_users', min_users,
    'features', COALESCE(jsonb_agg(
      jsonb_build_object(
        'feature', f.feature,
        'active_7d',    CASE WHEN COALESCE(g.a7, 0)  >= min_users THEN g.a7  END,
        'active_30d',   CASE WHEN COALESCE(g.a30, 0) >= min_users THEN g.a30 END,
        'actions_30d',  CASE WHEN COALESCE(g.a30, 0) >= min_users THEN g.actions END
      ) ORDER BY f.ord
    ), '[]'::jsonb)
  ) INTO result
  FROM all_features f
  LEFT JOIN agg g ON g.ord = f.ord;

  RETURN result;
END;
$function$;

COMMENT ON FUNCTION public.get_admin_usage_by_feature() IS
  'Usage par fonctionnalite : actifs distincts 7 j et 30 j, actions 30 j (mig. 266). '
  'Agregats seulement, compte < 3 masque (NULL), garde is_admin().';

REVOKE ALL ON FUNCTION public.get_admin_usage_by_feature() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_usage_by_feature() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_usage_by_feature() TO authenticated;
$mig$;

  -- ── Catalogue ─────────────────────────────────────────────────────
  ok_ := NOT has_function_privilege('anon', 'public.get_admin_usage_by_feature()', 'EXECUTE')
         AND has_function_privilege('authenticated', 'public.get_admin_usage_by_feature()', 'EXECUTE');
  r := r || ('01 catalogue : rien pour anon:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO auth.users (id, email) VALUES
    (A, 'a266@proof.invalid'), (U, 'u266@proof.invalid'),
    (X1, 'x1266@proof.invalid'), (X2, 'x2266@proof.invalid'), (X3, 'x3266@proof.invalid');
  INSERT INTO public.admin_users (user_id) VALUES (A);

  -- ── A admin aal2 : base avant ─────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN j0 := public.get_admin_usage_by_feature(); EXCEPTION WHEN OTHERS THEN j0 := NULL; END;
  EXECUTE 'RESET ROLE';
  ok_ := j0 IS NOT NULL AND jsonb_array_length(j0->'features') = 13 AND (j0->>'min_users')::int = 3;
  r := r || ('02 admin aal2 recoit 13 fonctionnalites:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- ── Trois comptes créent une tâche ────────────────────────────────
  INSERT INTO public.tasks (user_id, name, priority, completed) VALUES
    (X1, 'Preuve 266 a', 3, false), (X2, 'Preuve 266 b', 3, false), (X3, 'Preuve 266 c', 3, false);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN j1 := public.get_admin_usage_by_feature(); EXCEPTION WHEN OTHERS THEN j1 := NULL; END;
  EXECUTE 'RESET ROLE';

  SELECT (e->>'active_30d')::int, (e->>'actions_30d')::int INTO t1, ac1
    FROM jsonb_array_elements(j1->'features') e WHERE e->>'feature' = 'tasks';
  -- Décompte direct, sans passer par la RPC (rôle propriétaire) : la base peut
  -- déjà porter des comptes, la base lue avant serait masquée sous 3.
  SELECT count(DISTINCT user_id) INTO e_a FROM public.tasks
   WHERE (created_at >= now() - interval '30 days' OR completed_at >= now() - interval '30 days')
     AND user_id <> ALL(public.admin_stats_excluded_uids());
  SELECT (SELECT count(*) FROM public.tasks WHERE created_at >= now() - interval '30 days'
                 AND user_id <> ALL(public.admin_stats_excluded_uids()))
       + (SELECT count(*) FROM public.tasks WHERE completed_at >= now() - interval '30 days'
                 AND user_id <> ALL(public.admin_stats_excluded_uids())) INTO e_ac;
  ok_ := j1 IS NOT NULL AND t1 IS NOT NULL AND ac1 IS NOT NULL
         AND t1 = e_a AND ac1 = e_ac AND e_a >= 3;
  r := r || ('03 la RPC egale le decompte direct de la table:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- ── Seuil : jamais 1 ou 2 utilisateurs, ni actions sans actifs ────
  ok_ := j1 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(j1->'features') e
     WHERE (e->>'active_7d')::int  BETWEEN 1 AND 2
        OR (e->>'active_30d')::int BETWEEN 1 AND 2
        OR ((e->>'active_30d') IS NULL AND (e->>'actions_30d') IS NOT NULL));
  r := r || ('04 seuil de 3 respecte:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- ── Aucune donnée personnelle : seules les clés attendues ─────────
  ok_ := j1 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(j1->'features') e, jsonb_object_keys(e) k
     WHERE k NOT IN ('feature', 'active_7d', 'active_30d', 'actions_30d'));
  r := r || ('05 agregats seulement:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- ── A admin en aal1 : refusé ──────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN PERFORM public.get_admin_usage_by_feature(); ok_ := false;
  EXCEPTION WHEN SQLSTATE '42501' THEN ok_ := true; WHEN OTHERS THEN ok_ := false; END;
  EXECUTE 'RESET ROLE';
  r := r || ('06 admin aal1 refuse:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- ── U non-admin en aal2 : refusé ──────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN PERFORM public.get_admin_usage_by_feature(); ok_ := false;
  EXCEPTION WHEN SQLSTATE '42501' THEN ok_ := true; WHEN OTHERS THEN ok_ := false; END;
  EXECUTE 'RESET ROLE';
  r := r || ('07 non-admin refuse:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  -- ── anon : refusé ─────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN PERFORM public.get_admin_usage_by_feature(); ok_ := false;
  EXCEPTION WHEN SQLSTATE '42501' THEN ok_ := true; WHEN OTHERS THEN ok_ := false; END;
  EXECUTE 'RESET ROLE';
  r := r || ('08 anon refuse:' || CASE WHEN ok_ THEN 'OK' ELSE 'ECHEC' END);
  IF NOT ok_ THEN ko := ko + 1; END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END
$proof$;
