import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, Clock } from 'lucide-react';
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
 * deadline est atteinte. Reprend exactement le design de la carte OKR de
 * OKRPage (chip catégorie, dates, titre, progression, KR avec currentValue
 * éditable inline, temps effectué). Ajoute en bas un bouton « Valider »
 * qui anime la carte vers le bouton "OKR terminés".
 */
const OKRDeadlineReviewModal: React.FC<Props> = ({ okr, categories, flyTargetRef, onClose, onValidate, resolveColor }) => {
  const [draft, setDraft] = useState<OKR | null>(okr);
  const [phase, setPhase] = useState<'edit' | 'flying'>('edit');
  const [flyTarget, setFlyTarget] = useState<{ x: number; y: number; scale: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const validatedRef = useRef(false);

  useEffect(() => {
    // Ne pas réinitialiser quand okr devient null (fermeture) — sinon
    // validatedRef.current serait remis à false pendant l'animation fly,
    // ce qui laisserait le setTimeout(commit, 800) appeler onValidate une
    // deuxième fois après que handleFlyEnd l'a déjà appelé. → double toast.
    if (!okr?.id) return;
    setDraft(okr);
    setPhase('edit');
    setFlyTarget(null);
    validatedRef.current = false;
    // Init uniquement sur okr.id (voir commentaire ci-dessus) — pas l'objet okr
    // entier, sinon double-commit pendant l'animation fly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [okr?.id]);

  useEffect(() => {
    if (!okr) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [okr]);

  useEffect(() => {
    if (!okr || phase !== 'edit') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [okr, phase, onClose]);

  if (!okr || !draft) return null;

  const category = categories.find(c => c.id === draft.category);

  const updateKR = (krId: string, patch: Partial<KeyResult>) => {
    setDraft(prev => prev ? {
      ...prev,
      keyResults: prev.keyResults.map(kr => kr.id === krId ? { ...kr, ...patch } : kr),
    } : prev);
  };

  const computeProgress = (krs: KeyResult[]) => {
    if (krs.length === 0) return 0;
    const sum = krs.reduce((s, kr) =>
      s + (kr.targetValue > 0 ? Math.min((kr.currentValue / kr.targetValue) * 100, 100) : 0)
    , 0);
    return Math.round(sum / krs.length);
  };

  const formatTime = (minutes: number) => {
    if (minutes === 0) return '0min';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const handleValidate = () => {
    const commit = () => {
      if (validatedRef.current) return;
      validatedRef.current = true;
      onValidate({ ...draft, progress: computeProgress(draft.keyResults), completed: true });
    };
    if (!cardRef.current || !flyTargetRef.current) {
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
    window.setTimeout(commit, 800);
  };

  const handleFlyEnd = () => {
    if (validatedRef.current) return;
    validatedRef.current = true;
    onValidate({ ...draft, progress: computeProgress(draft.keyResults), completed: true });
  };

  const progress = computeProgress(draft.keyResults);
  const doneMins = draft.keyResults.reduce((sum, kr) => sum + Math.round(kr.currentValue * kr.estimatedTime), 0);
  const totalMins = draft.keyResults.reduce((sum, kr) => sum + Math.round(kr.estimatedTime * kr.targetValue), 0);

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
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
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
          className="relative w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh]"
          style={{
            backgroundColor: 'rgb(var(--color-surface))',
            border: '1px solid rgb(var(--color-border))',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* Drag handle mobile */}
          <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>

          {/* Close (X) */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>

          {/* Carte OKR — reprend exactement le design de OKRPage TaskCard */}
          <div className="p-6 overflow-y-auto flex-1">
            <div className="flex justify-between items-start mb-4 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap"
                    style={{
                      backgroundColor: category ? resolveColor(category.color) + '20' : 'rgb(var(--color-accent) / 0.1)',
                      color: category ? resolveColor(category.color) : 'rgb(var(--color-accent))',
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: category ? resolveColor(category.color) : 'rgb(var(--color-accent))' }}
                    />
                    <span>{category?.name ?? draft.category}</span>
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 mb-2 text-[11px]" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  <span>{new Date(draft.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <span>→</span>
                  <span>{new Date(draft.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>{draft.title}</h3>
                <p className="text-xs sm:text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>{draft.description}</p>
              </div>
            </div>

            <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0">
                <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" stroke="rgb(var(--color-border-muted))" strokeWidth="8" fill="none" />
                  <circle
                    cx="40" cy="40" r="32"
                    stroke="rgb(var(--color-accent))"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={2 * Math.PI * 32 * (1 - Math.min(progress, 100) / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg sm:text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{progress}%</span>
                </div>
              </div>

              <div className="flex-1 w-full">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs sm:text-sm font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>Progression globale</span>
                  <span className="text-xs sm:text-sm font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{progress}%</span>
                </div>
                <div className="w-full rounded-full h-2" style={{ backgroundColor: 'rgb(var(--color-border-muted))' }}>
                  <div className="h-2 rounded-full transition-all duration-500" style={{ backgroundColor: 'rgb(var(--color-accent))', width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs sm:text-sm font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>Résultats Clés</h4>
              {draft.keyResults.map((keyResult) => {
                const krProgress = keyResult.targetValue > 0 ? (keyResult.currentValue / keyResult.targetValue) * 100 : 0;
                return (
                  <div key={keyResult.id} className="rounded-lg p-3 transition-all" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                    <div className="flex justify-between items-center mb-3 gap-2">
                      <span className="text-xs sm:text-sm font-medium truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{keyResult.title}</span>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <span className="text-[10px] sm:text-xs flex items-center gap-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
                          <Clock size={12} />
                          {keyResult.estimatedTime}min
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="number"
                          aria-label={`Avancement de ${keyResult.title} sur ${keyResult.targetValue}`}
                          value={keyResult.currentValue}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            updateKR(keyResult.id, { currentValue: v, completed: v >= keyResult.targetValue });
                          }}
                          className="w-16 sm:w-20 px-2 py-1 text-xs sm:text-sm border rounded focus:outline-none"
                          style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))', borderColor: 'rgb(var(--color-border))' }}
                        />
                        <span className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgb(var(--color-text-secondary))' }}>/ {keyResult.targetValue}</span>
                      </div>

                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: 'rgb(var(--color-border-muted))' }}>
                          <div className={`h-1.5 rounded-full transition-all duration-500 ${krProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(krProgress, 100)}%` }} />
                        </div>
                        <span className="text-[10px] sm:text-xs font-medium w-8 text-right" style={{ color: 'rgb(var(--color-text-secondary))' }}>{Math.round(krProgress)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalMins > 0 && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgb(var(--color-border))' }}>
                <div className="flex items-center gap-1.5">
                  <Clock size={13} style={{ color: 'rgb(var(--color-text-muted))' }} />
                  <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>Temps effectué</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {formatTime(doneMins)} <span style={{ color: 'rgb(var(--color-text-muted))' }}>/ {formatTime(totalMins)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Footer — bouton Valider seul */}
          <div className="px-6 pt-3 pb-4 border-t shrink-0" style={{ borderColor: 'rgb(var(--color-border))' }}>
            <button
              onClick={handleValidate}
              disabled={phase !== 'edit'}
              className="w-full px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 shadow-md shadow-green-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CheckCircle2 size={16} />
              Valider
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default OKRDeadlineReviewModal;
