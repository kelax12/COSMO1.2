-- ═══════════════════════════════════════════════════════════════════
-- Migration 039 — Plafond journalier sur les crédits premium "pub"
--
-- Faille (audit architecture 2026-06-07, TOP-1) :
--   `credit_premium_token_from_ad()` (mig. 015/016) n'était throttlé qu'à
--   30 secondes et posait plan='premium' + status='active' + premium_tokens+1
--   SANS aucune attestation qu'une publicité ait réellement été visionnée.
--   Un client authentifié pouvait donc scripter l'appel (1 / 30 s = 2880/jour)
--   et s'octroyer un premium gratuit illimité → bypass total de la
--   monétisation.
--
-- Fix :
--   Plafond strict de 1 crédit / 24 h, mesuré sur une colonne DÉDIÉE
--   `last_ad_credit_at` (et non `updated_at`, qui est muté par
--   `consume_premium_token` et le webhook Stripe, donc inexploitable comme
--   horloge anti-abus).
--
--   Le free tier "ad-supported" reste intentionnel (≈ 1 jour de premium par
--   jour de pub regardée), mais un script n'obtient désormais STRICTEMENT
--   RIEN de plus qu'un utilisateur légitime : le rythme maximal d'octroi est
--   identique. La voie de revenu Stripe n'est plus contournable.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION.
-- À appliquer en prod via `supabase db push` (non auto-appliqué par le
-- déploiement Vercel front).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_ad_credit_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION credit_premium_token_from_ad()
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result subscriptions;
  last_credit TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT last_ad_credit_at INTO last_credit
  FROM subscriptions
  WHERE user_id = auth.uid();

  -- Plafond anti-abus : 1 crédit toutes les 24 h. Un script n'obtient pas
  -- plus qu'un viewer légitime (même rythme d'octroi).
  IF last_credit IS NOT NULL AND last_credit > NOW() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Rate limit: only one ad credit per 24 hours';
  END IF;

  UPDATE subscriptions
    SET premium_tokens   = premium_tokens + 1,
        -- Activer plan/status pour que isPremium() passe (cf. mig. 016).
        plan             = 'premium',
        status           = 'active',
        last_ad_credit_at = NOW(),
        updated_at       = NOW()
    WHERE user_id = auth.uid()
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION credit_premium_token_from_ad() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION credit_premium_token_from_ad() TO authenticated;
