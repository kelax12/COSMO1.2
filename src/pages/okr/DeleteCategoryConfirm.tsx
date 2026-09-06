import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';
import { NO_ORG_OKR_CATEGORY } from '@/modules/org-okr-categories/impact';

interface DeleteCategoryConfirmProps {
  open: boolean;
  categoryName: string | undefined;
  /** Objectifs d'équipe qui portent cette catégorie (impact mesuré par l'appelant). */
  impactedOkrs: number;
  /**
   * NOMS des catégories qui survivent, proposées comme destination.
   *
   * Des noms et non des identifiants : `team_okrs.category` porte le nom
   * (mig. 078), et c'est cette valeur-là que la réaffectation écrit.
   */
  targetNames: string[];
  onCancel: () => void;
  /** `reassignTo` vaut un nom de catégorie, ou la chaîne vide pour « aucune ». */
  onConfirm: (reassignTo: string) => void;
  isWorking?: boolean;
}

// Dialog de confirmation de suppression d'une categorie OKR d'EQUIPE.
//
// 🔴 POURQUOI il annonce un impact (item C-02, jumeau entreprise de R-02).
// Rien ne pointe vers `org_okr_categories` par cle etrangere : supprimer une
// categorie laissait un NOM mort dans chaque OKR d'equipe qui la portait, sans
// avertissement et sans reparation possible. La confirmation DECRIVAIT meme le
// defaut (« les OKR associes conserveront leur categorie mais ne seront plus
// filtrables ») sans rien proposer.
//
// ⚠️ Ne PAS l'utiliser pour les categories personnelles : celles-ci passent par
// `@/components/category/DeleteCategoryDialog`. Les deux ne visent pas la meme
// table : ici `org_okr_categories`, la-bas `categories`.
//
// ⚠️ Ce composant DECIDE, il n'ecrit pas : la reaffectation puis la suppression
// sont executees par `useDeleteOrgOKRCategoryFlow`, dans cet ordre.
const DeleteCategoryConfirm: React.FC<DeleteCategoryConfirmProps> = ({
  open,
  categoryName,
  impactedOkrs,
  targetNames,
  onCancel,
  onConfirm,
  isWorking = false,
}) => {
  const { t, tp } = useT('okr');

  // « Aucune catégorie » par défaut : ne rien reclasser est le comportement le
  // moins surprenant, et c'est aussi ce que faisait l'ancienne suppression, à
  // ceci près que c'était subi alors que c'est maintenant choisi.
  const [reassignTo, setReassignTo] = useState<string>(NO_ORG_OKR_CATEGORY);
  useEffect(() => {
    setReassignTo(NO_ORG_OKR_CATEGORY);
  }, [categoryName]);

  const showReassign = impactedOkrs > 0 && targetNames.length > 0;

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
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-org-okr-category-title"
            className="bg-[rgb(var(--color-surface))] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-[rgb(var(--color-border))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3
                id="delete-org-okr-category-title"
                className="text-xl font-bold text-[rgb(var(--color-text-primary))] mb-3"
              >
                {t('deleteCategory.title', { name: categoryName ?? '' })}
              </h3>

              {/* L'impact AVANT la question : on ne demande pas de décider sans
                  avoir dit ce qui est en jeu. */}
              <div className="text-sm leading-relaxed mb-5 text-[rgb(var(--color-text-secondary))]">
                {impactedOkrs === 0 ? (
                  <p>{t('deleteCategory.noImpact')}</p>
                ) : (
                  <p>{tp('deleteCategory.impactOkrs', impactedOkrs)}</p>
                )}
              </div>

              {showReassign && (
                <fieldset className="mb-6 space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
                    {t('deleteCategory.reassignLabel')}
                  </legend>

                  <label className="flex items-center gap-2.5 text-sm text-[rgb(var(--color-text-primary))] cursor-pointer min-h-11">
                    <input
                      type="radio"
                      name="reassign-org-okr-category"
                      className="accent-[rgb(var(--color-accent-solid))]"
                      checked={reassignTo === NO_ORG_OKR_CATEGORY}
                      onChange={() => setReassignTo(NO_ORG_OKR_CATEGORY)}
                    />
                    {t('deleteCategory.reassignNone')}
                  </label>

                  <label className="flex items-center gap-2.5 text-sm text-[rgb(var(--color-text-primary))] cursor-pointer min-h-11">
                    <input
                      type="radio"
                      name="reassign-org-okr-category"
                      className="accent-[rgb(var(--color-accent-solid))]"
                      checked={reassignTo !== NO_ORG_OKR_CATEGORY}
                      onChange={() => setReassignTo(targetNames[0])}
                    />
                    {t('deleteCategory.reassignTo')}
                  </label>

                  {reassignTo !== NO_ORG_OKR_CATEGORY && (
                    <select
                      aria-label={t('deleteCategory.reassignPick')}
                      value={reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                      className="w-full min-h-11 rounded-xl border px-3 text-sm bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]"
                    >
                      {targetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  )}
                </fieldset>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 min-h-11" onClick={onCancel} disabled={isWorking}>
                  {t('deleteCategory.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 min-h-11 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white"
                  onClick={() => onConfirm(reassignTo)}
                  disabled={isWorking}
                >
                  {isWorking ? t('deleteCategory.working') : t('deleteCategory.confirm')}
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
