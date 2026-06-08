// Feuille de sélection des jours de récurrence — extraite verbatim de EventModal.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EventRecurrence } from '@/modules/events';
import { DAY_ORDER } from './helpers';

interface RecurrenceDaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurrenceDays: number[];
  setRecurrenceDays: React.Dispatch<React.SetStateAction<number[]>>;
  setRecurrence: React.Dispatch<React.SetStateAction<EventRecurrence>>;
}

const RecurrenceDaysModal: React.FC<RecurrenceDaysModalProps> = ({
  isOpen, onClose, recurrenceDays, setRecurrenceDays, setRecurrence,
}) => (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center z-[70] sm:p-4"
            onClick={() => onClose()}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              className="rounded-t-[28px] sm:rounded-2xl shadow-2xl w-full sm:max-w-md"
              style={{ backgroundColor: 'rgb(var(--color-surface))', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm:hidden flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
              <div className="px-5 sm:px-6 py-4">
                <h3 className="text-base font-bold mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  Répéter les jours
                </h3>
                <p className="text-sm mb-4" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Sélectionnez les jours de la semaine où l'événement se répète.
                </p>
                <div className="space-y-1">
                  {DAY_ORDER.map((d) => {
                    const checked = recurrenceDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() =>
                          setRecurrenceDays((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                          )
                        }
                        className="w-full flex items-center justify-between px-3 min-h-11 rounded-lg transition-colors hover:bg-[rgb(var(--color-hover))]"
                      >
                        <span className="text-[15px]" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][d]}
                        </span>
                        <span
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            checked ? 'bg-blue-500 border-blue-500' : 'border-slate-400 dark:border-slate-500'
                          }`}
                        >
                          {checked && (
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
                  onClick={() => {
                    // Si aucun jour coché en sortie, on revient à 'none' pour éviter
                    // une récurrence custom vide silencieuse.
                    if (recurrenceDays.length === 0) setRecurrence('none');
                    onClose();
                  }}
                  className="mt-5 w-full min-h-11 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Valider
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
);

export default RecurrenceDaysModal;
