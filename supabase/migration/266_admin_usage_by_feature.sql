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
