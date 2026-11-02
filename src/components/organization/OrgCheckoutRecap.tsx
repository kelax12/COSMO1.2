import { useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Lock, ShieldCheck } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatCurrency, formatDate } from '@/i18n/format';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';
import type { OrgBillingInterval, OrgTierKey } from '@/modules/billing/premium-config';
import { chargedTodayEur, nextDueDate, withdrawalDeadline } from '@/modules/billing/org-billing.logic';
import { useTierRangeLabel } from './billing-ui';

interface Props {
  tierKey: OrgTierKey;
  interval: OrgBillingInterval;
  /** Injecté par les tests ; sinon l'instant du rendu. */
  now?: Date;
  /** Appel à `stripe-org-checkout` en cours. */
  isPending: boolean;
  /** L'URL Stripe est reçue, la navigation part. */
  isRedirecting: boolean;
  immediateAccess: boolean;
  onImmediateAccessChange: (checked: boolean) => void;
  onPay: () => void;
  onCancel: () => void;
}

/**
 * Récapitulatif avant paiement (spec 2026-11-02 § 3.3). La carte de la grille
 * s'y déploie : même `layoutId` (`org-tier-<palier>`).
 * Sous mouvement réduit, PAS de `layoutId` : Framer rendrait l'animation de
 * layout instantanée puis replacerait l'élément à l'ancienne position pour une
 * frame (même constat que `ApercuWidgetGrid`, CI du 2026-10-22).
 *
 * La case d'accès immédiat ne change pas sur le fond (L221-13, L221-25) : non
 * cochée par défaut, obligatoire, revérifiée par le serveur. Ce qui change :
 * le bouton n'est plus grisé en silence, il dit pourquoi il ne part pas.
 *
 * La pulsation du bouton est un `scale` qui part de 1 et y revient : sous
 * mouvement réduit elle ne joue pas, et rien ne reste décalé.
 */
export function OrgCheckoutRecap({
  tierKey,
  interval,
  now = new Date(),
  isPending,
  isRedirecting,
  immediateAccess,
  onImmediateAccessChange,
  onPay,
  onCancel,
}: Props) {
  const { t } = useT('orgAdmin');
  const rangeLabel = useTierRangeLabel();
  const reduce = useReducedMotion();
  const [showRequired, setShowRequired] = useState(false);
  const titleId = useId();
  const alertId = useId();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const tier = ENTERPRISE_PRICING_TIERS.find((x) => x.key === tierKey);
  if (!tier) return null;

  const today = `${formatCurrency(chargedTodayEur(tier.priceEurPerMonth, interval))} ${t('billing.vatSuffix')}`;
  const amount = formatCurrency(chargedTodayEur(tier.priceEurPerMonth, interval));

  if (isPending || isRedirecting) {
    return (
      <motion.div
        role="status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] px-4 py-8 text-center"
      >
        <ShieldCheck size={24} aria-hidden className="text-[rgb(var(--color-accent))]" />
        <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('billing.redirectTitle')}</p>
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.redirectBody')}</p>
        <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-[rgb(var(--color-hover))]">
          <div className="h-full w-1/3 rounded-full bg-[rgb(var(--color-accent))] animate-pulse motion-reduce:animate-none" />
        </div>
      </motion.div>
    );
  }

  const rows: Array<{ label: string; value: string; emphasis?: boolean }> = [
    { label: t('billing.recapTier'), value: rangeLabel(tierKey) },
    { label: t('billing.recapInterval'), value: interval === 'yearly' ? t('billing.recapYearly') : t('billing.recapMonthly') },
    { label: t('billing.recapToday'), value: today, emphasis: true },
    { label: t('billing.recapNext'), value: t('billing.recapNextValue', { date: formatDate(nextDueDate(now, interval)) }) },
    { label: t('billing.recapWithdrawal'), value: t('billing.recapWithdrawalValue', { date: formatDate(withdrawalDeadline(now)) }) },
  ];

  return (
    <motion.section
      layoutId={reduce ? undefined : `org-tier-${tierKey}`}
      aria-labelledby={titleId}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-3 rounded-xl border-2 border-[rgb(var(--color-accent))] p-4"
    >
      <h3 id={titleId} className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
        {t('billing.recapTitle')}
      </h3>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm tabular-nums">
        {rows.map(({ label, value, emphasis }) => (
          <div key={label} className="contents">
            <dt className="text-[rgb(var(--color-text-secondary))]">{label}</dt>
            <dd className={`text-right text-[rgb(var(--color-text-primary))] ${emphasis ? 'text-base font-semibold' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <label className="flex items-start gap-2 rounded-lg bg-[rgb(var(--color-hover))] p-3 text-sm text-[rgb(var(--color-text-primary))]">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={immediateAccess}
          onChange={(e) => {
            onImmediateAccessChange(e.target.checked);
            setShowRequired(false);
          }}
          className="mt-1"
        />
        <span>
          {t('billing.immediateAccessLabel')}{' '}
          <a href="/cgu" target="_blank" rel="noreferrer" className="underline">
            {t('billing.cgvLink')}
          </a>
        </span>
      </label>

      {showRequired && (
        <p id={alertId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {t('billing.checkBoxRequired')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <motion.button
          type="button"
          onClick={() => {
            if (immediateAccess) {
              onPay();
              return;
            }
            setShowRequired(true);
            checkboxRef.current?.focus();
          }}
          aria-describedby={showRequired ? alertId : undefined}
          animate={immediateAccess ? { scale: [1, 1.03, 1] } : { scale: 1 }}
          transition={{ duration: 0.6 }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            immediateAccess
              ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))]'
              : 'border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]'
          }`}
        >
          <Lock size={14} aria-hidden /> {t('billing.payWith', { amount })}
        </motion.button>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-[rgb(var(--color-text-secondary))]">
          {t('billing.confirmTierCancel')}
        </button>
      </div>
    </motion.section>
  );
}

export default OrgCheckoutRecap;
