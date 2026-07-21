// Confirmation avant fermeture avec modifications non sauvegardées (#40) —
// modale interne à l'app (remplace l'ancien window.confirm de confirm-discard.ts,
// non stylable et incohérent avec le reste de l'UI). Même pattern que
// DeleteTaskConfirm (bottom-sheet mobile / dialog desktop, drag-to-close).
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';

interface ConfirmDiscardDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmDiscardDialog: React.FC<ConfirmDiscardDialogProps> = ({ isOpen, onCancel, onConfirm }) => {
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onCancel);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70] sm:p-4"
          onClick={onCancel}
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
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 monochrome:bg-neutral-800 flex items-center justify-center mb-4">
                <AlertTriangle className="text-amber-600 dark:text-amber-400 monochrome:text-neutral-300" size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">
                Abandonner les modifications ?
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                Les modifications non enregistrées seront perdues.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 monochrome:border-neutral-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  Continuer la saisie
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 monochrome:bg-white monochrome:text-black transition-all shadow-md shadow-red-500/20 monochrome:shadow-white/10"
                >
                  Abandonner
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDiscardDialog;
