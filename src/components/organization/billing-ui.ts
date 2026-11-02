import { useT } from '@/i18n/useT';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';
import type { OrgTierKey } from '@/modules/billing/premium-config';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';

/** Tons des pastilles de l'onglet Abonnement : une seule table, quatre usages. */
export const PILL_TONE = {
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  danger: 'bg-red-500/10 text-red-700 dark:text-red-300',
  neutral: 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]',
} as const;

export type PillTone = keyof typeof PILL_TONE;

export const PILL_BASE = 'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold';

/**
 * Le libellé d'un palier tel que la grille l'écrit : l'effectif (« 5 à 10
 * membres »), ou « Illimité » pour le dernier. Le récapitulatif et l'écran de
 * bienvenue disent le MÊME mot que la carte cliquée.
 */
export function useTierRangeLabel(): (key: OrgTierKey) => string {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const { t: tc } = useT('common');
  return (key) => {
    const tier = ENTERPRISE_PRICING_TIERS.find((x) => x.key === key);
    if (!tier || tier.maxMembers === null) return tc(ORG_TIER_LABEL_KEYS[key]);
    return tOrgAdmin('billing.rangeUpTo', { min: tier.minMembers, max: tier.maxMembers });
  };
}
