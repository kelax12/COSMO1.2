-- ═══════════════════════════════════════════════════════════════════
-- Migration 015 — Subscriptions : passage trigger → RPC
--
-- Le trigger subscriptions_guard (013/014) bloquait le webhook Stripe
-- malgré le bypass service_role (selon le contexte d'auth de l'Edge
-- Function, le current_user / JWT claim n'est pas toujours résolu).
--
-- Nouvelle approche, plus robuste :
-- 1. DROP du trigger.
-- 2. DROP de la policy UPDATE côté client → les clients ne peuvent plus
--    UPDATE `subscriptions` directement (RLS deny par défaut).
-- 3. Le webhook Stripe (service_role) bypasse RLS naturellement → OK.
-- 4. Les opérations légitimes côté client passent par 2 RPCs
--    SECURITY DEFINER avec contraintes strictes :
--      - consume_premium_token() : décrémente de 1 (consommation quotidienne)
--      - credit_premium_token_from_ad() : incrémente de 1 (vidéo regardée)
--    Aucune RPC ne permet de modifier plan/status/period_end/win_streak.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Suppression du trigger et de la policy UPDATE ─────────────
DROP TRIGGER IF EXISTS trg_subscriptions_guard ON subscriptions;
-- (On garde la fonction subscriptions_guard() pour ne rien casser ailleurs,
--  mais elle n'est plus attachée à aucun trigger.)

DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;

-- ─── 2. RPC : consommation quotidienne d'un token ────────────────
CREATE OR REPLACE FUNCTION consume_premium_token()
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result subscriptions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE subscriptions
    SET premium_tokens = GREATEST(premium_tokens - 1, 0),
        status = CASE
          WHEN premium_tokens - 1 <= 0 THEN 'expired'
          ELSE status
        END
    WHERE user_id = auth.uid()
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION consume_premium_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_premium_token() TO authenticated;

-- ─── 3. RPC : crédit d'un token via vidéo (rate limit côté DB) ────
-- Limite : 1 crédit par 30 secondes minimum (anti-spam basique).
-- Une rate limit plus stricte (ex. 1/jour) nécessiterait une colonne dédiée
-- — à prévoir dans une migration ultérieure si besoin.
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
