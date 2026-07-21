// Modale hebdomadaire « gel » (#1, préparation déploiement) — annonce chaque
// lundi que toutes les habitudes ont reçu leur gel (joker) de la semaine.
// Purement informatif : le joker lui-même est déjà calculé automatiquement
// par une fenêtre glissante de 7 jours (modules/habits/streak.ts) — cette
// modale ne fait qu'expliquer la règle à l'utilisateur, sans toucher aux données.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake } from 'lucide-react';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import type { Habit } from '@/modules/habits';

interface HabitWeeklyFreezeModalProps {
  isOpen: boolean;
  habits: Habit[];
  onClose: () => void;
}

const HabitWeeklyFreezeModal: React.FC<HabitWeeklyFreezeModalProps> = ({ isOpen, habits, onClose }) => {
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            ref={sheetRef}
            {...sheetDragProps}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 monochrome:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border border-slate-200 dark:border-slate-700 monochrome:border-neutral-700"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sm:hidden flex justify-center pt-4 pb-3">
              <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
            </div>
            <div className="p-5 sm:p-6">
              <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900/30 monochrome:bg-neutral-800 flex items-center justify-center mb-4">
                <Snowflake className="text-cyan-600 dark:text-cyan-300 monochrome:text-neutral-300" size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">
                Bon lundi ! Vos gels sont rechargés ❄️
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                {habits.length > 1
                  ? `Chacune de vos ${habits.length} habitudes a reçu un gel pour cette semaine : un jour manqué ne cassera pas votre série.`
                  : 'Votre habitude a reçu un gel pour cette semaine : un jour manqué ne cassera pas votre série.'}
              </p>
              {habits.length > 0 && (
                <ul className="max-h-40 overflow-y-auto space-y-1.5 mb-5 sm:mb-6">
                  {habits.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 monochrome:text-neutral-200"
                    >
                      <Snowflake size={14} className="text-cyan-500 monochrome:text-neutral-400 shrink-0" />
                      <span className="truncate">{h.name}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 monochrome:bg-white monochrome:text-black transition-all shadow-md shadow-blue-500/20 monochrome:shadow-white/10"
              >
                Compris, bonne semaine !
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HabitWeeklyFreezeModal;
