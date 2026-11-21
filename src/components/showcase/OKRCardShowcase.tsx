import React, { useEffect, useRef, useState } from 'react';
import { Edit2, Trash2, Clock, Check, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShowcasePalette } from './showcase-theme';
import { formatNumber } from '@/i18n/format';

// Vitrine OKR : décalque de la carte d'objectif de l'app (`src/pages/okr/OKRCard.tsx`,
// vue desktop). En-tête catégorie / dates centrées / actions, pastille « j restants »,
// titre, progression globale en barre épaisse avec le pourcentage en grand, puis
// les résultats clés avec leurs boutons − / +, leur barre, leur % et leur menu.
//
// Le mouvement rejoue un usage réel : à chaque pas, le bouton + d'UN résultat clé
// s'enfonce, sa valeur monte, sa barre se remplit, et la progression globale suit.
// Un résultat clé qui touche sa cible affiche « Atteint ».

type KR = { id: string; title: string; targetValue: number; estimatedTime: number; tasks?: number };

const ACCENT = '#3B82F6';

const OBJECTIVE = {
  title: 'Accélérer la croissance produit',
  category: 'Produit',
  categoryColor: '#3B82F6',
  start: '1 avr. 2026',
  end: '30 juin 2026',
  remainingDays: 65,
  keyResults: [
    { id: 'kr1', title: 'Utilisateurs actifs mensuels', targetValue: 10000, estimatedTime: 45, tasks: 3 },
    { id: 'kr2', title: 'Score NPS', targetValue: 50, estimatedTime: 30 },
    { id: 'kr3', title: 'Taux de rétention J30', targetValue: 85, estimatedTime: 60, tasks: 1 },
  ] as KR[],
};

/** Valeurs successives des trois résultats clés : un seul change à chaque pas. */
const PHASES: number[][] = [
  [3200, 38, 71],
  [5500, 38, 71],
  [5500, 44, 71],
  [5500, 44, 80],
  [8200, 44, 80],
  [8200, 50, 80],
  [10000, 50, 80],
  [10000, 50, 85],
];

const PAS_MS = 1700;

