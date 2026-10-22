-- ═══════════════════════════════════════════════════════════════════
-- 180, facturation entreprise : contact de facturation et historique
--
-- CE QUE L'ÉCRAN `/entreprise/billing` NE SAVAIT PAS DIRE (revue du
-- 2026-09-25) : à qui partent les factures, et ce qui a déjà été payé.
--
--   · `org_billing_contacts` : un contact de facturation DISTINCT du
--     propriétaire (un service comptable, une adresse `compta@`). Une ligne au
--     plus par organisation. Absente = les factures vont au propriétaire,
--     exactement comme avant cette migration.
--   · `get_org_billing_history(p_org)` : les encaissements, échecs et
--     remboursements d'une organisation, lus dans le journal fiscal
--     `payment_records` (mig. 125).
--
-- ── POURQUOI UNE RPC `SECURITY DEFINER` POUR L'HISTORIQUE ───────────
--
-- `payment_records` est fermé à `anon` et `authenticated` (mig. 125, `REVOKE
-- ALL`), et il DOIT le rester : c'est le journal inaltérable, et une policy
-- SELECT posée dessus serait la porte d'entrée d'une future policy d'écriture.
-- La fonction est donc le seul chemin de LECTURE, et son autorisation est
-- écrite en clair : le PROPRIÉTAIRE de l'organisation, et lui seul — le même
-- périmètre que `stripe-org-checkout`, `stripe-org-portal` et
-- `stripe-org-refund`. Un admin qui ne paie rien n'y lit pas les montants.
--
-- ❌ Elle ne rend JAMAIS `payload` entier, ni `row_hash` / `prev_hash`, ni
--    `stripe_customer_id` : seulement ce que l'écran affiche.
-- ❌ Elle n'écrit rien. `payment_records` et `payment_closures` restent sans
--    policy UPDATE/DELETE (CLAUDE.md racine, journal fiscal).
--
-- ── POURQUOI LA TABLE DE CONTACT EST SOUS RLS ORDINAIRE ─────────────
--
-- Rien n'y est fiscal : c'est une préférence que le propriétaire modifie
-- quand il veut. Une policy par action (mig. 049), toutes sur le même
-- prédicat : propriétaire de l'organisation. `ON DELETE CASCADE` sur
-- l'organisation : le contact n'a aucune raison de survivre à l'entreprise
-- (RGPD, minimisation), à la différence du journal qui, lui, survit.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Contact de facturation ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_billing_contacts (
  org_id      UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT org_billing_contacts_email_ck
    CHECK (length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT org_billing_contacts_name_ck
    CHECK (name IS NULL OR length(name) <= 120)
);

ALTER TABLE public.org_billing_contacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.org_billing_contacts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_billing_contacts TO authenticated;

DROP POLICY IF EXISTS "org_billing_contacts_select" ON public.org_billing_contacts;
CREATE POLICY "org_billing_contacts_select"
  ON public.org_billing_contacts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_billing_contacts.org_id AND o.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "org_billing_contacts_insert" ON public.org_billing_contacts;
CREATE POLICY "org_billing_contacts_insert"
  ON public.org_billing_contacts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_billing_contacts.org_id AND o.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "org_billing_contacts_update" ON public.org_billing_contacts;
CREATE POLICY "org_billing_contacts_update"
  ON public.org_billing_contacts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_billing_contacts.org_id AND o.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_billing_contacts.org_id AND o.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "org_billing_contacts_delete" ON public.org_billing_contacts;
CREATE POLICY "org_billing_contacts_delete"
  ON public.org_billing_contacts FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_billing_contacts.org_id AND o.owner_id = (SELECT auth.uid())
  ));

-- ── 2. Historique des paiements ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_billing_history(p_org UUID)
RETURNS TABLE (
  id                 BIGINT,
  event_type         TEXT,
  invoice_number     TEXT,
  hosted_invoice_url TEXT,
  amount_cents       BIGINT,
  currency           TEXT,
  occurred_at        TIMESTAMPTZ
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
           r.occurred_at
      FROM public.payment_records r
     WHERE r.org_id = p_org
     ORDER BY r.occurred_at DESC, r.id DESC
     LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_billing_history(UUID) FROM PUBLIC;
-- `REVOKE FROM PUBLIC` ne retire PAS un droit accordé nommément à `anon` par
-- l'ACL par défaut du schéma public (mémoire « REVOKE PUBLIC »).
REVOKE EXECUTE ON FUNCTION public.get_org_billing_history(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_org_billing_history(UUID) TO authenticated;

COMMIT;

-- ── Vérification après application (catalogue, pas ledger) ─────────
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'org_billing_contacts';      -- true
-- SELECT count(*) FROM pg_policies WHERE tablename = 'org_billing_contacts';       -- 4
-- SELECT has_function_privilege('anon', 'public.get_org_billing_history(uuid)', 'EXECUTE');  -- false
-- SELECT count(*) FROM pg_policies WHERE tablename = 'payment_records';            -- 0
