// ═══════════════════════════════════════════════════════════════════
// Kill-switch d'application du Premium (source de vérité unique).
//
//  false → premium NON appliqué : toutes les features sont gratuites, le
//          mur-pub Habitudes est masqué. Le code premium (Stripe, RPC,
//          gates `isPremium()`, HabitsAdGate, PremiumPage) reste intact et
//          DORMANT — rien n'est supprimé.
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

//  false → aucune limite appliquée ; la bannière informative s'affiche à
//          partir de ORG_FREE_SEATS membres (préparation du marché).
//  true  → le client masque/désactive les CTA d'ajout au-delà du quota ;
//          le VRAI blocage est côté serveur (billing_flags
//          'enterprise_seat_limit', mig. 067 — 1 UPDATE pour activer).
export const ENTERPRISE_BILLING_ENFORCED = false;
export const ORG_FREE_SEATS = 5;
