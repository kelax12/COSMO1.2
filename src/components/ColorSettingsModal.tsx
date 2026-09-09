import React, { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useMoveCategory,
  useDeleteCategory,
  Category,
  buildTree,
  CategoryNode,
  CATEGORY_MAX_DEPTH,
  DEFAULT_CATEGORY_COLOR,
} from '@/modules/categories';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { useTasks } from '@/modules/tasks';
import { useOkrs } from '@/modules/okrs';
import { resolveReassignTargets } from '@/modules/categories/impact';
import { useReassignCategory } from '@/modules/categories/useReassignCategory';
import DeleteCategoryDialog from '@/components/category/DeleteCategoryDialog';
import CategoryTreeRow from '@/components/category/CategoryTreeRow';
import MoveCategoryDialog from '@/components/category/MoveCategoryDialog';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { useCollapsedCategories } from '@/modules/ui-states';

type ColorSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isNested?: boolean;
};

/**
 * Contenu de la modale — monté UNIQUEMENT quand elle est ouverte.
 *
 * 🔴 POURQUOI cette coupure. Cinq écrans montent `<ColorSettingsModal>` en
 * permanence (TasksSummary, EventModal, HabitModal, TaskModal, OKRModalSheet) :
 * tant que les requêtes vivaient au-dessus du `if (!isOpen)`, une lecture des
 * OKR partait depuis les pages Tâches, Agenda et Habitudes, qui n'en affichent
 * aucun, pour une modale que personne n'avait ouverte.
 *
 * Second effet, tout aussi voulu : l'état local meurt à la fermeture. Avant, des
 * suppressions mises en attente puis abandonnées (fermeture sans enregistrer)
 * survivaient à la réouverture, et repartaient à la sauvegarde suivante.
 */
