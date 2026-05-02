-- ═══════════════════════════════════════════════════════════════════
-- Migration 014 — Colonnes Stripe + bypass trigger pour service_role
--
-- 1. Ajoute stripe_customer_id / stripe_subscription_id sur subscriptions
-- 2. Met à jour subscriptions_guard() pour bypasser les vérifications
--    quand l'appelant est le service_role (Edge Function Stripe webhook)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON subscriptions(stripe_customer_id);

-- Mise à jour du guard : service_role bypass (webhook Stripe)
CREATE OR REPLACE FUNCTION subscriptions_guard()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role TEXT;
BEGIN
  -- Bypass complet pour le service_role (Edge Functions Stripe).
  -- On lit la claim JWT ET on vérifie le current_user Postgres pour couvrir
  -- toutes les façons dont une Edge Function peut s'authentifier.
  jwt_role := current_setting('request.jwt.claim.role', true);
  IF jwt_role = 'service_role' OR current_user::text = 'service_role' OR session_user::text = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- user_id immutable
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'subscriptions.user_id is immutable';
  END IF;

  -- plan / status / current_period_end / win_streak verrouillés côté client
  IF OLD.plan IS DISTINCT FROM NEW.plan THEN
    RAISE EXCEPTION 'subscriptions.plan can only be changed by the server (Stripe webhook)';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (OLD.status = 'active' AND NEW.status = 'expired' AND NEW.premium_tokens = 0) THEN
      RAISE EXCEPTION 'subscriptions.status can only be changed by the server';
    END IF;
  END IF;
  IF OLD.current_period_end IS DISTINCT FROM NEW.current_period_end THEN
    RAISE EXCEPTION 'subscriptions.current_period_end can only be changed by the server';
  END IF;
  IF OLD.win_streak IS DISTINCT FROM NEW.win_streak THEN
    RAISE EXCEPTION 'subscriptions.win_streak can only be changed by the server';
  END IF;

  -- premium_tokens : delta autorisé ∈ {-1, 0, +1}
  IF NEW.premium_tokens - OLD.premium_tokens NOT BETWEEN -1 AND 1 THEN
    RAISE EXCEPTION 'subscriptions.premium_tokens can only change by ±1 per update';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
