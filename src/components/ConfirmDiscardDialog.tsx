// Confirmation avant fermeture avec modifications non sauvegardées (#40) —
// modale interne à l'app (remplace l'ancien window.confirm de confirm-discard.ts,
// non stylable et incohérent avec le reste de l'UI). Même pattern que
// DeleteTaskConfirm (bottom-sheet mobile / dialog desktop, drag-to-close).
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useT } from '@/i18n/useT';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { useModalA11y } from '@/hooks/use-modal-a11y';

interface ConfirmDiscardDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmDiscardDialog: React.FC<ConfirmDiscardDialogProps> = ({ isOpen, onCancel, onConfirm }) => {
  const { t } = useT('common');
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onCancel);
  const sheetMotion = useSheetMotion();
  // C-53 — cette confirmation s'ouvre PAR-DESSUS EventModal / HabitModal, et
  // elle est rendue en FRERE de leur overlay, pas dedans. Sans piege a elle,
  // le piege du parent lui reprendrait le focus a la premiere tabulation.
  const { ref: overlayRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open: isOpen,
    onClose: onCancel,
    label: t('discard.title'),
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70] sm:p-4"
          onClick={onCancel}
        >
          <motion.div
            ref={sheetRef}
            {...sheetDragProps}
            {...sheetMotion}
            onClick={(e) => e.stopPropagation()}
            className="bg-[rgb(var(--color-surface))] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border border-[rgb(var(--color-border))]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sm:hidden flex justify-center pt-4 pb-3">
              <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
            </div>
            <div className="p-5 sm:p-6">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertTriangle className="text-amber-600 dark:text-amber-400" size={24} />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">
                {t('discard.title')}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                {t('discard.body')}
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  {t('discard.keepEditing')}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-500/20"
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
