// Feuille de sélection de jours de la semaine, commune à la récurrence d'un
// évènement (`event-modal/RecurrenceDaysModal`) et aux jours prévus d'une
// habitude (`HabitModal`, `HabitDaysPicker`). Corps extrait verbatim de
// l'ancienne `RecurrenceDaysModal`, textes et confirmation passés en props.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/i18n/useT';
import { useSheetDrag, useSheetMotion } from '@/components/mobile/mobile-motion';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { WEEK_DAY_ORDER, weekDayName } from '@/lib/week-days';

interface WeekDaysSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  hint: string;
  days: number[];
  onToggle: (day: number) => void;
  onConfirm: () => void;
  /** Confirmer grisé (ex. aucun jour coché pour une habitude). */
  confirmDisabled?: boolean;
}

const WeekDaysSheet: React.FC<WeekDaysSheetProps> = ({
  isOpen, onClose, title, hint, days, onToggle, onConfirm, confirmDisabled = false,
}) => {
  const { t: tCommon } = useT('common');
  const sheetDrag = useSheetDrag(onClose);
  const sheetMotion = useSheetMotion();
  // C-53 — feuille montee par-dessus une modale, en FRERE de son overlay.
  const { ref: overlayRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open: isOpen,
    onClose,
    label: title,
  });
  return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={overlayRef}
            {...dialogProps}
            className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center z-[70] sm:p-4"
            onClick={() => onClose()}
          >
            <motion.div
              {...sheetMotion}
              // La poignee ci-dessous promet un geste : il existe (C-07).
              {...sheetDrag}
              className="rounded-t-[28px] sm:rounded-2xl shadow-2xl w-full sm:max-w-md"
              style={{ backgroundColor: 'rgb(var(--color-surface))', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
              <div className="px-5 sm:px-6 py-4">
                <h3 className="text-base font-bold mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {title}
                </h3>
                <p className="text-sm mb-4" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {hint}
                </p>
                <div className="space-y-1">
                  {WEEK_DAY_ORDER.map((d) => {
                    const checked = days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => onToggle(d)}
                        className="w-full flex items-center justify-between px-3 min-h-11 rounded-lg transition-colors hover:bg-[rgb(var(--color-hover))]"
                      >
                        <span className="text-[15px]" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {weekDayName(d)}
                        </span>
                        <span
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            checked ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]' : 'border-slate-400 dark:border-slate-500'
                          }`}
                        >
                          {checked && (
                            <svg className="w-4 h-4 text-[rgb(var(--color-accent-solid-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={confirmDisabled}
                  onClick={onConfirm}
                  className="mt-5 w-full min-h-11 rounded-lg text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {tCommon('actions.confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
);
};

export default WeekDaysSheet;
