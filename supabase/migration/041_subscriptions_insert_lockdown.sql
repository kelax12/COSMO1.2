-- ═══════════════════════════════════════════════════════════════════
-- Migration 041 — Verrouillage de l'INSERT client sur subscriptions
--
-- Trou résiduel de la faille §2 (audit architecture 2026-06-10, fiche N14) :
-- la migration 015 a supprimé la policy UPDATE client, mais la policy INSERT
-- (créée en dashboard) ne contraignait que `auth.uid() = user_id`. Un compte
-- SANS ligne subscription (avant l'auto-create du BillingProvider) pouvait
-- donc s'auto-insérer :
--   - `plan = 'premium', premium_tokens = 9999` → premium gratuit ;
--   - `ad_credits_in_window = -1000000` → contournement du cap pub (mig. 039).
--
-- Fix : l'INSERT client n'autorise que la ligne d'amorçage exacte que crée
-- `BillingProvider` (`billing.context.tsx`) : plan free, zéro token, zéro
-- streak, aucun champ Stripe, aucune fenêtre pub. Le webhook Stripe écrit en
-- service_role et bypasse RLS — non affecté.
--
-- Idempotent (DROP IF EXISTS + CREATE). user_id immuable via trigger 010/011.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can insert own subscription" ON subscriptions;

CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND plan = 'free'
    AND COALESCE(premium_tokens, 0) = 0
    AND COALESCE(win_streak, 0) = 0
    AND current_period_end IS NULL
    AND stripe_customer_id IS NULL
    AND stripe_subscription_id IS NULL
    AND ad_credits_window_start IS NULL
    AND COALESCE(ad_credits_in_window, 0) = 0
  );
