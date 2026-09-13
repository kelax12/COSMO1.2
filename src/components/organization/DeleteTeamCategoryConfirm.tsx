import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import type { TeamCategoryImpact } from '@/modules/team-categories';

interface DeleteTeamCategoryConfirmProps {
  open: boolean;
  categoryName: string | undefined;
  impact: TeamCategoryImpact;
  onCancel: () => void;
  onConfirm: () => void;
  isWorking?: boolean;
}

/**
 * Confirmation de suppression d'une catégorie d'entreprise (mig. 148, fusion
 * org_okr_categories + team_categories).
 *
 * ⚠️ Pas de réaffectation à proposer, contrairement au versant personnel
 * (`@/components/category/DeleteCategoryDialog`) : `team_categories` est un
 * vrai FK `ON DELETE SET NULL` pour les tâches, projets ET OKR d'équipe — rien
 * ne pointera jamais dans le vide. Cette boîte annonce l'impact avant de
 * couper l'étiquette, elle ne décide pas d'un remplacement.
 */
const DeleteTeamCategoryConfirm: React.FC<DeleteTeamCategoryConfirmProps> = ({
  open,
  categoryName,
  impact,
  onCancel,
  onConfirm,
  isWorking = false,
}) => {
  const { t } = useT('org');

  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: onCancel,
    labelledBy: 'delete-team-category-title',
  });

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
            ref={modalA11yRef}
            {...modalA11yProps}
            className="bg-[rgb(var(--color-surface))] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-[rgb(var(--color-border))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3
                id="delete-team-category-title"
                className="text-xl font-bold text-[rgb(var(--color-text-primary))] mb-3"
              >
                {t('teamCategory.deleteTitle', { name: categoryName ?? '' })}
              </h3>

              <p className="text-sm leading-relaxed mb-5 text-[rgb(var(--color-text-secondary))]">
                {t('teamCategory.deleteImpact', { projects: impact.projects, tasks: impact.tasks, okrs: impact.okrs })}
                {impact.subcategories > 0 ? t('teamCategory.deleteImpactSubcategories', { count: impact.subcategories }) : ''}
              </p>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 min-h-11" onClick={onCancel} disabled={isWorking}>
                  {t('okrCategory.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 min-h-11 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white"
                  onClick={onConfirm}
                  disabled={isWorking}
                >
                  {t('teamCategory.deleteConfirm')}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeleteTeamCategoryConfirm;
