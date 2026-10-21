-- ═══════════════════════════════════════════════════════════════════
-- 224 · Réarmement de la limite de sièges entreprise (bascule Stripe live)
-- ═══════════════════════════════════════════════════════════════════
--
-- Inverse de la mig. 124. Appliquée le 2026-10-20, le même jour que
-- `ENTERPRISE_BILLING_ENFORCED = true` (premium-config.ts) : les deux
-- drapeaux se déplacent ENSEMBLE (src/modules/billing/CLAUDE.md).
--
-- Préalables vérifiés le 2026-10-20 : SIREN obtenu, secrets Stripe LIVE posés
-- (empreintes contrôlées), webhook live en API 2024-06-20, mig. 140 appliquée
-- et reset_stripe_identifiers(true) joué (5 customers de test effacés).
--
-- Retour arrière : rejouer la mig. 124 ET repasser le flag TS à false.
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

UPDATE public.billing_flags
   SET enabled = true
 WHERE key = 'enterprise_seat_limit';

INSERT INTO public.billing_flags (key, enabled)
SELECT 'enterprise_seat_limit', true
 WHERE NOT EXISTS (
   SELECT 1 FROM public.billing_flags WHERE key = 'enterprise_seat_limit'
 );
