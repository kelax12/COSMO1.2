// ═══════════════════════════════════════════════════════════════════
// BILLING ORG · trace du paiement en cours (spec § 5.1)
//
// Écrite juste avant la redirection vers Stripe, relue au retour
// (`?checkout=success`) pour savoir QUEL palier attendre pendant que le
// webhook arrive. `sessionStorage` : la trace ne doit pas survivre à l'onglet.
// Ce n'est pas une donnée de facturation : la perdre fait seulement attendre
// « n'importe quel palier payant » au lieu du palier précis.
// ═══════════════════════════════════════════════════════════════════
import { safeParse } from '@/lib/safe-json';
import { ENTERPRISE_PRICING_TIERS } from './premium-config';
import type { OrgBillingInterval, OrgTierKey } from './premium-config';

export const PENDING_CHECKOUT_KEY = 'cosmo_pending_checkout';
const MAX_AGE_MS = 30 * 60 * 1000;
// Paliers payants seuls : aucun paiement ne vise le palier gratuit.
const TIER_KEYS = new Set<string>(
  ENTERPRISE_PRICING_TIERS.filter((t) => t.priceEurPerMonth > 0).map((t) => t.key),
);

export interface PendingCheckout {
  orgId: string;
  tierKey: OrgTierKey;
  interval: OrgBillingInterval;
  at: number;
}

export function writePendingCheckout(pending: PendingCheckout): void {
  try {
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(pending));
  } catch {
    // Stockage indisponible (navigation privée stricte) : le retour attendra
    // n'importe quel palier payant, ce qui reste juste.
  }
}

export function readPendingCheckout(orgId: string, now = Date.now()): PendingCheckout | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  } catch {
    return null;
  }
  const p = safeParse<PendingCheckout>(raw);
  if (!p || p.orgId !== orgId || !TIER_KEYS.has(p.tierKey)) return null;
  if (p.interval !== 'monthly' && p.interval !== 'yearly') return null;
  if (typeof p.at !== 'number' || !Number.isFinite(p.at)) return null;
  const age = now - p.at;
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;
  return p;
}

export function clearPendingCheckout(): void {
  try {
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    // Rien à effacer si le stockage est inaccessible.
  }
}