const ColorSettingsModalContent: React.FC<Omit<ColorSettingsModalProps, 'isOpen'>> = ({ onClose, isNested }) => {
  const { t } = useT('tasks');
  const { t: tCommon } = useT('common');
  const { tp: tpOv } = useT('overlays');
  const { data: tasks = [] } = useTasks();
  const { data: okrs = [] } = useOkrs();
  const reassignCategory = useReassignCategory();
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  // C-53 — modale montee par-dessus EventModal / HabitModal, en FRERE de leur
  // overlay. Le composant n'est monte QUE lorsqu'il est ouvert (cf. le wrapper
  // en bas de fichier), d'ou `open: true`.
  const { ref: overlayRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose,
    label: t('colorModal.title'),
  });
  const sheetMotion = useSheetMotion();
  const { isCollapsed, setCollapsed } = useCollapsedCategories();
  const { data: categories = [] } = useCategories();
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const moveCategoryMutation = useMoveCategory();
  const deleteCategoryMutation = useDeleteCategory();

  // Initialize directly from cached data so the list is populated on first
  // render when categories are already in the React Query cache.
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  // « Déplacer vers… » (tâche 9) : la modale reste un éditeur par lot, donc la
  // confirmation ne fait QUE modifier `localCategories` — rien ne part au
  // serveur avant « Enregistrer ». C'est `handleSave` qui écrit le déplacement,
  // via `useMoveCategory` (voir plus bas).
  const [categoryToMove, setCategoryToMove] = useState<string | null>(null);
  // R-02 : ou partent les elements d'une categorie retiree, par categorie.
  // La modale met les suppressions EN ATTENTE jusqu'a l'enregistrement : la
  // decision de reclassement doit donc etre memorisee avec elles, sinon elle
  // serait prise puis perdue.
  const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync local state with fetched categories
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // Une categorie encore en brouillon (`temp-`) n'existe pas cote serveur : la
  // proposer comme destination ferait pointer des elements vers un identifiant
  // qui ne sera jamais celui de la ligne creee.
  const reassignOptions = localCategories.filter((c) => !c.id.startsWith('temp-'));

  // Aplatit l'arbre en lignes visibles (ordre d'affichage, profondeur, a-t-il
  // des enfants), en s'arrêtant sous une catégorie repliée. `AnimatePresence`
  // a besoin d'une liste À PLAT pour suivre proprement l'entrée/sortie de
  // chaque ligne : une récursion qui rendrait directement les enfants casserait
  // ce suivi, chaque niveau devenant un ensemble d'enfants distinct.
  const flattenVisible = (nodes: CategoryNode[], depth: number, out: Array<{ category: Category; depth: number; hasChildren: boolean }>) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      out.push({ category: node.category, depth, hasChildren });
      if (hasChildren && !isCollapsed(node.category.id)) {
        flattenVisible(node.children, depth + 1, out);
      }
    }
  };
  const visibleRows: Array<{ category: Category; depth: number; hasChildren: boolean }> = [];
  flattenVisible(buildTree(localCategories), 1, visibleRows);

  const handleAddCategory = (parentId: string | null = null) => {
    const newId = `temp-${Date.now()}`;
    const parent = parentId ? localCategories.find((c) => c.id === parentId) : undefined;
    const newCat: Category = {
      id: newId,
      name: '',
      // Couleur héritée du parent : une famille se lit à la teinte. Une
      // racine sans parent reprend la couleur par défaut du module.
      color: parent?.color ?? DEFAULT_CATEGORY_COLOR,
      parentId,
      position: localCategories.filter((c) => c.parentId === parentId).length,
    };
    setLocalCategories([...localCategories, newCat]);
    // Un enfant né replié serait invisible sous son parent : le déplier.
    if (parentId) setCollapsed(parentId, false);

    setTimeout(() => {
      const row = scrollRef.current?.querySelector<HTMLElement>(`[data-category-id="${newId}"]`);
      row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      row?.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
    }, 100);
  };

  const handleUpdateLocal = (id: string, updates: Partial<{ name: string; color: string }>) => {
    setLocalCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...updates } : cat));
  };

  const handleDeleteLocal = (id: string) => {
    setCategoryToDelete(id);
  };

  const confirmDeleteLocal = (reassignTo: string) => {
    if (categoryToDelete) {
      setReassignTargets(prev => ({ ...prev, [categoryToDelete]: reassignTo }));
      setLocalCategories(prev => prev.filter(cat => cat.id !== categoryToDelete));
      setCategoryToDelete(null);
    }
  };

  // « Déplacer vers… » — ne touche QUE l'état local (cf. commentaire sur
  // `categoryToMove`). La position choisie est la fin de la nouvelle fratrie :
  // le menu ne propose pas de rang, seulement une destination, exactement
  // comme `handleAddCategory` place une nouvelle catégorie en dernier.
  const confirmMoveLocal = (parentId: string | null) => {
    if (!categoryToMove) return;
    setLocalCategories(prev => {
      const siblingsCount = prev.filter(
        (c) => c.parentId === parentId && c.id !== categoryToMove,
      ).length;
      return prev.map((c) =>
        c.id === categoryToMove ? { ...c, parentId, position: siblingsCount } : c,
      );
    });
    setCategoryToMove(null);
  };

  const handleSave = async () => {
    // Validation : chaque nom de catégorie doit faire ≥ 2 caractères
    const invalid = localCategories.find(lc => lc.name.trim().length < 2);
    if (invalid) {
      toast.error(t('colorModal.nameTooShort'));
      return;
    }

    setIsSaving(true);
    try {
      // R-02 : reaffecter AVANT de supprimer. L'ordre inverse laisserait une
      // fenetre ou les elements pointent dans le vide, et un echec du
      // reclassement deviendrait irrattrapable : plus rien ne dirait quels
      // elements portaient la categorie disparue.
      const removed = categories.filter(cat => !localCategories.find(lc => lc.id === cat.id));
      // On peut supprimer DEUX categories d'un coup et designer la seconde comme
      // destination de la premiere. `resolveReassignTargets` suit la chaine
      // jusqu'a une categorie qui survit : sans lui, des elements partaient vers
      // une categorie supprimee une ligne plus bas, et l'instantane `tasks` ne
      // les montrait deja plus sous leur ancienne categorie au tour suivant.
      const finalTargets = resolveReassignTargets(removed.map(c => c.id), reassignTargets);
      let movedTotal = 0;
      for (const cat of removed) {
        const { moved } = await reassignCategory(cat.id, finalTargets[cat.id], tasks, okrs);
        movedTotal += moved;
      }

      const deletePromises = removed.map(cat => deleteCategoryMutation.mutateAsync(cat.id));

      // Create or update categories
      const savePromises = localCategories.map(lc => {
        const existing = categories.find(cat => cat.id === lc.id);
        if (existing) {
          // Update existing category
          if (existing.name !== lc.name || existing.color !== lc.color) {
            return updateCategoryMutation.mutateAsync({
              id: lc.id,
              updates: { name: lc.name, color: lc.color }
            });
          }
          return Promise.resolve();
        } else {
          // Create new category (temp IDs start with 'temp-')
          return createCategoryMutation.mutateAsync({
            name: lc.name,
            color: lc.color
          });
        }
      });

      // « Déplacer vers… » (tâche 9) écrit ici, à l'enregistrement — jamais à
      // la confirmation du dialogue, qui ne fait que muter `localCategories`.
      // `useMoveCategory` est LA mutation dédiée au reparentage ET au
      // réordonnancement : on la distingue de la mise à jour nom/couleur
      // ci-dessus, qu'elle ne touche jamais, même si les deux ont changé pour
      // la même catégorie dans le même lot (deux écritures sur des colonnes
      // disjointes, sans conflit).
      const movePromises = localCategories
        .filter((lc) => !lc.id.startsWith('temp-'))
        .filter((lc) => {
          const existing = categories.find((cat) => cat.id === lc.id);
          return !!existing && (existing.parentId !== lc.parentId || existing.position !== lc.position);
        })
        .map((lc) => moveCategoryMutation.mutateAsync({ id: lc.id, parentId: lc.parentId, position: lc.position }));

      await Promise.all([...deletePromises, ...savePromises, ...movePromises]);
      // Le message de reclassement part APRES les ecritures : annoncer un
      // deplacement avant de savoir si la suppression aboutit, c'est promettre
      // un resultat qu'on n'a pas encore.
      if (movedTotal > 0) toast.success(tpOv('deleteCategory.doneReassigned', movedTotal));
      onClose();
    } catch (error) {
      // Un echec avale en silence laissait l'utilisateur devant une modale qui
      // ne se ferme pas, sans un mot. La reaffectation ayant lieu AVANT les
      // suppressions, un echec de reclassement ne supprime rien ; un echec plus
      // tard peut laisser une partie du lot ecrite. Dans les deux cas la modale
      // reste ouverte sur l'etat local, donc rejouable.
      console.error('Error saving categories:', error);
      toast.error(tCommon('pageError.hint'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      {...dialogProps}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:px-4 pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-md"
        onClick={onClose}
      />

        <motion.div
          ref={sheetRef}
          {...sheetDragProps}
          {...sheetMotion}
            className={`relative w-full overflow-hidden rounded-t-[28px] sm:rounded-[20px] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl border-t sm:border border-[rgb(var(--color-border))] transition-all flex flex-col max-h-[88vh] sm:max-h-[85vh] ${
              isNested ? 'sm:max-w-[510px]' : 'sm:max-w-[572px]'
            }`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Drag handle — reacts to swipe on mobile */}
          <div className="sm:hidden flex justify-center pt-4 pb-3 shrink-0">
            <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-[0.420204rem] sm:py-[0.560272rem] border-b border-[rgb(var(--color-border))] shrink-0">
            <h2 className="text-base sm:text-xl font-medium text-[rgb(var(--color-text-primary))]">{t('colorModal.title')}</h2>
            <button
              onClick={onClose}
              aria-label={tCommon('actions.close')}
              className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:text-blue-600 hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <X size={22} strokeWidth={2.5} />
            </button>
          </div>

          <div
            ref={scrollRef}
            data-scroll-area
            className="px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto flex-1 custom-scrollbar scroll-smooth"
            style={{ backgroundColor: 'rgb(var(--color-surface))' }}
          >
            <div className="flex justify-end mb-4">
              <button
                onClick={() => handleAddCategory()}
                aria-label={t('colorModal.addRoot')}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full shadow-sm"
              >
                <Plus size={24} strokeWidth={3} />
              </button>
            </div>

            {/* Arbre des catégories. Rôles ARIA portés par le conteneur et par
                chaque `CategoryTreeRow` (treeitem/aria-level/aria-expanded) :
                sans eux un lecteur d'écran lit une liste plate. */}
            <div role="tree" aria-label={t('colorModal.title')} className="space-y-1">
              <AnimatePresence mode="popLayout">
                {visibleRows.map(({ category, depth, hasChildren }) => (
                  <motion.div
                    key={category.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <CategoryTreeRow
                      id={category.id}
                      name={category.name}
                      color={category.color}
                      depth={depth}
                      hasChildren={hasChildren}
                      isExpanded={!isCollapsed(category.id)}
                      onToggle={() => setCollapsed(category.id, !isCollapsed(category.id))}
                      onNameChange={(name) => handleUpdateLocal(category.id, { name })}
                      onColorChange={(color) => handleUpdateLocal(category.id, { color })}
                      onAddChild={() => handleAddCategory(category.id)}
                      onMove={() => setCategoryToMove(category.id)}
                      onDelete={() => handleDeleteLocal(category.id)}
                      atMaxDepth={depth >= CATEGORY_MAX_DEPTH}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

            <div className="px-4 sm:px-6 pt-[0.6555rem] pb-[0.6555rem] sm:pb-[1.311rem] border-t border-[rgb(var(--color-border))] shrink-0 flex justify-center">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:w-48 min-h-11 py-3 bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20 flex items-center justify-center"
              >
                {isSaving ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  tCommon('actions.save')
                )}
              </button>
            </div>

        </motion.div>

        {/* Une seule confirmation de suppression de categorie dans tout le
            produit : la reecrire ici a la main, c'etait deux ecrans a maintenir
            pour la meme decision, et deux occasions de les laisser diverger. */}
        <DeleteCategoryDialog
          open={!!categoryToDelete}
          category={localCategories.find(c => c.id === categoryToDelete) ?? null}
          categories={reassignOptions}
          onCancel={() => setCategoryToDelete(null)}
          onConfirm={confirmDeleteLocal}
        />

        {/* Rendue en FRÈRE de l'overlay ci-dessus : `useModalA11y` empile les
            surfaces (`openStack`), seule la dernière ouverte réagit à Échap. */}
        <MoveCategoryDialog
          open={!!categoryToMove}
          category={localCategories.find(c => c.id === categoryToMove) ?? null}
          categories={localCategories}
          onCancel={() => setCategoryToMove(null)}
          onConfirm={confirmMoveLocal}
        />
    </div>
  );
};

const ColorSettingsModal: React.FC<ColorSettingsModalProps> = ({ isOpen, onClose, isNested }) =>
  isOpen ? <ColorSettingsModalContent onClose={onClose} isNested={isNested} /> : null;

export default ColorSettingsModal;
