import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { percentDelta, type PeriodFlow } from './team-stats.helpers';
import { useT } from '@/i18n/useT';

interface PeriodCompareCardProps {
  periodLabel: string;
  current: PeriodFlow;
  previous: PeriodFlow;
}

/**
 * Cette période face à la précédente, même durée (reco UI n° 38).
 * Une hausse des TERMINÉES est bonne nouvelle, une hausse des CRÉÉES ne
 * l'est ni ne l'est pas : elle reste neutre, on ne colore pas un volume.
 */
const PeriodCompareCard = ({ periodLabel, current, previous }: PeriodCompareCardProps) => {
  const { t } = useT('orgAdmin');
  const rows = [
    { key: 'completed' as const, label: t('ui.compare.completed'), good: true },
    { key: 'created' as const, label: t('ui.compare.created'), good: null },
  ];
  return (
    <section
      aria-labelledby="period-compare-title"
      className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 sm:p-5"
    >
      <h3 id="period-compare-title" className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
        {t('ui.compare.title', { period: periodLabel })}
      </h3>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map(({ key, label, good }) => {
          const now = current[key];
          const before = previous[key];
          const delta = percentDelta(now, before);
          const tone = delta === null || delta === 0 || good === null
            ? 'text-[rgb(var(--color-text-muted))]'
            : (delta > 0) === good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
          const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
          return (
            <div key={key} className="rounded-xl bg-[rgb(var(--color-hover))] px-3 py-2.5">
              <dt className="text-xs text-[rgb(var(--color-text-muted))]">{label}</dt>
              <dd className="mt-0.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-[rgb(var(--color-text-primary))]">{now}</span>
                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${tone}`}>
                  <Icon size={12} aria-hidden="true" />
                  {delta === null ? t('ui.compare.noBase') : `${delta > 0 ? '+' : ''}${delta} %`}
                </span>
                <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('ui.compare.before', { count: before })}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};

export default PeriodCompareCard;
