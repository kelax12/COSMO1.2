import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-[#1e2235] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-700/50"
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-3">Confirmer la suppression</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                Êtes-vous sûr de vouloir supprimer la catégorie <strong className="text-white">"{categoryName}"</strong> ? Les OKR associés conserveront leur catégorie mais ne seront plus filtrables.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white border border-slate-600 hover:bg-slate-800 transition-all duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all duration-200"
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

export default DeleteCategoryConfirm;
