# Stripe entreprise — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encaisser l'abonnement du mode entreprise via Stripe (4 paliers payants + coupons natifs), livré dormant derrière les flags existants.

**Architecture:** Une table `org_subscriptions` clé sur `org_id`, écrite **uniquement** par le webhook Stripe (`service_role`), lue par les membres via RLS. Le quota de sièges serveur (`org_seats_allowed`, déjà appelé par les deux chemins d'ajout de membre) lit `max_members` sur cette table. Trois Edge Functions Deno (checkout, portail, webhook étendu) partagent un module de mapping de paliers en TS pur, dont la parité avec les tarifs du front est vérifiée par un test Vitest.

**Tech Stack:** Postgres/Supabase RLS, Deno Edge Functions + `npm:stripe@14.21.0`, React 18 + TanStack Query 5, catalogues i18n maison, Vitest.

**Spec de référence:** [`docs/superpowers/specs/2026-08-16-stripe-entreprise-design.md`](../specs/2026-08-16-stripe-entreprise-design.md)

---

## Deux corrections au spec, trouvées en écrivant ce plan

1. **Pas de nouvelle route.** `OrganizationPage` n'utilise pas de routes imbriquées : ses onglets vivent dans `?tab=`. Le paywall devient donc l'onglet `?tab=billing`, pas une route `/entreprise/abonnement`. Rien à ajouter dans `src/i18n/route-slugs.json` (qui ne sert qu'aux pages marketing publiques).
2. **`EnterprisePaywallPage.tsx` est supprimée.** Sa grille de paliers est extraite en composant partagé `EnterpriseTierGrid`, consommé par le nouvel onglet. Garder la page en plus de l'onglet dupliquerait la même grille dans deux fichiers dont un mort.

**Mode démo :** une org de démo ne paie jamais. `useOrgSubscription` renvoie `null` (= palier gratuit) sans requête quand `useIsDemo()` est vrai, et l'onglet n'affiche aucun CTA. Pas de `local.repository` ni d'entrée dans `repository.factory` : il n'y a pas de sémantique démo à simuler pour un abonnement.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `supabase/functions/_shared/org-tiers.ts` (créer) | Mapping paliers ↔ quotas ↔ price IDs, **TS pur sans API Deno** (donc importable par Vitest) |
| `src/modules/billing/premium-config.ts` (modifier) | `key` ajoutée à chaque palier + type `OrgTierKey` |
| `src/modules/billing/org-tiers.parity.test.ts` (créer) | Interdit la dérive front ↔ Edge Functions |
| `supabase/migration/101_org_subscriptions.sql` (créer) | Table, RLS, réécriture de `org_seats_allowed` |
| `e2e/rls/org-subscriptions.test.ts` (créer) | Isolation lecture + zéro écriture client |
| `supabase/functions/stripe-org-checkout/index.ts` (créer) | Session Checkout d'une org, coupons activés |
| `supabase/functions/stripe-org-portal/index.ts` (créer) | Session Billing Portal d'une org |
| `supabase/functions/stripe-webhook/index.ts` (modifier) | Branche org des 5 events |
| `src/modules/billing/org-billing.types.ts` (créer) | `OrgSubscription` |
| `src/modules/billing/org-billing.repository.ts` (créer) | Lecture `org_subscriptions` + mapping DB→domaine |
| `src/modules/billing/org-billing.hooks.ts` (créer) | `useOrgSubscription`, `useStartOrgCheckout`, `useOpenOrgPortal` |
| `src/modules/billing/org-billing.logic.ts` (créer) | Logique pure : palier recommandé, palier courant, quota |
| `src/modules/billing/org-billing.logic.test.ts` (créer) | Tests de la logique pure |
| `src/components/organization/EnterpriseTierGrid.tsx` (créer) | Grille des 5 paliers, avec ou sans CTA |
| `src/components/organization/OrgBillingTab.tsx` (créer) | Onglet Abonnement |
| `src/pages/OrganizationPage.tsx` (modifier) | Onglet `billing`, propriétaire uniquement |
| `src/pages/EnterprisePaywallPage.tsx` (supprimer) | Remplacée par l'onglet |
| `src/locales/{fr,en}/org.json` (modifier) | Clés `billing.*` et `tabs.billing` |

---

## Task 1: Module de paliers partagé + parité

**Files:**
- Create: `supabase/functions/_shared/org-tiers.ts`
- Modify: `src/modules/billing/premium-config.ts:45-51`
- Test: `src/modules/billing/org-tiers.parity.test.ts`

**Pourquoi ce module d'abord :** tout le reste (migration, checkout, webhook, UI) en dépend. Il est en **TypeScript pur, sans une seule API Deno** — c'est ce qui permet à Vitest de l'importer directement et donc de prouver qu'il ne dérive pas des tarifs affichés. Les price IDs n'y sont pas écrits : seulement les **noms** des variables d'environnement, résolus par un lecteur passé en argument.

- [ ] **Step 1: Écrire le test de parité (il échouera)**

Créer `src/modules/billing/org-tiers.parity.test.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// Parité tarifs front ↔ Edge Functions.
//
// Les montants affichés (landing + espace entreprise) viennent de
// `ENTERPRISE_PRICING_TIERS`. Les montants FACTURÉS viennent des price IDs
// Stripe résolus par `_shared/org-tiers.ts`, côté Deno. Ces deux listes ne
// peuvent pas être un seul fichier (le bundle front ne doit pas embarquer la
// grille Stripe, et une Edge Function ne lit pas `src/`), donc elles peuvent
// diverger en silence : on annoncerait 50 € et on facturerait 100 €.
//
// Ce test est le seul garde-fou contre ça. L'import relatif hors de `src/`
// est délibéré : `_shared/org-tiers.ts` est du TS pur sans API Deno, et ce
// fichier de test n'entre jamais dans le bundle Vite.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { ENTERPRISE_PRICING_TIERS } from './premium-config';
import {
  ORG_TIERS,
  tierByKey,
  priceIdForTier,
  tierFromPriceId,
  FREE_TIER_MAX_MEMBERS,
} from '../../../supabase/functions/_shared/org-tiers';

describe('parité ENTERPRISE_PRICING_TIERS ↔ _shared/org-tiers.ts', () => {
  it('même nombre de paliers', () => {
    expect(ORG_TIERS).toHaveLength(ENTERPRISE_PRICING_TIERS.length);
  });

  it('mêmes clés, bornes et montants, dans le même ordre', () => {
    ENTERPRISE_PRICING_TIERS.forEach((front, i) => {
      const shared = ORG_TIERS[i];
      expect(shared.key).toBe(front.key);
      expect(shared.minMembers).toBe(front.minMembers);
      expect(shared.maxMembers).toBe(front.maxMembers);
      expect(shared.priceEurPerMonth).toBe(front.priceEurPerMonth);
    });
  });

  it('le palier gratuit est le seul sans variable de prix', () => {
    const sansPrix = ORG_TIERS.filter((t) => t.priceEnvVar === null);
    expect(sansPrix.map((t) => t.key)).toEqual(['free']);
  });

  it('FREE_TIER_MAX_MEMBERS vaut le plafond du palier gratuit', () => {
    expect(FREE_TIER_MAX_MEMBERS).toBe(tierByKey('free')?.maxMembers);
  });
});

describe('résolution des price IDs', () => {
  const env = (name: string): string | undefined =>
    ({
      STRIPE_ORG_PRICE_T10: 'price_t10',
      STRIPE_ORG_PRICE_T20: 'price_t20',
      STRIPE_ORG_PRICE_T50: 'price_t50',
      STRIPE_ORG_PRICE_TMAX: 'price_tmax',
    })[name];

  it('rend le price ID du palier demandé', () => {
    expect(priceIdForTier('t20', env)).toBe('price_t20');
  });

  it('rend null pour le palier gratuit (aucun checkout possible)', () => {
    expect(priceIdForTier('free', env)).toBeNull();
  });

  it('rend null quand la variable d’environnement est absente', () => {
    expect(priceIdForTier('t20', () => undefined)).toBeNull();
  });

  it('retrouve le palier depuis un price ID (sens inverse, portail Stripe)', () => {
    expect(tierFromPriceId('price_t50', env)?.key).toBe('t50');
  });

  it('rend undefined pour un price ID inconnu — jamais un repli silencieux', () => {
    expect(tierFromPriceId('price_supprime', env)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run src/modules/billing/org-tiers.parity.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import ".../supabase/functions/_shared/org-tiers"`.

- [ ] **Step 3: Créer le module partagé**

Créer `supabase/functions/_shared/org-tiers.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// Paliers d'abonnement entreprise — mapping partagé par les Edge Functions.
//
// ⚠️ TS PUR, AUCUNE API DENO. C'est délibéré : ce fichier est importé par un
// test Vitest (`src/modules/billing/org-tiers.parity.test.ts`) qui prouve
// qu'il ne diverge pas de `ENTERPRISE_PRICING_TIERS`. Un seul `Deno.env` ici
// rendrait ce test impossible, donc l'environnement est passé en argument.
//
// ⚠️ Les price IDs ne sont PAS écrits ici, seulement les NOMS de variables
// d'environnement : la grille Stripe reste dans les secrets Supabase, et un
// client ne peut ni la lire ni forger un prix (il n'envoie qu'une `tierKey`).
//
// `maxMembers` sert de QUOTA : la règle serveur est `COUNT(membres) < maxMembers`,
// donc un palier « 10 à 20 membres » autorise jusqu'à 20 membres inclus.
// `null` = aucun plafond.
// ═══════════════════════════════════════════════════════════════════

export type OrgTierKey = 'free' | 't10' | 't20' | 't50' | 'tmax'

export interface OrgTier {
  key: OrgTierKey
  minMembers: number
  maxMembers: number | null
  priceEurPerMonth: number
  /** Nom du secret Supabase portant le price ID. `null` = palier gratuit. */
  priceEnvVar: string | null
}

/** Lecteur d'environnement injecté (`Deno.env.get` en production). */
export type EnvReader = (name: string) => string | undefined

export const ORG_TIERS: readonly OrgTier[] = [
  { key: 'free', minMembers: 0, maxMembers: 5, priceEurPerMonth: 0, priceEnvVar: null },
  { key: 't10', minMembers: 5, maxMembers: 10, priceEurPerMonth: 20, priceEnvVar: 'STRIPE_ORG_PRICE_T10' },
  { key: 't20', minMembers: 10, maxMembers: 20, priceEurPerMonth: 50, priceEnvVar: 'STRIPE_ORG_PRICE_T20' },
  { key: 't50', minMembers: 20, maxMembers: 50, priceEurPerMonth: 100, priceEnvVar: 'STRIPE_ORG_PRICE_T50' },
  { key: 'tmax', minMembers: 50, maxMembers: null, priceEurPerMonth: 200, priceEnvVar: 'STRIPE_ORG_PRICE_TMAX' },
] as const

/** Quota appliqué à une org sans abonnement actif. */
export const FREE_TIER_MAX_MEMBERS = 5

export function tierByKey(key: string): OrgTier | undefined {
  return ORG_TIERS.find((t) => t.key === key)
}

/** Price ID Stripe d'un palier, ou `null` (palier gratuit / secret absent). */
export function priceIdForTier(key: string, env: EnvReader): string | null {
  const tier = tierByKey(key)
  if (!tier || !tier.priceEnvVar) return null
  return env(tier.priceEnvVar) ?? null
}

/**
 * Sens inverse : retrouver le palier depuis un price ID Stripe.
 *
 * Indispensable pour `customer.subscription.updated` — un changement de palier
 * fait depuis le Billing Portal ne passe pas par notre checkout, donc la seule
 * information disponible est le price ID. Sans ce mapping, un client paierait
 * 100 € en restant bloqué au quota de 20 membres.
 *
 * `undefined` pour un price inconnu : l'appelant DOIT alerter et ne rien
 * écrire, plutôt que de dégrader l'org au palier gratuit.
 */
export function tierFromPriceId(priceId: string, env: EnvReader): OrgTier | undefined {
  return ORG_TIERS.find((t) => t.priceEnvVar !== null && env(t.priceEnvVar) === priceId)
}
```

- [ ] **Step 4: Ajouter `key` aux paliers du front**

Dans `src/modules/billing/premium-config.ts`, remplacer le bloc `ENTERPRISE_PRICING_TIERS` (lignes 45-51) par :

```typescript
export const ENTERPRISE_PRICING_TIERS = [
  { key: 'free', minMembers: 0, maxMembers: 5, priceEurPerMonth: 0 },
  { key: 't10', minMembers: 5, maxMembers: 10, priceEurPerMonth: 20 },
  { key: 't20', minMembers: 10, maxMembers: 20, priceEurPerMonth: 50 },
  { key: 't50', minMembers: 20, maxMembers: 50, priceEurPerMonth: 100 },
  { key: 'tmax', minMembers: 50, maxMembers: null, priceEurPerMonth: 200 },
] as const;

/**
 * Clé stable d'un palier. C'est ce que le client envoie au checkout — jamais
 * un montant, jamais un price ID Stripe : le serveur seul fait la conversion,
 * donc un client ne peut pas se choisir un prix.
 */
export type OrgTierKey = (typeof ENTERPRISE_PRICING_TIERS)[number]['key'];
```

- [ ] **Step 5: Lancer les tests et vérifier qu'ils passent**

```bash
npx vitest run src/modules/billing/org-tiers.parity.test.ts
```

Attendu : 8 tests PASS.

- [ ] **Step 6: Vérifier qu'aucun consommateur existant n'est cassé**

```bash
npm run typecheck && npm run lint
```

Attendu : 0 erreur. `PricingSection.tsx` et `EnterprisePaywallPage.tsx` itèrent sur les paliers sans les indexer par forme, l'ajout d'un champ est rétrocompatible.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/org-tiers.ts src/modules/billing/premium-config.ts src/modules/billing/org-tiers.parity.test.ts
git commit -m "feat(billing): mapping partage des paliers entreprise, verrouille par un test de parite"
```

---

## Task 2: Migration 101 — table `org_subscriptions` et quota réel

**Files:**
- Create: `supabase/migration/101_org_subscriptions.sql`

**Contexte indispensable :** `org_seats_allowed(p_org)` existe déjà (mig. 067) avec un `< 5` écrit en dur. Elle est appelée par `claim_org_invite` (dernière redéfinition en mig. 087) et `respond_join_request` (dernière redéfinition en mig. 067). **On ne touche à aucun appelant** — seul le corps de la fonction change. C'est ce qui rend cette migration sûre : le point d'application est déjà en place et déjà testé.

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migration/101_org_subscriptions.sql` :

```sql
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
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT UNIQUE,
  -- Code promo réellement appliqué, INFORMATIF uniquement : aucun montant
  -- n'est recalculé côté COSMO, Stripe fait foi sur ce qui est facturé.
  discount_code          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Le webhook retrouve l'org depuis le customer Stripe (events sans metadata).
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_customer
  ON public.org_subscriptions(stripe_customer_id);

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
-- Signature et appelants INCHANGÉS (`claim_org_invite` mig. 087,
-- `respond_join_request` mig. 067). Seul le corps change.
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
```

- [ ] **Step 2: Passer les gates statiques de migration**

```bash
npm run validate:migrations && npm run check:rls
```

Attendu : `101_org_subscriptions.sql` compté, **0 erreur** sur les deux. La policy n'est ni `FOR UPDATE` (pas de warning `WITH CHECK`) ni porteuse d'un `auth.uid()` nu.

- [ ] **Step 3: Appliquer la migration sur la stack Supabase locale**

```bash
npx supabase db reset
```

Attendu : les 101 migrations s'appliquent sans erreur. Si `supabase` n'est pas démarré : `npx supabase start` d'abord.

- [ ] **Step 4: Commit**

```bash
git add supabase/migration/101_org_subscriptions.sql
git commit -m "feat(db): table org_subscriptions et quota de sieges derive du palier reel"
```

---

## Task 3: Test d'intégration RLS

**Files:**
- Create: `e2e/rls/org-subscriptions.test.ts`

**Pourquoi un test d'intégration et pas unitaire :** une régression RLS est **silencieuse** — aucun écran ne change quand une policy s'élargit. Le harnais `e2e/rls/helpers.ts` fait les assertions sous des clients **utilisateur** (jamais `service_role`), seul moyen d'exercer réellement la RLS.

- [ ] **Step 1: Lire le harnais existant**

```bash
sed -n '1,120p' e2e/rls/helpers.ts
```

Repérer les exports : `admin`, `anonClient`, `createTestUser()`, `deleteTestUsers()`, le type `TestUser`.

- [ ] **Step 2: Écrire le test**

Créer `e2e/rls/org-subscriptions.test.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// RLS — org_subscriptions : lecture réservée aux membres, écriture interdite
// à tout client.
//
// Cette table porte l'état de facturation d'une organisation. Deux propriétés
// doivent tenir, et aucune n'est visible à l'œil nu si elle casse :
//
//   1. Un utilisateur extérieur ne doit rien lire — le palier tarifaire et la
//      date de renouvellement d'une entreprise sont des données commerciales.
//   2. AUCUN client ne doit écrire. La table n'a délibérément pas de policy
//      d'écriture (mig. 101) ; un futur `CREATE POLICY ... FOR UPDATE` posé
//      par inadvertance laisserait n'importe quel membre s'attribuer le palier
//      illimité. C'est un contournement de paiement, pas une fuite.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, anonClient, createTestUser, deleteTestUsers, TestUser } from './helpers';

describe('RLS — org_subscriptions (mig. 101)', () => {
  let membre: TestUser;
  let etranger: TestUser;
  let orgId: string;
  /** Seconde org du même membre, volontairement SANS ligne d'abonnement :
   *  c'est la seule cible sur laquelle un INSERT teste la RLS et non la PK. */
  let orgSansAboId: string;

  beforeAll(async () => {
    membre = await createTestUser();
    etranger = await createTestUser();

    // Création sous service_role : on teste la LECTURE de la table, pas le
    // parcours de création d'organisation (couvert ailleurs).
    const { data: org, error: orgError } = await admin
      .from('organizations')
      // `join_code` est NOT NULL UNIQUE sans défaut ni trigger de remplissage
      // (mig. 060) : l'omettre fait échouer le beforeAll, pas les assertions.
      .insert({ name: 'Org RLS billing', join_code: `rls-bill-${Date.now()}`, owner_id: membre.id })
      .select('id')
      .single();
    if (orgError) throw orgError;
    orgId = org.id as string;

    await admin
      .from('organization_members')
      .insert({ org_id: orgId, user_id: membre.id, role: 'admin' });

    await admin.from('org_subscriptions').insert({
      org_id: orgId,
      tier_key: 't20',
      max_members: 20,
      status: 'active',
      stripe_customer_id: 'cus_test_rls',
    });

    // Seconde org du même membre, sans abonnement : cible du test d'INSERT.
    const { data: org2, error: org2Error } = await admin
      .from('organizations')
      .insert({ name: 'Org RLS sans abo', join_code: `rls-noabo-${Date.now()}`, owner_id: membre.id })
      .select('id')
      .single();
    if (org2Error) throw org2Error;
    orgSansAboId = org2.id as string;

    await admin
      .from('organization_members')
      .insert({ org_id: orgSansAboId, user_id: membre.id, role: 'admin' });
  });

  afterAll(async () => {
    await admin.from('organizations').delete().in('id', [orgId, orgSansAboId]);
    await deleteTestUsers(membre, etranger);
  });

  it('un membre lit l’abonnement de son organisation', async () => {
    const { data, error } = await membre.client
      .from('org_subscriptions')
      .select('tier_key, max_members, status')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].tier_key).toBe('t20');
  });

  it('un utilisateur extérieur ne voit aucune ligne', async () => {
    const { data, error } = await etranger.client
      .from('org_subscriptions')
      .select('tier_key')
      .eq('org_id', orgId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('un client anonyme ne voit aucune ligne', async () => {
    const { data } = await anonClient
      .from('org_subscriptions')
      .select('tier_key')
      .eq('org_id', orgId);

    expect(data ?? []).toEqual([]);
  });

  it('un membre ne peut PAS s’attribuer le palier illimité', async () => {
    const { error } = await membre.client
      .from('org_subscriptions')
      .update({ tier_key: 'tmax', max_members: null })
      .eq('org_id', orgId);

    expect(error).not.toBeNull();

    // Vérification que la valeur n'a pas bougé, sous un client utilisateur.
    const { data } = await membre.client
      .from('org_subscriptions')
      .select('tier_key')
      .eq('org_id', orgId)
      .single();
    expect(data?.tier_key).toBe('t20');
  });

  // ⚠️ L'insertion doit viser une org SANS ligne d'abonnement. Tenter d'insérer
  // sur `orgId` échouerait sur la clé primaire même si la RLS l'autorisait :
  // le test passerait au vert sans rien prouver sur la sécurité.
  it('un membre ne peut PAS insérer d’abonnement', async () => {
    await membre.client
      .from('org_subscriptions')
      .insert({ org_id: orgSansAboId, tier_key: 'tmax', max_members: null, status: 'active' });

    const { data } = await membre.client
      .from('org_subscriptions')
      .select('org_id')
      .eq('org_id', orgSansAboId);
    expect(data ?? []).toEqual([]);
  });

  it('un membre ne peut PAS supprimer l’abonnement', async () => {
    const { error } = await membre.client
      .from('org_subscriptions')
      .delete()
      .eq('org_id', orgId);

    expect(error).not.toBeNull();

    const { data } = await membre.client
      .from('org_subscriptions')
      .select('org_id')
      .eq('org_id', orgId);
    expect(data).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Lancer le test contre la stack locale**

```bash
npm run test:rls
```

Attendu : les 6 nouveaux tests PASS, et les suites RLS existantes restent vertes.

> ⚠️ **Ne pas s'appuyer sur la forme de l'erreur.** Une table sans policy d'écriture refuse
> l'UPDATE/DELETE par un `USING` implicite vide, et PostgREST rend alors `error: null` avec
> 0 ligne au lieu d'une erreur. Chaque test d'écriture doit donc prouver que **rien n'a
> changé** — relecture par un client **utilisateur**, jamais `admin` — plutôt qu'attendre un
> `error != null`. Ajouter `.select()` à la requête d'écriture pour forcer une réponse de
> représentation exploitable.

- [ ] **Step 4: Commit**

```bash
git add e2e/rls/org-subscriptions.test.ts
git commit -m "test(rls): org_subscriptions lisible par les membres, ecrivable par personne"
```

---

## Task 4: Edge Function `stripe-org-checkout`

**Files:**
- Create: `supabase/functions/stripe-org-checkout/index.ts`

**Modèle à suivre :** `supabase/functions/stripe-create-checkout/index.ts` — allowlist CORS (faille N7), vérification JWT, client admin séparé, idempotency keys (faille M-3), `opsAlert` en `catch` (M6). On reprend cette ossature, on change le sujet (org au lieu d'utilisateur) et on ajoute deux choses : la **vérification du propriétaire** et **`allow_promotion_codes`**.

- [ ] **Step 1: Relire la fonction modèle**

```bash
sed -n '1,60p' supabase/functions/stripe-create-checkout/index.ts
```

- [ ] **Step 2: Écrire la fonction**

Créer `supabase/functions/stripe-org-checkout/index.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// Checkout Stripe d'une ORGANISATION (abonnement par palier).
//
// Distincte de `stripe-create-checkout` (abonnement particulier, montant fixe,
// clé `user_id`) : ici le sujet payant est l'organisation, le montant dépend
// du palier choisi, et l'état vit dans `org_subscriptions`.
//
// AUTORISATION : seul `organizations.owner_id` peut souscrire. C'est la SEULE
// vérification qui compte — le front ne fait que masquer un bouton.
//
// COUPONS : `allow_promotion_codes: true` fait apparaître le champ « code
// promo » dans la page Stripe. Les codes sont créés et administrés depuis le
// dashboard Stripe ; COSMO n'en valide aucun et n'en recalcule aucun montant,
// donc aucune surface de brute-force n'est ouverte de notre côté.
// ═══════════════════════════════════════════════════════════════════
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'
import { priceIdForTier, tierByKey } from '../_shared/org-tiers.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
const ALLOWED_ORIGINS = new Set([APP_URL])

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
  if (allow) headers['Access-Control-Allow-Origin'] = allow
  return headers
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { orgId, tierKey } = await req.json().catch(() => ({}))
    if (typeof orgId !== 'string' || typeof tierKey !== 'string') {
      return json({ error: 'bad_request' }, 400)
    }

    const tier = tierByKey(tierKey)
    if (!tier || tier.key === 'free') {
      return json({ error: 'invalid_tier' }, 400)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ── Autorisation : propriétaire de l'organisation, et lui seul ──
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, owner_id')
      .eq('id', orgId)
      .maybeSingle()

    // Même réponse pour « org inexistante » et « pas le propriétaire » : ne pas
    // confirmer l'existence d'une organisation dont on connaîtrait l'UUID.
    if (!org || org.owner_id !== user.id) {
      return json({ error: 'forbidden' }, 403)
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const { data: sub } = await supabaseAdmin
      .from('org_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('org_id', orgId)
      .maybeSingle()

    if (sub?.stripe_subscription_id) {
      const existing = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
      if (existing.status === 'active' || existing.status === 'trialing') {
        // Changement de palier = portail Stripe, pas un second checkout.
        return json({ error: 'already_subscribed' }, 400)
      }
    }

    let customerId = sub?.stripe_customer_id ?? null

    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: user.email,
          metadata: { org_id: orgId, supabase_uid: user.id },
        },
        { idempotencyKey: `org-customer:${orgId}` },
      )
      customerId = customer.id

      // Upsert AVANT la session : sans ça, un retour d'erreur laisse un
      // customer Stripe orphelin et le prochain appel en recrée un (faille U1).
      await supabaseAdmin.from('org_subscriptions').upsert(
        {
          org_id: orgId,
          tier_key: 'free',
          max_members: 5,
          status: 'active',
          stripe_customer_id: customerId,
        },
        { onConflict: 'org_id' },
      )
    }

    const priceId = priceIdForTier(tier.key, (name) => Deno.env.get(name))
    if (!priceId) {
      // Secret non configuré : échouer bruyamment plutôt que de créer une
      // session vide ou de facturer le mauvais palier.
      await opsAlert('stripe-org-checkout', `price id manquant pour le palier ${tier.key}`)
      return json({ error: 'tier_unavailable' }, 500)
    }

    const dayKey = new Date().toISOString().slice(0, 10)
    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${APP_URL}/entreprise?tab=billing&checkout=success`,
        cancel_url: `${APP_URL}/entreprise?tab=billing&checkout=cancelled`,
        metadata: { org_id: orgId, tier_key: tier.key },
        subscription_data: {
          metadata: { org_id: orgId, tier_key: tier.key },
        },
      },
      { idempotencyKey: `org-checkout:${orgId}:${tier.key}:${dayKey}` },
    )

    return json({ url: session.url })
  } catch (err) {
    console.error('stripe-org-checkout error:', err)
    await opsAlert('stripe-org-checkout', 'org checkout session creation failed — customer could not subscribe')
    return json({ error: 'Internal server error' }, 500)
  }
})
```

- [ ] **Step 3: Vérifier lint et typage**

```bash
npm run lint
```

Attendu : 0 erreur. (`npm run typecheck` ne couvre pas `supabase/` — le tsconfig ne prend que `src/`.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-org-checkout/index.ts
git commit -m "feat(stripe): checkout d abonnement par organisation avec codes promo"
```

---

## Task 5: Edge Function `stripe-org-portal`

**Files:**
- Create: `supabase/functions/stripe-org-portal/index.ts`

**Pourquoi c'est indispensable et pas un confort :** sans portail, un client ne peut ni changer de carte, ni récupérer ses factures, ni **résilier seul**. C'est ~50 lignes qui évitent de construire toute une UI de gestion d'abonnement.

- [ ] **Step 1: Écrire la fonction**

Créer `supabase/functions/stripe-org-portal/index.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// Portail de facturation Stripe d'une organisation.
//
// Délègue à Stripe tout ce qu'on n'a pas à construire : changement de carte,
// factures, changement de palier, RÉSILIATION. Sans ce portail, un client ne
// peut pas résilier sans nous écrire.
//
// ⚠️ Un changement de palier fait ICI ne passe pas par notre checkout : c'est
// `customer.subscription.updated` qui doit redériver le palier depuis le price
// ID reçu (voir `stripe-webhook`). Sans ça, le client paie le nouveau palier
// et garde l'ancien quota de sièges.
//
// AUTORISATION : propriétaire de l'organisation uniquement, comme le checkout.
// ═══════════════════════════════════════════════════════════════════
import Stripe from 'npm:stripe@14.21.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { opsAlert } from '../_shared/alert.ts'

const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
const ALLOWED_ORIGINS = new Set([APP_URL])

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
  if (allow) headers['Access-Control-Allow-Origin'] = allow
  return headers
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { orgId } = await req.json().catch(() => ({}))
    if (typeof orgId !== 'string') return json({ error: 'bad_request' }, 400)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, owner_id')
      .eq('id', orgId)
      .maybeSingle()
    if (!org || org.owner_id !== user.id) return json({ error: 'forbidden' }, 403)

    const { data: sub } = await supabaseAdmin
      .from('org_subscriptions')
      .select('stripe_customer_id')
      .eq('org_id', orgId)
      .maybeSingle()

    if (!sub?.stripe_customer_id) {
      // Aucun customer Stripe : l'org n'a jamais souscrit, il n'y a rien à gérer.
      return json({ error: 'no_customer' }, 400)
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${APP_URL}/entreprise?tab=billing`,
    })

    return json({ url: session.url })
  } catch (err) {
    console.error('stripe-org-portal error:', err)
    await opsAlert('stripe-org-portal', 'billing portal session creation failed — customer cannot manage or cancel')
    return json({ error: 'Internal server error' }, 500)
  }
})
```

- [ ] **Step 2: Vérifier le lint**

```bash
npm run lint
```

Attendu : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/stripe-org-portal/index.ts
git commit -m "feat(stripe): portail de facturation d organisation (carte, factures, resiliation)"
```

---

## Task 6: Branche organisation du webhook

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts`

**Ce qu'on ne touche pas :** le préambule (vérification de signature, pré-check d'idempotence, marqueur écrit **après** succès du handler — faille M-5, purge opportuniste). Il est mutualisé tel quel entre les deux univers de facturation.

**La règle de routage :** la présence de `org_id` dans les metadata décide. Un event org écrit dans `org_subscriptions` et **jamais** dans `subscriptions`, et réciproquement.

- [ ] **Step 1: Ajouter l'import du module de paliers**

En tête de `supabase/functions/stripe-webhook/index.ts`, après la ligne 3 (`import { opsAlert } ...`) :

```typescript
import { tierFromPriceId, FREE_TIER_MAX_MEMBERS } from '../_shared/org-tiers.ts'
```

- [ ] **Step 2: Router les cinq events**

Remplacer le bloc `switch (event.type)` (lignes 61-80) par :

```typescript
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Routage : une session portant `org_id` appartient à l'univers
        // entreprise, jamais à l'abonnement particulier (et réciproquement).
        if (session.metadata?.org_id) await handleOrgCheckoutCompleted(session)
        else await handleCheckoutCompleted(session)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.org_id) await handleOrgSubscriptionUpdated(subscription)
        else await handleSubscriptionUpdated(subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        if (subscription.metadata?.org_id) await handleOrgSubscriptionDeleted(subscription)
        else await handleSubscriptionDeleted(subscription)
        break
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const orgId = await orgIdFromInvoice(invoice)
        if (orgId) await handleOrgInvoicePaid(orgId, invoice)
        else await handleInvoicePaymentSucceeded(invoice)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const orgId = await orgIdFromInvoice(invoice)
        if (orgId) await handleOrgInvoiceFailed(orgId)
        else await handleInvoicePaymentFailed(invoice)
        break
      }
      default:
        // Ignore unhandled events
        break
    }
```

- [ ] **Step 3: Ajouter les handlers organisation en fin de fichier**

Ajouter à la fin de `supabase/functions/stripe-webhook/index.ts` :

```typescript
// ─── Univers ENTREPRISE ────────────────────────────────────────────
//
// Écrit exclusivement dans `org_subscriptions`. Aucun jeton premium, aucun
// `win_streak` : ces notions appartiennent à l'abonnement particulier.

const env = (name: string) => Deno.env.get(name)

/**
 * Les invoices ne portent pas nos metadata : on remonte à l'org par le
 * customer Stripe, indexé (`idx_org_subscriptions_stripe_customer`).
 * `null` = ce n'est pas une facture d'organisation.
 */
async function orgIdFromInvoice(invoice: Stripe.Invoice): Promise<string | null> {
  if (!invoice.customer) return null
  const { data } = await supabaseAdmin
    .from('org_subscriptions')
    .select('org_id')
    .eq('stripe_customer_id', invoice.customer as string)
    .maybeSingle()
  return data?.org_id ?? null
}

async function handleOrgCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription' || !session.subscription) return

  const orgId = session.metadata?.org_id
  if (!orgId) return

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

  // Code promo réellement appliqué — INFORMATIF. On ne recalcule aucun
  // montant : Stripe fait foi sur ce qui est facturé.
  let discountCode: string | null = null
  try {
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['total_details.breakdown.discounts.discount.promotion_code'],
    })
    const discount = full.total_details?.breakdown?.discounts?.[0]?.discount
    const promo = discount?.promotion_code
    discountCode = typeof promo === 'string' ? promo : (promo?.code ?? null)
  } catch (err) {
    // Un code promo non relu ne doit pas faire échouer l'activation payée.
    console.error('org checkout: promotion code read failed:', err)
  }

  await applyOrgSubscription(orgId, subscription, session.customer as string, discountCode)
}

async function handleOrgSubscriptionUpdated(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.org_id
  if (!orgId) return
  await applyOrgSubscription(orgId, subscription, subscription.customer as string, undefined)
}

async function handleOrgSubscriptionDeleted(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.org_id
  if (!orgId) return

  // Retour au palier gratuit. AUCUN membre n'est retiré : seule la croissance
  // de l'organisation redevient contrainte.
  const { error } = await supabaseAdmin
    .from('org_subscriptions')
    .update({
      tier_key: 'free',
      max_members: FREE_TIER_MAX_MEMBERS,
      status: 'cancelled',
      current_period_end: null,
      discount_code: null,
    })
    .eq('org_id', orgId)
  if (error) throw error
}

async function handleOrgInvoicePaid(orgId: string, invoice: Stripe.Invoice) {
  if (!invoice.subscription) return
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
  await applyOrgSubscription(orgId, subscription, invoice.customer as string, undefined)
}

async function handleOrgInvoiceFailed(orgId: string) {
  // `past_due` : le quota retombe au palier gratuit (org_seats_allowed n'accorde
  // le quota payant que sur `status = 'active'`), sans rien supprimer.
  const { error } = await supabaseAdmin
    .from('org_subscriptions')
    .update({ status: 'past_due' })
    .eq('org_id', orgId)
  if (error) throw error
}

/**
 * Convertit un abonnement Stripe en état de facturation d'organisation.
 *
 * ⚠️ LE POINT CRITIQUE DE TOUT LE SYSTÈME. Le palier est redérivé du PRICE ID
 * porté par l'abonnement, jamais des metadata : un changement de palier fait
 * depuis le Billing Portal ne repasse pas par notre checkout, donc les
 * metadata `tier_key` posées à la souscription sont périmées. Sans cette
 * redérivation, le client paie 100 € et reste bloqué au quota de 20 membres.
 *
 * `discountCode === undefined` = « ne pas toucher au code existant » ; `null`
 * l'efface explicitement.
 */
async function applyOrgSubscription(
  orgId: string,
  subscription: Stripe.Subscription,
  customerId: string,
  discountCode: string | null | undefined,
) {
  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const priceId = subscription.items.data[0]?.price?.id ?? ''
  const tier = tierFromPriceId(priceId, env)

  if (isActive && !tier) {
    // Price inconnu (palier retiré côté Stripe, secret désynchronisé). Écrire
    // ici dégraderait l'organisation au palier gratuit ALORS QU'ELLE PAIE —
    // on préfère alerter et ne rien changer.
    await opsAlert(
      'stripe-webhook',
      `org subscription references an unknown price — tier not applied, seat quota left untouched`,
    )
    return
  }

  const payload: Record<string, unknown> = {
    org_id: orgId,
    tier_key: isActive && tier ? tier.key : 'free',
    max_members: isActive && tier ? tier.maxMembers : FREE_TIER_MAX_MEMBERS,
    status: isActive ? 'active' : 'cancelled',
    current_period_end: isActive
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  }
  // Omis = `ON CONFLICT DO UPDATE` laisse la valeur existante intacte.
  if (discountCode !== undefined) payload.discount_code = discountCode

  const { error } = await supabaseAdmin
    .from('org_subscriptions')
    .upsert(payload, { onConflict: 'org_id' })
  if (error) {
    console.error('applyOrgSubscription upsert error:', error)
    throw error
  }
}
```

- [ ] **Step 4: Vérifier le lint**

```bash
npm run lint
```

Attendu : 0 erreur.

- [ ] **Step 5: Vérifier qu'aucun handler particulier n'a été modifié**

```bash
git diff supabase/functions/stripe-webhook/index.ts | grep '^-' | grep -v '^---'
```

Attendu : les seules lignes supprimées sont celles de l'ancien `switch`. Aucune ligne de `handleCheckoutCompleted`, `applySubscriptionToDb`, `getUidFromCustomer` ou du préambule d'idempotence ne doit apparaître.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat(stripe): branche organisation du webhook, palier redrive du price id"
```

---

## Task 7: Module front `org-billing`

**Files:**
- Create: `src/modules/billing/org-billing.types.ts`
- Create: `src/modules/billing/org-billing.logic.ts`
- Create: `src/modules/billing/org-billing.repository.ts`
- Create: `src/modules/billing/org-billing.hooks.ts`
- Test: `src/modules/billing/org-billing.logic.test.ts`

**Découpage :** la logique **pure** (quel palier couvre N membres, quel palier est actif, le quota est-il atteint) vit dans `org-billing.logic.ts` et est testée sans mock. Le repository ne fait que lire et mapper. Les hooks n'orchestrent que React Query.

- [ ] **Step 1: Écrire les types**

Créer `src/modules/billing/org-billing.types.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// BILLING — Abonnement d'ORGANISATION (mode entreprise)
//
// Distinct de `Subscription` (billing.repository.ts), qui porte l'abonnement
// PARTICULIER : jetons premium, win_streak, plan 3,50 €/mois. Les deux ne
// partagent aucune colonne et ne doivent jamais être confondus.
// ═══════════════════════════════════════════════════════════════════
import type { OrgTierKey } from './premium-config';

export type OrgSubscriptionStatus = 'active' | 'past_due' | 'cancelled';

export interface OrgSubscription {
  orgId: string;
  tierKey: OrgTierKey;
  /** `null` = palier sans plafond. */
  maxMembers: number | null;
  status: OrgSubscriptionStatus;
  currentPeriodEnd: string | null;
  /** Code promo appliqué — informatif, jamais utilisé pour un calcul. */
  discountCode: string | null;
}
```

- [ ] **Step 2: Écrire le test de la logique pure (il échouera)**

Créer `src/modules/billing/org-billing.logic.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { tierForMemberCount, effectiveQuota, isQuotaReached } from './org-billing.logic';
import type { OrgSubscription } from './org-billing.types';

const sub = (over: Partial<OrgSubscription> = {}): OrgSubscription => ({
  orgId: 'org-1',
  tierKey: 't20',
  maxMembers: 20,
  status: 'active',
  currentPeriodEnd: '2026-09-16T00:00:00.000Z',
  discountCode: null,
  ...over,
});

describe('tierForMemberCount', () => {
  it('0 à 5 membres → palier gratuit', () => {
    expect(tierForMemberCount(0).key).toBe('free');
    expect(tierForMemberCount(5).key).toBe('free');
  });

  it('6 membres → premier palier payant', () => {
    expect(tierForMemberCount(6).key).toBe('t10');
  });

  it('20 membres → le palier qui les couvre, pas le suivant', () => {
    expect(tierForMemberCount(20).key).toBe('t20');
  });

  it('au-delà du dernier plafond → palier sans limite', () => {
    expect(tierForMemberCount(500).key).toBe('tmax');
  });
});

describe('effectiveQuota', () => {
  it('sans abonnement → 5 sièges', () => {
    expect(effectiveQuota(null)).toBe(5);
  });

  it('abonnement actif → le plafond du palier', () => {
    expect(effectiveQuota(sub())).toBe(20);
  });

  it('impayé → retombe à 5 sièges, sans rien supprimer', () => {
    expect(effectiveQuota(sub({ status: 'past_due' }))).toBe(5);
  });

  it('résilié → retombe à 5 sièges', () => {
    expect(effectiveQuota(sub({ status: 'cancelled' }))).toBe(5);
  });

  it('palier sans plafond → null', () => {
    expect(effectiveQuota(sub({ tierKey: 'tmax', maxMembers: null }))).toBeNull();
  });
});

describe('isQuotaReached', () => {
  it('sous le quota → false', () => {
    expect(isQuotaReached(19, sub())).toBe(false);
  });

  it('au quota exact → true (la règle serveur est COUNT < quota)', () => {
    expect(isQuotaReached(20, sub())).toBe(true);
  });

  it('palier sans plafond → jamais atteint', () => {
    expect(isQuotaReached(9999, sub({ tierKey: 'tmax', maxMembers: null }))).toBe(false);
  });

  it('sans abonnement, 5 membres → atteint', () => {
    expect(isQuotaReached(5, null)).toBe(true);
  });
});
```

- [ ] **Step 3: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run src/modules/billing/org-billing.logic.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./org-billing.logic"`.

- [ ] **Step 4: Écrire la logique pure**

Créer `src/modules/billing/org-billing.logic.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — logique pure (aucun accès réseau, aucun état React).
//
// ⚠️ Ces fonctions ne sont PAS la frontière de sécurité : le quota qui compte
// est celui appliqué par `org_seats_allowed()` en base (mig. 101). Ce qui est
// ici sert à l'AFFICHAGE — proposer le bon palier, prévenir avant le blocage.
// Les deux doivent dire la même chose, d'où la sémantique identique
// (`COUNT(membres) < quota`).
// ═══════════════════════════════════════════════════════════════════
import { ENTERPRISE_PRICING_TIERS, ORG_FREE_SEATS } from './premium-config';
import type { OrgSubscription } from './org-billing.types';

type Tier = (typeof ENTERPRISE_PRICING_TIERS)[number];

/** Le plus petit palier dont le plafond couvre `count` membres. */
export function tierForMemberCount(count: number): Tier {
  return (
    ENTERPRISE_PRICING_TIERS.find((t) => t.maxMembers === null || count <= t.maxMembers) ??
    ENTERPRISE_PRICING_TIERS[ENTERPRISE_PRICING_TIERS.length - 1]
  );
}

/**
 * Nombre de sièges réellement accordés. `null` = illimité.
 *
 * Un abonnement non `active` (impayé, résilié) ne donne PAS son quota : c'est
 * la même règle qu'en base, et elle ne retire jamais de membre existant.
 */
export function effectiveQuota(sub: OrgSubscription | null): number | null {
  if (!sub || sub.status !== 'active') return ORG_FREE_SEATS;
  return sub.maxMembers;
}

/** Le prochain ajout de membre sera-t-il refusé par le serveur ? */
export function isQuotaReached(memberCount: number, sub: OrgSubscription | null): boolean {
  const quota = effectiveQuota(sub);
  if (quota === null) return false;
  return memberCount >= quota;
}
```

- [ ] **Step 5: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run src/modules/billing/org-billing.logic.test.ts
```

Attendu : 13 tests PASS.

- [ ] **Step 6: Écrire le repository**

Créer `src/modules/billing/org-billing.repository.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — lecture de l'abonnement d'organisation.
//
// LECTURE SEULE, par construction : `org_subscriptions` n'a aucune policy
// d'écriture (mig. 101). Toute mutation passe par Stripe puis par le webhook.
// ═══════════════════════════════════════════════════════════════════
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type { OrgSubscription, OrgSubscriptionStatus } from './org-billing.types';
import type { OrgTierKey } from './premium-config';

interface OrgSubscriptionRow {
  org_id: string;
  tier_key: OrgTierKey;
  max_members: number | null;
  status: OrgSubscriptionStatus;
  current_period_end: string | null;
  discount_code: string | null;
}

/** `null` = aucune ligne, c'est-à-dire palier gratuit. Pas une erreur. */
export async function getOrgSubscription(orgId: string): Promise<OrgSubscription | null> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('org_subscriptions')
    .select('org_id, tier_key, max_members, status, current_period_end, discount_code')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw normalizeApiError(error);
  if (!data) return null;

  const row = data as OrgSubscriptionRow;
  return {
    orgId: row.org_id,
    tierKey: row.tier_key,
    maxMembers: row.max_members,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    discountCode: row.discount_code,
  };
}
```

- [ ] **Step 7: Écrire les hooks**

Créer `src/modules/billing/org-billing.hooks.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — hooks React Query.
//
// MODE DÉMO : une organisation de démo ne paie jamais. `useOrgSubscription`
// renvoie `null` (= palier gratuit) sans aucune requête, et les mutations de
// checkout/portail ne sont pas exposées dans l'UI démo. Pas de
// `local.repository` ni d'entrée dans `repository.factory` : il n'y a aucune
// sémantique démo à simuler pour un abonnement Stripe.
// ═══════════════════════════════════════════════════════════════════
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useIsDemo } from '@/lib/app-mode.store';
import { translator } from '@/i18n/useT';
import { getOrgSubscription } from './org-billing.repository';
import type { OrgSubscription } from './org-billing.types';
import type { OrgTierKey } from './premium-config';

export const orgBillingKeys = {
  all: ['org-billing'] as const,
  subscription: (orgId: string) => [...orgBillingKeys.all, 'subscription', orgId] as const,
};

export const useOrgSubscription = (orgId: string | undefined) => {
  const isDemo = useIsDemo();
  return useQuery<OrgSubscription | null>({
    queryKey: orgBillingKeys.subscription(orgId ?? ''),
    queryFn: () => (isDemo ? Promise.resolve(null) : getOrgSubscription(orgId as string)),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

/** Invoque une Edge Function Stripe et redirige vers l'URL renvoyée. */
async function redirectToStripe(
  fn: 'stripe-org-checkout' | 'stripe-org-portal',
  body: Record<string, unknown>,
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not_authenticated');

  const { data, error } = await supabase.functions.invoke(fn, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error as string);
  if (!data?.url) throw new Error('no_url');

  window.location.href = data.url as string;
}

export const useStartOrgCheckout = () =>
  useMutation({
    mutationFn: ({ orgId, tierKey }: { orgId: string; tierKey: OrgTierKey }) =>
      redirectToStripe('stripe-org-checkout', { orgId, tierKey }),
    onError: (err: Error) => {
      // `translator(ns).t(key)` — forme vérifiée dans src/i18n/useT.ts:70 et
      // utilisée par src/modules/organizations/hooks.ts. Hors composant, on ne
      // peut pas appeler le hook `useT`.
      const { t } = translator('org');
      toast.error(
        err.message === 'already_subscribed' ? t('billing.alreadySubscribed') : t('billing.error'),
      );
    },
  });

export const useOpenOrgPortal = () =>
  useMutation({
    mutationFn: ({ orgId }: { orgId: string }) => redirectToStripe('stripe-org-portal', { orgId }),
    onError: () => {
      toast.error(translator('org').t('billing.error'));
    },
  });
```

> Les hooks du projet passent le plus souvent par le namespace `errors` pour leurs toasts.
> Ici on reste sur `org` **délibérément** : tout le vocabulaire de facturation vit dans un seul
> catalogue, ce qui évite d'avoir à chercher la moitié des messages dans un autre fichier.

- [ ] **Step 8: Vérifier typage et lint**

```bash
npm run typecheck && npm run lint
```

Attendu : 0 erreur. Les clés `billing.*` n'existent pas encore dans le catalogue : si `typecheck` refuse `t('billing.error')`, faire d'abord les étapes 1 à 3 de la Task 8 (les clés i18n) puis relancer.

- [ ] **Step 9: Commit**

```bash
git add src/modules/billing/org-billing.*
git commit -m "feat(billing): module front d abonnement d organisation, logique de quota testee"
```

---

## Task 8: Onglet Abonnement + i18n

**Files:**
- Create: `src/components/organization/EnterpriseTierGrid.tsx`
- Create: `src/components/organization/OrgBillingTab.tsx`
- Modify: `src/pages/OrganizationPage.tsx:33-45`
- Delete: `src/pages/EnterprisePaywallPage.tsx`
- Modify: `src/locales/fr/org.json`, `src/locales/en/org.json`

- [ ] **Step 1: Ajouter les clés i18n françaises**

Dans `src/locales/fr/org.json`, ajouter `"billing"` à l'objet `tabs` existant et un nouvel objet racine `billing` :

```json
{
  "tabs": {
    "billing": "Abonnement"
  },
  "billing": {
    "title": "Abonnement de l'organisation",
    "subtitle": "Un tarif par palier de membres, sans engagement. Le palier gratuit reste l'essai.",
    "rangeUpTo": "{{min}} à {{max}} membres",
    "rangeFrom": "{{min}} membres et plus",
    "perMonth": "par mois",
    "free": "Gratuit",
    "currentTier": "Palier actuel",
    "currentTierFree": "Vous êtes sur le palier gratuit.",
    "seatsUsed": "{{count}} membres sur {{quota}} sièges",
    "seatsUnlimited": "{{count}} membres, sièges illimités",
    "renewsOn": "Renouvellement le {{date}}",
    "discountApplied": "Code promo appliqué : {{code}}",
    "statusPastDue": "Le dernier paiement a échoué. Les membres actuels gardent tous leurs accès, mais aucun nouveau membre ne peut être ajouté tant que le paiement n'est pas régularisé.",
    "statusCancelled": "Abonnement résilié. Les membres actuels gardent tous leurs accès ; le quota est revenu au palier gratuit.",
    "subscribe": "Choisir ce palier",
    "manage": "Gérer l'abonnement",
    "manageHint": "Carte bancaire, factures, changement de palier et résiliation se gèrent depuis Stripe.",
    "ownerOnly": "L'abonnement est géré par le propriétaire de l'organisation.",
    "dormant": "La facturation entreprise n'est pas encore activée. Tout est gratuit pour le moment.",
    "checkoutSuccess": "Abonnement activé. Merci !",
    "checkoutCancelled": "Paiement annulé, rien n'a été débité.",
    "alreadySubscribed": "Cette organisation a déjà un abonnement actif. Utilisez « Gérer l'abonnement » pour changer de palier.",
    "error": "Impossible de contacter Stripe. Réessayez dans un instant."
  }
}
```

> ⚠️ Ne pas écraser les objets `tabs` / racine existants : **fusionner** ces clés dans le JSON actuel (737 clés). Ouvrir le fichier, ajouter `"billing": "Abonnement"` dans `tabs`, puis l'objet `billing` au niveau racine.

- [ ] **Step 2: Ajouter les mêmes clés en anglais**

Dans `src/locales/en/org.json`, mêmes chemins de clés, traduits :

```json
{
  "tabs": {
    "billing": "Billing"
  },
  "billing": {
    "title": "Organization subscription",
    "subtitle": "One price per member tier, no commitment. The free tier is the trial.",
    "rangeUpTo": "{{min}} to {{max}} members",
    "rangeFrom": "{{min}} members and up",
    "perMonth": "per month",
    "free": "Free",
    "currentTier": "Current tier",
    "currentTierFree": "You are on the free tier.",
    "seatsUsed": "{{count}} members of {{quota}} seats",
    "seatsUnlimited": "{{count}} members, unlimited seats",
    "renewsOn": "Renews on {{date}}",
    "discountApplied": "Promo code applied: {{code}}",
    "statusPastDue": "The last payment failed. Current members keep full access, but no new member can be added until payment is settled.",
    "statusCancelled": "Subscription cancelled. Current members keep full access; the seat quota is back to the free tier.",
    "subscribe": "Choose this tier",
    "manage": "Manage subscription",
    "manageHint": "Payment method, invoices, tier changes and cancellation are handled on Stripe.",
    "ownerOnly": "Billing is managed by the organization owner.",
    "dormant": "Enterprise billing is not active yet. Everything is free for now.",
    "checkoutSuccess": "Subscription active. Thank you!",
    "checkoutCancelled": "Payment cancelled, nothing was charged.",
    "alreadySubscribed": "This organization already has an active subscription. Use \"Manage subscription\" to change tier.",
    "error": "Could not reach Stripe. Please try again shortly."
  }
}
```

- [ ] **Step 3: Vérifier la parité des catalogues**

```bash
npm run i18n:check
```

Attendu : 0 clé manquante. Cette gate est bloquante en CI.

- [ ] **Step 4: Extraire la grille de paliers**

Créer `src/components/organization/EnterpriseTierGrid.tsx` (reprend la grille de `EnterprisePaywallPage.tsx`, en la rendant traduite et actionnable) :

```tsx
import { Check } from 'lucide-react';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';
import type { OrgTierKey } from '@/modules/billing/premium-config';
import { formatCurrency } from '@/i18n/format';
import { useT } from '@/i18n/useT';

interface Props {
  /** Palier actuellement actif — mis en avant. */
  currentTier?: OrgTierKey;
  /** Absent = grille purement informative (pas propriétaire, ou flag dormant). */
  onSelect?: (tier: OrgTierKey) => void;
  isPending?: boolean;
}

/**
 * Grille des cinq paliers. Les montants viennent de `ENTERPRISE_PRICING_TIERS`
 * et sont rendus par `formatCurrency` — jamais de montant écrit en dur, et
 * jamais de compteur animé sur un prix (il passerait par 48 € avant de se
 * poser sur 50 €).
 */
export function EnterpriseTierGrid({ currentTier, onSelect, isPending }: Props) {
  const { t } = useT('org');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {ENTERPRISE_PRICING_TIERS.map((tier) => {
        const isCurrent = currentTier === tier.key;
        const isFree = tier.priceEurPerMonth === 0;
        const range =
          tier.maxMembers === null
            ? t('billing.rangeFrom', { min: String(tier.minMembers) })
            : t('billing.rangeUpTo', {
                min: String(tier.minMembers),
                max: String(tier.maxMembers),
              });

        return (
          <div
            key={tier.key}
            className={`rounded-xl border p-4 flex flex-col gap-2 ${
              isCurrent
                ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.06)]'
                : 'border-[rgb(var(--color-border))]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-[rgb(var(--color-text-secondary))]">{range}</span>
              {isCurrent && (
                <Check size={16} className="text-[rgb(var(--color-accent))]" aria-hidden />
              )}
            </div>

            <div className="text-2xl font-semibold text-[rgb(var(--color-text-primary))]">
              {isFree ? t('billing.free') : formatCurrency(tier.priceEurPerMonth)}
            </div>
            {!isFree && (
              <div className="text-xs text-[rgb(var(--color-text-secondary))]">
                {t('billing.perMonth')}
              </div>
            )}

            {onSelect && !isFree && !isCurrent && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onSelect(tier.key)}
                className="mt-auto rounded-lg bg-[rgb(var(--color-accent-solid))] px-3 py-2 text-sm font-medium text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-60"
              >
                {t('billing.subscribe')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EnterpriseTierGrid;
```

> **Tokens de couleur — déjà vérifiés, ne pas improviser.** Les seuls tokens de texte existants
> sont `--color-text-primary`, `--color-text-secondary`, `--color-text-muted` ; pour un bouton
> plein, `--color-accent-solid` + `--color-accent-solid-foreground` (+ `-hover`). Le projet
> interdit les couleurs Tailwind en dur du type `bg-white dark:bg-slate-900` (fix de réactivité
> des thèmes, 2026-07-23) : `text-white` sur un bouton est donc une régression, pas un raccourci.

- [ ] **Step 5: Écrire l'onglet**

Créer `src/components/organization/OrgBillingTab.tsx` :

```tsx
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { CreditCard } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { ENTERPRISE_BILLING_ENFORCED } from '@/modules/billing/premium-config';
import { useOrgSubscription, useStartOrgCheckout, useOpenOrgPortal } from '@/modules/billing/org-billing.hooks';
import { effectiveQuota } from '@/modules/billing/org-billing.logic';
import { EnterpriseTierGrid } from './EnterpriseTierGrid';

interface Props {
  orgId: string;
  isOwner: boolean;
  memberCount: number;
}

/**
 * Onglet Abonnement de l'espace entreprise.
 *
 * Tant que `ENTERPRISE_BILLING_ENFORCED` est `false`, la grille reste visible
 * (elle informe) mais AUCUN CTA de paiement n'est monté. Le flag est la seule
 * condition — pas « actif si les variables d'environnement existent » : on doit
 * pouvoir dire d'un coup d'œil si le produit facture ou non.
 */
export function OrgBillingTab({ orgId, isOwner, memberCount }: Props) {
  const { t } = useT('org');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: subscription } = useOrgSubscription(orgId);
  const checkout = useStartOrgCheckout();
  const portal = useOpenOrgPortal();

  // Retour de Stripe : on consomme le paramètre pour qu'un rafraîchissement ne
  // rejoue pas le toast.
  const checkoutResult = searchParams.get('checkout');
  useEffect(() => {
    if (!checkoutResult) return;
    if (checkoutResult === 'success') toast.success(t('billing.checkoutSuccess'));
    if (checkoutResult === 'cancelled') toast.info(t('billing.checkoutCancelled'));
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
  }, [checkoutResult, searchParams, setSearchParams, t]);

  const quota = effectiveQuota(subscription ?? null);
  const canPay = ENTERPRISE_BILLING_ENFORCED && isOwner;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[rgb(var(--color-text-primary))]">
          <CreditCard size={18} aria-hidden />
          {t('billing.title')}
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('billing.subtitle')}</p>
      </header>

      <section className="rounded-xl border border-[rgb(var(--color-border))] p-4 flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-[rgb(var(--color-text-secondary))]">
          {t('billing.currentTier')}
        </span>
        <p className="text-sm text-[rgb(var(--color-text-primary))]">
          {quota === null
            ? t('billing.seatsUnlimited', { count: String(memberCount) })
            : t('billing.seatsUsed', { count: String(memberCount), quota: String(quota) })}
        </p>
        {!subscription && (
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {t('billing.currentTierFree')}
          </p>
        )}
        {subscription?.status === 'active' && subscription.currentPeriodEnd && (
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {t('billing.renewsOn', { date: formatDate(new Date(subscription.currentPeriodEnd)) })}
          </p>
        )}
        {subscription?.status === 'past_due' && (
          <p className="text-sm text-[rgb(var(--color-text-primary))]">{t('billing.statusPastDue')}</p>
        )}
        {subscription?.status === 'cancelled' && (
          <p className="text-sm text-[rgb(var(--color-text-primary))]">{t('billing.statusCancelled')}</p>
        )}
        {subscription?.discountCode && (
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {t('billing.discountApplied', { code: subscription.discountCode })}
          </p>
        )}
      </section>

      {!ENTERPRISE_BILLING_ENFORCED && (
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('billing.dormant')}</p>
      )}
      {ENTERPRISE_BILLING_ENFORCED && !isOwner && (
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('billing.ownerOnly')}</p>
      )}

      <EnterpriseTierGrid
        currentTier={subscription?.tierKey}
        onSelect={canPay ? (tierKey) => checkout.mutate({ orgId, tierKey }) : undefined}
        isPending={checkout.isPending}
      />

      {canPay && subscription && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={portal.isPending}
            onClick={() => portal.mutate({ orgId })}
            className="self-start rounded-lg border border-[rgb(var(--color-border))] px-3 py-2 text-sm disabled:opacity-60"
          >
            {t('billing.manage')}
          </button>
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.manageHint')}</p>
        </div>
      )}
    </div>
  );
}

export default OrgBillingTab;
```

> Le bouton « Gérer l'abonnement » n'apparaît que s'il existe un abonnement : sans customer
> Stripe, `stripe-org-portal` répond `no_customer` et le portail n'a rien à afficher.
>
> `formatDate(date, options?, locale?)` est bien la signature réelle (`src/i18n/format.ts:39`),
> donc `formatDate(new Date(iso))` suffit.

- [ ] **Step 6: Brancher l'onglet dans `OrganizationPage`**

Dans `src/pages/OrganizationPage.tsx` :

1. Élargir le type d'onglet (ligne 33) :

```typescript
type OrgTab = 'overview' | 'pyramid' | 'projects' | 'okr' | 'stats' | 'members' | 'billing';
```

2. Ajouter le drapeau `ownerOnly` au type de `TABS` et l'entrée correspondante (lignes 37-45) :

```typescript
const TABS: {
  id: OrgTab;
  labelKey: KeyOf<'org'>;
  Icon: typeof Users;
  managerOnly?: boolean;
  ownerOnly?: boolean;
}[] = [
  { id: 'overview', labelKey: 'tabs.overview', Icon: LayoutDashboard },
  { id: 'pyramid', labelKey: 'tabs.pyramid', Icon: Network },
  { id: 'projects', labelKey: 'tabs.projects', Icon: FolderKanban },
  { id: 'okr', labelKey: 'tabs.okr', Icon: Target },
  { id: 'stats', labelKey: 'tabs.stats', Icon: BarChart3, managerOnly: true },
  { id: 'members', labelKey: 'tabs.members', Icon: Users },
  // Facturation : propriétaire uniquement. Le vrai contrôle est côté Edge
  // Function (`owner_id`) — ici on ne fait que ne pas proposer un écran inutile.
  { id: 'billing', labelKey: 'tabs.billing', Icon: CreditCard, ownerOnly: true },
];
```

3. Importer `CreditCard` depuis `lucide-react` (import nominal) et `OrgBillingTab`.

4. Appliquer le filtre `ownerOnly` là où `managerOnly` est déjà filtré, et rendre l'onglet là où les autres contenus sont rendus :

```tsx
{tab === 'billing' && organization && (
  <OrgBillingTab
    orgId={organization.id}
    isOwner={organization.ownerId === user?.id}
    memberCount={members?.length ?? 0}
  />
)}
```

Repérer les noms réels des variables locales (`organization`, `members`, `user`) en lisant le corps du composant :

```bash
sed -n '60,180p' src/pages/OrganizationPage.tsx
```

- [ ] **Step 7: Supprimer la page paywall devenue morte**

```bash
git rm src/pages/EnterprisePaywallPage.tsx
grep -rn "EnterprisePaywallPage" src
```

Attendu du `grep` : **aucun résultat**. La page n'était référencée nulle part (ni route, ni nav) — c'est exactement pourquoi elle est remplacée plutôt que conservée en double de l'onglet.

- [ ] **Step 8: Vérifier typage, lint et i18n**

```bash
npm run typecheck && npm run lint && npm run i18n:check
```

Attendu : 0 erreur sur les trois.

- [ ] **Step 9: Vérifier l'écran dans le navigateur**

Démarrer le serveur de dev, se connecter en mode démo, ouvrir `/entreprise?tab=billing`. Attendu :
- la grille des 5 paliers s'affiche avec « Gratuit », 20 €, 50 €, 100 €, 200 € ;
- le message « La facturation entreprise n'est pas encore activée » est visible ;
- **aucun bouton de paiement** n'est présent (flag dormant) ;
- aucune erreur dans la console.

- [ ] **Step 10: Commit**

```bash
git add src/components/organization/EnterpriseTierGrid.tsx src/components/organization/OrgBillingTab.tsx src/pages/OrganizationPage.tsx src/locales/fr/org.json src/locales/en/org.json
git commit -m "feat(entreprise): onglet Abonnement, grille de paliers et etat de facturation"
```

---

## Task 9: Documentation et gates finales

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/POST-AUDIT-GUIDE.md`

- [ ] **Step 1: Mettre à jour le compte de migrations dans CLAUDE.md**

Dans `CLAUDE.md`, section « Base de données Supabase », remplacer :

```
**100 migrations, dernière = `099_admin_stats_v3.sql`** (au 2026-08-14).
```

par :

```
**102 migrations, dernière = `101_org_subscriptions.sql`** (au 2026-08-16).
```

> Ce compte était déjà faux d'une unité avant ce chantier : `100_private_rls_helpers.sql` existe
> (101 fichiers sur disque) mais la ligne annonçait encore la 099. On corrige les deux d'un coup.

- [ ] **Step 2: Documenter la facturation entreprise dans CLAUDE.md**

Dans `CLAUDE.md`, sous « Modèle Premium », ajouter :

```markdown
#### Facturation entreprise (Stripe, dormante)

`org_subscriptions` (mig. 101) porte l'abonnement d'une organisation : un palier
(`ENTERPRISE_PRICING_TIERS`), un quota de sièges (`max_members`), un statut. La table
n'a **aucune policy d'écriture** — seul le webhook Stripe (`service_role`) écrit.

- Souscription et gestion : **propriétaire de l'org uniquement**, vérifié dans
  `stripe-org-checkout` / `stripe-org-portal`, jamais seulement côté UI.
- Coupons : **promotion codes Stripe natifs** (`allow_promotion_codes`). COSMO ne valide
  aucun code et ne recalcule aucun montant.
- ❌ **Ne jamais dériver le palier des metadata Stripe** : un changement fait depuis le
  Billing Portal ne repasse pas par notre checkout. Le palier se redérive du **price ID**
  (`tierFromPriceId`, `supabase/functions/_shared/org-tiers.ts`). Sans ça, un client paie
  100 € et reste bloqué au quota de 20 sièges.
- ❌ **Ne jamais écrire un montant en dur** côté Deno : `_shared/org-tiers.ts` est verrouillé
  sur `ENTERPRISE_PRICING_TIERS` par `src/modules/billing/org-tiers.parity.test.ts`.
- Activation : `UPDATE billing_flags SET enabled = true WHERE key = 'enterprise_seat_limit'`
  puis `ENTERPRISE_BILLING_ENFORCED = true`.
```

- [ ] **Step 3: Ajouter la section Stripe entreprise à `docs/SECURITY.md`**

Ajouter, dans la partie Stripe de `docs/SECURITY.md` :

```markdown
### Abonnement d'organisation (mig. 101)

`org_subscriptions` : SELECT réservé aux membres (`is_org_member`), **aucune policy
d'écriture**. Contrairement à `subscriptions` (mig. 013), aucun trigger-guard n'est
nécessaire — il n'y a rien à garder quand rien n'est écrivable.

Autorisation de paiement : `organizations.owner_id`, vérifié **dans les Edge Functions**
`stripe-org-checkout` et `stripe-org-portal`. Une org inexistante et un appelant non
propriétaire renvoient la même 403, pour ne pas confirmer l'existence d'une organisation
dont on connaîtrait l'UUID.

Le quota de sièges appliqué est `org_seats_allowed()` ; un abonnement `past_due` ou
`cancelled` retombe au palier gratuit **sans jamais retirer de membre**.

Test d'intégration : `e2e/rls/org-subscriptions.test.ts`.
```

- [ ] **Step 4: Mettre à jour `docs/POST-AUDIT-GUIDE.md`**

Remplacer le point « finalisation Stripe » par la procédure réelle :

```markdown
## Activation de la facturation entreprise

**Prérequis Stripe** — créer 4 prix récurrents mensuels en EUR (20, 50, 100, 200 €), puis
les promotion codes voulus (montant ou %, durée, plafond d'usage, restriction produit).

**Secrets Supabase** :

    supabase secrets set STRIPE_ORG_PRICE_T10=price_... \
                         STRIPE_ORG_PRICE_T20=price_... \
                         STRIPE_ORG_PRICE_T50=price_... \
                         STRIPE_ORG_PRICE_TMAX=price_...

**Déploiement** : `stripe-org-checkout`, `stripe-org-portal`, et redéploiement de
`stripe-webhook`. Ajouter `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
à l'endpoint webhook s'ils n'y sont pas déjà.

**Recette (test mode, `stripe listen --forward-to`)** :

- souscription palier 2 par le propriétaire → `org_subscriptions` correcte, quota 20
- souscription tentée par un membre non propriétaire → 403
- souscription avec promotion code → montant réduit chez Stripe, `discount_code` renseigné
- changement de palier depuis le portail → `tier_key` **et** `max_members` suivent
- résiliation → `status='cancelled'`, quota 5, **aucun membre expulsé**
- échec de paiement → `status='past_due'`
- rejeu du même event → dédupliqué

**Bascule** :

    UPDATE public.billing_flags SET enabled = true WHERE key = 'enterprise_seat_limit';

puis `ENTERPRISE_BILLING_ENFORCED = true` et déploiement du front.

⚠️ **Avant de basculer**, compter les organisations qui dépasseraient leur quota : elles
seront bloquées en ajout de membre du jour au lendemain. Les prévenir, ou leur poser une
ligne `org_subscriptions` de courtoisie.

    SELECT o.id, o.name, COUNT(m.user_id) AS membres
    FROM public.organizations o
    JOIN public.organization_members m ON m.org_id = o.id
    GROUP BY o.id, o.name HAVING COUNT(m.user_id) > 5;
```

- [ ] **Step 5: Lancer toutes les gates**

```bash
npm run lint && npm run typecheck && npm run i18n:check && npm run validate:migrations && npm run check:rls && npm test
```

Attendu : 0 erreur partout, suite Vitest verte (1362 tests existants + les nouveaux). `npm test` prend ~7 min.

> `npm run test:coverage` et `npm run test:e2e` sont **déjà rouges sur `main`** (dette connue). Ne pas les traiter comme une régression de ce chantier ; mesurer la baseline avant d'accuser un changement.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md docs/SECURITY.md docs/POST-AUDIT-GUIDE.md
git commit -m "docs: facturation entreprise Stripe, procedure d activation et garde-fous"
```

---

## Récapitulatif des tâches

| # | Tâche | Livrable vérifiable |
|---|---|---|
| 1 | Module de paliers partagé | 8 tests de parité verts |
| 2 | Migration 101 | `validate:migrations` + `check:rls` verts, `db reset` OK |
| 3 | Test RLS | 6 tests d'intégration verts |
| 4 | `stripe-org-checkout` | Lint vert, fonction déployable |
| 5 | `stripe-org-portal` | Lint vert, fonction déployable |
| 6 | Branche org du webhook | Aucun handler particulier modifié (diff vérifié) |
| 7 | Module front | 13 tests de logique verts |
| 8 | Onglet Abonnement | Écran vérifié dans le navigateur, `i18n:check` vert |
| 9 | Docs + gates | Toutes les gates CI vertes |
