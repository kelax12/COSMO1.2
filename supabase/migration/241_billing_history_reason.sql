-- ═══════════════════════════════════════════════════════════════════
-- 241 · Motif de facture dans l'historique de facturation (2026-11-05)
--
-- Depuis le 2026-11-05, le portail Stripe live permet de changer de palier
-- avec prorata facturé IMMÉDIATEMENT : une organisation peut payer deux
-- factures dans le même mois. L'historique (`OrgBillingHistory`) doit dire
-- laquelle est un changement de forfait, sinon le second prélèvement ressemble
-- à une erreur.
--
-- Le motif est déjà au journal : `payment_records.payload ->> 'billing_reason'`,
-- écrit par `stripe-webhook` (`subscription_create`, `subscription_cycle`,
-- `subscription_update`…). Seule la LECTURE change : une colonne de plus en
-- sortie de `get_org_billing_history`. Aucune écriture, aucune policy.
--
-- ⚠️ Changer le `RETURNS TABLE` d'une fonction exige DROP puis CREATE
-- (`CREATE OR REPLACE` refuse un type de retour différent) : les droits sont
-- donc reposés à l'identique de la mig. 180.
-- ⚠️ Le front tolère l'absence de la colonne (avant application) : il garde
-- alors les libellés d'avant.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DROP FUNCTION IF EXISTS public.get_org_billing_history(UUID);

CREATE OR REPLACE FUNCTION public.get_org_billing_history(p_org UUID)
RETURNS TABLE (
  id                 BIGINT,
  event_type         TEXT,
  invoice_number     TEXT,
  hosted_invoice_url TEXT,
  amount_cents       BIGINT,
  currency           TEXT,
  occurred_at        TIMESTAMPTZ,
  billing_reason     TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Même refus pour « organisation inconnue » et « pas le propriétaire » :
  -- ne pas confirmer l'existence d'une organisation dont on connaîtrait l'UUID.
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org AND o.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT r.id,
           r.event_type,
           r.payload ->> 'number',
           r.payload ->> 'hosted_invoice_url',
           r.amount_cents,
           r.currency,
           r.occurred_at,
           r.payload ->> 'billing_reason'
      FROM public.payment_records r
     WHERE r.org_id = p_org
     ORDER BY r.occurred_at DESC, r.id DESC
     LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_billing_history(UUID) FROM PUBLIC;
-- `REVOKE FROM PUBLIC` ne retire PAS un droit accordé nommément à `anon`.
REVOKE EXECUTE ON FUNCTION public.get_org_billing_history(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_org_billing_history(UUID) TO authenticated;

COMMIT;

-- ── Vérification après application (catalogue, pas ledger) ─────────
-- SELECT pg_get_function_result('public.get_org_billing_history(uuid)'::regprocedure);  -- … billing_reason text
-- SELECT has_function_privilege('anon', 'public.get_org_billing_history(uuid)', 'EXECUTE');           -- false
-- SELECT has_function_privilege('authenticated', 'public.get_org_billing_history(uuid)', 'EXECUTE');  -- true
-- SELECT prosecdef, proconfig FROM pg_proc WHERE proname = 'get_org_billing_history';  -- t, {search_path=""}
