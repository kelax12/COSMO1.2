import { CalendarClock, CalendarOff, LogOut, Receipt, Undo2 } from 'lucide-react';
import { useT } from '@/i18n/useT';
import type { OrgBillingInterval } from '@/modules/billing/premium-config';

interface Props {
  interval: OrgBillingInterval;
}

/**
 * Information précontractuelle (L111-1, L221-5 ; LEGAL.md E2) posée AVANT le
 * choix d'un palier. Les pictos la rendent lisible ; ils ne la remplacent pas :
 * `billing.precontractual` reste affiché en entier juste dessous.
 * ❌ Ni repli, ni info-bulle, ni « en savoir plus ».
 */
export function OrgPrecontractualPictos({ interval }: Props) {
  const { t } = useT('orgAdmin');
  const items = [
    interval === 'yearly'
      ? { Icon: CalendarClock, label: t('billing.pictoYearly') }
      : { Icon: CalendarOff, label: t('billing.pictoNoCommitment') },
    { Icon: Undo2, label: t('billing.pictoWithdrawal') },
    { Icon: LogOut, label: t('billing.pictoCancel') },
    { Icon: Receipt, label: t('billing.pictoTax') },
  ];

  return (
    <section aria-label={t('billing.pictosLabel')} className="flex flex-col gap-2">
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {items.map(({ Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-2 rounded-lg bg-[rgb(var(--color-hover))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]"
          >
            <Icon size={16} aria-hidden className="shrink-0 text-[rgb(var(--color-accent))]" />
            {label}
          </li>
        ))}
      </ul>
      <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.precontractual')}</p>
    </section>
  );
}

export default OrgPrecontractualPictos;
