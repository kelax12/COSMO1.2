# Stripe entreprise — abonnement par organisation + coupons

**Date** : 2026-08-16 · **Statut** : validé, en implémentation

## Problème

Le mode entreprise est le seul endroit où COSMO facture quelque chose (`ENTERPRISE_PRICING_TIERS`,
0/20/50/100/200 € par mois selon le nombre de membres), et **rien n'existe pour l'encaisser** :

- Le Stripe en place est **exclusivement particulier** : table `subscriptions` clé sur `user_id`,
  un seul `STRIPE_PRICE_ID` à 3,50 €/mois, jetons premium + `win_streak`. Rien de tout cela ne
  s'applique à une organisation.
- `org_seats_allowed()` (mig. 067) est un **stub** avec `< 5` écrit en dur et un TODO explicite :
  « table org_subscriptions à venir avec la finalisation Stripe ».
- `EnterprisePaywallPage` existe mais n'est montée sur **aucune route** et n'a **aucun CTA**.
- Les 5 paliers annoncés sur la landing n'ont **aucun prix Stripe en face**.

Ce document décrit la plomberie complète, livrée **dormante** derrière les flags existants.

## Portée retenue

| Décision | Choix |
|---|---|
| Livraison | Plomberie complète, **dormante** (`ENTERPRISE_BILLING_ENFORCED = false`, `billing_flags` off) |
| Modèle Stripe | **4 prix fixes** (un par palier payant), changement de palier explicite |
| Coupons | **Promotion codes Stripe natifs** (`allow_promotion_codes: true`), gérés depuis le dashboard Stripe |
| Qui souscrit | **Le propriétaire de l'org uniquement** (`organizations.owner_id`) |
| Dépassement de quota | **Blocage de l'ajout de membre**, membres existants intacts, aucune fonctionnalité retirée |
| Portail de gestion | **Oui**, Edge Function dédiée (Stripe Billing Portal) |

Explicitement **hors périmètre** : facturation annuelle, prorata automatique, upgrade automatique
au dépassement, TVA/facturation locale au-delà de ce que Stripe Tax fait tout seul, gestion des
codes promo depuis notre UI.

---

## 1. Modèle de données — migration `101_org_subscriptions.sql`

```sql
CREATE TABLE public.org_subscriptions (
  org_id                 UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier_key               TEXT NOT NULL,          -- 'free' | 't10' | 't20' | 't50' | 'tmax'
  max_members            INT,                    -- NULL = illimité
  status                 TEXT NOT NULL,          -- 'active' | 'past_due' | 'cancelled'
  current_period_end     TIMESTAMPTZ,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT UNIQUE,
  discount_code          TEXT,                   -- code promo appliqué (informatif)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Clé primaire = `org_id`** : une organisation a au plus un abonnement. C'est ce qui rend
l'upsert du webhook atomique sans verrou (même pattern que `subscriptions`, faille U2).

**`max_members` est dénormalisé exprès.** `org_seats_allowed()` n'a alors jamais besoin de
connaître les prix ni de faire une jointure : juste un entier à comparer. C'est aussi ce qui rend
le quota d'une org lisible en une requête SQL le jour d'un litige client.

### RLS

- **SELECT** : membres de l'organisation, via le helper existant `public.is_org_member(org_id)`
  (mig. 069, resté public après le durcissement de la mig. 100).
- **Aucune policy INSERT / UPDATE / DELETE.** Ce qui n'a pas de policy n'est pas écrivable par un
  client : pas besoin d'un trigger-guard comme `subscriptions_guard()`. Seul le `service_role` du
  webhook écrit.
- Une seule policy PERMISSIVE par rôle+action (contrainte mig. 049, `npm run check:rls`).

### Réécriture de `org_seats_allowed(p_org)`

Signature et appelants inchangés — la fonction est **déjà** le point d'application, appelée par
`claim_org_invite` et `approve_join_request` (mig. 084, 087). Rien à recâbler.

```
si billing_flags['enterprise_seat_limit'] != true  → true          (gate dormant, comportement actuel)
sinon:
  quota = max_members de org_subscriptions WHERE org_id = p_org AND status = 'active'
  si aucune ligne, ou status != 'active'           → quota = ORG_FREE_SEATS (5)
  si quota IS NULL (palier illimité)               → true
  → COUNT(organization_members) < quota
