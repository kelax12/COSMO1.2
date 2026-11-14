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
  orderByDepth,
} from '@/modules/categories';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/lib/toast';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { useOkrs } from '@/modules/okrs';
import { resolveReassignTargets } from '@/modules/categories/impact';
import { descendantIdSet } from '@/modules/categories/tree';
import { useReassignCategory } from '@/modules/categories/useReassignCategory';
import DeleteCategoryDialog from '@/components/category/DeleteCategoryDialog';
import CategoryTreeRow from '@/components/category/CategoryTreeRow';
import CategoryManageCascade from '@/components/category/CategoryManageCascade';
import { useCascadePath } from '@/components/category/use-cascade-path';
import { draftSnapshot as snapshot, moveAmongSiblings, siblingsOf } from '@/components/category/reorder';
import { useCanHover } from '@/hooks/use-can-hover';
import ConfirmDiscardDialog from '@/components/ConfirmDiscardDialog';
import MoveCategoryDialog from '@/components/category/MoveCategoryDialog';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { useCollapsedCategories } from '@/modules/categories/collapsed.store';

type ColorSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isNested?: boolean;
};

/**
 * Plan d'écriture d'un lot de créations. Un enfant du MÊME lot porte un `parentId` en `temp-` sans ligne serveur : on crée par niveau (`orderByDepth`, lève sur cycle) et `handleSave` substitue chaque `temp-` par l'identifiant réel du parent.
 */
export function planCreations(drafts: readonly Category[]): Category[] {
  return orderByDepth(drafts.filter((c) => c.id.startsWith('temp-')));
}

/**
 * Ordre d'écriture d'un lot de SUPPRESSIONS : feuilles vers racine. La FK `categories.parent_id` est `ON DELETE NO ACTION` (mig. 143), vérifiée à la fin de CHAQUE instruction, et l'app supprime par catégorie : un parent avant ses enfants échoue. On INVERSE `orderByDepth` plutôt que d'écrire un second tri.
 */
export function planDeletions(removed: readonly Category[]): Category[] {
  return [...orderByDepth(removed)].reverse();
}

/**
 * Contenu de la modale, monté UNIQUEMENT à l'ouverture : les requêtes (OKR) ne partent pas des cinq écrans qui montent la modale en permanence, et l'état local (suppressions en attente) meurt à la fermeture.
 */
/**
 * Ce que la suppression de `targetId` fait à la liste EN COURS D'ÉDITION. Fonction pure (vérifiable sans écran) : c'est le seul endroit où se tromper DÉTRUIT des données.
 * `promote` : les enfants DIRECTS prennent le parent du supprimé ; `handleSave` écrit ce `parentId` AVANT la suppression (mig. 143). `deleteBranch` : le nœud ET ses descendants partent.
 */
export function applyDeleteToDrafts(
  drafts: readonly Category[],
  targetId: string,
  childrenMode: 'promote' | 'deleteBranch',
): { next: Category[]; removedIds: string[] } {
  if (childrenMode === 'deleteBranch') {
    const removedIds = [targetId, ...descendantIdSet(targetId, drafts)];
    const gone = new Set(removedIds);
    return { next: drafts.filter((cat) => !gone.has(cat.id)), removedIds };
  }

  const parentId = drafts.find((c) => c.id === targetId)?.parentId ?? null;
  return {
    next: drafts
      .filter((cat) => cat.id !== targetId)
      .map((cat) => (cat.parentId === targetId ? { ...cat, parentId } : cat)),
    removedIds: [targetId],
  };
}

const ColorSettingsModalContent: React.FC<Omit<ColorSettingsModalProps, 'isOpen'>> = ({ onClose, isNested }) => {
  const { t } = useT('tasks');
  const { t: tCommon } = useT('common');
  const { tp: tpOv } = useT('overlays');
  const { data: okrs = [] } = useOkrs();
  const reassignCategory = useReassignCategory();

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
  // « Déplacer vers… » : la confirmation ne modifie QUE `localCategories` ; `handleSave` écrit via `useMoveCategory`.
  const [categoryToMove, setCategoryToMove] = useState<string | null>(null);
  // R-02 : où partent les éléments d'une catégorie retirée. Mémorisé avec les suppressions en attente jusqu'à l'enregistrement.
  const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Fermer avec des changements non enregistrés (ordre, noms, couleurs…)
  // demande confirmation : ils vivent en brouillon jusqu'à « Enregistrer ».
  const guardedClose = () => (snapshot(localCategories) !== snapshot(categories) ? setConfirmDiscard(true) : onClose());
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(guardedClose);
  // C-53 — modale montee par-dessus EventModal / HabitModal, en FRERE de leur
  // overlay. Le composant n'est monte QUE lorsqu'il est ouvert (cf. le wrapper
  // en bas de fichier), d'ou `open: true`.
  const { ref: overlayRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: guardedClose,
    label: t('colorModal.title'),
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const canHover = useCanHover();
  const cascade = useCascadePath();
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => setOverlayEl(overlayRef.current), [overlayRef]);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Sync local state with fetched categories
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // Une categorie encore en brouillon (`temp-`) n'existe pas cote serveur : la
  // proposer comme destination ferait pointer des elements vers un identifiant
  // qui ne sera jamais celui de la ligne creee.
  const reassignOptions = localCategories.filter((c) => !c.id.startsWith('temp-'));

  // Aplatit l'arbre en lignes visibles (ordre, profondeur, enfants), sous une catégorie repliée on s'arrête : `AnimatePresence` exige une liste À PLAT.
  const flattenVisible = (nodes: CategoryNode[], depth: number, out: Array<{ category: Category; depth: number; hasChildren: boolean }>) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      out.push({ category: node.category, depth, hasChildren });
      if (hasChildren && !canHover && !isCollapsed(node.category.id)) {
        flattenVisible(node.children, depth + 1, out);
      }
    }
  };
  const visibleRows: Array<{ category: Category; depth: number; hasChildren: boolean }> = [];
  flattenVisible(buildTree(localCategories), 1, visibleRows);

  const renderRow = (category: Category, depth: number, hasChildren: boolean) => {
    const siblings = siblingsOf(localCategories, category.id);
    const index = siblings.findIndex((c) => c.id === category.id);
    const move = (direction: -1 | 1) => setLocalCategories((prev) => moveAmongSiblings(prev, category.id, direction));
    return (
      <CategoryTreeRow
        id={category.id}
        name={category.name}
        color={category.color}
        depth={depth}
        hasChildren={hasChildren}
        isExpanded={!isCollapsed(category.id)}
        cascade={canHover}
        onToggle={() => setCollapsed(category.id, !isCollapsed(category.id))}
        onNameChange={(name) => handleUpdateLocal(category.id, { name })}
        onColorChange={(color) => handleUpdateLocal(category.id, { color })}
        onAddChild={() => handleAddCategory(category.id)}
        onMove={() => setCategoryToMove(category.id)}
        onDelete={() => handleDeleteLocal(category.id)}
        onStartReorder={() => setReorderingId(category.id)}
        reorder={reorderingId === category.id
          ? { canUp: index > 0, canDown: index < siblings.length - 1, onUp: () => move(-1), onDown: () => move(1) }
          : undefined}
        atMaxDepth={depth >= CATEGORY_MAX_DEPTH}
      />
    );
  };

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

  const confirmDeleteLocal = (reassignTo: string, childrenMode: 'promote' | 'deleteBranch') => {
    if (!categoryToDelete) return;
    const targetId = categoryToDelete;

    // La transition vit dans `applyDeleteToDrafts` ; ici on l'applique et on enregistre où part le contenu de chaque identifiant retiré (`resolveReassignTargets` le suit à l'enregistrement).
    const { next, removedIds } = applyDeleteToDrafts(localCategories, targetId, childrenMode);
    setLocalCategories(next);
    setReassignTargets(prev => {
      const updated = { ...prev };
      for (const id of removedIds) updated[id] = reassignTo;
      return updated;
    });

    setCategoryToDelete(null);
  };

  // « Déplacer vers… » : état local seulement ; la position est la fin de la nouvelle fratrie, comme `handleAddCategory`.
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
    // Catégorie créée jamais nommée : silencieuse, sans blocage. Seule une catégorie EXISTANTE renommée trop court bloque (sinon on effacerait un nom en base).
    const categoriesToSave = localCategories.filter(
      (lc) => !(lc.id.startsWith('temp-') && lc.name.trim().length < 2),
    );
    const invalid = categoriesToSave.find(lc => lc.name.trim().length < 2);
    if (invalid) {
      toast.error(t('colorModal.nameTooShort'));
      return;
    }

    setIsSaving(true);
    try {
      // R-02 : réaffecter AVANT de supprimer (sinon des éléments pointent dans le vide et un échec devient irrattrapable).
      const removed = categories.filter(cat => !categoriesToSave.find(lc => lc.id === cat.id));
      // Deux catégories supprimées d'un coup, la seconde destination de la première : `resolveReassignTargets` suit la chaîne jusqu'à une survivante. Chaque tour relit les tâches de SA catégorie (V14.1).
      const finalTargets = resolveReassignTargets(removed.map(c => c.id), reassignTargets);
      let movedTotal = 0;
      for (const cat of removed) {
        const { moved } = await reassignCategory(cat.id, finalTargets[cat.id], okrs);
        movedTotal += moved;
      }

      // Mises à jour nom/couleur : elles visent des lignes qui existent déjà,
      // et peuvent partir en parallèle entre elles.
      const updatePromises = categoriesToSave
        .filter((lc) => !lc.id.startsWith('temp-'))
        .map((lc) => {
          const existing = categories.find((cat) => cat.id === lc.id);
          if (existing && (existing.name !== lc.name || existing.color !== lc.color)) {
            return updateCategoryMutation.mutateAsync({
              id: lc.id,
              updates: { name: lc.name, color: lc.color },
            });
          }
          return Promise.resolve();
        });

      // « Déplacer vers… » s'écrit ici, à l'enregistrement, via `useMoveCategory` (reparentage ET réordonnancement, colonnes disjointes de la mise à jour nom/couleur). Lignes déjà en base seulement : une création porte déjà son `parentId`/`position`.
      const movePromises = categoriesToSave
        .filter((lc) => !lc.id.startsWith('temp-'))
        .filter((lc) => {
          const existing = categories.find((cat) => cat.id === lc.id);
          return !!existing && (existing.parentId !== lc.parentId || existing.position !== lc.position);
        })
        .map((lc) => moveCategoryMutation.mutateAsync({ id: lc.id, parentId: lc.parentId, position: lc.position }));

      // Les MOVES AVANT les suppressions, pas en parallèle : un enfant promu (`promote`) doit être détaché de son ancien parent avant que celui-ci soit supprimé (`ON DELETE NO ACTION`, mig. 143).
      await Promise.all([...updatePromises, ...movePromises]);

      // Suppressions : feuilles vers racine, EN SÉQUENCE (FK `ON DELETE NO ACTION` mig. 143, vérifiée par instruction ; `Promise.all` ne garantit pas l'ordre d'arrivée). `planDeletions` inverse `orderByDepth`.
      for (const cat of planDeletions(removed)) {
        await deleteCategoryMutation.mutateAsync(cat.id);
      }

      // Créations par niveau, en séquence : chaque `temp-` est substitué par l'identifiant réel du parent en descendant.
      const tempToReal = new Map<string, string>();
      for (const draft of planCreations(categoriesToSave)) {
        const parentId = draft.parentId?.startsWith('temp-')
          ? tempToReal.get(draft.parentId) ?? null
          : draft.parentId;
        const created = await createCategoryMutation.mutateAsync({
          name: draft.name,
          color: draft.color,
          parentId,
          position: draft.position,
        });
        tempToReal.set(draft.id, created.id);
      }
      // Le message de reclassement part APRES les ecritures : annoncer un
      // deplacement avant de savoir si la suppression aboutit, c'est promettre
      // un resultat qu'on n'a pas encore.
      if (movedTotal > 0) toast.success(tpOv('deleteCategory.doneReassigned', movedTotal));
      onClose();
    } catch (error) {
      // Un échec laisse la modale ouverte sur l'état local (rejouable) : la réaffectation précède les suppressions, un échec précoce ne supprime rien.
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
        onClick={guardedClose}
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
            {/* Mobile : le bouton « Enregistrer » du footer est retiré — cette
                action prend sa place ET ferme, comme la croix le faisait sans
                enregistrer avant. Desktop inchangé (croix + footer). */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="sm:hidden min-h-11 px-2 flex items-center justify-center text-blue-500 text-[15px] font-semibold disabled:opacity-50"
            >
              {isSaving ? '…' : tCommon('actions.confirm')}
            </button>
            <button
              onClick={guardedClose}
              aria-label={tCommon('actions.close')}
              className="hidden sm:flex min-w-11 min-h-11 items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:text-blue-600 hover:bg-[rgb(var(--color-hover))] transition-colors"
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
              {/* Refonte mobile : le rond bleu plein (24px dans un
                  cercle `p-2`) devient un bouton icône simple — même gabarit
                  que le « + » de TaskListsBar (accès rapide aux listes) —
                  plutôt qu'un simple rétrécissement du même style. Desktop
                  inchangé (rond bleu plein). */}
              <button
                onClick={() => handleAddCategory()}
                aria-label={t('colorModal.addRoot')}
                className="sm:hidden flex items-center justify-center min-w-touch min-h-touch rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/40 transition-colors"
              >
                <Plus size={20} />
              </button>
              <button
                onClick={() => handleAddCategory()}
                aria-label={t('colorModal.addRoot')}
                className="hidden sm:flex text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full shadow-sm"
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
                    onMouseEnter={canHover ? () => cascade.hover(1, hasChildren ? category.id : null) : undefined}
                    onMouseLeave={canHover ? cascade.leave : undefined}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    {renderRow(category, depth, hasChildren)}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

            {/* Footer « Enregistrer » — desktop uniquement. Sur mobile, le
                bouton « Valider » du header sauvegarde ET ferme. */}
            <div className="hidden sm:flex px-4 sm:px-6 pt-[0.6555rem] pb-[0.6555rem] sm:pb-[1.311rem] border-t border-[rgb(var(--color-border))] shrink-0 justify-center">
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
          categoriesTree={localCategories}
          onCancel={() => setCategoryToDelete(null)}
          onConfirm={confirmDeleteLocal}
        />

        {/* Rendue en FRÈRE de l'overlay ci-dessus : `useModalA11y` empile les
            surfaces (`openStack`), seule la dernière ouverte réagit à Échap. */}
        {canHover && (
          <CategoryManageCascade
            container={overlayEl}
            categories={localCategories}
            cascade={cascade}
            renderRow={(node, depth) => renderRow(node.category, depth, node.children.length > 0)}
          />
        )}

        <ConfirmDiscardDialog
          isOpen={confirmDiscard}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        />

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
