import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';

interface DeleteCategoryConfirmProps {
  open: boolean;
  categoryName: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

// Dialog de confirmation de suppression d'une categorie OKR d'EQUIPE.
//
// ⚠️ Ne PAS l'utiliser pour les categories personnelles : celles-ci passent par
// `@/components/category/DeleteCategoryDialog`, qui annonce le nombre de taches
// et d'objectifs concernes et propose de les reclasser (risque R-02). Les deux
// ne visent pas la meme table : ici `org_okr_categories`, la-bas `categories`.
// L'impact cote equipe n'a pas ete mesure, il reste a traiter.
const DeleteCategoryConfirm: React.FC<DeleteCategoryConfirmProps> = ({ open, categoryName, onCancel, onConfirm }) => {
  const { t } = useT('okr');
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
            className="bg-[rgb(var(--color-surface))] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-[rgb(var(--color-border))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{t('deleteCategory.title')}</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                {t('deleteCategory.body', { name: categoryName ?? '' })}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 min-h-11" onClick={onCancel}>
                  {t('deleteCategory.cancel')}
                </Button>
                <Button variant="destructive" className="flex-1 min-h-11 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white" onClick={onConfirm}>
                  {t('deleteCategory.confirm')}
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
