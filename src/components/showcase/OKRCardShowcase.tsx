import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, Calendar, CheckCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Real OKR-style data ────────────────────────────────────────────
type KR = {
  id: string;
  title: string;
  targetValue: number;
  estimatedTime: number;
};

type OKRStatic = {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryColor: string;
  startDate: string;
  endDate: string;
  keyResults: KR[];
};

const OBJECTIVE: OKRStatic = {
  id: '1',
  title: 'Accélérer la croissance produit',
  description:
    "Atteindre une masse critique d'utilisateurs et valider l'adéquation produit-marché sur Q2.",
  category: 'Produit',
  categoryColor: '#3B82F6',
  startDate: '2026-04-01',
  endDate: '2026-06-30',
  keyResults: [
    { id: 'kr1', title: 'Utilisateurs actifs mensuels', targetValue: 10000, estimatedTime: 45 },
    { id: 'kr2', title: 'Score NPS', targetValue: 50, estimatedTime: 30 },
    { id: 'kr3', title: 'Taux de rétention J30', targetValue: 85, estimatedTime: 60 },
  ],
};

// Animation phases — each step increments one or more KRs
const PHASES: number[][] = [
  [3200, 38, 71],
  [5500, 38, 71],
  [5500, 44, 71],
  [5500, 44, 80],
  [8200, 50, 80],
  [10000, 50, 85],
];

