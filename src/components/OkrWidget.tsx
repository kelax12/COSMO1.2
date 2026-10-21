import { useNavigate } from 'react-router';
import { Target } from 'lucide-react';
import { useOkrs, recalcProgress } from '@/modules/okrs';
import { useCategories } from '@/modules/categories';
import { NO_CATEGORY_COLOR } from '@/lib/category-colors';
import { DashboardCardSkeleton } from '@/components/skeletons';
import EmptyState from '@/components/EmptyState';
import { useT } from '@/i18n/useT';

interface OkrWidgetProps {
  /** OKR choisi pour cet exemplaire ; absent ou disparu = `fallbackIndex`. */
  okrId: string | undefined;
  /** Rang de cet exemplaire parmi les widgets OKR : deux widgets non réglés montrent deux OKR différents. */
  fallbackIndex: number;
  onSelect: (okrId: string) => void;
}

/**
 * Widget OKR du tableau de bord (2026-10-21) : UN objectif, choisi par un
 * sélecteur, et TOUS ses résultats clés quel que soit le format
 * (alternative 2 : titre, valeur, barre fine à la couleur de la catégorie).
 * Seul widget posable plusieurs fois : un exemplaire par objectif suivi.
 */
const OkrWidget = ({ okrId, fallbackIndex, onSelect }: OkrWidgetProps) => {
  const { t } = useT('dashboard');
  const navigate = useNavigate();
  const { data: okrs = [], isLoading } = useOkrs();
  const { data: categories = [] } = useCategories();

  if (isLoading && okrs.length === 0) return <DashboardCardSkeleton />;

  const active = okrs.filter((o) => !o.completed);
  const pool = active.length > 0 ? active : okrs;
  const okr = pool.find((o) => o.id === okrId) ?? pool[fallbackIndex % Math.max(pool.length, 1)];

  if (!okr) {
    return (
      <div className="p-gutter md:p-6 rounded-2xl">
        <EmptyState
          icon={Target}
          title={t('okrs.empty.title')}
          description={t('okrs.empty.description')}
          actionLabel={t('okrs.empty.action')}
          onAction={() => navigate('/okr', { state: { openCreate: true } })}
          accentColor="#22c55e"
          compact
        />
      </div>
    );
  }

  const color = categories.find((c) => c.id === okr.category)?.color || NO_CATEGORY_COLOR;
  const { progress } = recalcProgress(okr.keyResults);

  return (
    <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
      <label className="block">
        <span className="sr-only">{t('okrWidget.choose')}</span>
        <select
          value={okr.id}
          onChange={(e) => onSelect(e.target.value)}
          title={t('okrWidget.choose')}
          className="w-full max-w-full truncate rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2 py-1.5 text-sm font-semibold text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
        >
          {pool.map((o) => (
            <option key={o.id} value={o.id}>{o.title}</option>
          ))}
        </select>
      </label>

      <div className="mt-3 mb-4 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-[rgb(var(--color-border-muted))] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: color }} />
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[rgb(var(--color-text-primary))]">{progress} %</span>
      </div>

      {okr.keyResults.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('okrWidget.noKeyResult')}</p>
      ) : (
        <ul className="space-y-3">
          {okr.keyResults.map((kr) => {
            const pct = kr.targetValue > 0 ? Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100) : 0;
            return (
              <li key={kr.id}>
                <button
                  type="button"
                  onClick={() => navigate('/okr')}
                  className="w-full text-left rounded-lg -mx-2 px-2 py-1 transition-colors hover:bg-[rgb(var(--color-hover))]"
                >
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="flex-1 min-w-0 text-sm text-[rgb(var(--color-text-primary))] break-words">{kr.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-[rgb(var(--color-text-secondary))]">
                      {kr.currentValue} / {kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}
                    </span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-[rgb(var(--color-border-muted))] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default OkrWidget;
