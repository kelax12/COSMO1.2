import React from 'react';
import { useNavigate } from 'react-router';
import { Target, TrendingUp, Clock } from 'lucide-react';
import { useOkrs, KeyResult } from '@/modules/okrs';
import { DashboardCardSkeleton } from '@/components/skeletons';
import EmptyState from '@/components/EmptyState';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';

const ActiveOKRs: React.FC = () => {
  const { t, tp } = useT('dashboard');
  const navigate = useNavigate();
  const { data: okrs = [], isLoading } = useOkrs();

  const activeOKRs = okrs.filter(okr => !okr.completed).slice(0, 3);

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
    
              <div className="space-y-4">
                {activeOKRs.map(okr => {
                  const progress = getProgress(okr.keyResults);
                  
                  return (
                    <div 
                      key={okr.id} 
                      className="p-4 bg-[rgb(var(--color-hover))] rounded-xl border border-[rgb(var(--color-border))] transition-all duration-300 hover:shadow-md hover:border-[rgb(var(--color-success)/0.5)] hover:bg-[rgb(var(--color-success)/0.05)] cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-body sm:text-base text-[rgb(var(--color-text-primary))]">{okr.title}</h3>
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-[rgb(var(--color-success))]" />
                        <span className="font-semibold text-body sm:text-base text-[rgb(var(--color-success))]">{progress}%</span>
                      </div>
                    </div>

                    <div className="w-full bg-[rgb(var(--color-border-muted))] rounded-full h-1.5 mb-3">
                      <div
                        className="bg-[rgb(var(--color-success))] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                  <div className="text-label sm:text-sm text-[rgb(var(--color-text-secondary))]">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={14} className="text-[rgb(var(--color-text-muted))]" />
                      <span>
                        {t('okrs.timeProgress', {
                          current: okr.keyResults.reduce((sum: number, kr: KeyResult) => sum + (kr.currentValue * kr.estimatedTime), 0),
                          target: okr.keyResults.reduce((sum: number, kr: KeyResult) => sum + (kr.estimatedTime * kr.targetValue), 0),
                        })}
                      </span>
                    </div>
                    <p className="mb-1">{tp('okrs.keyResult', okr.keyResults.length)}</p>
                    <p>{t('okrs.deadline', { date: formatDate(new Date(okr.endDate), { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
                  </div>
                </div>
              );
            })}
  
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
      </div>
    );
};

export default ActiveOKRs;
