-- ═══════════════════════════════════════════════════════════════════
-- Migration 016 — Fix credit_premium_token_from_ad
--
-- Problème : la RPC incrémentait premium_tokens mais ne changeait pas
-- plan/status, donc isPremium() retournait false malgré les tokens.
--
-- Fix : la RPC active aussi plan='premium' et status='active' pour que
-- les tokens gagnés via pub débloquent réellement le premium.
-- current_period_end reste géré uniquement par le webhook Stripe pour
-- les abonnements payants ; pour les tokens pub il reste NULL ou inchangé.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION credit_premium_token_from_ad()
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result subscriptions;
  last_update TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT updated_at INTO last_update FROM subscriptions WHERE user_id = auth.uid();
  IF last_update IS NOT NULL AND last_update > NOW() - INTERVAL '30 seconds' THEN
    RAISE EXCEPTION 'Rate limit: wait at least 30 seconds between ad credits';
  END IF;

  UPDATE subscriptions
    SET premium_tokens = premium_tokens + 1,
        -- Activer le plan premium et le statut pour que isPremium() passe
        plan   = 'premium',
        status = 'active',
        updated_at = NOW()
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
