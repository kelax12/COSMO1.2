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
