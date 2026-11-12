import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@/i18n/useT';
import { formatCurrency, formatDate } from '@/i18n/format';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';
import { chargedTodayEur, effectiveQuota, effectiveTierKey } from '@/modules/billing/org-billing.logic';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import type { OrgSubscription } from '@/modules/billing/org-billing.types';
import { PILL_BASE, PILL_TONE, type PillTone } from './billing-ui';

interface Props {
  subscription: OrgSubscription | null;
  memberCount: number;
}

/**
 * En tête de l'onglet Abonnement (spec § 3.1) : tout l'état en un
 * coup d'œil. Le nom du forfait est celui de la pastille de l'en-tête : les
 * deux doivent dire le même mot.
 *
 * La jauge anime sa LARGEUR (pas un transform) : sous mouvement réduit, elle
 * part directement de sa valeur (`initial={false}`), elle ne reste jamais à 0.
 */
export function OrgPlanCard({ subscription, memberCount }: Props) {
  const { t } = useT('orgAdmin');
  const { t: tc } = useT('common');
  const reduce = useReducedMotion();
  const titleId = useId();
  const gaugeLabelId = useId();

  const quota = effectiveQuota(subscription);
  const planName = t('billing.planNamed', { name: tc(ORG_TIER_LABEL_KEYS[effectiveTierKey(subscription)]) });
  const ratio = quota === null ? 0 : Math.min(1, memberCount / Math.max(quota, 1));
  const full = quota !== null && memberCount >= quota;
  const near = !full && quota !== null && ratio >= 0.8;
  const tier = ENTERPRISE_PRICING_TIERS.find((x) => x.key === subscription?.tierKey);
  const showNextDue =
    subscription?.status === 'active' &&
    subscription.tierKey !== 'free' &&
    !subscription.cancelAtPeriodEnd &&
    !!subscription.currentPeriodEnd &&
    !!tier;

  let pill: { tone: PillTone; label: string };
  if (subscription?.status === 'past_due') pill = { tone: 'warning', label: t('billing.pillPastDue') };
  else if (subscription?.status === 'active' && subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd)
    pill = { tone: 'neutral', label: t('billing.pillEnds', { date: formatDate(new Date(subscription.currentPeriodEnd)) }) };
  else if (subscription?.status === 'active' && subscription.tierKey !== 'free') pill = { tone: 'success', label: t('billing.pillActive') };
  else pill = { tone: 'neutral', label: t('billing.pillTrial') };

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-xl border border-[rgb(var(--color-border))] p-4 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <p id={titleId} className="text-xs text-[rgb(var(--color-text-secondary))]">
            {t('billing.planCardLabel')}
          </p>
          <p className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">{planName}</p>
        </div>
        <span className={`${PILL_BASE} ${PILL_TONE[pill.tone]}`}>{pill.label}</span>
      </div>

      {quota === null ? (
        <p className="text-sm text-[rgb(var(--color-text-primary))]">
          {t('billing.seatsUnlimited', { count: memberCount })}
        </p>
      ) : (
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-[rgb(var(--color-text-secondary))]">
            <span id={gaugeLabelId}>{t('billing.seatsGaugeLabel')}</span>
            <span className="tabular-nums">{t('billing.seatsGauge', { count: memberCount, quota })}</span>
          </div>
          <div
            role="meter"
            aria-labelledby={gaugeLabelId}
            aria-valuetext={t('billing.seatsGauge', { count: memberCount, quota })}
            aria-valuemin={0}
            aria-valuemax={quota}
            aria-valuenow={Math.min(memberCount, quota)}
            className="h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden"
          >
            <motion.div
              className={`h-full rounded-full ${full || near ? 'bg-amber-500' : 'bg-[rgb(var(--color-accent))]'}`}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${ratio * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
          {full && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{t('billing.seatsFullHint')}</p>
          )}
          {near && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {t('billing.seatsNearHint', { left: quota - memberCount, quota })}
            </p>
          )}
        </div>
      )}

      {subscription?.discountCode && (
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          {t('billing.discountApplied', { code: subscription.discountCode })}
        </p>
      )}

      {showNextDue && subscription?.currentPeriodEnd && tier && (
        <p className="border-t border-[rgb(var(--color-border))] pt-3 text-sm text-[rgb(var(--color-text-secondary))]">
          {/* Un code de réduction change le montant réel, qui n'est pas lu ici :
              la date seule, jamais un montant dérivé du tarif plein. */}
          {subscription.discountCode
            ? t('billing.nextDueDateOnly', { date: formatDate(new Date(subscription.currentPeriodEnd)) })
            : t('billing.nextDue', {
                date: formatDate(new Date(subscription.currentPeriodEnd)),
                amount: formatCurrency(chargedTodayEur(tier.priceEurPerMonth, subscription.billingInterval)),
              })}
        </p>
      )}
    </section>
  );
}

export default OrgPlanCard;
