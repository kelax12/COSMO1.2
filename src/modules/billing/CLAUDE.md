# Facturation · règles du dossier

> **Quand lire** : avant de toucher `src/modules/billing/**`, `supabase/functions/stripe-*`, `supabase/functions/_shared/org-*`, `refund-*`, ou un écran de facturation.
> **Fait foi** : `premium-config.ts` (drapeaux, grille) et le compte Stripe live ([`docs/STRIPE-LIVE.md`](../../../docs/STRIPE-LIVE.md), réglages et procédures). Ce fichier est le seul endroit des interdits de facturation.
> Sécurité et RLS : [`docs/SECURITY.md`](../../../docs/SECURITY.md) ; récits : [`docs/archive/OPS-SECURITE-recits-2026-11-13.md`](../../../docs/archive/OPS-SECURITE-recits-2026-11-13.md).

## Deux abonnements à ne jamais confondre

| Table | Porte | Écrit par |
|---|---|---|
| `subscriptions` | abonnement **particulier** (plan, statut, période) | webhook Stripe seul |
| `org_subscriptions` (mig. `101`, `123`) | abonnement d'**organisation** (palier, `max_members`, `billing_interval`) | webhook Stripe seul |

- Aucune colonne commune ; le client n'écrit ni l'une ni l'autre (aucune policy UPDATE, INSERT `subscriptions` limité à la ligne `free`).
- Premium : `const { isPremium } = useBilling()` (`@/modules/billing/billing.context`), et `isPremium` est une FONCTION. Définition : `plan='premium'` + `status='active'` + période non dépassée (`subscription.logic.ts`).

## Drapeaux (`premium-config.ts`)

- `PREMIUM_ENFORCED = false` : `isPremium()` rend `true` pour tous, `/premium` redirige vers `/`. ❌ Jamais supprimer le code de gating dormant. Réactivation : [`docs/POST-AUDIT-GUIDE.md`](../../../docs/POST-AUDIT-GUIDE.md).
- Si `PREMIUM_ENFORCED` passe à `true` : statistiques premium ; partage, collaboration et habitudes gratuits.
- `ENTERPRISE_BILLING_ENFORCED` et `billing_flags.enterprise_seat_limit` (mig. `224`) : armés, compte Stripe live.
- 🔴 Les deux drapeaux se déplacent ENSEMBLE : le flag TS ne masque que les CTA, le blocage réel est `enterprise_seat_limit`. Serveur seul = invitation refusée sans écran pour payer ; client seul = on encaisse sans rien débloquer.
- ❌ Le CTA de paiement dépend du seul `ENTERPRISE_BILLING_ENFORCED`, jamais de la présence de variables d'environnement.
- 🔴 On ne vend pas sans afficher de prix : les surfaces entreprise testent `PRICES_VISIBLE || ENTERPRISE_BILLING_ENFORCED` ; miroir `PRIX_VISIBLES` de `prerender/flags.ts`.

## Interdits

