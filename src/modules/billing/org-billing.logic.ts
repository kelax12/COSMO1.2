// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — logique pure (aucun accès réseau, aucun état React).
//
// ⚠️ Ces fonctions ne sont PAS la frontière de sécurité : le quota qui compte
// est celui appliqué par `org_seats_allowed()` en base (mig. 101). Ce qui est
// ici sert à l'AFFICHAGE — proposer le bon palier, prévenir avant le blocage.
// Les deux doivent dire la même chose, d'où la sémantique identique
// (`COUNT(membres) < quota`).
//
// Les fonctions ajoutées pour le parcours de facturation (palier conseillé,
// échéances, activation, dernier échec) servent à l'affichage seul : aucune
// n'est reprise côté serveur, aucune n'est la frontière de sécurité.
// ═══════════════════════════════════════════════════════════════════
import { addDays, addMonths, addYears } from 'date-fns';
import { ENTERPRISE_PRICING_TIERS, ORG_FREE_SEATS, yearlyTotalEur } from './premium-config';
import type { OrgBillingInterval, OrgTierKey } from './premium-config';
import type { OrgBillingHistoryEntry, OrgSubscription } from './org-billing.types';

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

/**
 * L'effectif DÉPASSE le quota (strictement) : cas d'une organisation qui a
 * baissé de palier, ou dont l'abonnement est tombé, avec plus de membres que
 * le nouveau quota. Le serveur ne retire jamais de membre ; c'est l'espace
 * entreprise qui se verrouille tant que l'effectif n'est pas rentré dans le
 * quota (décision d'Axel). Pile au quota n'est PAS un dépassement.
 */
export function isOverQuota(memberCount: number, sub: OrgSubscription | null): boolean {
  const quota = effectiveQuota(sub);
  if (quota === null) return false;
  return memberCount > quota;
}

/** Combien de membres retirer pour rentrer dans le quota (0 si rien à faire). */
export function membersOverQuota(memberCount: number, sub: OrgSubscription | null): number {
  const quota = effectiveQuota(sub);
  if (quota === null) return 0;
  return Math.max(0, memberCount - quota);
}

/**
 * Sections encore ouvertes pendant un dépassement : ce qui permet d'en SORTIR,
 * rien d'autre. Un admin retire des membres (`members`) et règle l'organisation
 * (`settings`) ; le propriétaire remonte de palier (`billing`). Un membre sans
 * ces droits ne peut rien y faire : tout lui est fermé.
 */
export function sectionOpenWhileOverQuota(
  section: string,
  viewer: { isAdmin: boolean; isOwner: boolean },
): boolean {
  if (section === 'billing') return viewer.isOwner;
  if (section === 'members' || section === 'settings') return viewer.isAdmin || viewer.isOwner;
  return false;
}

/**
 * Palier proposé à la CRÉATION d'une entreprise, d'après l'effectif annoncé
 * (onboarding). Jusqu'au plafond du gratuit, rien à payer ; au-delà,
 * `recommendedTier` : le plus petit palier payant qui laisse une place, pour ne
 * pas faire payer un palier déjà plein le jour même.
 */
export function onboardingTier(memberCount: number): Tier {
  if (memberCount <= ORG_FREE_SEATS) return ENTERPRISE_PRICING_TIERS[0];
  return recommendedTier(memberCount);
}

/**
 * Le palier à CONSEILLER : le plus petit palier payant qui laisse au moins une
 * place libre à l'effectif actuel. Distinct de `tierForMemberCount`, qui rend
 * le palier qui COUVRE l'effectif (pile au plafond compris) : conseiller un
 * palier déjà plein ferait payer pour ne rien pouvoir inviter.
 */
export function recommendedTier(memberCount: number): Tier {
  return (
    ENTERPRISE_PRICING_TIERS.find(
      (t) => t.priceEurPerMonth > 0 && (t.maxMembers === null || t.maxMembers > memberCount),
    ) ?? ENTERPRISE_PRICING_TIERS[ENTERPRISE_PRICING_TIERS.length - 1]
  );
}

/**
 * Le palier dont le plafond vaut `quota` (`null` = illimité). Un plafond inconnu
 * ne retombe jamais sur le gratuit : on rend le plus petit palier qui le couvre,
 * à défaut le dernier.
 */
export function tierByQuota(quota: number | null): Tier {
  const exact = ENTERPRISE_PRICING_TIERS.find((t) => t.maxMembers === quota);
  if (exact) return exact;
  if (quota === null) return ENTERPRISE_PRICING_TIERS[ENTERPRISE_PRICING_TIERS.length - 1];
  return (
    ENTERPRISE_PRICING_TIERS.find((t) => t.maxMembers !== null && t.maxMembers >= quota) ??
    ENTERPRISE_PRICING_TIERS[ENTERPRISE_PRICING_TIERS.length - 1]
  );
}

/** Montant débité au paiement : le mois, ou l'année entière dérivée du mensuel. */
export function chargedTodayEur(priceEurPerMonth: number, interval: OrgBillingInterval): number {
  return interval === 'yearly' ? yearlyTotalEur(priceEurPerMonth) : priceEurPerMonth;
}

/** Échéance suivante d'un abonnement pris à `from`. date-fns gère fin de mois et 29 février. */
export function nextDueDate(from: Date, interval: OrgBillingInterval): Date {
  return interval === 'yearly' ? addYears(from, 1) : addMonths(from, 1);
}

/**
 * Fin du délai de rétractation (L221-18), pour l'AFFICHAGE du récapitulatif.
 * Compte en jours calendaires (date-fns) alors que `withdrawal-window.ts` compte
 * 14 x 24 h : les deux peuvent différer d'une heure autour d'un changement
 * d'heure. Le serveur (`_shared/refund-amount.ts`) reste la référence.
 */
export function withdrawalDeadline(from: Date): Date {
  return addDays(from, 14);
}

export const ACTIVATION_POLL_MS = 1500;
export const ACTIVATION_TIMEOUT_MS = 20_000;

/**
 * L'abonnement lu est-il celui qu'on vient de payer ? Sans palier attendu (la
 * trace `sessionStorage` a été perdue), tout palier payant actif compte.
 */
export function isActivated(sub: OrgSubscription | null | undefined, tierKey: OrgTierKey | null): boolean {
  if (!sub || sub.status !== 'active') return false;
  return tierKey ? sub.tierKey === tierKey : sub.tierKey !== 'free';
}

/**
 * Intervalle du sondage d'activation au retour de Stripe. BORNÉ : `false` dès
 * que l'abonnement correspond ou que l'échéance est passée. C'est cette borne
 * qui justifie la place du hook dans `polling.guard.test.ts`.
 */
export function activationPollInterval(
  sub: OrgSubscription | null | undefined,
  tierKey: OrgTierKey | null,
  deadline: number,
  now = Date.now(),
): number | false {
  if (isActivated(sub, tierKey)) return false;
  return now < deadline ? ACTIVATION_POLL_MS : false;
}

/** Date du dernier paiement échoué du journal, quel que soit son ordre. */
export function lastFailedPaymentAt(entries: OrgBillingHistoryEntry[]): string | null {
  let lastMs = -Infinity;
  let last: string | null = null;
  for (const e of entries) {
    if (e.eventType !== 'invoice.payment_failed') continue;
    const ms = new Date(e.occurredAt).getTime();
    if (Number.isFinite(ms) && ms > lastMs) {
      lastMs = ms;
      last = e.occurredAt;
    }
  }
  return last;
}
