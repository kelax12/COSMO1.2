# ADR 0004 · Stripe par redirection serveur, facturation entreprise seule, Premium perso coupé

- **Statut** : acceptée
- **Date** : Premium perso coupé le 2026-06-21 ; Stripe en mode live le 2026-10-20

## Contexte

COSMO a deux mondes (voir [ADR 0005](./0005-modules-entreprise-separes-des-modules-perso.md)). Le
partage de tâches et la collaboration entre amis sont gratuits depuis le 2026-06-11. Un Premium perso
a existé en code ; Axel a choisi de ne pas le faire payer. Le monde entreprise, lui, se facture par
paliers de membres.

## Décision

1. **Seule la facturation entreprise est active.** `ENTERPRISE_BILLING_ENFORCED = true` côté
   TypeScript (il affiche les appels à l'achat) **et** `billing_flags.enterprise_seat_limit = true`
   côté base (il bloque). Les deux drapeaux bougent ensemble : le serveur seul donne une impasse
   (`seat_limit_reached`).
2. **Le Premium perso est coupé** : `PREMIUM_ENFORCED = false` (`premium-config.ts`), `isPremium()`
   rend `true` pour tous et `/premium` redirige vers `/`. Le code de gating reste, dormant : il ne se
   supprime pas, et on n'ajoute aucun `isPremium()` sur le partage ni la collaboration.
3. **Le paiement se fait par redirection serveur.** Une Edge Function crée la session Stripe
   Checkout (`stripe-org-checkout`) ou le portail (`stripe-org-portal`) et le navigateur est
   redirigé vers Stripe. Il n'y a **aucun SDK Stripe côté client** (`VITE_STRIPE_PUBLISHABLE_KEY`
   n'est lue nulle part).
4. **Seul le webhook écrit l'état de l'abonnement.** `subscriptions` (perso) et `org_subscriptions`
   (entreprise) ne reçoivent d'écriture que de `stripe-webhook` ; le client n'en écrit aucune. Le
   palier se redérive du price ID Stripe, jamais des métadonnées.
5. **Le journal de paiement est inaltérable** (`payment_records`, `payment_closures`, migration
   `125`, trigger) : une erreur se corrige par une ligne compensatoire.

## Conséquences

- **Positives.** Aucune clé Stripe ni SDK de paiement dans le bundle ; une surface de paiement réduite
  à quelques Edge Functions que l'on peut tester et comparer au déploiement (`check:edge`,
  `check:stripe-prices`). Le client ne peut pas se donner un abonnement.
- **Négatives.** L'expérience de paiement est celle de Stripe, hors de l'application. Un correctif sur
  une Edge Function ne prend effet qu'une fois déployée, ce qui ouvre un risque de dérive entre dépôt
  et production, gardé par `check:edge` et `edge-deploy.yml`.
- **À ne pas faire.** Réarmer le Premium perso est une décision produit d'Axel, pas un nettoyage de
  code mort : le chantier est décrit dans [`docs/POST-AUDIT-GUIDE.md`](../POST-AUDIT-GUIDE.md).
- Détail et règles : [`src/modules/billing/CLAUDE.md`](../../src/modules/billing/CLAUDE.md) et
  [`docs/STRIPE-LIVE.md`](../STRIPE-LIVE.md).
