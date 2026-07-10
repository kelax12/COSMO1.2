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

// ─── Facturation entreprise (v2 — dormante, Stripe non finalisé) ─────
//
// Pricing décidé 2026-07-10 : FORFAIT PAR ENTREPRISE — gratuit < 5
// collaborateurs, 20 €/mois de 5 à 50, 100 €/mois au-delà. Pas d'essai
// (le palier gratuit EST l'essai). Non-paiement = blocage des AJOUTS de
// membres uniquement (jamais de prise d'otage des données).
//
//  false → aucune limite appliquée ; la bannière informative s'affiche à
//          partir de ORG_FREE_SEATS membres (préparation du marché).
//  true  → le client masque/désactive les CTA d'ajout au-delà du quota ;
//          le VRAI blocage est côté serveur (billing_flags
//          'enterprise_seat_limit', mig. 067 — 1 UPDATE pour activer).
export const ENTERPRISE_BILLING_ENFORCED = false;
export const ORG_FREE_SEATS = 5;
