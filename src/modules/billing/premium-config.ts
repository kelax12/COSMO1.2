// ═══════════════════════════════════════════════════════════════════
// Kill-switch d'application du Premium (source de vérité unique).
//
//  false → premium NON appliqué : toutes les features sont gratuites. Le code
//          premium (Stripe, gates `isPremium()`, PremiumPage) reste intact et
//          DORMANT — rien n'est supprimé.
//          C-04 (2026-09-04) : le mur-pub Habitudes et le système de jetons,
//          eux, ne sont PAS dormants : ils ont été SUPPRIMÉS. Rebasculer ce
//          drapeau ne les ramène pas, et ne doit pas les réécrire.
//  true  → premium appliqué (monétisation). Re-basculer ICI pour réactiver.
//
// Décision 2026-06-21 : gratuit pour tous, monétisation reportée. Quand on
// voudra monétiser, passer à `true` (puis finaliser Stripe — cf.
// docs/POST-AUDIT-GUIDE.md, point 3, option C).
// ═══════════════════════════════════════════════════════════════════
export const PREMIUM_ENFORCED = false;

// ─── Tarifs, en euros ────────────────────────────────────────────────
//
// Source de vérité unique des MONTANTS. Le prix était auparavant écrit en dur
// et déjà formaté (« 3,50€ ») à quatre endroits ; l'afficher passe désormais
// par `formatCurrency()` (src/i18n/format.ts), qui rend « 3,50 € » en français
// et « €3.50 » en anglais.
//
// La devise reste l'EUR dans toutes les langues : la facturation est en euros,
// il n'y a aucune conversion. Seule la PRÉSENTATION change.
export const PREMIUM_MONTHLY_EUR = 3.5;
// Les anciens paliers (2026-07-10, 2 tranches) ont été retirés le 2026-08-17 :
// la bannière `org.freemiumInfo` était leur dernier point d'ancrage et ne cite
// plus aucun montant — elle renvoie vers l'onglet Abonnement, désormais seule
// surface qui affiche des prix. Deux grilles tarifaires visibles sur le même
// écran (bannière v2 + grille v3) se contredisaient.

// ─── Facturation entreprise (v3 — dormante, Stripe branché) ──────────
//
// Pricing décidé 2026-08-14 (demande Axel) : FORFAIT PAR ENTREPRISE selon le
// nombre de membres, palier gratuit inclus (le palier gratuit EST l'essai).
// Remplace le pricing v2 (2 tranches, 2026-07-10) ci-dessus.
//
// Ces paliers sont affichés par `EnterpriseTierGrid`
// (src/components/organization/EnterpriseTierGrid.tsx), monté dans l'onglet
// Abonnement de l'espace entreprise (`/entreprise?tab=billing`, propriétaire
// uniquement). Le CTA de paiement n'est monté que si ENTERPRISE_BILLING_ENFORCED
// vaut `true` — le flag est la SEULE condition, pour qu'on puisse dire d'un coup
// d'œil si le produit facture ou non.
//
// ⚠️ Cette liste est la source de vérité des MONTANTS AFFICHÉS. Les montants
// FACTURÉS viennent des price IDs Stripe résolus par
// supabase/functions/_shared/org-tiers.ts, qui duplique nécessairement cette
// grille côté Deno. `org-tiers.parity.test.ts` casse si les deux divergent :
// sans lui, on pourrait annoncer 50 € et facturer 100 €.
//
// `maxMembers: null` = tranche « et plus », pas de plafond.
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

// ─── Périodicité de facturation (2026-08-25) ─────────────────────────
//
// Chaque palier payant peut être réglé au mois ou à l'année. L'annuel N'A PAS
// de grille propre : son montant est DÉRIVÉ du tarif mensuel par
// `ENTERPRISE_YEARLY_DISCOUNT`. Une seconde liste de montants serait une
// seconde occasion de diverger — c'est déjà ce qui a imposé
// `org-tiers.parity.test.ts` entre le front et les Edge Functions.
export type OrgBillingInterval = 'monthly' | 'yearly';

/** Remise consentie contre un engagement annuel. 0.3 = −30 %. */
export const ENTERPRISE_YEARLY_DISCOUNT = 0.3;

/** Arrondi au centime — deux calculs identiques doivent rendre le même nombre. */
const roundEur = (amount: number): number => Math.round(amount * 100) / 100;

/**
 * Tarif MENSUEL ÉQUIVALENT d'un engagement annuel (le mensuel moins 30 %).
 *
 * C'est ce montant-là que la grille affiche en gros quand « Annuel » est
 * sélectionné : comparer un prix annuel à un prix mensuel côte à côte ne dit
 * rien de l'économie réalisée.
 */