const formatTime = (minutes: number) => {
  if (minutes === 0) return '0min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const OKRCardShowcase: React.FC = () => {
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhaseIdx((i) => (i + 1) % PHASES.length);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const currentValues = PHASES[phaseIdx];
  const krs = OBJECTIVE.keyResults.map((kr, i) => {
    const currentValue = currentValues[i];
    return {
      ...kr,
      currentValue,
      completed: currentValue >= kr.targetValue,
    };
  });

  const progress = Math.round(
    krs.reduce((sum, kr) => {
      return sum + (kr.targetValue > 0 ? Math.min(kr.currentValue / kr.targetValue, 1) * 100 : 0);
    }, 0) / krs.length
  );

  const start = new Date(OBJECTIVE.startDate);
  const end = new Date(OBJECTIVE.endDate);
  const today = new Date('2026-04-26');
  const totalTime = end.getTime() - start.getTime();
  const elapsedTime = today.getTime() - start.getTime();
  const remainingTime = end.getTime() - today.getTime();
  const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
  const timeProgress = totalTime > 0 ? Math.min(Math.max((elapsedTime / totalTime) * 100, 0), 100) : 0;

  let hue = 120;
  const saturation = 80;
  const lightness = 45;
  if (timeProgress > 0) {
    const ratio = progress / timeProgress;
    if (ratio >= 1.5) hue = 120;
    else if (ratio >= 1.0) hue = 145;
    else if (ratio >= 0.8) hue = 60;
    else if (ratio >= 0.5) hue = 30;
    else hue = 0;
  }
  const healthBg = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.1)`;
  const healthBorder = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.2)`;
  const healthText = `hsl(${hue}, ${saturation}%, ${lightness - 5}%)`;

  const doneMins = krs.reduce(
    (sum, kr) => sum + Math.round(kr.currentValue * kr.estimatedTime),
    0
  );
  const totalMins = krs.reduce(
    (sum, kr) => sum + Math.round(kr.estimatedTime * kr.targetValue),
    0
  );

  // Circle progress
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - Math.min(progress, 100) / 100);

  return (
    <div className="w-full grid grid-cols-1 gap-6">
      <div
        className="rounded-lg border p-6 relative overflow-hidden shadow-xl"
        style={{
          backgroundColor: 'rgba(30, 41, 59, 0.85)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Header row */}
        <div className="flex justify-between items-start mb-4 gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap"
                style={{
                  backgroundColor: OBJECTIVE.categoryColor + '20',
                  color: OBJECTIVE.categoryColor,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: OBJECTIVE.categoryColor }}
                />
                <span>{OBJECTIVE.category}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2 text-[11px] text-slate-500">
              <span>{fmtDate(OBJECTIVE.startDate)}</span>
              <span>→</span>
              <span>{fmtDate(OBJECTIVE.endDate)}</span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold mb-1 truncate text-white">
              {OBJECTIVE.title}
            </h3>
            <p className="text-xs sm:text-sm line-clamp-2 text-slate-400">
              {OBJECTIVE.description}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Edit2 size={16} className="text-slate-500 cursor-default" />
              <Trash2 size={16} className="text-slate-500 cursor-default" />
            </div>
            {remainingDays > 0 && (
              <div
                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full backdrop-blur-md border shadow-sm"
                style={{
                  backgroundColor: healthBg,
                  borderColor: healthBorder,
                  color: healthText,
                }}
              >
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    className="w-1 h-1 rounded-full animate-pulse"
                    style={{ backgroundColor: healthText }}
                  />
                  {remainingDays}j restants
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Big progress section */}
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r={r}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="8"
                fill="none"
              />
              <motion.circle
                cx="40"
                cy="40"
                r={r}
                stroke="#3B82F6"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circ}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span
                key={progress}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-xl font-bold text-white"
              >
                {progress}%
              </motion.span>
            </div>
          </div>

          <div className="flex-1 w-full">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-slate-400">Progression globale</span>
              <span className="text-sm font-bold text-white">{progress}%</span>
            </div>
            <div
              className="w-full rounded-full h-2 overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            >
              <motion.div
                className="h-2 rounded-full"
                style={{ backgroundColor: '#3B82F6' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Key Results */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium mb-2 text-slate-400">Résultats Clés</h4>
          {krs.map((kr) => {
            const krProgress = Math.min((kr.currentValue / kr.targetValue) * 100, 100);
            return (
              <div
                key={kr.id}
                className="rounded-lg p-3 transition-colors"
                style={{
                  backgroundColor: kr.completed
                    ? 'rgba(34,197,94,0.08)'
                    : 'rgba(255,255,255,0.04)',
                }}
              >
                <div className="flex justify-between items-center mb-3 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {kr.completed && (
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                        className="shrink-0"
                      >
                        <CheckCircle size={14} className="text-green-400" />
                      </motion.div>
                    )}
                    <span
                      className={`text-sm font-medium truncate ${
                        kr.completed ? 'text-green-300' : 'text-white'
                      }`}
                    >
                      {kr.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="p-1.5 rounded-md">
                      <CheckCircle size={14} className="text-blue-500" />
                    </div>
                    <div className="p-1.5 rounded-md">
                      <Calendar size={14} className="text-purple-500" />
                    </div>
                    <span className="text-xs flex items-center gap-1 text-slate-500">
                      <Clock size={12} />
                      {kr.estimatedTime}min
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div
                      className="w-20 px-2 py-1 text-sm border rounded text-white tabular-nums"
                      style={{
                        backgroundColor: 'rgba(15,23,42,0.6)',
                        borderColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <motion.span
                        key={kr.currentValue}
                        initial={{ opacity: 0, y: -3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        {kr.currentValue}
                      </motion.span>
                    </div>
                    <span className="text-sm whitespace-nowrap text-slate-400">
                      / {kr.targetValue}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 w-full">
                    <div
                      className="flex-1 rounded-full h-1.5 overflow-hidden"
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <motion.div
                        className={`h-1.5 rounded-full ${
                          kr.completed ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        animate={{ width: `${krProgress}%` }}
                        transition={{ duration: 0.9, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right text-slate-400 tabular-nums">
                      {Math.round(krProgress)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalMins > 0 && (
          <div
            className="mt-4 pt-4 border-t flex items-center justify-between"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-slate-500" />
              <span className="text-xs text-slate-500">Temps effectué</span>
            </div>
            <span className="text-xs font-semibold text-white tabular-nums">
              {formatTime(doneMins)}{' '}
              <span className="text-slate-500">/ {formatTime(totalMins)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OKRCardShowcase;
