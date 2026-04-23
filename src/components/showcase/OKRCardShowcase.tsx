import React from 'react';
import { Edit2, Trash2, TrendingUp, CheckCircle, Clock } from 'lucide-react';

// ─── Real OKR-style data ────────────────────────────────────────────
const OKRS = [
  {
    id: '1',
    title: 'Accélérer la croissance produit',
    description: 'Atteindre une masse critique d\'utilisateurs et valider l\'adéquation produit-marché sur Q2.',
    category: 'Produit',
    categoryColor: '#3B82F6',
    startDate: '01/04/2026',
    endDate: '30/06/2026',
    remainingDays: 67,
    keyResults: [
      { id:'kr1', title:'Utilisateurs actifs mensuels', current: 3200,  target: 10000, unit: 'users',   completed: false },
      { id:'kr2', title:'Score NPS',                    current: 38,    target: 50,    unit: 'pts',     completed: false },
      { id:'kr3', title:'Taux de rétention J30',        current: 71,    target: 85,    unit: '%',       completed: false },
    ],
  },
  {
    id: '2',
    title: 'Excellence technique & performance',
    description: 'Réduire la dette technique et garantir une expérience fluide à l\'échelle.',
    category: 'Engineering',
    categoryColor: '#10B981',
    startDate: '01/04/2026',
    endDate: '30/06/2026',
    remainingDays: 67,
    keyResults: [
      { id:'kr4', title:'Couverture de tests',          current: 54,    target: 80,    unit: '%',       completed: false },
      { id:'kr5', title:'Temps de chargement initial',  current: 2.8,   target: 1.5,   unit: 's',       completed: false },
      { id:'kr6', title:'Incidents critiques en prod',  current: 2,     target: 0,     unit: 'incidents', completed: false },
    ],
  },
  {
    id: '3',
    title: 'Expansion commerciale H1',
    description: 'Ouvrir le marché entreprise et atteindre les objectifs de revenus du semestre.',
    category: 'Sales',
    categoryColor: '#F59E0B',
    startDate: '01/01/2026',
    endDate: '30/06/2026',
    remainingDays: 67,
    keyResults: [
      { id:'kr7', title:'Comptes Enterprise signés',    current: 2,     target: 5,     unit: 'comptes', completed: false },
      { id:'kr8', title:'Pipeline commercial',          current: 87000, target: 200000, unit: '€',      completed: false },
      { id:'kr9', title:'Chiffre d\'affaires récurrent',current: 4200,  target: 8000,  unit: '€/mois',  completed: true  },
    ],
  },
];

const getProgress = (krs: { current: number; target: number }[]) => {
  if (!krs.length) return 0;
  return Math.round(
    krs.reduce((s, kr) => {
      // For "incidents" type where lower is better, invert the ratio
      const ratio = kr.target === 0
        ? kr.current === 0 ? 1 : 0
        : Math.min(kr.current / kr.target, 1);
      return s + ratio * 100;
    }, 0) / krs.length
  );
};

// Health color: compare progress vs time elapsed (Q2 2026)
const getHealthHue = (progress: number) => {
  // Simplified: assume ~40% time elapsed
  const timeElapsed = 40;
  const ratio = timeElapsed > 0 ? progress / timeElapsed : 1;
  if (ratio >= 1.5) return 120;
  if (ratio >= 1.0) return 145;
  if (ratio >= 0.8) return 60;
  if (ratio >= 0.5) return 30;
  return 0;
};

const fmtVal = (v: number, unit: string) => {
  if (unit === '€' || unit === '€/mois') return `${v.toLocaleString('fr-FR')} ${unit}`;
  return `${v} ${unit}`;
};

const OKRCardShowcase: React.FC = () => (
  <div className="w-full grid grid-cols-1 gap-4">
    {OKRS.map(okr => {
      const progress = getProgress(okr.keyResults);
      const hue = getHealthHue(progress);
      const healthBg     = `hsla(${hue},80%,45%,0.10)`;
      const healthBorder = `hsla(${hue},80%,45%,0.20)`;
      const healthText   = `hsl(${hue},80%,50%)`;

      return (
        <div
          key={okr.id}
          className="rounded-lg border p-5 relative overflow-hidden shadow-xl"
          style={{ backgroundColor: 'rgba(30,41,59,0.85)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          {/* Header row */}
          <div className="flex justify-between items-start gap-3 mb-3">
            <div className="flex-1 min-w-0">
              {/* Category + dates */}
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: `${okr.categoryColor}20`, color: okr.categoryColor }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: okr.categoryColor }} />
                  {okr.category}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                <span>{okr.startDate}</span>
                <span>→</span>
                <span>{okr.endDate}</span>
              </div>
              <h3 className="text-sm font-semibold text-white leading-snug">{okr.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{okr.description}</p>
            </div>

            {/* Actions + remaining days */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-1">
                <Edit2 size={13} className="text-slate-500 cursor-default" />
                <Trash2 size={13} className="text-slate-500 cursor-default" />
              </div>
              <div
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                style={{ backgroundColor: healthBg, borderColor: healthBorder, color: healthText }}
              >
                {okr.remainingDays}j restants
              </div>
            </div>
          </div>

          {/* Progress section */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <TrendingUp size={11} style={{ color: healthText }} />
              Progression globale
            </span>
            <span className="text-sm font-bold" style={{ color: healthText }}>{progress}%</span>
          </div>
          {/* Objective progress bar */}
          <div className="w-full bg-slate-700/60 rounded-full h-1.5 mb-1">
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, backgroundColor: healthText }}
            />
          </div>
          {/* Time progress bar */}
          <div className="w-full bg-slate-700/30 rounded-full h-1 mb-4">
            <div className="h-1 rounded-full bg-slate-500/60" style={{ width: '40%' }} />
          </div>
          <div className="flex justify-between text-[9px] text-slate-600 -mt-3 mb-3">
            <span>Avancement objectif</span>
            <span>Temps écoulé : 40%</span>
          </div>

          {/* Key Results */}
          <div className="space-y-2">
            {okr.keyResults.map(kr => {
              const pct = kr.target === 0
                ? (kr.current === 0 ? 100 : 0)
                : Math.min(Math.round((kr.current / kr.target) * 100), 100);
              return (
                <div key={kr.id} className="flex items-center gap-2.5">
                  <div className="flex-shrink-0">
                    {kr.completed
                      ? <CheckCircle size={13} className="text-green-400" />
                      : <div className="w-3 h-3 rounded-full border border-slate-600" />
                    }
                  </div>
                  <span className="flex-1 text-xs text-slate-300 truncate min-w-0">{kr.title}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                    {fmtVal(kr.current, kr.unit)} / {fmtVal(kr.target, kr.unit)}
                  </span>
                  <span
                    className="text-[10px] font-bold w-7 text-right shrink-0"
                    style={{ color: pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444' }}
                  >
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
);

export default OKRCardShowcase;
