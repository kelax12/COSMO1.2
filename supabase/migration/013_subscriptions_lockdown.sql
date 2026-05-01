-- ═══════════════════════════════════════════════════════════════════
-- Migration 013 — Verrouillage des champs sensibles de subscriptions
--
-- Tant que Stripe (faille §3) n'est pas en place, on empêche tout client
-- de modifier les colonnes premium sensibles depuis la console / une app
-- compromise. Seul le serveur (service_role via Edge Function future) ou
-- des fonctions SECURITY DEFINER explicites pourront les modifier.
--
-- Champs verrouillés : plan, status, current_period_end, win_streak.
-- Champ encore mutable côté client : premium_tokens (UI watch-ad / consume),
-- mais limité par trigger : decrement de 1 max ou increment de 1 max.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION subscriptions_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- user_id immutable (déjà couvert par trigger 011, double sécurité)
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'subscriptions.user_id is immutable';
  END IF;

  -- plan / status / current_period_end / win_streak verrouillés côté client
  IF OLD.plan IS DISTINCT FROM NEW.plan THEN
    RAISE EXCEPTION 'subscriptions.plan can only be changed by the server (Stripe webhook)';
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Tolère la transition automatique 'active' → 'expired' quand premium_tokens = 0
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

  -- premium_tokens : delta autorisé ∈ {-1, 0, +1} (consume / no-op / watch-ad)
  IF NEW.premium_tokens - OLD.premium_tokens NOT BETWEEN -1 AND 1 THEN
    RAISE EXCEPTION 'subscriptions.premium_tokens can only change by ±1 per update';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_guard ON subscriptions;
CREATE TRIGGER trg_subscriptions_guard
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION subscriptions_guard();

-- Note pour la suite : quand l'Edge Function Stripe sera en place, elle
-- doit s'authentifier en service_role pour bypasser ce trigger, OU le
-- trigger doit être réécrit pour autoriser les mutations quand
-- current_setting('request.jwt.claim.role', true) = 'service_role'.
