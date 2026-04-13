import React from 'react';
import { Target, TrendingUp, Clock } from 'lucide-react';
import { useOkrs, KeyResult } from '@/modules/okrs';

const ActiveOKRs: React.FC = () => {
  const { data: okrs = [] } = useOkrs();
  
  const activeOKRs = okrs.filter(okr => !okr.completed).slice(0, 3);

  const getProgress = (keyResults: KeyResult[]) => {
    if (keyResults.length === 0) return 0;
    const totalProgress = keyResults.reduce((sum, kr) => {
      return sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100);
    }, 0);
    return Math.round(totalProgress / keyResults.length);
  };

    return (
        <div className="p-6 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div>
                <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">OKR en cours</h2>
                <p className="text-[rgb(var(--color-text-secondary))] text-sm">{activeOKRs.length} objectifs actifs</p>
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
                      <h3 className="font-semibold text-[rgb(var(--color-text-primary))]">{okr.title}</h3>
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-[rgb(var(--color-success))]" />
                        <span className="font-semibold text-[rgb(var(--color-success))]">{progress}%</span>
                      </div>
                    </div>
                    
                    <div className="w-full bg-[rgb(var(--color-border-muted))] rounded-full h-1.5 mb-3">
                      <div 
                        className="bg-[rgb(var(--color-success))] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  
                  <div className="text-sm text-[rgb(var(--color-text-secondary))]">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock size={14} className="text-[rgb(var(--color-text-muted))]" />
                      <span>
                         {okr.keyResults.reduce((sum: number, kr: KeyResult) => sum + (kr.currentValue * kr.estimatedTime), 0)} / {okr.keyResults.reduce((sum: number, kr: KeyResult) => sum + (kr.estimatedTime * kr.targetValue), 0)} min
                      </span>
                    </div>
                    <p className="mb-1">{okr.keyResults.length} résultats clés</p>
                    <p>Échéance: {new Date(okr.endDate).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              );
            })}
  
            {activeOKRs.length === 0 && (
              <div className="text-center py-8 text-[rgb(var(--color-text-muted))]">
                <Target size={48} className="mx-auto mb-4 opacity-30" />
                <p>Aucun OKR actif</p>
                <p className="text-sm">Définissez vos objectifs dans la section OKR</p>
              </div>
            )}
        </div>
      </div>
    );
};

export default ActiveOKRs;
