// Feuille de confirmation de suppression d'un objectif (OKR) — extraite verbatim de OKRPage.
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';
import { useSheetDrag, useSheetMotion } from '@/components/mobile/mobile-motion';

interface DeleteObjectiveConfirmProps {
  deletingObjective: string | null;
  setDeletingObjective: React.Dispatch<React.SetStateAction<string | null>>;
  deleteObjective: (objectiveId: string) => void;
}

const DeleteObjectiveConfirm: React.FC<DeleteObjectiveConfirmProps> = ({ deletingObjective, setDeletingObjective, deleteObjective }) => {
  const { t } = useT('okr');
  const sheetDrag = useSheetDrag(() => setDeletingObjective(null));
  const sheetMotion = useSheetMotion();
  return (
        <AnimatePresence>
          {deletingObjective && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/30 dark:bg-slate-950/50 backdrop-blur-md flex items-end sm:items-center justify-center z-[60] sm:p-4"
              onClick={() => setDeletingObjective(null)}
            >
              <motion.div
                {...sheetMotion}
                // La poignee ci-dessous promettait un geste qui n existait pas
                // (audit mobile 2026-08-14 : cinq feuilles dans ce cas). Une
                // affordance qui ment est pire que pas d affordance.
                {...sheetDrag}
                className="bg-[rgb(var(--color-surface))] rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border border-[rgb(var(--color-border))]"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sm:hidden flex justify-center pt-4 pb-3">
                  <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
                </div>
                <div className="p-5 sm:p-6">
                  {/* Icône retirée sur mobile (demande utilisateur) : le
                      titre + le corps portent déjà l'information. Desktop
                      inchangé. */}
                  <div className="hidden sm:flex w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-4">
                    <Trash2 className="text-red-600 dark:text-red-400" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('deleteObjective.title')}</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                    {t('deleteObjective.body')}
                  </p>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                    <Button variant="outline" className="flex-1 min-h-11" onClick={() => setDeletingObjective(null)}>
                      {t('deleteObjective.cancel')}
                    </Button>
                    <Button variant="destructive" className="flex-1 min-h-11 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white" onClick={() => deleteObjective(deletingObjective)}>
                      {t('deleteObjective.confirm')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
  );
};

export default DeleteObjectiveConfirm;
