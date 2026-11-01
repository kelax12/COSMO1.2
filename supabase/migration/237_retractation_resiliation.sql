-- ═══════════════════════════════════════════════════════════════════
-- 237 · Rétractation, résiliation, acceptation des CGV (décision du 2026-11-01)
-- ═══════════════════════════════════════════════════════════════════
--
-- Consigne : `Documents/analytics/docs/REMBOURSEMENT-RESILIATION.md`.
-- Remplace « rembourser le mois en cours à tout moment » (2026-09-03).
--
--   1. `billing_acceptances` : version des CGV acceptée et demande expresse
--      d'accès immédiat (L221-25), horodatées au checkout. Append-only.
--   2. `org_withdrawals` : chaque rétractation (L221-21), le montant dû et la
--      date du remboursement manuel. Sert l'alerte J+10 et l'outil admin.
--   3. `org_subscriptions.started_at` (conclusion du contrat, départ des
--      14 jours) et `cancel_at_period_end` (résiliation programmée),
--      écrites par le webhook seul.
--   4. `org_subscriptions.renewal_notice_missed_at` : abonnement annuel dont
--      le rappel L215-1 n'a pu partir au moins un mois avant (§5), ce qui
--      ouvre le remboursement au prorata par l'admin.
--   5. Rappel J-45 : `orgs_due_for_renewal_notice` sert désormais 30..45 j,
--      avec le montant, et `renewal_notices.provider_message_id` (preuve).
--
-- Toutes les nouvelles tables : RLS activée SANS policy, REVOKE pour `anon` et
-- `authenticated`. Seules les Edge Functions (service_role) y touchent.

-- ─── 1. Acceptation des CGV et demande d'accès immédiat ─────────────

CREATE TABLE IF NOT EXISTS public.billing_acceptances (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id                  UUID NOT NULL,
  cgv_version              TEXT NOT NULL,
  immediate_access_at      TIMESTAMPTZ NOT NULL,
  tier_key                 TEXT,
  billing_interval         TEXT,
  stripe_checkout_session  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_acceptances_org_idx ON public.billing_acceptances (org_id, created_at DESC);
ALTER TABLE public.billing_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_acceptances FROM anon, authenticated;

-- Preuve : ni UPDATE ni DELETE, même pour service_role (sauf SET NULL de la FK).
CREATE OR REPLACE FUNCTION public.billing_acceptances_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'billing_acceptances is append-only';
  END IF;
  -- Seule évolution admise : la FK remise à NULL par la suppression de l'org.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.cgv_version IS DISTINCT FROM OLD.cgv_version
     OR NEW.immediate_access_at IS DISTINCT FROM OLD.immediate_access_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.org_id IS NOT NULL AND NEW.org_id IS DISTINCT FROM OLD.org_id) THEN
    RAISE EXCEPTION 'billing_acceptances is append-only';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.billing_acceptances_append_only() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_billing_acceptances_append_only ON public.billing_acceptances;
CREATE TRIGGER trg_billing_acceptances_append_only
  BEFORE UPDATE OR DELETE ON public.billing_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.billing_acceptances_append_only();

-- ─── 2. Rétractations ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_withdrawals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id                 UUID NOT NULL,
  recipient               TEXT NOT NULL,
  stripe_subscription_id  TEXT NOT NULL UNIQUE,
  stripe_invoice_id       TEXT,
  withdrawn_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_due_cents        INT NOT NULL CHECK (amount_due_cents >= 0),
  rule                    TEXT NOT NULL,
  ack_message_id          TEXT,
  refunded_at             TIMESTAMPTZ,
  refunded_cents          INT CHECK (refunded_cents IS NULL OR refunded_cents >= 0),
  reminder_sent_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS org_withdrawals_pending_idx
  ON public.org_withdrawals (withdrawn_at) WHERE refunded_at IS NULL;
ALTER TABLE public.org_withdrawals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_withdrawals FROM anon, authenticated;

-- ─── 3 et 4. État de l'abonnement ─────────────────────────────────

ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS started_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_notice_missed_at TIMESTAMPTZ;

-- ─── 5. Rappel J-45 ───────────────────────────────────────────────

ALTER TABLE public.renewal_notices
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Abonnements annuels à moins de 30 jours du terme sans rappel envoyé pour
-- cette échéance : le rappel n'a pas pu partir à temps (§5).
CREATE OR REPLACE FUNCTION public.orgs_missing_renewal_notice()
RETURNS TABLE (org_id UUID, period_end DATE)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.org_id, s.current_period_end::date
  FROM public.org_subscriptions s
  WHERE s.status = 'active'
    AND s.billing_interval = 'yearly'
    AND s.tier_key <> 'free'
    AND s.cancel_at_period_end = false
    AND s.renewal_notice_missed_at IS NULL
    AND s.current_period_end IS NOT NULL
    AND s.current_period_end::date < CURRENT_DATE + 30
    AND NOT EXISTS (
      SELECT 1 FROM public.renewal_notices n
       WHERE n.org_id = s.org_id
         AND n.period_end = s.current_period_end::date
    );
$$;
REVOKE ALL ON FUNCTION public.orgs_missing_renewal_notice() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.orgs_missing_renewal_notice() FROM anon, authenticated;

-- Le rappel part à J-45 (au plus tôt) et se rattrape jusqu'à J-30 (au plus
-- tard un mois avant, L215-1). Ajout du montant pour l'encadré du message.
DROP FUNCTION IF EXISTS public.orgs_due_for_renewal_notice(INT, INT);
CREATE FUNCTION public.orgs_due_for_renewal_notice(
  p_min_days INT DEFAULT 30,
  p_max_days INT DEFAULT 45
)
RETURNS TABLE (
  org_id      UUID,
  org_name    TEXT,
  owner_email TEXT,
  period_end  DATE,
  tier_key    TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.org_id,
    o.name,
    u.email::text,
    s.current_period_end::date,
    s.tier_key
  FROM public.org_subscriptions s
  JOIN public.organizations o ON o.id = s.org_id
  JOIN auth.users u           ON u.id = o.owner_id
  WHERE s.status = 'active'
    AND s.billing_interval = 'yearly'
    AND s.tier_key <> 'free'
    AND s.cancel_at_period_end = false
    AND s.current_period_end IS NOT NULL
    AND s.current_period_end::date
        BETWEEN (CURRENT_DATE + p_min_days) AND (CURRENT_DATE + p_max_days)
    AND NOT EXISTS (
      SELECT 1 FROM public.renewal_notices n
       WHERE n.org_id = s.org_id
         AND n.period_end = s.current_period_end::date
    )
    AND u.email IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.orgs_due_for_renewal_notice(INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.orgs_due_for_renewal_notice(INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.orgs_due_for_renewal_notice(INT, INT) FROM authenticated;
