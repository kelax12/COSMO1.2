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
import type { OrgTierKey } from './premium-config';
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

/**
 * Le palier à NOMMER dans l'UI.
 *
 * Dérivé du droit réellement accordé, pas du palier acheté : un abonnement
 * impayé ou résilié affiche « Gratuit », exactement comme le serveur le traite
 * (`effectiveQuota`). Un libellé qui annoncerait encore « Entreprise » à une
 * organisation retombée à 5 sièges mentirait sur ce qu'elle peut faire.
 */
export function effectiveTierKey(sub: OrgSubscription | null): OrgTierKey {
  if (!sub || sub.status !== 'active') return 'free';
  return sub.tierKey;
}

/** L'abonnement demande une action du propriétaire (paiement à régulariser). */
export function needsPaymentAttention(sub: OrgSubscription | null): boolean {
  return sub?.status === 'past_due';
}

/** Le prochain ajout de membre sera-t-il refusé par le serveur ? */
export function isQuotaReached(memberCount: number, sub: OrgSubscription | null): boolean {
  const quota = effectiveQuota(sub);
  if (quota === null) return false;
  return memberCount >= quota;
}
