-- ═══════════════════════════════════════════════════════════════════
-- 238 · Affiliation : nouvelle formule de commission (décision du 2026-11-01)
-- ═══════════════════════════════════════════════════════════════════
--
-- Avant (mig. 236) : commission = 39,5 % × (payé HT − frais Stripe).
-- Après           : commission = 50 % × (payé HT − 25,6 % du payé − frais Stripe).
--
-- La déduction est un nouveau taux réglable, `deduction_bp` (2560 = 25,6 %),
-- prise sur le montant payé (`gross`), comme les frais Stripe.
--
-- Non rétroactif : les lignes déjà écrites gardent leurs taux. Elles reçoivent
-- `deduction_bp = 0` et `deduction_cents = 0`, ce qui est exactement leur calcul.
-- Les remboursements gardent les taux du paiement d'origine (inchangé).
--
-- Formules : `_shared/affiliation-math.ts` (référence, `src/affiliation-math.guard.test.ts`).

-- ─── Réglages ──────────────────────────────────────────────────────

ALTER TABLE public.affiliate_settings
  ADD COLUMN IF NOT EXISTS deduction_bp INT NOT NULL DEFAULT 2560
    CHECK (deduction_bp BETWEEN 0 AND 10000);
ALTER TABLE public.affiliate_settings ALTER COLUMN commission_bp SET DEFAULT 5000;
UPDATE public.affiliate_settings SET commission_bp = 5000, deduction_bp = 2560 WHERE id;

-- ─── Commissions : trace de la déduction appliquée ─────────────────

ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS deduction_bp    INT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_cents BIGINT NOT NULL DEFAULT 0;

-- ─── Calcul (reproduit `_shared/affiliation-math.ts` au centime) ──

CREATE OR REPLACE FUNCTION public.affiliate_compute(
  p_gross BIGINT, p_vat_bp INT, p_deduction_bp INT, p_fee_bp INT, p_fee_fixed INT, p_rate_bp INT,
  OUT vat_cents BIGINT, OUT deduction_cents BIGINT, OUT fee_cents BIGINT, OUT base_cents BIGINT,
  OUT commission_cents BIGINT
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  vat_cents := p_gross - round(p_gross::numeric / (1 + p_vat_bp::numeric / 10000));
  deduction_cents := round(p_gross::numeric * p_deduction_bp / 10000);
  fee_cents := round(p_gross::numeric * p_fee_bp / 10000) + p_fee_fixed;
  base_cents := greatest(p_gross - vat_cents - deduction_cents - fee_cents, 0);
  commission_cents := round(base_cents::numeric * p_rate_bp / 10000);
END;
$$;
REVOKE ALL ON FUNCTION public.affiliate_compute(BIGINT, INT, INT, INT, INT, INT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_process(p_rec public.payment_records)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_set    public.affiliate_settings;
  v_uid    UUID;
  v_aff    UUID;
  v_at     TIMESTAMPTZ;
  v_c      RECORD;
  v_origin public.affiliate_commissions;
  v_comm   BIGINT;
  v_count  INT;
BEGIN
  IF p_rec.event_type = 'invoice.payment_succeeded' AND p_rec.amount_cents > 0 THEN
    v_uid := p_rec.user_id;
    IF v_uid IS NULL AND p_rec.org_id IS NOT NULL THEN
      SELECT os.purchased_by INTO v_uid
        FROM public.org_subscriptions os WHERE os.org_id = p_rec.org_id;
    END IF;
    IF v_uid IS NULL THEN RETURN false; END IF;

    SELECT p.affiliate_id, p.affiliated_at INTO v_aff, v_at
      FROM public.profiles p WHERE p.id = v_uid;
    IF v_aff IS NULL OR v_at IS NULL OR v_at > p_rec.occurred_at THEN RETURN false; END IF;

    SELECT * INTO STRICT v_set FROM public.affiliate_settings WHERE id;
    SELECT * INTO v_c FROM public.affiliate_compute(
      p_rec.amount_cents, v_set.vat_bp, v_set.deduction_bp, v_set.fee_bp, v_set.fee_fixed_cents,
      v_set.commission_bp);

    INSERT INTO public.affiliate_commissions (
      payment_record_id, affiliate_id, customer_id, org_id, gross_cents, vat_cents,
      deduction_bp, deduction_cents, fee_cents, base_cents, rate_bp, commission_cents, occurred_at)
    VALUES (p_rec.id, v_aff, v_uid, p_rec.org_id, p_rec.amount_cents, v_c.vat_cents,
      v_set.deduction_bp, v_c.deduction_cents, v_c.fee_cents, v_c.base_cents, v_set.commission_bp,
      v_c.commission_cents, p_rec.occurred_at)
    ON CONFLICT (payment_record_id) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;

  ELSIF p_rec.event_type = 'charge.refunded' AND p_rec.amount_cents < 0
        AND p_rec.stripe_invoice_id IS NOT NULL THEN
    -- Le remboursement Premium arrive avec `user_id` NULL : on retrouve la
    -- commission d'origine par la facture, et on garde SES taux.
    SELECT ac.* INTO v_origin
      FROM public.affiliate_commissions ac
      JOIN public.payment_records pr ON pr.id = ac.payment_record_id
     WHERE pr.stripe_invoice_id = p_rec.stripe_invoice_id
       AND pr.event_type = 'invoice.payment_succeeded'
       AND ac.commission_cents > 0
     ORDER BY pr.id
     LIMIT 1;
    IF v_origin.id IS NULL OR v_origin.gross_cents <= 0 THEN RETURN false; END IF;

    v_comm := -round(abs(p_rec.amount_cents)::numeric / v_origin.gross_cents * v_origin.commission_cents);

    INSERT INTO public.affiliate_commissions (
      payment_record_id, affiliate_id, customer_id, org_id, gross_cents, vat_cents,
      deduction_bp, deduction_cents, fee_cents, base_cents, rate_bp, commission_cents, occurred_at)
    VALUES (p_rec.id, v_origin.affiliate_id, v_origin.customer_id, v_origin.org_id,
      p_rec.amount_cents, 0, v_origin.deduction_bp, 0, 0, 0, v_origin.rate_bp, v_comm,
      p_rec.occurred_at)
    ON CONFLICT (payment_record_id) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
  END IF;

  -- `invoice.payment_failed` et le reste : ces lignes ne sont pas un encaissement.
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.affiliate_process(public.payment_records) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_process(public.payment_records) TO service_role;

-- L'ancienne signature (5 taux) n'a plus d'appelant.
DROP FUNCTION IF EXISTS public.affiliate_compute(BIGINT, INT, INT, INT, INT);
