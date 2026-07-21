import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface DeleteCategoryConfirmProps {
  open: boolean;
  categoryName: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

// Dialog de confirmation de suppression d'une catégorie OKR.
const DeleteCategoryConfirm: React.FC<DeleteCategoryConfirmProps> = ({ open, categoryName, onCancel, onConfirm }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/30 dark:bg-slate-950/50 backdrop-blur-md flex items-center justify-center z-[60] p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Confirmer la suppression</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                Êtes-vous sûr de vouloir supprimer la catégorie <strong className="text-slate-900 dark:text-white">"{categoryName}"</strong> ? Les OKR associés conserveront leur catégorie mais ne seront plus filtrables.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 min-h-11" onClick={onCancel}>
                  Annuler
                </Button>
                <Button variant="destructive" className="flex-1 min-h-11 bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm}>
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

export default DeleteCategoryConfirm;
