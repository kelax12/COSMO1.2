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
// ⚠️ Anciens paliers (2026-07-10, 2 tranches) — remplacés par
// ENTERPRISE_PRICING_TIERS ci-dessous (2026-08-14, 4 tranches). Gardés
// pour ne rien casser tant qu'ils sont référencés (bannière `org.freemiumInfo`
// fr/en, texte figé) ; à retirer quand cette bannière sera réécrite sur les
// nouveaux paliers.
export const ENTERPRISE_TIER_1_EUR = 20;
export const ENTERPRISE_TIER_2_EUR = 100;

// ─── Facturation entreprise (v3 — dormante, Stripe non finalisé) ─────
//
// Pricing décidé 2026-08-14 (demande Axel) : FORFAIT PAR ENTREPRISE selon le
// nombre de membres, palier gratuit inclus (le palier gratuit EST l'essai).
// Remplace le pricing v2 (2 tranches, 2026-07-10) ci-dessus. `EnterprisePaywall`
// (src/pages/EnterprisePaywallPage.tsx) affiche ces paliers ; le composant
// existe mais n'est câblé dans AUCUNE route ni AUCUN lien de nav — à faire
// lors de l'activation réelle du paywall entreprise (avec le blocage serveur
// et le passage de ENTERPRISE_BILLING_ENFORCED à true).
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
