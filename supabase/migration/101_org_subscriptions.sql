-- ═══════════════════════════════════════════════════════════════════
-- Migration 101 — Abonnement Stripe par organisation
--
-- Le mode entreprise annonce cinq paliers tarifaires (0/20/50/100/200 € par
-- mois selon l'effectif) et n'avait aucun moyen de les encaisser :
-- `org_seats_allowed` (mig. 067) était un stub avec un quota de 5 écrit en
-- dur, coiffé d'un TODO « table org_subscriptions à venir ». La voici.
--
-- ── MODÈLE ─────────────────────────────────────────────────────────
--
-- `org_id` est la CLÉ PRIMAIRE : une organisation a au plus un abonnement.
-- C'est ce qui rend l'upsert du webhook atomique sans verrou applicatif
-- (même raison que le `onConflict: 'user_id'` de `subscriptions`, faille U2).
--
-- `max_members` est DÉNORMALISÉ depuis le palier, volontairement :
-- `org_seats_allowed` n'a alors besoin ni de connaître les prix, ni d'une
-- jointure — juste un entier à comparer. Le quota d'une org est aussi lisible
-- en une requête le jour d'un litige client. La contrepartie est que le
-- webhook doit le réécrire à chaque changement de palier ; c'est exactement ce
-- que fait `tierFromPriceId` sur `customer.subscription.updated`.
--
-- ── ÉCRITURES ──────────────────────────────────────────────────────
--
-- AUCUNE policy INSERT / UPDATE / DELETE. Ce qui n'a pas de policy n'est pas
-- écrivable par un client : contrairement à `subscriptions` (mig. 013), aucun
-- trigger-guard n'est nécessaire ici, il n'y a rien à garder. Seul le
-- `service_role` du webhook Stripe écrit, et il bypasse la RLS par nature.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.org_subscriptions (
  org_id                 UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier_key               TEXT NOT NULL DEFAULT 'free'
                           CHECK (tier_key IN ('free', 't10', 't20', 't50', 'tmax')),
  -- NULL = palier sans plafond ('tmax').
  max_members            INT CHECK (max_members IS NULL OR max_members > 0),
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'past_due', 'cancelled')),
  current_period_end     TIMESTAMPTZ,
  -- UNIQUE : exigence de CORRECTION, pas d'hygiène. Le webhook Stripe remonte
  -- l'organisation depuis le customer (`orgIdFromInvoice`) — les invoices ne
  -- portent pas nos metadata. Cette lecture est un `maybeSingle()` : deux
  -- organisations partageant un customer la feraient ÉCHOUER, et une facture
  -- d'organisation partirait alors sur la branche de l'abonnement particulier.
  -- L'unicité est donc ce qui garantit que « customer → org » est une fonction.
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  -- Code promo réellement appliqué, INFORMATIF uniquement : aucun montant
  -- n'est recalculé côté COSMO, Stripe fait foi sur ce qui est facturé.
  discount_code          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Le webhook retrouve l'org depuis le customer Stripe (events sans metadata) ;
-- l'index qui sert cette lecture est désormais celui créé automatiquement par
-- la contrainte UNIQUE ci-dessus. L'index simple d'origine ferait doublon
-- exact : même colonne, même btree, coût d'écriture doublé pour zéro gain en
-- lecture. On le retire (et ce DROP rattrape une base où il aurait déjà été
-- créé par une version antérieure de cette migration).
DROP INDEX IF EXISTS public.idx_org_subscriptions_stripe_customer;

DROP TRIGGER IF EXISTS trg_org_subscriptions_updated_at ON public.org_subscriptions;
CREATE TRIGGER trg_org_subscriptions_updated_at
  BEFORE UPDATE ON public.org_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

-- SELECT : membres de l'organisation. Une SEULE policy PERMISSIVE par
-- rôle+action (mig. 049). Aucun `auth.uid()` nu ici — il est encapsulé dans
-- `is_org_member`, déjà `STABLE SECURITY DEFINER` (mig. 060).
DROP POLICY IF EXISTS "org_subscriptions_select" ON public.org_subscriptions;
CREATE POLICY "org_subscriptions_select"
  ON public.org_subscriptions FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

-- Défense en profondeur : même sans policy d'écriture, on retire les GRANTs.
REVOKE ALL ON public.org_subscriptions FROM anon;
REVOKE ALL ON public.org_subscriptions FROM authenticated;
GRANT SELECT ON public.org_subscriptions TO authenticated;

-- ─── Quota de sièges : le stub devient réel ─────────────────────────
--
-- Signature et appelants INCHANGÉS (`claim_org_invite`, dernière redéfinition
-- en mig. 087 ; `respond_join_request`, dernière redéfinition en mig. 067).
-- Seul le corps de `org_seats_allowed` change.
--
-- Sémantique du quota : `COUNT(membres) < max_members`. Un palier
-- « 10 à 20 membres » autorise donc jusqu'à 20 membres inclus — identique à
-- l'ancien `v_count < 5` pour le palier gratuit, aucun décalage introduit.
CREATE OR REPLACE FUNCTION public.org_seats_allowed(p_org UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enforced BOOLEAN;
  v_quota    INT;
  v_status   TEXT;
  v_count    INT;
BEGIN
  SELECT enabled INTO v_enforced FROM public.billing_flags
  WHERE key = 'enterprise_seat_limit';
  IF v_enforced IS DISTINCT FROM true THEN
    RETURN true; -- gate dormant : aucune limite tant que non activé
  END IF;

  SELECT max_members, status INTO v_quota, v_status
  FROM public.org_subscriptions WHERE org_id = p_org;

  -- Pas d'abonnement, ou abonnement non actif (impayé, résilié) → palier
  -- gratuit. On ne retire JAMAIS de membre : seule la croissance est bloquée.
  IF v_status IS DISTINCT FROM 'active' THEN
    v_quota := 5;
  END IF;

  -- Palier sans plafond.
  IF v_quota IS NULL THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)::int INTO v_count FROM public.organization_members
  WHERE org_id = p_org;

  RETURN v_count < v_quota;
END;
$$;

REVOKE ALL ON FUNCTION public.org_seats_allowed(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.org_seats_allowed(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.org_seats_allowed(UUID) TO authenticated;
