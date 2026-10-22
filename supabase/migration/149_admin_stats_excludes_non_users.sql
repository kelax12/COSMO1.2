-- ═══════════════════════════════════════════════════════════════════
-- 149, `get_admin_stats` cesse de compter les comptes qui ne sont pas
--       des utilisateurs
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE. Mesuré en production le 2026-09-14,
-- puis rejoué le 2026-09-15 : `auth.users` porte **28 comptes**, dont deux
-- qui ne sont pas des utilisateurs du produit.
--
--   aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa · demo@cosmo.app
--     Créé le 2026-01-10. `last_sign_in_at IS NULL` : il ne s'est JAMAIS
--     connecté. Il porte pourtant, EN PRODUCTION, 120 tâches, 67
--     événements, 6 habitudes et 4 OKR, le jeu de démonstration.
--
--   728ecd25-67d2-4a9f-8cc4-d15b9e1ded51 · testemail@gmail.com
--     Créé le 2026-07-17, connecté une fois, la même minute.
--
-- `get_admin_stats` n'en excluait AUCUN (vérifié dans sa définition en
-- base, pas dans le dépôt). La console `/admin` annonçait donc **28
-- utilisateurs là où il y en a 26**, et **16 % des tâches de la plateforme**
-- appartenaient au compte de démonstration. Toutes les proportions que cette
-- console sert à lire (activation, rétention, adoption par module) étaient
-- diluées par un compte qui n'a jamais ouvert l'application.
--
-- ── LA DETTE EST ASSUMÉE, ET ELLE EST TENUE EN UN SEUL ENDROIT ──────
--
-- ⚠️ Une liste d'identifiants en dur dans du SQL est une dette : elle ne se
-- met pas à jour toute seule, et personne ne pense à la relire. L'arbitrage
-- a été rendu par Axel le 2026-09-15, l'alternative étant de ne rien coder
-- et d'écrire le biais là où les chiffres se lisent.
--
-- Ce qui rend la dette tenable est qu'elle vit à UN seul endroit,
-- `public.admin_stats_excluded_uids()`, et nulle part ailleurs. ❌ Ne
-- JAMAIS recopier un de ces UUID dans une requête, un écran ou un autre
-- agrégat : deux listes finiraient par diverger, et on se retrouverait avec
-- deux totaux d'utilisateurs différents selon l'endroit où on les lit.
--
-- 🔴 ET LA CONSOLE DOIT LE DIRE. La fonction rend désormais une clé
-- `excluded_accounts` : un chiffre corrigé sans mention de sa correction est
-- un chiffre qu'on ne peut pas recouper avec le tableau de bord Supabase, où
-- les 28 comptes seront toujours là. Un écart non expliqué finit toujours
-- par être pris pour un bug.
--
-- ── CE QUI N'EST PAS EXCLU, ET POURQUOI ─────────────────────────────
--
-- ⚠️ `demo_devices` n'est PAS filtrée : elle compte des APPAREILS qui ont
-- essayé le mode démo, pas des comptes. Le compte `demo@cosmo.app` n'y a
-- jamais mis les pieds (il ne s'est jamais connecté). Y toucher retirerait
-- de vraies visites.
--
-- ⚠️ `organizations` n'est PAS filtrée : aucun des deux comptes n'est
-- propriétaire d'une organisation, et filtrer sur `owner_id` ferait croire
-- que c'est le cas.
--
-- ── CE QUI NE CHANGE PAS ────────────────────────────────────────────
--
--   • La signature, donc aucun changement côté client, sauf la clé
--     `excluded_accounts` qui S'AJOUTE.
--   • `SECURITY DEFINER` + la garde `is_admin()` en tête (mig. 131 : elle
--     exige `aal2`, et elle reste la PREMIÈRE instruction du corps).
--   • `SET search_path = ''`, donc tous les noms restent qualifiés.
-- ═══════════════════════════════════════════════════════════════════

-- Les comptes qui ne sont pas des utilisateurs du produit.
--
-- 🔴 `STABLE` et pas `IMMUTABLE` : un `IMMUTABLE` autoriserait Postgres à
-- replier l'appel dans un plan mis en cache, et cette liste est destinée à
-- changer (le jour où le compte de seed sera supprimé, par exemple).
--
-- ⚠️ `SECURITY INVOKER` (le défaut), et c'est délibéré : elle ne lit RIEN.
-- Une fonction qui ne fait que rendre une constante n'a aucune raison de
-- s'élever en privilèges, et la règle du dépôt est qu'un `DEFINER` doit
-- pouvoir justifier ce qu'il va lire au-delà des droits de l'appelant.
CREATE OR REPLACE FUNCTION public.admin_stats_excluded_uids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT ARRAY[
    -- demo@cosmo.app : le compte de seed de la demonstration, cree le
    -- 2026-01-10, JAMAIS connecte, porteur du jeu de donnees montre.
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    -- testemail@gmail.com : compte d'essai du 2026-07-17.
    '728ecd25-67d2-4a9f-8cc4-d15b9e1ded51'::uuid
  ];
$$;

COMMENT ON FUNCTION public.admin_stats_excluded_uids() IS
  'Comptes qui ne sont pas des utilisateurs du produit (seed de demo, compte '
  'de test). SEULE liste de ce genre dans le depot : ne jamais recopier un de '
  'ces UUID ailleurs, deux listes divergeraient. Mig. 149.';

REVOKE ALL ON FUNCTION public.admin_stats_excluded_uids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_stats_excluded_uids() FROM anon;
-- Lisible par `authenticated` : elle ne rend qu'une constante, et
-- `get_admin_stats` est de toute facon gardee par `is_admin()`.
GRANT EXECUTE ON FUNCTION public.admin_stats_excluded_uids() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result   jsonb;
  v3       jsonb;
  excluded uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  excluded := public.admin_stats_excluded_uids();

  -- ══ v1 (mig. 056) + v2 (mig. 057) ══════════════════════════════════
  -- Seule difference avec la mig. 099 : chaque source keyee par un compte
  -- retranche `excluded`. Aucune agregation n'a change de forme.
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    -- 🔴 Le nombre de comptes RETRANCHES, rendu avec les chiffres qu'il
    -- corrige. Sans lui, `/admin` afficherait 26 la ou le tableau de bord
    -- Supabase en montre 28, sans que rien n'explique l'ecart.
    'excluded_accounts', COALESCE(array_length(excluded, 1), 0),
    'totals', jsonb_build_object(
      'users', (SELECT COUNT(*) FROM auth.users WHERE id <> ALL(excluded)),
      'active_today', (SELECT COUNT(*) FROM public.profiles
                       WHERE id <> ALL(excluded)
                         AND last_seen_at >= date_trunc('day', NOW())),
      'active_7d', (SELECT COUNT(*) FROM public.profiles
                    WHERE id <> ALL(excluded)
                      AND last_seen_at >= NOW() - INTERVAL '7 days'),
      'inactive_7d_plus', (SELECT COUNT(*) FROM public.profiles
                           WHERE id <> ALL(excluded)
                             AND (last_seen_at IS NULL
                                  OR last_seen_at < NOW() - INTERVAL '7 days')),
      'inactive_30d_plus', (SELECT COUNT(*) FROM public.profiles
                            WHERE id <> ALL(excluded)
                              AND (last_seen_at IS NULL
                                   OR last_seen_at < NOW() - INTERVAL '30 days'))
    ),
    'signups_by_day', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS cnt
        FROM auth.users WHERE id <> ALL(excluded) GROUP BY 1
      ) d
    ),
    'dau', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', a.day, 'count', a.cnt) ORDER BY a.day), '[]'::jsonb)
      FROM (
        SELECT day, COUNT(*) AS cnt FROM public.user_activity_days
        WHERE user_id <> ALL(excluded) GROUP BY day
      ) a
    ),
    -- ⚠️ `demo_devices` compte des APPAREILS, pas des comptes : elle n'est
    -- volontairement pas filtree (cf. l'en-tete).
    'demo', (
      SELECT jsonb_build_object(
        'visitors', COUNT(*),
        'converted', COUNT(converted_at),
        'conversion_pct', COALESCE(ROUND(100.0 * COUNT(converted_at) / NULLIF(COUNT(*), 0), 1), 0)
      ) FROM public.demo_devices
    ),
    'usage', jsonb_build_object(
      'tasks',        (SELECT COUNT(*) FROM public.tasks  WHERE user_id <> ALL(excluded)),
      'habits',       (SELECT COUNT(*) FROM public.habits WHERE user_id <> ALL(excluded)),
      'events',       (SELECT COUNT(*) FROM public.events WHERE user_id <> ALL(excluded)),
      'okrs',         (SELECT COUNT(*) FROM public.okrs   WHERE user_id <> ALL(excluded)),
      'shared_tasks', (SELECT COUNT(*) FROM public.shared_tasks st
                       WHERE st.shared_by <> ALL(excluded))
    ),
    -- ── v2 (mig. 057) ────────────────────────────────────────────────
    'signups_by_provider', (
      SELECT COALESCE(jsonb_object_agg(p.provider, p.cnt), '{}'::jsonb)
      FROM (
        SELECT COALESCE(raw_app_meta_data->>'provider', 'email') AS provider, COUNT(*) AS cnt
        FROM auth.users WHERE id <> ALL(excluded) GROUP BY 1
      ) p
    ),
    'adoption', jsonb_build_object(
      'tasks_users',  (SELECT COUNT(DISTINCT user_id) FROM public.tasks  WHERE user_id <> ALL(excluded)),
      'habits_users', (SELECT COUNT(DISTINCT user_id) FROM public.habits WHERE user_id <> ALL(excluded)),
      'events_users', (SELECT COUNT(DISTINCT user_id) FROM public.events WHERE user_id <> ALL(excluded)),
      'okrs_users',   (SELECT COUNT(DISTINCT user_id) FROM public.okrs   WHERE user_id <> ALL(excluded))
    ),
    'activation_24h', (
      SELECT jsonb_build_object(
        'activated', COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.user_id = u.id AND t.created_at <= u.created_at + INTERVAL '24 hours'
          ) OR EXISTS (
            SELECT 1 FROM public.habits h
            WHERE h.user_id = u.id AND h.created_at <= u.created_at + INTERVAL '24 hours'
          ) OR EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.user_id = u.id AND e.created_at <= u.created_at + INTERVAL '24 hours'
          ) OR EXISTS (
            SELECT 1 FROM public.okrs o
            WHERE o.user_id = u.id AND o.created_at <= u.created_at + INTERVAL '24 hours'
          )),
        'total', COUNT(*)
      ) FROM auth.users u WHERE u.id <> ALL(excluded)
    ),
    'tasks_completion', (
      SELECT jsonb_build_object(
        'completed', COUNT(*) FILTER (WHERE completed),
        'total', COUNT(*)
      ) FROM public.tasks WHERE user_id <> ALL(excluded)
    ),
    'collaboration', jsonb_build_object(
      'sharers', (SELECT COUNT(DISTINCT t.user_id)
                  FROM public.shared_tasks st JOIN public.tasks t ON t.id = st.task_id
                  WHERE t.user_id <> ALL(excluded)),
      'users_with_friends', (SELECT COUNT(DISTINCT user_id) FROM public.friends
                             WHERE user_id <> ALL(excluded)),
      'accepted_requests', (SELECT COUNT(*) FROM public.friend_requests
                            WHERE status = 'accepted' AND sender_id <> ALL(excluded))
    ),
    'retention_j7', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('week', c.week, 'signups', c.signups, 'retained', c.retained)
        ORDER BY c.week
      ), '[]'::jsonb)
      FROM (
        SELECT
          date_trunc('week', u.created_at)::date AS week,
          COUNT(*) AS signups,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM public.user_activity_days a
            WHERE a.user_id = u.id
              AND a.day BETWEEN (u.created_at AT TIME ZONE 'UTC')::date + 7
                            AND (u.created_at AT TIME ZONE 'UTC')::date + 13
          )) AS retained
        FROM auth.users u
        WHERE u.id <> ALL(excluded)
        GROUP BY 1
      ) c
    ),
    'stickiness', jsonb_build_object(
      'dau', (SELECT COUNT(DISTINCT user_id) FROM public.user_activity_days
              WHERE day = CURRENT_DATE AND user_id <> ALL(excluded)),
      'mau', (SELECT COUNT(DISTINCT user_id) FROM public.user_activity_days
              WHERE day >= CURRENT_DATE - 29 AND user_id <> ALL(excluded))
    )
  ) INTO result;

  -- ══ v3 (mig. 099), pack acquisition ═══════════════════════════════
  -- Une seule passe sur auth.users ⋈ profiles. Le filtre vit dans la CTE,
  -- donc il couvre les quatre agregats d'un coup : c'est l'endroit le plus
  -- sur pour le poser, et le seul qui ne puisse pas etre oublie a moitie.
  WITH u AS (
    SELECT
      au.id,
      au.created_at,
      (au.created_at AT TIME ZONE 'UTC')::date AS signup_day,
      COALESCE(NULLIF(p.acquisition_source, ''), 'unknown') AS source,
      (
        EXISTS (SELECT 1 FROM public.tasks t
                WHERE t.user_id = au.id AND t.created_at <= au.created_at + INTERVAL '48 hours')
        OR EXISTS (SELECT 1 FROM public.habits h
                   WHERE h.user_id = au.id AND h.created_at <= au.created_at + INTERVAL '48 hours')
        OR EXISTS (SELECT 1 FROM public.events e
                   WHERE e.user_id = au.id AND e.created_at <= au.created_at + INTERVAL '48 hours')
        OR EXISTS (SELECT 1 FROM public.okrs o
                   WHERE o.user_id = au.id AND o.created_at <= au.created_at + INTERVAL '48 hours')
      ) AS activated_48h,
      -- Cohorte J+7 « éligible » : la fenêtre J+7..J+13 doit être écoulée,
      -- sinon un canal lancé hier afficherait 0 % de rétention et serait coupé
      -- à tort.
      (au.created_at <= NOW() - INTERVAL '14 days') AS d7_eligible,
      EXISTS (
        SELECT 1 FROM public.user_activity_days a
        WHERE a.user_id = au.id
          AND a.day BETWEEN (au.created_at AT TIME ZONE 'UTC')::date + 7
                        AND (au.created_at AT TIME ZONE 'UTC')::date + 13
      ) AS retained_d7
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id <> ALL(excluded)
  )
  SELECT jsonb_build_object(
    'signups_by_source', (
      SELECT COALESCE(jsonb_object_agg(s.source, s.cnt), '{}'::jsonb)
      FROM (SELECT source, COUNT(*) AS cnt FROM u GROUP BY 1) s
    ),
    'signups_by_source_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', d.signup_day, 'source', d.source, 'count', d.cnt)
        ORDER BY d.signup_day, d.source
      ), '[]'::jsonb)
      FROM (
        SELECT signup_day, source, COUNT(*) AS cnt FROM u GROUP BY 1, 2
      ) d
    ),
    'activation_48h', jsonb_build_object(
      'activated', (SELECT COUNT(*) FILTER (WHERE activated_48h) FROM u),
      'total',     (SELECT COUNT(*) FROM u),
      'by_source', (
        SELECT COALESCE(jsonb_object_agg(
          a.source, jsonb_build_object('activated', a.activated, 'total', a.total)
        ), '{}'::jsonb)
        FROM (
          SELECT source,
                 COUNT(*) FILTER (WHERE activated_48h) AS activated,
                 COUNT(*) AS total
          FROM u GROUP BY 1
        ) a
      )
    ),
    'retention_d7_by_source', (
      SELECT COALESCE(jsonb_object_agg(
        r.source, jsonb_build_object('signups', r.signups, 'retained', r.retained)
      ), '{}'::jsonb)
      FROM (
        SELECT source,
               COUNT(*) AS signups,
               COUNT(*) FILTER (WHERE retained_d7) AS retained
        FROM u WHERE d7_eligible GROUP BY 1
      ) r
    ),
    -- ⚠️ `organizations` n'est PAS filtree : aucun des deux comptes exclus
    -- n'est proprietaire d'une organisation, et filtrer sur `owner_id`
    -- laisserait croire le contraire.
    'orgs', (
      SELECT jsonb_build_object(
        'total',                   COUNT(*),
        'created_30d',             COUNT(*) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days'),
        'with_3plus_members',      COUNT(*) FILTER (WHERE m.members >= 3),
        'with_3plus_members_30d',  COUNT(*) FILTER (WHERE m.members >= 3
                                                      AND o.created_at >= NOW() - INTERVAL '30 days')
      )
      FROM public.organizations o
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT om.user_id) AS members
        FROM public.organization_members om
        WHERE om.org_id = o.id
      ) m ON TRUE
    )
  ) INTO v3;

  RETURN result || v3;