const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${m}` : `${h} h`;
};

const fmt = (n: number) => formatNumber(n);

const OKRCardShowcase: React.FC = () => {
  const P = useShowcasePalette();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const precedent = useRef(PHASES[PHASES.length - 1]);

  useEffect(() => {
    const id = setInterval(() => setPhaseIdx((i) => (i + 1) % PHASES.length), PAS_MS);
    return () => clearInterval(id);
  }, []);

  const valeurs = PHASES[phaseIdx];
  // Le résultat clé qui vient de bouger : son bouton + s'enfonce à ce pas.
  const actif = valeurs.findIndex((v, i) => v !== precedent.current[i]);
  useEffect(() => {
    precedent.current = valeurs;
  }, [valeurs]);

  const krs = OBJECTIVE.keyResults.map((kr, i) => {
    const currentValue = valeurs[i];
    const pct = kr.targetValue > 0 ? Math.min((currentValue / kr.targetValue) * 100, 100) : 0;
    return { ...kr, currentValue, pct, reached: currentValue >= kr.targetValue };
  });
  const progress = Math.round(krs.reduce((s, kr) => s + kr.pct, 0) / krs.length);
  const doneMins = krs.reduce((s, kr) => s + Math.round((kr.pct / 100) * kr.estimatedTime * 10), 0);
  const totalMins = krs.reduce((s, kr) => s + kr.estimatedTime * 10, 0);

  return (
    <div className="w-full">
      <div
        className="rounded-lg border p-6 relative overflow-hidden shadow-xl"
        style={{ backgroundColor: P.surface, borderColor: P.hairline }}
      >
        {/* En-tête : catégorie · dates centrées · actions */}
        <div className="flex justify-between items-center mb-4 gap-4">
          <span
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0"
            style={{ backgroundColor: OBJECTIVE.categoryColor + '20', color: P.tintText(OBJECTIVE.categoryColor) }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: OBJECTIVE.categoryColor }} />
            {OBJECTIVE.category}
          </span>
          <div className="flex-1 min-w-0 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <span>{OBJECTIVE.start}</span>
            <span>→</span>
            <span>{OBJECTIVE.end}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="p-1.5 text-slate-500"><Edit2 size={15} /></span>
            <span className="p-1.5 text-red-500/70"><Trash2 size={15} /></span>
          </div>
        </div>

        <div className="mb-4">
          <span
            className="inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border"
            style={{ backgroundColor: ACCENT + '1A', borderColor: ACCENT + '33', color: P.tintText(ACCENT) }}
          >
            {OBJECTIVE.remainingDays}j restants
          </span>
        </div>

        <h3 className="text-lg font-semibold mb-4 truncate text-white sc-ink">{OBJECTIVE.title}</h3>

        {/* Progression globale : libellé + grand pourcentage, barre épaisse */}
        <div className="mb-6">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm font-medium text-slate-400">Progression globale</span>
            <motion.span
              key={progress}
              initial={{ y: 5 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-2xl font-bold tabular-nums text-white sc-ink"
            >
              {progress}%
            </motion.span>
          </div>
          <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: P.track }}>
            <motion.div
              className="h-3 rounded-full"
              style={{ backgroundColor: ACCENT }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Résultats clés */}
        <h4 className="text-sm font-medium mb-1 text-slate-400">Résultats clés</h4>
        <div>
          {krs.map((kr, i) => {
            const enCours = i === actif;
            return (
              <div key={kr.id} className="rounded-lg p-3">
                <div className="flex justify-between items-center mb-3 gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium truncate text-white sc-ink">{kr.title}</span>
                    <span className="shrink-0 text-xs flex items-center gap-1 text-slate-500">
                      <Clock size={12} />
                      {kr.estimatedTime} min
                    </span>
                    {kr.reached && (
                      <motion.span
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold"
                        style={{ color: P.tintText(ACCENT) }}
                      >
                        <Check size={13} />
                        Atteint
                      </motion.span>
                    )}
                  </span>
                  {kr.tasks ? (
                    <span
                      className="shrink-0 text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: ACCENT + '1A', color: P.tintText(ACCENT) }}
                    >
                      {kr.tasks} tâche{kr.tasks > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="w-7 h-7 rounded-md border flex items-center justify-center text-sm font-bold text-slate-400"
                      style={{ borderColor: P.hairline }}
                    >
                      −
                    </span>
                    <span
                      className="w-16 px-2 py-1 text-sm border rounded text-center tabular-nums text-white sc-ink overflow-hidden"
                      style={{ backgroundColor: P.field, borderColor: P.hairline }}
                    >
                      <motion.span key={kr.currentValue} className="inline-block" initial={{ y: -6 }} animate={{ y: 0 }} transition={{ duration: 0.25 }}>
                        {kr.targetValue >= 1000 ? fmt(kr.currentValue) : kr.currentValue}
                      </motion.span>
                    </span>
                    {/* Le bouton + s'enfonce au pas où ce résultat clé avance. */}
                    <motion.span
                      key={enCours ? `actif-${phaseIdx}` : 'repos'}
                      className="w-7 h-7 rounded-md border flex items-center justify-center text-sm font-bold"
                      style={{ borderColor: enCours ? ACCENT : P.hairline, color: enCours ? P.tintText(ACCENT) : undefined }}
                      initial={enCours ? { scale: 1 } : false}
                      animate={enCours ? { scale: [1, 0.86, 1], backgroundColor: [ACCENT + '00', ACCENT + '22', ACCENT + '00'] } : { scale: 1 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                    >
                      +
                    </motion.span>
                    <span className="text-sm whitespace-nowrap text-slate-400">
                      / {kr.targetValue >= 1000 ? fmt(kr.targetValue) : kr.targetValue}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ backgroundColor: P.track }}>
                      <motion.div
                        className="h-1.5 rounded-full"
                        style={{ backgroundColor: ACCENT }}
                        animate={{ width: `${kr.pct}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: enCours ? 0.15 : 0 }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right tabular-nums text-slate-400">{Math.round(kr.pct)}%</span>
                    <span className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500">
                      <MoreHorizontal size={16} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: P.hairline }}>
          <div className="flex items-center gap-1.5">
            <Clock size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500">Temps effectué</span>
          </div>
          <span className="text-xs font-semibold text-white sc-ink tabular-nums">
            {formatTime(doneMins)} <span className="text-slate-500">/ {formatTime(totalMins)}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default OKRCardShowcase;
