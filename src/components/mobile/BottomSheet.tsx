import React from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SHEET_SPRING, FADE_TRANSITION, haptic } from './mobile-motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Libellé accessible du panneau (role="dialog"). */
  ariaLabel: string;
  className?: string;
}

/**
 * Feuille bas-d'écran sur mobile, dialogue centré sur desktop (`sm:` et plus).
 *
 * Extrait de la modale de choix Premium (PremiumPage) et de la structure
 * reprise à l'identique par HabitsAdGate — au lieu de deux copies qui
 * divergeraient avec le temps, une seule brique. Cf. docs/MOBILE.md.
 */
export default function BottomSheet({ open, onClose, children, ariaLabel, className }: BottomSheetProps) {
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) {
      haptic(10);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE_TRANSITION}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            key="sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={SHEET_SPRING}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full sm:max-w-md bg-[rgb(var(--color-surface))] sm:rounded-2xl rounded-t-sheet shadow-2xl flex flex-col max-h-[92vh]',
              className,
            )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sm:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