export function yearlyMonthlyEquivalentEur(priceEurPerMonth: number): number {
  return roundEur(priceEurPerMonth * (1 - ENTERPRISE_YEARLY_DISCOUNT));
}

/**
 * Montant réellement débité une fois par an.
 *
 * Dérivé de l'équivalent mensuel ARRONDI, pas du tarif brut : sinon le total
 * annoncé peut différer d'un centime de « 12 × le prix affiché », et un client
 * a raison de se fier à la multiplication qu'il fait de tête.
 */
export function yearlyTotalEur(priceEurPerMonth: number): number {
  return roundEur(yearlyMonthlyEquivalentEur(priceEurPerMonth) * 12);
}

/** Le montant à mettre en avant pour un palier, selon la périodicité choisie. */
export function displayedMonthlyEur(
  priceEurPerMonth: number,
  interval: OrgBillingInterval,
): number {
  return interval === 'yearly' ? yearlyMonthlyEquivalentEur(priceEurPerMonth) : priceEurPerMonth;
}

//  false → aucune limite appliquée ; la bannière informative s'affiche à
//          partir de ORG_FREE_SEATS membres (préparation du marché), aucun CTA
//          de paiement n'est monté.
//  true  → le client masque/désactive les CTA d'ajout au-delà du quota ;
//          le VRAI blocage est côté serveur (billing_flags
//          'enterprise_seat_limit', mig. 067 — 1 UPDATE pour activer).
//
// RÉACTIVÉ le 2026-08-25 (demande Axel), après la parenthèse gratuite du
// 2026-08-24. Les CTA de paiement sont montés, la landing entreprise réaffiche
// ses tarifs (`ENTERPRISE_FREE_OFFER` s'en dérive), et le quota de sièges est
// réellement appliqué : `billing_flags.enterprise_seat_limit` est repassé à
// `true` en base le même jour, comme l'exige la règle des deux drapeaux.
//
// 🔴 DEUX RÉSERVES CONNUES AU MOMENT DE LA BASCULE, ni l'une ni l'autre
// corrigée par ce drapeau :
//
//  1. `STRIPE_SECRET_KEY` en prod est une clé de TEST. Le checkout n'accepte
//     donc que des cartes de test : le quota est réel, l'encaissement ne l'est
//     pas. Passer en live = recréer les prix sur le compte live puis remplacer
//     STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / les STRIPE_ORG_PRICE_*.
//  2. Les 4 prix ANNUELS n'existent pas côté Stripe et les secrets
//     `STRIPE_ORG_PRICE_*_YEARLY` ne sont pas posés. Le sélecteur « Annuel »
//     est cliquable, mais son checkout répond `tier_unavailable`. Le mensuel,
//     lui, est complet.
//
// ⚠️ RIEN N'A ÉTÉ SUPPRIMÉ — toute la plomberie Stripe entreprise reste en place
// et déployée : Edge Functions `stripe-org-checkout` / `stripe-org-portal`, les
// quatre secrets `STRIPE_ORG_PRICE_*`, `stripe-webhook` (routage `org_id`), la
// table `org_subscriptions` (mig. 101) et `org_seats_allowed()`. Ce flag est la
// SEULE condition d'affichage du CTA de paiement : le rebasculer à `true` suffit
// à réactiver la facturation côté client.
//
// La landing entreprise en dérive son offre de lancement
// (`src/pages/landing/entreprise/free-offer.ts` → `ENTERPRISE_FREE_OFFER`), qui
// remplace chaque montant par « Gratuit ». Ce fichier-là porte la procédure de
// retour en arrière pas à pas.
//
// 🔴 Le flag client ne suffit PAS à tout rendre gratuit : le gate bloquant est en
// base. Il doit rester désactivé tant que ce flag vaut `false` —
//   UPDATE public.billing_flags SET enabled = false WHERE key = 'enterprise_seat_limit';
// Sinon un propriétaire se verrait refuser une invitation (`seat_limit_reached`)
// sans qu'aucun écran ne lui propose de payer : impasse totale.
//
// ⚠️ Rappel pour le jour de la réactivation : la grille Stripe branchée est celle
// du SANDBOX DE TEST (`STRIPE_SECRET_KEY` en prod est une clé de test, le compte
// live est vide). Passer en live = recréer les 4 prix sur le compte live,
// réenregistrer un endpoint webhook live, puis remplacer STRIPE_SECRET_KEY /
// STRIPE_WEBHOOK_SECRET / les 4 STRIPE_ORG_PRICE_*.
export const ENTERPRISE_BILLING_ENFORCED = false;
export const ORG_FREE_SEATS = 5;