END;
$function$;

COMMENT ON FUNCTION public.get_admin_stats() IS
  'Statistiques de la console /admin. Gardee par is_admin() (mig. 131 : exige '
  'aal2). Depuis la mig. 149, les comptes de admin_stats_excluded_uids() sont '
  'retranches de toutes les sources keyees par un compte, et leur NOMBRE est '
  'rendu dans la cle excluded_accounts : un chiffre corrige sans mention de sa '
  'correction ne se recoupe plus avec le tableau de bord Supabase.';

REVOKE ALL ON FUNCTION public.get_admin_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;

-- ── Vérification, à exécuter APRÈS application ──
--
-- 1. La garde n'a pas bougé : un compte NON admin doit toujours recevoir
--    42501, et un admin en `aal1` aussi (mig. 131).
--
-- 2. Les deux comptes sont bien retranchés. Attendu au 2026-09-15 :
--    `totals.users` = 26 (et non 28), `excluded_accounts` = 2,
--    `usage.tasks` = 629 (et non 750), `usage.events` = 367 (et non 434).
--
--    SELECT (public.get_admin_stats() -> 'totals' ->> 'users')::int  AS users,
--           (public.get_admin_stats() ->> 'excluded_accounts')::int  AS exclus,
--           (public.get_admin_stats() -> 'usage' ->> 'tasks')::int   AS taches;
--
-- 3. Les comptes exclus existent toujours : cette migration ne supprime
--    RIEN, elle ne fait que cesser de compter.
--
--    SELECT count(*) FROM auth.users;  -- doit toujours rendre 28
