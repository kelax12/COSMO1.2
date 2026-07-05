-- ═══════════════════════════════════════════════════════════════════
-- Migration 054 — Dernière connexion utilisateur
-- Ajoute profiles.last_seen_at, mis à jour à chaque ouverture de session
-- via la RPC touch_last_seen() (timestamp pris côté serveur : le client
-- ne peut pas forger de date, il ne peut que « pinger » sa propre ligne).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;