- ❌ Jamais de gate `isPremium()` sur le partage de tâches ou la collaboration (gratuits, décision d'acquisition) ; habitudes gratuites sans condition.
- ❌ Jamais de monnaie interne (jetons premium, mur-pub) : supprimée (C-04, mig. `141`), contournable par `localStorage`.
- ❌ Jamais une grille de tarifs annuels écrite à la main : l'annuel se DÉRIVE du mensuel (`ENTERPRISE_YEARLY_DISCOUNT`), front et Deno, même formule (`org-tiers.parity.test.ts`).
- ❌ Jamais un montant en dur côté Deno : `_shared/org-tiers.ts` est verrouillé sur `ENTERPRISE_PRICING_TIERS` par `org-tiers.parity.test.ts`.
- 🔴 Le price ID annuel se dérive (`_shared/org-stripe-prices.ts`, `resolveYearlyPriceId`) : prix `year` actif, même devise, montant exact, même produit que le mensuel ; zéro ou plusieurs candidates = aucune session (`yearly_unavailable`). Les secrets `STRIPE_ORG_PRICE_*_YEARLY` sont une porte de sortie, lue en premier.
- ❌ Jamais faire deviner un prix : le montant annuel est vérifié contre `yearlyTotalEur` AVANT toute session, au checkout ET au webhook.
- ❌ Jamais dériver le palier des metadata Stripe : palier ET périodicité depuis le **price ID** (`tierFromPriceId`, `_shared/org-tiers.ts`), car un changement fait au portail ne repasse pas par le checkout.
- ❌ Jamais faire dépendre le quota de la périodicité : `max_members` porté par le palier seul ; pas de « palier annuel » chez Stripe.
- ✅ Quota réel = `org_seats_allowed()` (`claim_org_invite`, `respond_join_request`) ; `past_due` / `cancelled` retombe au gratuit sans retirer de membre.
- 🔴 Effectif au-dessus du quota = espace verrouillé : `isOverQuota` (strictement `>`), `sectionOpenWhileOverQuota` (`org-billing.logic.ts`), écran `OrgOverQuotaLock` ; restent Membres, Paramètres (admin), facturation (propriétaire). ❌ Jamais verrouiller avant d'avoir lu abonnement ET membres (en chargement le quota retombe au gratuit). ⚠️ Verrou d'interface seul.
- ✅ Souscription et gestion : propriétaire seul, vérifié dans `stripe-org-checkout` / `stripe-org-portal` ; le front ne fait que masquer. Entrée par `OrgPlanChip` (propriétaire), `?tab=billing` reste une URL valide ; ❌ jamais un onglet lu par toute l'organisation.
- ✅ Coupons : promotion codes Stripe natifs (`allow_promotion_codes`) ; COSMO ne valide aucun code ni ne recalcule de montant.
- ❌ Jamais créer un prix Stripe sans `tax_behavior` explicite : il ne se modifie plus ; le live est en `inclusive`.
- ❌ Jamais avaler l'erreur d'une lecture qui décide d'un routage (`getUidFromCustomer`, pré-contrôle d'idempotence, `orgIdFromInvoice` lèvent) : sinon paiement encaissé sans abonnement et marqueur posé. En cas de doute, faire retenter Stripe.
- ❌ Jamais laisser un event d'organisation retomber sur la branche particulier : customer d'org en `org_owner_uid`, `getUidFromCustomer` refuse un customer à `org_id`.
- ❌ Un event qui DÉGRADE ne s'applique qu'à l'abonnement enregistré (S-5) : garde asymétrique d'`applyOrgSubscription` ; ❌ jamais la remplacer par un `.eq()` sur l'upsert (bloquerait la première écriture).
- ❌ Aucun rejeu automatique d'une mutation qui arrête un contrat ou déplace de l'argent : `useOrgSubscriptionAction` pose `retry: 0` contre le `retry: 1` global. On fait retenter la PERSONNE.
- 🔴 Les deux verrous anti-rejeu du remboursement ne se remplacent pas : la clé d'idempotence (dérivée de l'`invoice_id`) expire et n'arrête que le concurrent ; seul le pré-contrôle qui RETRANCHE le déjà-rendu arrête un rejeu différé.
- ❌ Jamais recopier l'arithmétique de `_shared/refund-replay.ts` dans l'entrypoint Deno (`src/refund.guard.test.ts`) ; tests : `refund-replay.test.ts`.
- ⚠️ `pending` compte comme rendu, `failed` / `canceled` non. ❌ Jamais l'écrire par exclusion (`status !== 'succeeded'`).
- ⚠️ Après un remboursement, relire l'abonnement (invalidation) ; bloc conditionné à `effectiveTierKey(subscription)`, pas à `subscription.tierKey`.
- 🔴 Rétractation, résiliation, remboursement (décision d'Axel, `Documents/analytics/docs/REMBOURSEMENT-RESILIATION.md`) : rétractation 14 jours depuis `started_at`, arrêt immédiat (`stripe-org-subscription`) ; résiliation en fin de période (`cancel_at_period_end`) ; remboursement par `stripe-org-refund`, ADMIN seul (`is_admin()`) ; montant au prorata journalier, jour en cours compté, centime inférieur (`_shared/refund-amount.ts`).
- ❌ Jamais un bouton qui résilie ET rembourse ; jamais de remboursement depuis l'interface client.
- ✅ Aucune renonciation au droit de rétractation n'est recueillie : remboursement intégral en cas de rétractation.
- ❌ Jamais payer sans la case d'accès immédiat ni `CGV_VERSION` (`billing_acceptances`, mig. `237`, append-only).
- ❌ Jamais purger les lignes passées de `withdrawal_consents` (preuve, mig. `135`, `138`).
- ⚠️ Noms des paliers dans le namespace `common` (`orgTier.*`), mapping `org-tier-labels.ts` (`Record<OrgTierKey, …>`) : landing et produit disent le même mot.
- ⚠️ `APP_URL` est la seule origine CORS des fonctions appelées du navigateur (`_shared/cors.ts`) : le checkout ne se teste pas depuis `localhost` contre la prod ; en local `CORS_DEV_ORIGINS=http://localhost:5173`. Sans `APP_URL`, les fonctions refusent de démarrer.
