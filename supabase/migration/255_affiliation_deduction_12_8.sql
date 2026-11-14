-- ═══════════════════════════════════════════════════════════════════
-- 255 · Affiliation : déduction ramenée de 25,6 % à 12,8 % (décision du 2026-11-14)
-- ═══════════════════════════════════════════════════════════════════
--
-- commission = 50 % × (payé HT − 12,8 % du payé − frais Stripe).
-- Non rétroactif : chaque ligne de `affiliate_commissions` garde son
-- `deduction_bp` ; seuls les paiements suivants prennent 1280.

ALTER TABLE public.affiliate_settings ALTER COLUMN deduction_bp SET DEFAULT 1280;
UPDATE public.affiliate_settings SET deduction_bp = 1280 WHERE id;
