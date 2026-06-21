import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeleteListConfirmProps {
  open: boolean;
  listName: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

// Dialog (bottom-sheet mobile) de confirmation de suppression d'une liste.
const DeleteListConfirm: React.FC<DeleteListConfirmProps> = ({ open, listName, onCancel, onConfirm }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] sm:p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0, transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="sm:hidden flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
            <div className="p-5 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>
                Confirmer la suppression
              </h3>
              <p className="text-sm leading-relaxed mb-5 sm:mb-6" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                Êtes-vous sûr de vouloir supprimer la liste{' '}
                <strong style={{ color: 'rgb(var(--color-text-primary))' }}>
                  "{listName}"
                </strong>
                {' ? Les tâches associées resteront mais ne seront plus groupées.'}
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all"
                  style={{
                    borderColor: 'rgb(var(--color-border))',
                    color: 'rgb(var(--color-text-primary))',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeleteListConfirm;
