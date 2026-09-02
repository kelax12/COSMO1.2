import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';
import { useTasks } from '@/modules/tasks';
import { useOkrs } from '@/modules/okrs';
import type { Category } from '@/modules/categories';
import { categoryImpact, NO_CATEGORY } from '@/modules/categories/impact';

/**
 * Confirmation de suppression d'une catégorie — avec impact et réaffectation.
 *
 * 🔴 POURQUOI (risque R-02). Aucune clé étrangère ne pointe vers
 * `categories` : supprimer une catégorie laissait un identifiant mort dans
 * chaque tâche et chaque objectif qui la portait, sans avertissement. Mesuré
 * avant correctif : 13 tâches et 2 objectifs déjà orphelins en production.
 * L'ancienne confirmation DÉCRIVAIT même le défaut (« conserveront leur
 * catégorie mais ne seront plus filtrables ») sans rien proposer.
 *
 * Le dialogue répond maintenant à deux questions avant d'agir : combien
 * d'éléments sont concernés, et où ils doivent aller.
 *
 * ⚠️ La réaffectation est exécutée par l'APPELANT (`onConfirm` reçoit la cible),
 * parce que les deux points d'entrée n'écrivent pas au même moment : la
 * confirmation OKR supprime tout de suite, la modale de couleurs met en
 * attente jusqu'à l'enregistrement. Ce composant décide, il n'écrit pas.
 */
interface DeleteCategoryDialogProps {
  open: boolean;
  /** Catégorie visée. `null` ferme le dialogue. */
  category: Category | null;
  /** Catégories proposées comme destination (la visée est retirée). */
  categories: Category[];
  onCancel: () => void;
  /**
   * `reassignTo` vaut l'id de la catégorie de destination, ou `NO_CATEGORY`
   * (chaîne vide) si les éléments doivent rester sans catégorie.
   */
  onConfirm: (reassignTo: string) => void;
  isWorking?: boolean;
}

/**
 * Corps du dialogue — monté UNIQUEMENT pendant qu'il est ouvert.
 *
 * 🔴 POURQUOI cette coupure. `useTasks()` et `useOkrs()` vivent ici, pas dans le
 * composant exporté. Le dialogue est rendu en permanence par sa page (c'est
 * `open` qui le masque) : garder les requêtes au-dessus faisait partir une
 * lecture des OKR sur des écrans qui n'en affichent aucun, pour une modale que
 * personne n'a ouverte. Le projet a supprimé huit sondages permanents pour cette
 * raison exacte ; on ne les remplace pas par des lectures fantômes.
 */
const DeleteCategoryDialogBody: React.FC<{
  category: Category;
  categories: Category[];
  onCancel: () => void;
  onConfirm: (reassignTo: string) => void;
  isWorking: boolean;
}> = ({ category, categories, onCancel, onConfirm, isWorking }) => {
  const { t, tp } = useT('common');
  const { data: tasks = [] } = useTasks();
  const { data: okrs = [] } = useOkrs();

  const impact = useMemo(
    () => categoryImpact(category.id, tasks, okrs),
    [category.id, tasks, okrs],
  );

  const targets = useMemo(
    () => categories.filter((c) => c.id !== category.id),
    [categories, category.id],
  );

  // `NO_CATEGORY` par défaut : ne rien reclasser est le comportement le moins
  // surprenant, et c'est aussi ce que faisait l'ancienne suppression — à ceci
  // près que c'était subi, alors que c'est maintenant choisi.
  const [reassignTo, setReassignTo] = useState<string>(NO_CATEGORY);
  useEffect(() => {
    setReassignTo(NO_CATEGORY);
  }, [category.id]);

  const showReassign = impact.total > 0 && targets.length > 0;

  return (
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
            aria-labelledby="delete-category-title"
            className="bg-[rgb(var(--color-surface))] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-[rgb(var(--color-border))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3
                id="delete-category-title"
                className="text-xl font-bold text-[rgb(var(--color-text-primary))] mb-3"
              >
                {t('deleteCategory.title', { name: category.name })}
              </h3>

              {/* L'impact AVANT la question : on ne demande pas de décider sans
                  avoir dit ce qui est en jeu. */}
              <div className="text-sm leading-relaxed mb-5 space-y-1 text-[rgb(var(--color-text-secondary))]">
                {impact.total === 0 ? (
                  <p>{t('deleteCategory.noImpact')}</p>
                ) : (
                  <>
                    {impact.tasks > 0 && <p>{tp('deleteCategory.impactTasks', impact.tasks)}</p>}
                    {impact.okrs > 0 && <p>{tp('deleteCategory.impactOkrs', impact.okrs)}</p>}
                  </>
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
                      name="reassign"
                      className="accent-[rgb(var(--color-accent-solid))]"
                      checked={reassignTo === NO_CATEGORY}
                      onChange={() => setReassignTo(NO_CATEGORY)}
                    />
                    {t('deleteCategory.reassignNone')}
                  </label>

                  <label className="flex items-center gap-2.5 text-sm text-[rgb(var(--color-text-primary))] cursor-pointer min-h-11">
                    <input
                      type="radio"
                      name="reassign"
                      className="accent-[rgb(var(--color-accent-solid))]"
                      checked={reassignTo !== NO_CATEGORY}
                      onChange={() => setReassignTo(targets[0].id)}
                    />
                    {t('deleteCategory.reassignTo')}
                  </label>

                  {reassignTo !== NO_CATEGORY && (
                    <select
                      aria-label={t('deleteCategory.reassignPick')}
                      value={reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                      className="w-full min-h-11 rounded-xl border px-3 text-sm bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]"
                    >
                      {targets.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
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
  );
};

/**
 * Enveloppe : décide de la présence du dialogue, et fait jouer sa sortie.
 *
 * La catégorie est retenue le temps de l'animation (`shown`) parce que les
 * appelants remettent `category` à `null` en même temps qu'ils ferment : sans
 * ce rappel, `AnimatePresence` n'avait plus rien à faire sortir et la modale
 * disparaissait d'un coup.
 */
const DeleteCategoryDialog: React.FC<DeleteCategoryDialogProps> = ({
  open,
  category,
  categories,
  onCancel,
  onConfirm,
  isWorking = false,
}) => {
  const [lastCategory, setLastCategory] = useState<Category | null>(category);
  useEffect(() => {
    if (category) setLastCategory(category);
  }, [category]);

  const shown = category ?? lastCategory;

  return (
    <AnimatePresence>
      {open && shown && (
        <DeleteCategoryDialogBody
          key={shown.id}
          category={shown}
          categories={categories}
          onCancel={onCancel}
          onConfirm={onConfirm}
          isWorking={isWorking}
        />
      )}
    </AnimatePresence>
  );
};

export default DeleteCategoryDialog;
