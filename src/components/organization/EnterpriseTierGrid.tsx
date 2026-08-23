import { Check } from 'lucide-react';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';
import type { OrgTierKey } from '@/modules/billing/premium-config';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import { formatCurrency } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

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
            <div className="flex items-center justify-between gap-3">
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

              {/* Coin droit de l'en-tête : le palier actif ET l'action sur un
                  autre palier sont mutuellement exclusifs, ils partagent donc
                  le même emplacement plutôt que d'empiler un bouton pleine
                  largeur sous le prix. */}
              {isCurrent && (
                <Check size={16} className="shrink-0 text-[rgb(var(--color-accent))]" aria-hidden />
              )}
              {!isFree && !isCurrent && (
                onSelect ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onSelect(tier.key)}
                    className="shrink-0 rounded-lg bg-[rgb(var(--color-accent-solid))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-60"
                  >
                    {t('billing.subscribe')}
                  </button>
                ) : (
                  // La facturation entreprise est dormante (ENTERPRISE_BILLING_
                  // ENFORCED = false) : ce bouton reste visuel, jamais un vrai
                  // CTA de paiement — `onSelect` est la SEULE condition qui
                  // monte un checkout, cf. OrgBillingTab. `aria-disabled` plutôt
                  // que `disabled` : un bouton natif désactivé bloque les
                  // événements pointeur, donc le tooltip qui explique pourquoi.
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-disabled="true"
                        onClick={(e) => e.preventDefault()}
                        className="shrink-0 rounded-lg border border-blue-600/40 dark:border-blue-400/40 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 cursor-not-allowed"
                      >
                        {t('billing.upgrade')}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{t('billing.dormant')}</TooltipContent>
                  </Tooltip>
                )
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
          </div>
        );
      })}
    </div>
  );
}

export default EnterpriseTierGrid;
