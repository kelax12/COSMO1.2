// Feuille de confirmation de suppression d'événement — extraite verbatim de EventModal.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';

interface DeleteEventConfirmProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteEventConfirm: React.FC<DeleteEventConfirmProps> = ({ isOpen, onCancel, onConfirm }) => {
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onCancel);
  return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-end sm:items-center justify-center z-[60] sm:p-4"
            onClick={() => onCancel()}
          >
            <motion.div
              ref={sheetRef}
              {...sheetDragProps}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              className="rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl w-full sm:max-w-md transition-colors"
              style={{
                backgroundColor: "rgb(var(--color-surface))",
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm:hidden flex justify-center pt-4 pb-3">
                <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
              </div>
              <div className="p-5 sm:p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                  <Trash2 className="text-red-600 dark:text-red-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Supprimer l'événement
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                  Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 min-h-11"
                    onClick={() => onCancel()}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 min-h-11 bg-red-600 hover:bg-red-700 text-white"
                    onClick={onConfirm}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );
};

export default DeleteEventConfirm;
