const WITHDRAWAL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Le délai de rétractation de 14 jours (L221-18) court-il encore ? Sert
 * l'AFFICHAGE du bouton seulement : `stripe-org-subscription` revérifie avec
 * `withinWithdrawalWindow` (`_shared/refund-amount.ts`).
 */
export function withdrawalOpen(startedAt: string | null, now = Date.now()): boolean {
  if (!startedAt) return false;
  const start = new Date(startedAt).getTime();
  return Number.isFinite(start) && now >= start && now < start + WITHDRAWAL_MS;
}