```

Reste `STABLE SECURITY DEFINER SET search_path = ''`, `REVOKE FROM PUBLIC/anon`, `GRANT TO
authenticated` — conforme à mig. 069 et au durcissement des helpers (mig. 100).

---

## 2. Paliers — une source, deux runtimes

### Les price IDs ne touchent jamais le front

Le client envoie une **`tierKey`** (`'t10'`, `'t20'`, …). L'Edge Function fait seule la
correspondance `tierKey → priceId` depuis ses variables d'environnement. Un client ne peut donc
pas se forger un prix, ni découvrir la grille tarifaire Stripe depuis le bundle.

| Palier | `tierKey` | Membres | € / mois | Env var |
|---|---|---|---|---|
| Gratuit | `free` | 0 à 5 | 0 | — (pas de checkout) |
| 1 | `t10` | 5 à 10 | 20 | `STRIPE_ORG_PRICE_T10` |
| 2 | `t20` | 10 à 20 | 50 | `STRIPE_ORG_PRICE_T20` |
| 3 | `t50` | 20 à 50 | 100 | `STRIPE_ORG_PRICE_T50` |
| 4 | `tmax` | 50 et plus | 200 | `STRIPE_ORG_PRICE_TMAX` |

### `supabase/functions/_shared/org-tiers.ts`

Ce module porte le mapping `tierKey ↔ maxMembers ↔ priceId`, **dans les deux sens** (le sens
inverse `priceId → tier` est indispensable, voir §3). Il est écrit en **TypeScript pur, sans
aucune API Deno**, ce qui le rend importable tel quel par Vitest.

Un test compare sa table aux `ENTERPRISE_PRICING_TIERS` du front et échoue si les deux dérivent.
C'est le garde-fou qui empêche d'annoncer 50 € sur la landing et d'en facturer 100. Il complète la
règle CLAUDE.md « jamais de montant en dur » en la rendant vérifiable côté serveur aussi.

`ENTERPRISE_PRICING_TIERS` (`src/modules/billing/premium-config.ts`) gagne une clé `key` stable
par palier. Les montants restent inchangés.

---

## 3. Edge Functions

### `stripe-org-checkout` (nouvelle)

1. JWT obligatoire, sinon 401 (même préambule que `stripe-create-checkout`).
2. Lit `{ orgId, tierKey }` du corps. **Vérifie que l'appelant est `organizations.owner_id`**,
   sinon 403. C'est la seule autorisation qui compte : le front ne fait qu'afficher ou masquer.
3. Rejette `tierKey === 'free'` et toute clé inconnue.
4. Refuse si un abonnement Stripe actif ou `trialing` existe déjà pour l'org (`already_subscribed`,
   même contrat que l'existant).
5. Customer Stripe **par organisation** : `metadata: { org_id, supabase_uid }`, idempotency key
   `org-customer:{orgId}`. Persisté par upsert sur `org_subscriptions` (palier `free`) pour ne pas
   créer de customers orphelins au retry — la leçon de la faille U1.
6. Session Checkout :
   - `mode: 'subscription'`, `line_items: [{ price: priceIdOf(tierKey), quantity: 1 }]`
   - **`allow_promotion_codes: true`** ← l'option coupon
   - `metadata: { org_id, tier_key }` sur la session **et** sur `subscription_data`
   - `success_url` / `cancel_url` vers `${APP_URL}/entreprise?checkout=…`
   - idempotency key `org-checkout:{orgId}:{tierKey}:{YYYY-MM-DD}` (granularité jour, comme
     l'existant : un retry le même jour rejoue la session, le lendemain on peut recommencer)
7. Allowlist CORS `ALLOWED_ORIGINS` et `opsAlert` en `catch`, repris à l'identique (failles N7, M6).

### `stripe-org-portal` (nouvelle, ~40 lignes)

JWT + vérification `owner_id`, puis `stripe.billingPortal.sessions.create({ customer, return_url })`.
Donne au client : changement de carte, résiliation, factures, changement de palier. Sans ça, un
client ne peut pas résilier seul.

### `stripe-webhook` (étendue)

Routage : **la présence de `org_id` dans les metadata de l'objet** décide de la branche. Les events
org écrivent dans `org_subscriptions` et **jamais** dans `subscriptions`, et réciproquement. Aucun
handler particulier n'est modifié.

L'idempotence (`processed_stripe_events`, marqueur écrit **après** succès du handler — faille M-5)
et la purge opportuniste restent mutualisées, inchangées.

| Event | Effet sur `org_subscriptions` |
|---|---|
| `checkout.session.completed` | upsert : `tier_key`, `max_members`, `status='active'`, `current_period_end`, ids Stripe, `discount_code` |
| `customer.subscription.updated` | **redérive `tier_key`/`max_members` depuis le price ID**, resynchronise statut et période |
| `customer.subscription.deleted` | `status='cancelled'`, `tier_key='free'`, `max_members=5`, `current_period_end=null` |
| `invoice.payment_succeeded` | rafraîchit `current_period_end`, `status='active'` |
| `invoice.payment_failed` | `status='past_due'` |

> ⚠️ **Le piège principal de tout ce système.** Un changement de palier depuis le Billing Portal
> change le price **sans passer par notre checkout**. Si `customer.subscription.updated` ne
> redérive pas `tier_key` et `max_members` depuis le price ID reçu, le client paie 100 € et reste
> bloqué au quota de 20 membres. D'où le mapping inverse `priceId → tier` dans `_shared/org-tiers.ts`.
> Un price ID inconnu (palier supprimé côté Stripe) doit **alerter via `opsAlert` et ne rien
> écrire**, plutôt que de dégrader silencieusement l'org au palier gratuit.

### Coupons — ce qu'on stocke et ce qu'on ne stocke pas

Le code réellement appliqué est relu depuis la session (`discounts[0].promotion_code`, `expand`
requis) et écrit dans `discount_code`. C'est **purement informatif**, pour afficher « code X
appliqué » dans l'espace entreprise.

**On ne recalcule aucun montant côté COSMO.** Stripe fait foi sur ce qui est facturé. Aucune
validation de code n'est écrite de notre côté, donc aucune surface de brute-force sur les codes,
aucun message d'erreur à traduire, aucun rate-limiting à prévoir. Création, plafonds d'usage,
durée et restriction par produit se font dans le dashboard Stripe.

---

## 4. Front

### Module

`src/modules/billing/org-billing.repository.ts` + `org-billing.hooks.ts` :

- `useOrgSubscription(orgId)` — lecture directe de `org_subscriptions` (RLS : membres). Retourne
  palier, statut, date de renouvellement, code promo.
- `useStartOrgCheckout()` — invoque `stripe-org-checkout`, redirige vers `session.url`.
- `useOpenOrgPortal()` — invoque `stripe-org-portal`, redirige.

Clés React Query en factory dans `constants.ts`, conformément à la structure de module du projet.

### Pages

- **`EnterprisePaywallPage`** enfin routée, sous un slug localisé rattaché à `/entreprise`
  (`src/i18n/route-slugs.json`), protégée, réservée aux membres d'une org.
  CTA de souscription par palier **visible pour le propriétaire uniquement** ; les autres membres
  voient le même tableau avec la mention « abonnement géré par le propriétaire de l'organisation ».
- **`OrganizationPage`** : bloc abonnement (palier courant, renouvellement, code promo appliqué le
  cas échéant) et bouton « Gérer l'abonnement » → portail Stripe, propriétaire uniquement.
- **Aucun champ coupon dans notre UI.** C'est la page Stripe qui l'affiche.

### Comportement dormant

Tant que `ENTERPRISE_BILLING_ENFORCED === false` : la page est atteignable et affiche la grille,
mais **le CTA de checkout n'est pas monté**. Pour tester en Stripe test mode, on bascule le flag en
local.

Pas de logique maligne du type « actif si les variables d'environnement existent » : le flag est la
seule condition, il est lisible d'un coup d'œil et ne dépend pas de l'état d'un environnement.

### i18n

Nouvelles clés dans le namespace `org` existant, fr **et** en. `npm run i18n:check` est bloquant en
CI. Une clé = une phrase complète, aucune concaténation de fragments.

### Animations

Aucune position finale ne dépend d'une animation de transform (garde-fou `MotionConfig
reducedMotion="user"`), et **aucun compteur à ressort sur les montants** : un prix ne doit jamais
passer par 48 € avant de se poser sur 50 €.

---

## 5. Tests

| Niveau | Ce qui est couvert |
|---|---|
| Vitest | Parité `_shared/org-tiers.ts` ↔ `ENTERPRISE_PRICING_TIERS` ; `priceId → tier` (aller-retour) ; sélection du palier par nombre de membres ; logique de quota (aucun abonnement, actif, `past_due`, palier illimité) |
| RLS (`npm run test:rls`) | Un membre lit l'abonnement de son org ; un non-membre ne lit rien ; **aucun client ne peut écrire** (INSERT/UPDATE/DELETE rejetés) |
| Gates statiques | `npm run validate:migrations`, `npm run check:rls`, `npm run i18n:check`, `lint`, `typecheck` |
| E2E Playwright | **Rien sur le checkout.** On ne teste pas Stripe en E2E. |

Vérification manuelle en Stripe test mode, via `stripe listen --forward-to`, avec la checklist du §7.

---

## 6. Découpage en unités

| Unité | Fait quoi | Dépend de |
|---|---|---|
| `101_org_subscriptions.sql` | Table + RLS + réécriture `org_seats_allowed` | `organizations`, `billing_flags` |
| `_shared/org-tiers.ts` | Mapping paliers, deux sens, TS pur | rien |
| `stripe-org-checkout` | Créer une session de paiement pour une org | org-tiers, `org_subscriptions` |
| `stripe-org-portal` | Ouvrir le portail Stripe d'une org | `org_subscriptions` |
| `stripe-webhook` (branche org) | Convertir les events Stripe en état d'abonnement | org-tiers, `org_subscriptions` |
| `org-billing` (module front) | Lire l'abonnement, déclencher checkout/portail | Edge Functions |
| UI paywall + bloc org | Affichage et CTA | module front, flag |

Chaque unité est testable seule ; les Edge Functions ne partagent que `org-tiers.ts` et le client
admin.

---

## 7. Ce qui reste côté Axel

**Avant de tester (Stripe test mode)**

1. Créer 4 produits/prix **récurrents mensuels en EUR** : 20, 50, 100, 200 €.
2. Créer les coupons et promotion codes voulus dans le dashboard Stripe.
3. Poser les secrets Supabase : `STRIPE_ORG_PRICE_T10`, `_T20`, `_T50`, `_TMAX`.
4. Déployer `stripe-org-checkout`, `stripe-org-portal`, et redéployer `stripe-webhook`.
5. Appliquer la migration 101.

**Checklist de recette (test mode, `stripe listen`)**

- Souscription palier 2 par le propriétaire → ligne `org_subscriptions` correcte, quota à 20
- Souscription tentée par un membre non propriétaire → 403
- Souscription avec un promotion code → montant réduit chez Stripe, `discount_code` renseigné
- Changement de palier depuis le portail → `tier_key` **et** `max_members` suivent
- Résiliation → `status='cancelled'`, quota retombé à 5, **aucun membre expulsé**
- Échec de paiement → `status='past_due'`
- Rejeu manuel du même event → dédupliqué

**Le jour de l'activation réelle**

```sql
UPDATE public.billing_flags SET enabled = true WHERE key = 'enterprise_seat_limit';
```
puis `ENTERPRISE_BILLING_ENFORCED = true` et déploiement du front, avec les clés Stripe live.

---

## 8. Décision à prendre à l'activation, pas maintenant

Aujourd'hui **aucune organisation n'a d'abonnement**. Au moment de l'activation du flag, toute org
de plus de 5 membres se retrouve **bloquée en ajout de membre du jour au lendemain**. Les membres
existants gardent tout leur accès (c'est le modèle retenu : on bloque la croissance, on ne retire
rien), mais le blocage sera perçu comme une panne s'il n'est pas annoncé.

Deux options, à trancher le jour J :

- **Prévenir** les orgs concernées avant de basculer le flag ;
- **Poser une ligne de courtoisie** dans `org_subscriptions` (palier couvrant leur effectif actuel,
  `status='active'`, sans abonnement Stripe) pour les faire atterrir en douceur.

Le nombre d'orgs concernées se compte en une requête ; il est probablement nul ou proche de zéro au
vu de la base actuelle.

---

## 9. Risques identifiés

| Risque | Parade |
|---|---|
| Divergence prix landing ↔ prix facturé | Test de parité `org-tiers.ts` ↔ `ENTERPRISE_PRICING_TIERS` |
| Changement de palier via le portail non répercuté sur le quota | Redérivation `priceId → tier` sur `subscription.updated` ; price inconnu → `opsAlert`, aucune écriture |
| Customers Stripe orphelins au retry | Upsert du `stripe_customer_id` avant la session + idempotency keys (faille U1, M-3) |
| Double abonnement pour une même org | `org_id` en clé primaire + refus si abonnement actif |
| Un client écrit son propre palier | Aucune policy d'écriture sur `org_subscriptions` |
| Un membre non propriétaire souscrit | Vérification `owner_id` **côté Edge Function**, pas côté UI |
| Webhook silencieusement cassé | `opsAlert` déjà en place sur tous les chemins d'échec |
