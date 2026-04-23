import React from 'react';
import { TrendingUp, Clock, Target, CheckCircle2, Circle } from 'lucide-react';

const OKRS = [
  {
    id: '1',
    title: 'Devenir Senior Developer',
    category: 'Apprentissage',
    categoryColor: '#8B5CF6',
    endDate: '2026-06-30',
    keyResults: [
      { id: 'kr1', title: 'Maîtriser TypeScript avancé', current: 80, target: 100, unit: '%', completed: false },
      { id: 'kr2', title: 'Lancer 2 features majeures', current: 1, target: 2, unit: 'features', completed: false },
      { id: 'kr3', title: 'Obtenir la certification AWS', current: 1, target: 1, unit: 'cert', completed: true },
    ],
  },
  {
    id: '2',
    title: 'Liberté Financière',
    category: 'Finance',
    categoryColor: '#F59E0B',
    endDate: '2026-12-31',
    keyResults: [
      { id: 'kr4', title: 'Épargner 10 000 €', current: 2500, target: 10000, unit: '€', completed: false },
      { id: 'kr5', title: 'Lancer un side project rentable', current: 0, target: 1, unit: 'projet', completed: false },
    ],
  },
  {
    id: '3',
    title: 'Forme Olympique',
    category: 'Santé',
    categoryColor: '#10B981',
    endDate: '2026-09-30',
    keyResults: [
      { id: 'kr6', title: 'Courir un semi-marathon', current: 14, target: 21, unit: 'km', completed: false },
      { id: 'kr7', title: '3 séances / semaine pendant 3 mois', current: 9, target: 12, unit: 'semaines', completed: false },
    ],
  },
];

const getProgress = (krs: { current: number; target: number }[]) => {
  if (!krs.length) return 0;
  return Math.round(krs.reduce((s, kr) => s + Math.min((kr.current / kr.target) * 100, 100), 0) / krs.length);
};

const getProgressColor = (p: number) => {
  if (p >= 75) return '#22C55E';
  if (p >= 40) return '#3B82F6';
  return '#F59E0B';
};

const OKRCardShowcase: React.FC = () => (
  <div className="w-full space-y-3">
    {OKRS.map(okr => {
      const progress = getProgress(okr.keyResults);
      const color = getProgressColor(progress);
      return (
        <div
          key={okr.id}
          className="rounded-2xl bg-slate-800/80 border border-white/10 p-4 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3 gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${okr.categoryColor}20`, color: okr.categoryColor }}
                >
                  {okr.category}
                </span>
              </div>
              <h3 className="font-bold text-white text-sm leading-snug">{okr.title}</h3>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <TrendingUp size={14} style={{ color }} />
              <span className="font-bold text-sm" style={{ color }}>{progress}%</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-700/60 rounded-full h-1.5 mb-3">
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, backgroundColor: color }}
            />
          </div>

          {/* Key Results */}
          <div className="space-y-1.5">
            {okr.keyResults.map(kr => {
              const krPct = Math.min(Math.round((kr.current / kr.target) * 100), 100);
              return (
                <div key={kr.id} className="flex items-center gap-2 text-xs">
                  {kr.completed
                    ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                    : <Circle size={13} className="text-slate-600 flex-shrink-0" />
                  }
                  <span className="flex-1 truncate text-slate-300">{kr.title}</span>
                  <span className="text-slate-500 flex-shrink-0 font-mono">
                    {kr.current}/{kr.target} {kr.unit}
                  </span>
                  <span
                    className="text-xs font-bold flex-shrink-0 w-8 text-right"
                    style={{ color: getProgressColor(krPct) }}
                  >
                    {krPct}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/5 text-xs text-slate-500">
            <Clock size={11} />
            <span>Échéance : {new Date(okr.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      );
    })}
  </div>
);

export default OKRCardShowcase;
