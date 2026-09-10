import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { useTasks } from '@/modules/tasks';
import { useOkrs } from '@/modules/okrs';
import type { Category } from '@/modules/categories';
import { branchImpact, categoryImpact, NO_CATEGORY } from '@/modules/categories/impact';
import { descendantIdSet } from '@/modules/categories/tree';

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
 *
 * 🔴 SUPPRESSION D'UNE BRANCHE (tâche 10). Une catégorie visée peut porter des
 * sous-catégories. Deux issues, choisies par `childrenMode` :
 *
 * - `promote` (défaut) : les enfants DIRECTS prennent le parent du supprimé,
 *   toute la sous-branche survit avec son contenu intact. C'est l'issue qui
 *   ne détruit rien, donc la moins surprenante — même raisonnement que
 *   `NO_CATEGORY` par défaut pour la réaffectation.
 * - `deleteBranch` : le nœud ET tous ses descendants disparaissent ; leur
 *   contenu (tâches, OKR) est réaffecté comme celui du nœud seul.
 *
 * L'impact annoncé suit le mode choisi : en `promote`, seuls les éléments du
 * nœud visé sont concernés (ses enfants gardent les leurs) ; en
 * `deleteBranch`, l'impact porte sur la BRANCHE ENTIÈRE (`branchImpact`).
 * Annoncer moins que ce qui va réellement disparaître est le défaut R-02,
 * transposé à la profondeur ajoutée par les sous-catégories.
 */
