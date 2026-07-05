-- ═══════════════════════════════════════════════════════════════════
-- Migration 056 — Dashboard admin de croissance (/admin)
-- 1. user_activity_days : journal DAU append-only (1 ligne par user et
--    par jour de connexion), alimenté uniquement par touch_last_seen()
--    passée SECURITY DEFINER — le jour est CURRENT_DATE serveur, le
--    client ne peut pas forger d'historique. RLS sans policy : aucun
--    accès client direct (même pattern que demo_devices).
-- 2. admin_users : allowlist admin (RLS sans policy) + helper is_admin().
-- 3. get_admin_stats() : RPC unique SECURITY DEFINER retournant un jsonb
--    complet ; RAISE 42501 si l'appelant n'est pas admin.
-- Timezone : agrégations par jour en UTC. C'est voulu pour de
-- l'analytics de tendance — ne pas « corriger » vers la date locale
-- client (convention en-CA) : le décalage aux frontières de jour est
-- sans enjeu ici.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Journal d'activité quotidien ─────────────────────────────────
CREATE TABLE IF NOT EXISTS user_activity_days (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE user_activity_days ENABLE ROW LEVEL SECURITY;
-- Pas de policy : écritures via touch_last_seen(), lectures via get_admin_stats().

-- touch_last_seen (mig. 054) passe INVOKER → DEFINER pour pouvoir insérer
-- dans user_activity_days sans policy. Le périmètre reste identique : la
-- fonction n'écrit QUE la ligne de l'appelant (auth.uid()) et le jour
-- serveur (CURRENT_DATE). Ne JAMAIS y ajouter de paramètre client.
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.profiles SET last_seen_at = NOW() WHERE id = auth.uid();
  INSERT INTO public.user_activity_days (user_id, day)
  SELECT auth.uid(), CURRENT_DATE
  WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id, day) DO NOTHING;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- ── 2. Allowlist admin ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- Pas de policy : table gérée uniquement en migration / SQL editor.

-- Amorçage idempotent : uid résolu par email à l'application de la
-- migration. Si le compte n'existe pas dans cet environnement, insère
-- 0 ligne sans erreur — rejouer l'INSERT à la main le cas échéant.
INSERT INTO admin_users (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'axellongatte2@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── 3. RPC stats globales ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'totals', jsonb_build_object(
      'users', (SELECT COUNT(*) FROM auth.users),
      'active_today', (SELECT COUNT(*) FROM public.profiles
                       WHERE last_seen_at >= date_trunc('day', NOW())),
      'active_7d', (SELECT COUNT(*) FROM public.profiles
                    WHERE last_seen_at >= NOW() - INTERVAL '7 days'),
      'inactive_7d_plus', (SELECT COUNT(*) FROM public.profiles
                           WHERE last_seen_at IS NULL
                              OR last_seen_at < NOW() - INTERVAL '7 days')
    ),
    'signups_by_day', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS cnt
        FROM auth.users GROUP BY 1
      ) d
    ),
    'dau', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', a.day, 'count', a.cnt) ORDER BY a.day), '[]'::jsonb)
      FROM (
        SELECT day, COUNT(*) AS cnt FROM public.user_activity_days GROUP BY day
      ) a
    ),
    'demo', (
      SELECT jsonb_build_object(
        'visitors', COUNT(*),
        'converted', COUNT(converted_at),
        'conversion_pct', COALESCE(ROUND(100.0 * COUNT(converted_at) / NULLIF(COUNT(*), 0), 1), 0)
      ) FROM public.demo_devices
    ),
    'usage', jsonb_build_object(
      'tasks',        (SELECT COUNT(*) FROM public.tasks),
      'habits',       (SELECT COUNT(*) FROM public.habits),
      'events',       (SELECT COUNT(*) FROM public.events),
      'okrs',         (SELECT COUNT(*) FROM public.okrs),
      'shared_tasks', (SELECT COUNT(*) FROM public.shared_tasks)
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
