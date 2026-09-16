# Facturation · règles du dossier

> **Le détail, les mesures et l'histoire sont dans [`docs/STRIPE-LIVE.md`](../../../docs/STRIPE-LIVE.md)**,
> § « Règles et récits repris de CLAUDE.md ». Ce fichier ne porte que les interdits.
> Sécurité et RLS : [`docs/SECURITY.md`](../../../docs/SECURITY.md). Findings : [`faille.md`](../../../faille.md).

## Deux abonnements à ne jamais confondre

| Table | Porte | Écrit par |
|---|---|---|
| `subscriptions` | l'abonnement **particulier** (plan, statut, période) | webhook Stripe seul |
| `org_subscriptions` (mig. 101, 123) | l'abonnement d'une **organisation** (palier, sièges, périodicité) | webhook Stripe seul |

Elles ne partagent aucune colonne. Le client ne peut écrire ni l'une ni l'autre.

## État courant

- 🟢 `PREMIUM_ENFORCED = false` (`premium-config.ts`) : `isPremium()` rend `true` pour tous,
  `/premium` redirige vers `/`. Le code de gating reste dormant, il ne se supprime pas.
- 🔴 `ENTERPRISE_BILLING_ENFORCED = false` **et** `billing_flags.enterprise_seat_limit = false`,
  désarmés ensemble le 2026-08-26 (mig. 124).
- 🔴 `STRIPE_SECRET_KEY` en prod est une clé de **TEST**. Le quota est réel, l'encaissement non.

## Interdits

- ❌ **Ne jamais réintroduire de gate `isPremium()` sur le partage de tâches ou la collaboration.**
  C'est gratuit par décision d'acquisition. Les habitudes aussi, sans condition.
- ❌ **Ne jamais réintroduire une monnaie interne** (jetons premium, mur-pub). Supprimée par C-04,
  mig. 141. Elle n'a jamais été câblée et le mur qu'elle gardait était contournable en une
  manipulation de `localStorage`.
- 🔴 **Les deux drapeaux se déplacent ENSEMBLE.** Le flag TS ne masque que les CTA ; le blocage réel
  est `billing_flags.enterprise_seat_limit`. Serveur `true` + client `false` = un propriétaire se
  voit refuser une invitation sans qu'aucun écran ne propose de payer. L'inverse = on encaisse sans
  rien débloquer.
- ❌ **Ne jamais écrire une grille de tarifs annuels à la main.** Le montant annuel est DÉRIVÉ du
  mensuel (`ENTERPRISE_YEARLY_DISCOUNT`), front et Deno, par la même formule. Verrouillé par
  `org-tiers.parity.test.ts`.
- ❌ **Ne jamais dériver le palier des metadata Stripe.** Palier et périodicité se redérivent du
  **price ID** (`tierFromPriceId`). Un changement fait depuis le Billing Portal ne repasse pas par
  notre checkout.
- ❌ **Ne jamais faire dépendre le quota de sièges de la périodicité.** `max_members` est porté par
  le palier seul.
- ❌ **Ne jamais créer un prix Stripe sans `tax_behavior` explicite.** Il ne se modifie plus après
  coup. Le compte live est en `inclusive`, définitif.
- ❌ **Ne jamais avaler l'erreur d'une lecture qui décide d'un routage.** Une panne de lecture
  devenue « pas d'utilisateur » encaisse sans appliquer l'abonnement, et écrit un marqueur
  d'idempotence qui empêche toute re-livraison. **En cas de doute, faire retenter Stripe.**
- ❌ **Un event Stripe qui DÉGRADE ne s'applique qu'à l'abonnement enregistré.** La garde
  d'`applyOrgSubscription` est asymétrique, et c'est voulu.
- ❌ **AUCUN REJEU AUTOMATIQUE sur une mutation qui déplace de l'argent.** `useCancelAndRefundOrg`
  pose `retry: 0` contre le `retry: 1` global. **On fait retenter la PERSONNE, jamais le navigateur.**
- 🔴 **Les deux verrous anti-rejeu du remboursement ne se remplacent pas.** La clé d'idempotence
  Stripe **expire** et n'arrête que deux appels concurrents ; seul le pré-contrôle qui RETRANCHE le
  déjà-rendu arrête un rejeu différé. Son arithmétique vit dans
  `supabase/functions/_shared/refund-replay.ts`, module TS pur couvert par 10 cas.
  ❌ **Ne jamais la recopier dans l'entrypoint Deno** : `src/refund.guard.test.ts` l'interdit, et
  mélangée aux appels Stripe elle n'est exécutable par aucun test.
  ⚠️ Un remboursement `pending` compte comme rendu, un `failed` ou `canceled` ne compte pas.
  ❌ Ne jamais l'écrire par exclusion (`status !== 'succeeded'`) : `pending` serait ignoré.
- ❌ **Ne JAMAIS ouvrir une session de paiement sans la preuve de renonciation** (S-6).
  `immediateExecution` ET `waivesWithdrawal` strictement à `true`, puis une ligne dans
  `withdrawal_consents` **avant** de créer la session : l'ordre est la preuve. Les deux drapeaux
  sont exigés séparément, l'art. L221-28, 13° demandant deux manifestations distinctes.
- ❌ **Ne jamais laisser un event d'organisation retomber sur la branche particulier.**
- ⚠️ Les **noms** des paliers vivent dans le namespace `common` (`orgTier.*`), pas dans `org` :
  la landing et le produit doivent dire le même mot pour le même palier.
