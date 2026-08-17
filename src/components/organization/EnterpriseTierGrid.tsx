import { Check } from 'lucide-react';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';
import type { OrgTierKey } from '@/modules/billing/premium-config';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import { formatCurrency } from '@/i18n/format';
import { useT } from '@/i18n/useT';

interface Props {
  /** Palier actuellement actif — mis en avant. */
  currentTier?: OrgTierKey;
  /** Absent = grille purement informative (pas propriétaire, ou flag dormant). */
  onSelect?: (tier: OrgTierKey) => void;
  isPending?: boolean;
}

/**
 * Grille des cinq paliers. Les montants viennent de `ENTERPRISE_PRICING_TIERS`
 * et sont rendus par `formatCurrency` — jamais de montant écrit en dur, et
 * jamais de compteur animé sur un prix (il passerait par 48 € avant de se
 * poser sur 50 €).
 */
export function EnterpriseTierGrid({ currentTier, onSelect, isPending }: Props) {
  const { t } = useT('org');
  const { t: tc } = useT('common');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {ENTERPRISE_PRICING_TIERS.map((tier) => {
        const isCurrent = currentTier === tier.key;
        const isFree = tier.priceEurPerMonth === 0;
        const range =
          tier.maxMembers === null
            ? t('billing.rangeFrom', { min: tier.minMembers })
            : t('billing.rangeUpTo', {
                min: tier.minMembers,
                max: tier.maxMembers,
              });

        return (
          <div
            key={tier.key}
            className={`rounded-xl border p-4 flex flex-col gap-2 ${
              isCurrent
                ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.06)]'
                : 'border-[rgb(var(--color-border))]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                {/* Le nom porte le palier, l'effectif le qualifie : « Équipe »
                    seul ne dit pas à qui il s'adresse, « 5 à 10 membres » seul
                    n'est pas un nom qu'on prononce. Sauf pour le palier gratuit,
                    dont le nom EST déjà le prix affiché juste dessous — l'écrire
                    deux fois ne le rend pas plus gratuit. */}
                {!isFree && (
                  <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                    {tc(ORG_TIER_LABEL_KEYS[tier.key])}
                  </span>
                )}
                <span className="text-xs text-[rgb(var(--color-text-secondary))]">{range}</span>
              </div>
              {isCurrent && (
                <Check size={16} className="mt-0.5 text-[rgb(var(--color-accent))]" aria-hidden />
              )}
            </div>

            <div className="text-2xl font-semibold text-[rgb(var(--color-text-primary))]">
              {isFree ? t('billing.free') : formatCurrency(tier.priceEurPerMonth)}
            </div>
            {!isFree && (
              <div className="text-xs text-[rgb(var(--color-text-secondary))]">
                {t('billing.perMonth')}
              </div>
            )}

            {onSelect && !isFree && !isCurrent && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onSelect(tier.key)}
                className="mt-auto rounded-lg bg-[rgb(var(--color-accent-solid))] px-3 py-2 text-sm font-medium text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-60"
              >
                {t('billing.subscribe')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EnterpriseTierGrid;