interface DeleteCategoryDialogProps {
  open: boolean;
  /** Catégorie visée. `null` ferme le dialogue. */
  category: Category | null;
  /** Catégories proposées comme destination (la visée est retirée). */
  categories: Category[];
  /**
   * Arbre complet, pour calculer l'impact de la branche.
   *
   * Distinct de `categories` : ce dernier peut déjà exclure des candidats
   * (brouillons non enregistrables comme destination, par exemple), alors que
   * le calcul de descendance a besoin de CHAQUE catégorie du lot en cours
   * d'édition pour suivre correctement les liens `parentId`.
   *
   * ⚠️ Un appelant qui ne SAIT PAS supprimer une branche doit n'y passer que le
   * nœud visé. `OKRPage` est dans ce cas : `useDeleteCategoryFlow` ne supprime
   * qu'un nœud. Lui donner l'arbre entier ferait apparaître le choix
   * « remonter / supprimer la branche » pour une catégorie qui a des enfants,
   * sans que le flux sache l'honorer — on annoncerait un geste qu'on ne fait
   * pas. Restreint au seul nœud, `branchImpact` n'y voit aucun descendant et le
   * choix reste masqué.
   */
  categoriesTree: Category[];
  onCancel: () => void;
  /**
   * `reassignTo` vaut l'id de la catégorie de destination, ou `NO_CATEGORY`
   * (chaîne vide) si les éléments doivent rester sans catégorie.
   *
   * `childrenMode` :
   * - `promote` : les enfants prennent le parent du supprimé.
   * - `deleteBranch` : toute la branche part, son contenu est réaffecté.
   */
  onConfirm: (reassignTo: string, childrenMode: 'promote' | 'deleteBranch') => void;
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
  categoriesTree: Category[];
  onCancel: () => void;
  onConfirm: (reassignTo: string, childrenMode: 'promote' | 'deleteBranch') => void;
  isWorking: boolean;
}> = ({ category, categories, categoriesTree, onCancel, onConfirm, isWorking }) => {
  const ov = useT('overlays');
  const { data: tasks = [] } = useTasks();
  const { data: okrs = [] } = useOkrs();

  // `promote` par défaut : l'issue qui ne détruit rien, la moins surprenante —
  // même raisonnement que `NO_CATEGORY` par défaut pour la réaffectation.
  const [childrenMode, setChildrenMode] = useState<'promote' | 'deleteBranch'>('promote');
  useEffect(() => {
    setChildrenMode('promote');
  }, [category.id]);

  // Impact de la BRANCHE ENTIÈRE (nœud + descendants), calculé dans tous les
  // cas : c'est lui qui dit s'il y a des sous-catégories, donc s'il faut
  // même proposer le choix.
  const branch = useMemo(
    () => branchImpact(category.id, tasks, okrs, categoriesTree),
    [category.id, tasks, okrs, categoriesTree],
  );
  const showChildrenChoice = branch.subcategories > 0;

  // L'impact AFFICHÉ suit le mode choisi : en `promote`, les enfants
  // survivent avec leur contenu, seul le nœud visé perd le sien ; en
  // `deleteBranch`, tout part. Annoncer l'impact de la branche alors que
  // « promote » ne détruit qu'un nœud mentirait dans l'autre sens (R-02
  // existe pour empêcher de sous-annoncer, pas pour sur-annoncer).
  const impact =
    showChildrenChoice && childrenMode === 'deleteBranch'
      ? branch
      : categoryImpact(category.id, tasks, okrs);
  const hasSubcategoryImpact = showChildrenChoice && childrenMode === 'deleteBranch';
  const noImpact = impact.total === 0 && !hasSubcategoryImpact;

  // Destinations proposées : en `deleteBranch`, toute la branche disparaît,
  // donc aucun de ses membres ne peut servir de destination (une sélection
  // pointant dedans retomberait de toute façon sur « aucune catégorie » via
  // `resolveReassignTargets`, mais autant ne pas la proposer). En `promote`,
  // seul le nœud visé disparaît : ses enfants restent des destinations
  // valides, ils survivent juste un cran plus haut.
  const excludedIds = useMemo(() => {
    if (showChildrenChoice && childrenMode === 'deleteBranch') {
      return new Set<string>([category.id, ...descendantIdSet(category.id, categoriesTree)]);
    }
    return new Set<string>([category.id]);
  }, [category.id, categoriesTree, showChildrenChoice, childrenMode]);

  const targets = useMemo(
    () => categories.filter((c) => !excludedIds.has(c.id)),
    [categories, excludedIds],
  );

  // `NO_CATEGORY` par défaut : ne rien reclasser est le comportement le moins
  // surprenant, et c'est aussi ce que faisait l'ancienne suppression — à ceci
  // près que c'était subi, alors que c'est maintenant choisi.
  const [reassignTo, setReassignTo] = useState<string>(NO_CATEGORY);
  useEffect(() => {
    setReassignTo(NO_CATEGORY);
  }, [category.id]);

  // Changer de mode peut retirer la destination choisie de `targets` (un
  // descendant devient invalide en passant en `deleteBranch`) : la remettre à
  // « aucune catégorie » plutôt que garder une sélection qui n'est plus
  // proposée mais résoudrait quand même vers `NO_CATEGORY` en silence.
  useEffect(() => {
    if (reassignTo !== NO_CATEGORY && excludedIds.has(reassignTo)) {
      setReassignTo(NO_CATEGORY);
    }
  }, [excludedIds, reassignTo]);

  const showReassign = impact.total > 0 && targets.length > 0;

  // C-53 — le corps n'est monte que lorsque la boite est ouverte.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: onCancel,
    labelledBy: 'delete-category-title',
  });

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
            ref={modalA11yRef}
            {...modalA11yProps}
            className="bg-[rgb(var(--color-surface))] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-[rgb(var(--color-border))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3
                id="delete-category-title"
                className="text-xl font-bold text-[rgb(var(--color-text-primary))] mb-3"
              >
                {ov.t('deleteCategory.title', { name: category.name })}
              </h3>

              {/* L'impact AVANT la question : on ne demande pas de décider sans
                  avoir dit ce qui est en jeu. Réactif au mode choisi plus bas
                  (`childrenMode`) : « remonter » n'affecte que le nœud visé,
                  « supprimer la branche » affecte tout ce qu'elle contient. */}
              <div className="text-sm leading-relaxed mb-5 space-y-1 text-[rgb(var(--color-text-secondary))]">
                {noImpact ? (
                  <p>{ov.t('deleteCategory.noImpact')}</p>
                ) : (
                  <>
                    {hasSubcategoryImpact && (
                      <p>{ov.tp('deleteCategory.impactSubcategories', branch.subcategories)}</p>
                    )}
                    {impact.tasks > 0 && <p>{ov.tp('deleteCategory.impactTasks', impact.tasks)}</p>}
                    {impact.okrs > 0 && <p>{ov.tp('deleteCategory.impactOkrs', impact.okrs)}</p>}
                  </>
                )}
              </div>

              {showChildrenChoice && (
                <fieldset className="mb-6 space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
                    {ov.t('deleteCategory.childrenLabel')}
                  </legend>

                  <label className="flex items-center gap-2.5 text-sm text-[rgb(var(--color-text-primary))] cursor-pointer min-h-11">
                    <input
                      type="radio"
                      name="children-mode"
                      className="accent-[rgb(var(--color-accent-solid))]"
                      checked={childrenMode === 'promote'}
                      onChange={() => setChildrenMode('promote')}
                    />
                    {ov.t('deleteCategory.childrenPromote')}
                  </label>

                  <label className="flex items-center gap-2.5 text-sm text-[rgb(var(--color-text-primary))] cursor-pointer min-h-11">
                    <input
                      type="radio"
                      name="children-mode"
                      className="accent-[rgb(var(--color-accent-solid))]"
                      checked={childrenMode === 'deleteBranch'}
                      onChange={() => setChildrenMode('deleteBranch')}
                    />
                    {ov.t('deleteCategory.childrenDeleteBranch')}
                  </label>
                </fieldset>
              )}

              {showReassign && (
                <fieldset className="mb-6 space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
                    {ov.t('deleteCategory.reassignLabel')}
                  </legend>

                  <label className="flex items-center gap-2.5 text-sm text-[rgb(var(--color-text-primary))] cursor-pointer min-h-11">
                    <input
                      type="radio"
                      name="reassign"
                      className="accent-[rgb(var(--color-accent-solid))]"
                      checked={reassignTo === NO_CATEGORY}
                      onChange={() => setReassignTo(NO_CATEGORY)}
                    />
                    {ov.t('deleteCategory.reassignNone')}
                  </label>

                  <label className="flex items-center gap-2.5 text-sm text-[rgb(var(--color-text-primary))] cursor-pointer min-h-11">
                    <input
                      type="radio"
                      name="reassign"
                      className="accent-[rgb(var(--color-accent-solid))]"
                      checked={reassignTo !== NO_CATEGORY}
                      onChange={() => setReassignTo(targets[0].id)}
                    />
                    {ov.t('deleteCategory.reassignTo')}
                  </label>

                  {reassignTo !== NO_CATEGORY && (
                    <select
                      aria-label={ov.t('deleteCategory.reassignPick')}
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
                  {ov.t('deleteCategory.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 min-h-11 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white"
                  onClick={() => onConfirm(reassignTo, childrenMode)}
                  disabled={isWorking}
                >
                  {isWorking ? ov.t('deleteCategory.working') : ov.t('deleteCategory.confirm')}
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
  categoriesTree,
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
          categoriesTree={categoriesTree}
          onCancel={onCancel}
          onConfirm={onConfirm}
          isWorking={isWorking}
        />
      )}
    </AnimatePresence>
  );
};

export default DeleteCategoryDialog;
