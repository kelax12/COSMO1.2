-- ═══════════════════════════════════════════════════════════════════
-- Migration 055 — Tracking conversion démo → compte
-- Compte les appareils distincts ayant testé le mode démo (UUID anonyme
-- généré client, persistant dans localStorage) et marque la conversion
-- quand ce même appareil ouvre une session authentifiée.
-- Aucun accès direct à la table côté client : RLS activée sans policy,
-- tout passe par les 2 RPCs SECURITY DEFINER ci-dessous. La lecture se
-- fait via la vue demo_conversion_stats (dashboard SQL uniquement).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS demo_devices (
  device_id         UUID PRIMARY KEY,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at      TIMESTAMPTZ,
  converted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE demo_devices ENABLE ROW LEVEL SECURITY;

-- Enregistre une visite démo. Idempotent par appareil (1 ligne max).
-- Exposée à anon : le mode démo se lance sans session Supabase.
CREATE OR REPLACE FUNCTION public.record_demo_visit(p_device_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.demo_devices (device_id) VALUES (p_device_id)
  ON CONFLICT (device_id) DO NOTHING;
$$;

REVOKE EXECUTE ON FUNCTION public.record_demo_visit(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.record_demo_visit(UUID) TO anon, authenticated;

-- Marque la conversion (première session authentifiée sur un appareil qui a
-- fait la démo). auth.uid() côté serveur : non forgeable. Ne convertit qu'une
-- fois (converted_at IS NULL) et ignore les device_id jamais vus en démo.
CREATE OR REPLACE FUNCTION public.record_demo_conversion(p_device_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.demo_devices
  SET converted_at = NOW(), converted_user_id = auth.uid()
  WHERE device_id = p_device_id
    AND converted_at IS NULL
    AND auth.uid() IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.record_demo_conversion(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_demo_conversion(UUID) TO authenticated;

-- Vue de visualisation (Supabase Dashboard → SQL editor) :
--   SELECT * FROM demo_conversion_stats;
CREATE OR REPLACE VIEW demo_conversion_stats
WITH (security_invoker = on) AS
SELECT
  COUNT(*)::int                 AS demo_users,
  COUNT(converted_at)::int      AS converted_users,
  ROUND(100.0 * COUNT(converted_at) / NULLIF(COUNT(*), 0), 1) AS conversion_pct
FROM demo_devices;

REVOKE ALL ON demo_conversion_stats FROM anon, authenticated;
