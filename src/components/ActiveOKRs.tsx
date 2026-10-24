import { useNavigate } from 'react-router';
import { Target, TrendingUp } from 'lucide-react';
import { useOkrs, KeyResult } from '@/modules/okrs';
import { useCategories } from '@/modules/categories';
import { NO_CATEGORY_COLOR } from '@/lib/category-colors';
import { DashboardCardSkeleton } from '@/components/skeletons';
import EmptyState from '@/components/EmptyState';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useIsMobile } from '@/lib/hooks/use-mobile';

interface ActiveOKRsProps {
  /** Widget du tableau de bord : petit = 1 OKR, moyen = 2, grand = 3. */
  limit?: number;
}

const ActiveOKRs = ({ limit = 3 }: ActiveOKRsProps) => {
  const { t, tp } = useT('dashboard');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: okrs = [], isLoading } = useOkrs();
  const { data: categories = [] } = useCategories();
  const colorOf = (id: string) => categories.find(c => c.id === id)?.color || NO_CATEGORY_COLOR;

  const activeOKRs = okrs.filter(okr => !okr.completed).slice(0, isMobile ? 3 : limit);

  const getProgress = (keyResults: KeyResult[]) => {
    if (keyResults.length === 0) return 0;
    const totalProgress = keyResults.reduce((sum, kr) => {
      // Guard targetValue > 0 (B17) : évite NaN quand la cible vaut 0.
      if (kr.targetValue <= 0) return sum;
      return sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100);
    }, 0);
    return Math.round(totalProgress / keyResults.length);
  };

    if (isLoading && okrs.length === 0) {
      return <DashboardCardSkeleton />;
    }

    return (
        <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div>
                <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{t('sections.activeOkrs')}</h2>
                <p className="text-[rgb(var(--color-text-secondary))] text-sm">{tp('okrs.activeGoal', activeOKRs.length)}</p>
              </div>
            </div>
    
              {isMobile ? (
                /* Mobile : tableau à une colonne, séparateur entre lignes —
                   même traitement que le fil « Aujourd'hui » et les
                   habitudes, plus de carte individuelle par OKR (arbitrage
                   du 2026-09-05). */
                <ul>
                  {activeOKRs.map(okr => {
                    const progress = getProgress(okr.keyResults);
                    return (
                      <li key={okr.id} className="border-b border-[rgb(var(--color-border))] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => navigate('/okr')}
                          className="w-full min-h-touch py-2.5 text-left"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="flex-1 min-w-0 truncate text-label font-medium text-[rgb(var(--color-text-primary))]">
                              {okr.title}
                            </span>
                            <span className="shrink-0 flex items-center gap-1 text-label font-semibold text-[rgb(var(--color-success))]">
                              <TrendingUp size={14} aria-hidden="true" />
                              {progress}%
                            </span>
                          </div>
                          <div className="w-full bg-[rgb(var(--color-border-muted))] rounded-full h-1.5 mb-1.5">
                            <div
                              className="bg-[rgb(var(--color-success))] h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-caption text-[rgb(var(--color-text-muted))] truncate">
                            {tp('okrs.keyResult', okr.keyResults.length)}
                            {' · '}
                            {t('okrs.deadline', { date: formatDate(new Date(okr.endDate), { day: 'numeric', month: 'long', year: 'numeric' }) })}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
              /* Desktop : alternative 2 (2026-10-21) — titre, pourcentage et
                 barre fine à la couleur de la catégorie ; plus de carte. */
              <ul className="space-y-4">
                {activeOKRs.map(okr => {
                  const progress = getProgress(okr.keyResults);
                  return (
                    <li key={okr.id}>
                      <button
                        type="button"
                        onClick={() => navigate('/okr')}
                        className="w-full text-left rounded-lg -mx-2 px-2 py-1.5 transition-colors hover:bg-[rgb(var(--color-hover))]"
                      >
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="flex-1 min-w-0 truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">{okr.title}</span>
                          <span className="shrink-0 text-sm text-[rgb(var(--color-text-secondary))] tabular-nums">{progress} %</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[rgb(var(--color-border-muted))] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${progress}%`, backgroundColor: colorOf(okr.category) }}
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              )}

            {activeOKRs.length === 0 && (
              /* Empty state avec CTA (#16) : seul point de découverte des OKR
                 sur mobile (absents de la tab bar). */
              <EmptyState
                icon={Target}
                title={t('okrs.empty.title')}
                description={t('okrs.empty.description')}
                actionLabel={t('okrs.empty.action')}
                onAction={() => navigate('/okr', { state: { openCreate: true } })}
                accentColor="#22c55e"
                compact
              />
            )}
        </div>
    );
};

export default ActiveOKRs;
