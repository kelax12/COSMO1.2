-- ═══════════════════════════════════════════════════════════════════
-- Migration 135 — Renonciation au droit de rétractation : la PREUVE
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Audit des Edge Functions Stripe, 2026-09-02, finding S-6.
--
-- L'article L221-28, 13° du Code de la consommation ne fait tomber le délai de
-- rétractation de quatorze jours QUE si le consommateur a donné, avant
-- l'exécution, deux manifestations DISTINCTES :
--
--   1. son accord exprès à l'exécution immédiate du service ;
--   2. la reconnaissance explicite qu'il perd son droit de rétractation une
--      fois le service pleinement fourni.
--
-- `OrgBillingTab` les recueillait déjà — deux cases séparées, jamais
-- pré-cochées — et son commentaire concluait « nous laisse la preuve ». Il n'y
-- avait AUCUNE preuve : les deux booléens gardaient un bouton et ne quittaient
-- jamais le navigateur. Le corps posté à `stripe-org-checkout` était
-- `{ orgId, tierKey, interval }`.
--
-- Deux conséquences. Un appel direct à la fonction, avec un JWT valide,
-- ouvrait une session de paiement sans qu'aucun consentement ait été donné —
-- alors que les CGU affirment « le paiement ne peut être engagé sans elles ».
-- Et surtout : le jour où un client conteste, il n'y a rien à produire.
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────
--
-- Une table jumelle de `renewal_notices` (mig. 126), qui a exactement le même
-- statut : ce n'est PAS un cache, c'est une pièce qu'on produit en cas de
-- litige. Elle en reprend donc les trois propriétés :
--
--   - écriture par le SERVEUR uniquement (`stripe-org-checkout`, service_role) ;
--   - aucune policy d'écriture pour le client ;
--   - immuabilité par TRIGGER et non par RLS, parce que `service_role`
--     contourne la RLS mais jamais un trigger.
--
-- La lecture est ouverte au propriétaire de l'organisation : c'est SA preuve
-- autant que la nôtre, et un consommateur doit pouvoir vérifier ce qu'on
-- prétend qu'il a accepté.
--
-- ⚠️ Une ligne est écrite AVANT la création de la session Stripe. L'ordre est
-- la preuve : le consentement précède le paiement, jamais l'inverse. Une ligne
-- sans paiement derrière est inoffensive (un consentement donné, un achat
-- abandonné) ; un paiement sans ligne serait exactement le trou qu'on ferme.
--
-- ❌ Ne JAMAIS ajouter de policy UPDATE ou DELETE sur cette table.
-- ❌ Ne JAMAIS l'inclure dans une purge : c'est une preuve, comme
--    `renewal_notices`. Elle ne porte ni nom ni adresse e-mail — seulement des
--    identifiants techniques, qui cessent de désigner quiconque dès que le
--    compte est supprimé.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.withdrawal_consents (
  id                BIGSERIAL PRIMARY KEY,

  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Qui a coché. Le propriétaire au moment du consentement, pas « le
  -- propriétaire actuel » : la propriété d'une organisation se transfère.
  -- Pas de FK vers auth.users : la preuve doit survivre à la suppression du
  -- compte, exactement comme le journal d'encaissement (mig. 125).
  user_id           UUID NOT NULL,

  -- Ce qui était acheté au moment du consentement. Sans ça, la preuve dit
  -- « quelqu'un a accepté quelque chose un jour ».
  tier_key          TEXT NOT NULL,
  billing_interval  TEXT NOT NULL,

  -- Les DEUX manifestations, stockées séparément. Les fondre en une seule
  -- colonne « a consenti » perdrait précisément ce que le texte exige : deux
  -- accords distincts, pas un accord global.
  immediate_execution BOOLEAN NOT NULL,
  waives_withdrawal   BOOLEAN NOT NULL,

  consented_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT withdrawal_consents_interval_ck
    CHECK (billing_interval IN ('monthly', 'yearly')),
  -- On n'enregistre que des consentements COMPLETS. Une ligne à moitié vraie
  -- ne prouve rien et se relirait comme une preuve.
  CONSTRAINT withdrawal_consents_complete_ck
    CHECK (immediate_execution AND waives_withdrawal)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_consents_org
  ON public.withdrawal_consents (org_id, consented_at DESC);

ALTER TABLE public.withdrawal_consents ENABLE ROW LEVEL SECURITY;

-- ─── Lecture : le propriétaire de l'organisation, et lui seul ───────
--
-- `(SELECT auth.uid())` et non `auth.uid()` : hissé en InitPlan, donc évalué
-- une fois par requête et non par ligne (mig. 043). Une seule policy
-- PERMISSIVE par rôle et par action (mig. 049).

DROP POLICY IF EXISTS withdrawal_consents_select_owner ON public.withdrawal_consents;
CREATE POLICY withdrawal_consents_select_owner
  ON public.withdrawal_consents
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT o.id FROM public.organizations o
       WHERE o.owner_id = (SELECT auth.uid())
    )
  );

-- Aucune policy INSERT / UPDATE / DELETE : seul `service_role` écrit, depuis
-- `stripe-org-checkout`. Un client qui pourrait écrire sa propre preuve
-- n'aurait pas produit une preuve.

-- ─── Immuabilité réelle ─────────────────────────────────────────────
--
-- SECURITY INVOKER (défaut) : une garde ne doit jamais être DEFINER, sinon ses
-- messages d'erreur deviennent un oracle sur des lignes non lisibles
-- (mig. 064b, 094b, 108).

CREATE OR REPLACE FUNCTION public.forbid_consent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'withdrawal_consents est une preuve append-only : ni UPDATE ni DELETE.'
    USING ERRCODE = 'restrict_violation';
END;
$$;

REVOKE ALL ON FUNCTION public.forbid_consent_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.forbid_consent_mutation() FROM anon;
-- `REVOKE FROM PUBLIC` ne retire PAS un droit accorde explicitement a
-- `authenticated` : les deux revocations sont necessaires (mig. 094b).
REVOKE EXECUTE ON FUNCTION public.forbid_consent_mutation() FROM authenticated;

DROP TRIGGER IF EXISTS trg_forbid_consent_mutation ON public.withdrawal_consents;
CREATE TRIGGER trg_forbid_consent_mutation
  BEFORE UPDATE OR DELETE ON public.withdrawal_consents
  FOR EACH ROW EXECUTE FUNCTION public.forbid_consent_mutation();

COMMENT ON TABLE public.withdrawal_consents IS
  'Preuve du consentement de l''article L221-28, 13° (renonciation au droit de '
  'retractation). Append-only, ecrite par stripe-org-checkout AVANT la creation '
  'de la session de paiement. Jumelle de renewal_notices : ne jamais purger.';
