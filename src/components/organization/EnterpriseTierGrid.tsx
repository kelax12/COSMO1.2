import { useId } from 'react';
import { Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ENTERPRISE_PRICING_TIERS, displayedMonthlyEur, yearlyTotalEur } from '@/modules/billing/premium-config';
import type { OrgBillingInterval, OrgTierKey } from '@/modules/billing/premium-config';
import { formatCurrency, formatPrice } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useTierRangeLabel, PILL_BASE } from './billing-ui';

interface Props {
  /** Palier actuellement actif, mis en avant. */
  currentTier?: OrgTierKey;
  /** Absent = grille purement informative (pas propriétaire, ou flag dormant). */
  onSelect?: (tier: OrgTierKey) => void;
  isPending?: boolean;
  /**
   * Périodicité affichée. Elle ne change QUE le montant : les bornes d'effectif
   * et le quota de sièges sont portés par le palier seul, dans les deux cas.
   */
  interval?: OrgBillingInterval;
  /**
   * La facturation est-elle éteinte pour TOUT LE MONDE
   * (`ENTERPRISE_BILLING_ENFORCED === false`) ? Distinct de `!onSelect` : un
   * membre non propriétaire n'a pas de `onSelect` alors que son organisation
   * peut très bien être facturée.
   */
  dormant?: boolean;
  /** Palier conseillé (`recommendedTier`). Sans pastille s'il est déjà actif. */
  recommendedKey?: OrgTierKey;
}

/**
 * Grille des paliers. Montants issus de `ENTERPRISE_PRICING_TIERS`, rendus par
 * `formatCurrency` : jamais de montant en dur, et ❌ JAMAIS de compteur animé
 * sur un prix (il passerait par 48 € avant de se poser sur 50 €). Au changement
 * de périodicité, le bloc prix se remplace en FONDU, rien ne défile.
 *
 * Depuis le 2026-11-02, la carte entière se clique (spec § 3.2) et porte un
 * `layoutId` : le récapitulatif reprend le même, la carte s'y déploie.
 * Sous mouvement réduit, PAS de `layoutId` : Framer rendrait l'animation de
 * layout instantanée puis replacerait l'élément à l'ancienne position pour une
 * frame (même constat que `ApercuWidgetGrid`, CI du 2026-10-22).
 *
 * Facturation éteinte (`dormant`) : le prix d'un palier payant est REMPLACÉ par
 * « Gratuit », le tarif d'après barré dessous, comme sur la landing.
 */
export function EnterpriseTierGrid({
  currentTier,
  onSelect,
  isPending,
  dormant,
  interval = 'monthly',
  recommendedKey,
}: Props) {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const rangeLabel = useTierRangeLabel();
  const uid = useId();
  const reduce = useReducedMotion();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {ENTERPRISE_PRICING_TIERS.map((tier) => {
        const isCurrent = currentTier === tier.key;
        const isFree = tier.priceEurPerMonth === 0;
        const isPromo = dormant && !isFree;
        const monthlyShown = displayedMonthlyEur(tier.priceEurPerMonth, interval);
        const label = rangeLabel(tier.key);
        const isRecommended = recommendedKey === tier.key && !isCurrent;
        const clickable = !isFree && !isCurrent && !dormant && !!onSelect;
        const labelId = `${uid}-${tier.key}-label`;
        const pillId = `${uid}-${tier.key}-pill`;
        const priceId = `${uid}-${tier.key}-price`;

        const body = (
          <>
            <span className="flex items-center justify-between gap-3">
              <span id={labelId} className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                {clickable && (
                  <>
                    <span className="sr-only">{tOrgAdmin('billing.chooseTierPrefix')}</span>{' '}
                  </>
                )}
                {label}
              </span>
              {isCurrent && <Check size={16} className="shrink-0 text-[rgb(var(--color-accent))]" aria-hidden />}
            </span>
            {isRecommended && (
              <span id={pillId} className={`${PILL_BASE} bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]`}>
                {tOrgAdmin('billing.recommended')}
              </span>
            )}

            {isFree || isPromo ? (
              <>
                <span className="block text-2xl font-semibold text-amber-600 dark:text-amber-400">{tOrgAdmin('billing.free')}</span>
                {isPromo && (
                  <s className="block text-xs text-[rgb(var(--color-text-muted))] decoration-[rgb(var(--color-border-strong))]">
                    {tOrgAdmin('billing.insteadOf', { price: formatPrice(monthlyShown) })}
                  </s>
                )}
              </>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  id={priceId}
                  key={interval}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col gap-0.5"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-2xl font-semibold tabular-nums text-[rgb(var(--color-text-primary))]">
                      {formatCurrency(monthlyShown)}{' '}
                      <span className="text-sm font-medium text-[rgb(var(--color-text-secondary))]">
                        {tOrgAdmin('billing.vatSuffix')}
                      </span>
                    </span>
                    {interval === 'yearly' && (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {tOrgAdmin('billing.intervalSave')}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-[rgb(var(--color-text-secondary))]">
                    {interval === 'yearly'
                      ? tOrgAdmin('billing.perMonthBilledYearly', {
                          total: `${formatCurrency(yearlyTotalEur(tier.priceEurPerMonth))} ${tOrgAdmin('billing.vatSuffix')}`,
                        })
                      : tOrgAdmin('billing.perMonth')}
                  </span>
                </motion.span>
              </AnimatePresence>
            )}
          </>
        );

        const frame = `rounded-xl p-4 flex flex-col gap-2 text-left ${
          isCurrent
            ? 'border border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.06)]'
            : isRecommended
              ? 'border-2 border-[rgb(var(--color-accent))]'
              : 'border border-[rgb(var(--color-border))]'
        }`;

        return clickable ? (
          <motion.button
            key={tier.key}
            type="button"
            layoutId={reduce ? undefined : `org-tier-${tier.key}`}
            disabled={isPending}
            onClick={() => onSelect?.(tier.key)}
            aria-labelledby={labelId}
            aria-describedby={isRecommended ? `${pillId} ${priceId}` : priceId}
            whileHover={{ y: -2 }}
            className={`${frame} transition-colors hover:border-[rgb(var(--color-border-strong))] disabled:opacity-60`}
          >
            {body}
          </motion.button>
        ) : (
          <motion.div key={tier.key} layoutId={reduce ? undefined : `org-tier-${tier.key}`} className={frame}>
            {body}
          </motion.div>
        );
      })}
    </div>
  );
}

export default EnterpriseTierGrid;
