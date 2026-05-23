import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, Clock, Calendar, AlarmClock } from 'lucide-react';
import type { OKR, KeyResult } from '@/modules/okrs';

type Category = { id: string; name: string; color: string };

type Props = {
  okr: OKR | null;
  categories: Category[];
  /** Élément cible vers lequel la carte « vole » à la validation (bouton "OKR terminés"). */
  flyTargetRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  /** Appelé quand l'utilisateur valide — reçoit l'OKR mis à jour, doit setter completed=true côté caller. */
  onValidate: (updated: OKR) => void;
  resolveColor: (color: string) => string;
};

/**
 * Popup affiché à l'ouverture de la page OKR pour les objectifs dont la
 * deadline est atteinte (endDate <= today) et qui ne sont pas encore
 * complétés. L'utilisateur peut éditer les champs avant de cliquer Valider —
 * la carte s'anime alors vers le bouton "OKR terminés" en haut à droite,
 * puis l'OKR est marqué completed.
 */
const OKRDeadlineReviewModal: React.FC<Props> = ({ okr, categories, flyTargetRef, onClose, onValidate, resolveColor }) => {
  const [draft, setDraft] = useState<OKR | null>(okr);
  const [phase, setPhase] = useState<'edit' | 'flying'>('edit');
  const [flyTarget, setFlyTarget] = useState<{ x: number; y: number; scale: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const validatedRef = useRef(false);

  useEffect(() => {
    setDraft(okr);
    setPhase('edit');
    setFlyTarget(null);
    validatedRef.current = false;
  }, [okr?.id]);

  // Lock body scroll
  useEffect(() => {
    if (!okr) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [okr]);

  // ESC pour fermer (seulement en mode edit)
  useEffect(() => {
    if (!okr || phase !== 'edit') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [okr, phase, onClose]);

  if (!okr || !draft) return null;

  const category = categories.find(c => c.id === draft.category);

  const updateField = <K extends keyof OKR>(key: K, value: OKR[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const updateKR = (krId: string, patch: Partial<KeyResult>) => {
    setDraft(prev => prev ? {
      ...prev,
      keyResults: prev.keyResults.map(kr => kr.id === krId ? { ...kr, ...patch } : kr),
    } : prev);
  };

  const computeProgress = (krs: KeyResult[]) => {
    if (krs.length === 0) return 0;
    const sum = krs.reduce((s, kr) => s + (kr.targetValue > 0 ? Math.min((kr.currentValue / kr.targetValue) * 100, 100) : 0), 0);
    return Math.round(sum / krs.length);
  };

  const handleValidate = () => {
    const commit = () => {
      if (validatedRef.current) return;
      validatedRef.current = true;
      onValidate({ ...draft, progress: computeProgress(draft.keyResults), completed: true });
    };
    if (!cardRef.current || !flyTargetRef.current) {
      // Fallback : pas d'animation, valide direct
      commit();
      return;
    }
    const cardRect = cardRef.current.getBoundingClientRect();
    const targetRect = flyTargetRef.current.getBoundingClientRect();
    const dx = (targetRect.left + targetRect.width / 2) - (cardRect.left + cardRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (cardRect.top + cardRect.height / 2);
    const scale = Math.max(0.08, targetRect.width / cardRect.width);
    setFlyTarget({ x: dx, y: dy, scale });
    setPhase('flying');
    // Fallback : si onAnimationComplete ne se déclenche pas (Framer ne tire pas
    // toujours l'event quand le composant est démonté pendant l'anim), on
    // commit après la durée prévue + marge. La duration est 0.7s côté card.
    window.setTimeout(commit, 800);
  };

  const handleFlyEnd = () => {
    if (validatedRef.current) return;
    validatedRef.current = true;
    onValidate({ ...draft, progress: computeProgress(draft.keyResults), completed: true });
  };

  const progress = computeProgress(draft.keyResults);
  const accent = category ? resolveColor(category.color) : '#3B82F6';

  // Pour l'input date HTML
  const endDateInput = draft.endDate ? draft.endDate.split('T')[0] : '';

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'flying' ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: phase === 'flying' ? 0.45 : 0.2 }}
        onClick={() => phase === 'edit' && onClose()}
        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4"
      >
        <motion.div
          ref={cardRef}
          key="card"
          initial={{ scale: 0.85, opacity: 0, y: 40 }}
          animate={
            phase === 'flying' && flyTarget
              ? { x: flyTarget.x, y: flyTarget.y, scale: flyTarget.scale, opacity: 0, rotate: 8 }
              : { scale: 1, opacity: 1, y: 0, x: 0, rotate: 0 }
          }
          transition={
            phase === 'flying'
              ? { duration: 0.7, ease: [0.6, -0.05, 0.7, 0.95] }
              : { type: 'spring', stiffness: 240, damping: 22 }
          }
          onAnimationComplete={() => { if (phase === 'flying') handleFlyEnd(); }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Drag handle mobile */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>

          {/* Header avec bandeau « deadline atteinte » */}
          <div className="px-5 sm:px-6 pt-4 pb-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: accent + '20' }}
                >
                  <AlarmClock size={20} style={{ color: accent }} />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                    Deadline atteinte
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Faites le point sur cet objectif avant de le clôturer.
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body — carte éditable */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
            {/* Catégorie chip */}
            {category && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: accent + '20', color: accent }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
                {category.name}
              </span>
            )}

            {/* Titre */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Objectif
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full px-3 py-2 text-base font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Description
              </label>
              <textarea
                value={draft.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Deadline
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={endDateInput}
                  onChange={(e) => updateField('endDate', e.target.value ? new Date(e.target.value).toISOString() : draft.endDate)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Progress global */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <div className="relative w-14 h-14 shrink-0">
                <svg className="-rotate-90" width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" stroke="rgb(226,232,240)" className="dark:stroke-slate-700" strokeWidth="6" fill="none" />
                  <circle
                    cx="28" cy="28" r="22"
                    stroke={accent}
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 22}`}
                    strokeDashoffset={2 * Math.PI * 22 * (1 - Math.min(progress, 100) / 100)}
                    style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-slate-100">
                  {progress}%
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Progression globale</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {draft.keyResults.filter(k => k.currentValue >= k.targetValue && k.targetValue > 0).length} / {draft.keyResults.length} KR atteints
                </div>
              </div>
            </div>

            {/* Key Results éditables */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Résultats clés
              </label>
              <div className="space-y-2">
                {draft.keyResults.map((kr) => {
                  const krProgress = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
                  const done = krProgress >= 100;
                  return (
                    <div key={kr.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                      <input
                        type="text"
                        value={kr.title}
                        onChange={(e) => updateKR(kr.id, { title: e.target.value })}
                        className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none mb-2"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={kr.currentValue}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            updateKR(kr.id, { currentValue: v, completed: v >= kr.targetValue });
                          }}
                          className="w-16 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">/</span>
                        <input
                          type="number"
                          value={kr.targetValue}
                          onChange={(e) => updateKR(kr.id, { targetValue: Number(e.target.value) })}
                          className="w-16 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">{kr.unit}</span>
                        <div className="flex-1 ml-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(krProgress, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 w-8 text-right shrink-0 flex items-center gap-0.5">
                          <Clock size={10} /> {kr.estimatedTime}m
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 pt-3 pb-3 border-t border-slate-200 dark:border-slate-700 shrink-0 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Plus tard
            </button>
            <button
              onClick={handleValidate}
              disabled={phase !== 'edit'}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 shadow-md shadow-green-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CheckCircle2 size={16} />
              Valider et terminer
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default OKRDeadlineReviewModal;
