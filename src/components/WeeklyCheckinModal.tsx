import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { X, ChevronRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveOkrs, useUpdateKeyResult } from '@/modules/okrs';

const STORAGE_KEY = 'cosmo:last-checkin-week';

/**
 * Identifiant ISO de la semaine courante au format "YYYY-Www" (ex. "2026-W21").
 * Sert de "fingerprint" pour ne montrer le check-in qu'une fois par semaine.
 */
function getCurrentWeekId(): string {
  const d = new Date();
  // ISO week: Thursday in current week decides the year
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Hook qui détermine si le modal de check-in hebdo doit s'afficher.
 *
 * Conditions :
 * - On est lundi ou mardi (jours pertinents pour faire le point)
 * - Pas encore vu cette semaine (flag localStorage)
 * - Au moins un OKR actif existe
 *
 * Retourne `{ shouldShow, dismiss }`. Le composant appelant peut piloter
 * l'affichage du modal et appeler `dismiss()` pour marquer la semaine comme vue.
 */
export function useWeeklyCheckin() {
  const { data: activeOkrs = [] } = useActiveOkrs();
  const [seenThisWeek, setSeenThisWeek] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === getCurrentWeekId();
    } catch {
      return true;
    }
  });

  const today = new Date().getDay(); // 0=Sun, 1=Mon, 2=Tue, ...
  const isCheckinDay = today === 1 || today === 2; // Lundi ou mardi
  const shouldShow = isCheckinDay && !seenThisWeek && activeOkrs.length > 0;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, getCurrentWeekId());
    } catch {
      // ignore
    }
    setSeenThisWeek(true);
  };

  return { shouldShow, dismiss, activeOkrs };
}

interface WeeklyCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal "Check-in hebdo" — proposé chaque lundi matin pour mettre à jour
 * les KR en cours.
 *
 * UX : 1 KR par "écran" avec input de la nouvelle valeur, navigation prev/next.
 * À la fin, soumet toutes les modifications en batch. Trace automatiquement
 * via `useUpdateKeyResult` (qui insère dans `kr_completions` côté repository).
 */
export function WeeklyCheckinModal({ isOpen, onClose }: WeeklyCheckinModalProps) {
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const { data: activeOkrs = [] } = useActiveOkrs();
  const updateKR = useUpdateKeyResult();

  // Flatten tous les KR non complétés des OKR actifs
  const allKRs = useMemo(() => {
    return activeOkrs.flatMap(okr =>
      okr.keyResults
        .filter(kr => !kr.completed)
        .map(kr => ({ okrId: okr.id, okrTitle: okr.title, kr }))
    );
  }, [activeOkrs]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [updates, setUpdates] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset state quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setCurrentIdx(0);
      setUpdates({});
    }
  }, [isOpen]);

  const current = allKRs[currentIdx];
  const isLast = currentIdx === allKRs.length - 1;

  const currentValue = current
    ? updates[current.kr.id] !== undefined
      ? updates[current.kr.id]
      : current.kr.currentValue
    : 0;

  const handleNext = () => {
    if (isLast) {
      void handleSubmit();
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      // Submet uniquement les KR dont la valeur a changé
      const changes = Object.entries(updates);
      for (const [krId, newValue] of changes) {
        const item = allKRs.find(x => x.kr.id === krId);
        if (!item) continue;
        const completed = newValue >= item.kr.targetValue;
        await new Promise<void>((resolve, reject) => {
          updateKR.mutate(
            {
              okrId: item.okrId,
              keyResultId: krId,
              updates: { currentValue: newValue, completed },
            },
            {
              onSuccess: () => resolve(),
              onError: err => reject(err),
            }
          );
        });
      }
      toast.success('Check-in enregistré ! Bonne semaine 🚀', {
        description: `${changes.length} KR ${changes.length > 1 ? 'mis à jour' : 'mis à jour'}`,
      });
      onClose();
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  if (!current && isOpen) {
    // Pas de KR à check-in — fermer immédiatement
    return null;
  }

  const progress = current ? ((currentIdx + 1) / allKRs.length) * 100 : 0;
  const krProgress = current ? (currentValue / Math.max(current.kr.targetValue, 1)) * 100 : 0;

  return (
    <AnimatePresence>
      {isOpen && current && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            ref={sheetRef}
            {...sheetDragProps}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[rgb(var(--color-surface))] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
              <motion.div style={{ width: handleBarWidth }} className="h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>

            {/* Header */}
            <div className="px-5 pt-3 pb-4 shrink-0 border-b border-[rgb(var(--color-border))]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="font-bold text-base text-[rgb(var(--color-text-primary))]">
                    Check-in hebdo
                  </h2>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    KR {currentIdx + 1} sur {allKRs.length}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                  aria-label="Fermer"
                >
                  <X size={18} className="text-[rgb(var(--color-text-muted))]" />
                </button>
              </div>
              {/* Barre de progression globale */}
              <div className="h-1 bg-[rgb(var(--color-hover))] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', damping: 22 }}
                />
              </div>
            </div>

            {/* Body — KR actuel */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--color-text-muted))] mb-1.5">
                {current.okrTitle}
              </p>
              <h3 className="text-lg font-semibold text-[rgb(var(--color-text-primary))] mb-5">
                {current.kr.title}
              </h3>

              {/* Input nouvelle valeur */}
              <label className="block text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-2">
                Où en es-tu ?
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={currentValue}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    setUpdates(u => ({ ...u, [current.kr.id]: Number.isNaN(v) ? 0 : v }));
                  }}
                  className="flex-1 px-4 py-3 text-xl font-bold bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] rounded-xl text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <span className="text-sm text-[rgb(var(--color-text-muted))] min-w-[80px]">
                  / {current.kr.targetValue} {current.kr.unit}
                </span>
              </div>

              {/* Progress visualisation */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="text-[rgb(var(--color-text-muted))]">
                    Avant : {current.kr.currentValue} {current.kr.unit}
                  </span>
                  <span
                    className={`font-semibold ${
                      krProgress >= 100 ? 'text-emerald-600' : 'text-[rgb(var(--color-text-secondary))]'
                    }`}
                  >
                    {Math.round(krProgress)}%
                  </span>
                </div>
                <div className="h-2 bg-[rgb(var(--color-hover))] rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${krProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    animate={{ width: `${Math.min(krProgress, 100)}%` }}
                    transition={{ type: 'spring', damping: 22 }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pt-3 pb-3 border-t border-[rgb(var(--color-border))] shrink-0 flex items-center gap-2">
              {currentIdx > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentIdx(i => i - 1)}
                  className="px-4 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] rounded-xl transition-colors"
                >
                  Précédent
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  'Enregistrement…'
                ) : isLast ? (
                  <>
                    <Check size={16} />
                    Terminer
                  </>
                ) : (
                  <>
                    Suivant
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default WeeklyCheckinModal;
