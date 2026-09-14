// ═══════════════════════════════════════════════════════════════════
// TaskModalCategorySheet — feuille « Catégorie » du corps mobile
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de `TaskModalMobileBody.tsx` le 2026-09-14 (C-75) : le fichier avait
// franchi les 600 lignes du cliquet `architecture.guard`, et la frontière la
// plus nette était celle-ci — une SURFACE (la feuille) avec son propre état de
// saisie, que le corps du modal n'a aucune raison de porter.
//
// Ce qui vit ici : l'arbre repliable des catégories (même chevron bleu et même
// indentation que `ColorSettingsModal` / `CategoryTreeSelect`, et le même état
// de pliage partagé par compte), et la création d'une catégorie à la volée.
// Ce qui reste au parent : quelle catégorie est choisie, et ce qu'il en fait.
import React, { useState } from 'react';
import { Plus, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { buildTree } from '@/modules/categories';
import type { Category, CategoryNode, useCreateCategory } from '@/modules/categories';
import { useCollapsedCategories } from '@/modules/categories/collapsed.store';
import { CellSeparator } from './primitives';
import { MobileActionSheet } from './MobileActionSheet';
import { useT } from '@/i18n/useT';

interface TaskModalCategorySheetProps {
  open: boolean;
  /** Fermeture par le voile, la croix ou Échap — le parent décide de la suite. */
  onClose: () => void;
  categories: Category[];
  /** Identifiant de la catégorie courante ; chaîne vide = aucune (`NO_CATEGORY`). */
  selectedId: string;
  /** Rappelé avec l'identifiant choisi, ou la chaîne vide si on décoche. */
  onSelect: (categoryId: string) => void;
  /** Rappelé APRÈS création, avec l'identifiant de la catégorie créée. */
  onCreated: (categoryId: string) => void;
  createCategoryMutation: ReturnType<typeof useCreateCategory>;
  listColorOptions: { value: string; color: string }[];
}

const TaskModalCategorySheet: React.FC<TaskModalCategorySheetProps> = ({
  open, onClose, categories, selectedId, onSelect, onCreated,
  createCategoryMutation, listColorOptions,
}) => {
  const { t } = useT('taskModal');
  // colorModal.expand / colorModal.collapse — même arbre replié que
  // ColorSettingsModal / CategoryFilterTree, namespace `tasks`.
  const { t: tTasks } = useT('tasks');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');
  // Partagé avec ColorSettingsModal / CategoryTreeSelect : un même compte a un
  // seul état de pliage, pas un par sélecteur.
  const { isCollapsed, setCollapsed } = useCollapsedCategories();

  // Aplatit l'arbre en lignes visibles (s'arrête sous un nœud replié), même
  // technique que `CategoryFilterTree` / `ColorSettingsModal`.
  const visibleCategoryRows: Array<{ node: CategoryNode; depth: number; hasChildren: boolean }> = [];
  const flattenVisibleCategories = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      visibleCategoryRows.push({ node, depth, hasChildren });
      if (hasChildren && !isCollapsed(node.category.id)) flattenVisibleCategories(node.children, depth + 1);
    }
  };
  flattenVisibleCategories(buildTree(categories), 0);

  const handleClose = () => {
    setShowNewCatInput(false);
    onClose();
  };

  // Création depuis la feuille : sélectionne la catégorie créée, referme la
  // saisie ET la feuille. Le parent efface l'erreur du champ.
  const submitNewCategory = () => {
    const name = newCatName.trim();
    if (name.length < 2) return;
    createCategoryMutation.mutate(
      { name, color: listColorOptions.find((c) => c.value === newCatColor)?.color ?? '#3B82F6' },
      {
        onSuccess: (created) => {
          onCreated(created.id);
          setShowNewCatInput(false);
          setNewCatName('');
          setNewCatColor('blue');
        },
      },
    );
  };

  return (
    <MobileActionSheet
      open={open}
      title={t('fields.category')}
      onClose={handleClose}
      scrollable
    >
      {visibleCategoryRows.map((row, i) => (
        <React.Fragment key={row.node.category.id}>
          {i > 0 && <CellSeparator />}
          <div className="flex items-center gap-1 min-h-11" style={{ paddingInlineStart: `${16 + row.depth * 16}px` }}>
            {row.hasChildren ? (
              <button
                type="button"
                onClick={() => setCollapsed(row.node.category.id, !isCollapsed(row.node.category.id))}
                aria-label={isCollapsed(row.node.category.id) ? tTasks('colorModal.expand') : tTasks('colorModal.collapse')}
                className="p-1 shrink-0 text-blue-600 dark:text-blue-400"
              >
                {isCollapsed(row.node.category.id)
                  ? <ChevronRight size={14} aria-hidden="true" />
                  : <ChevronDown size={14} aria-hidden="true" />}
              </button>
            ) : (
              <span className="w-6 shrink-0" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => onSelect(selectedId === row.node.category.id ? '' : row.node.category.id)}
              className="flex-1 min-w-0 flex items-center justify-between pr-4 min-h-11 active:bg-[rgb(var(--color-hover))]"
            >
              <span className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.node.category.color }} />
                <span className="text-[15px] text-[rgb(var(--color-text-primary))] truncate">{row.node.category.name}</span>
              </span>
              {selectedId === row.node.category.id && <Check size={16} className="text-blue-500 shrink-0" />}
            </button>
          </div>
        </React.Fragment>
      ))}
      {categories.length > 0 && <CellSeparator />}
      {!showNewCatInput ? (
        <button type="button" onClick={() => setShowNewCatInput(true)} className="w-full flex items-center gap-2 px-4 min-h-11 text-blue-500">
          <Plus size={16} /><span className="text-[15px]">{t('fields.createCategory')}</span>
        </button>
      ) : (
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => { const idx = listColorOptions.findIndex((c) => c.value === newCatColor); setNewCatColor(listColorOptions[(idx + 1) % listColorOptions.length].value); }}
            className="w-6 h-6 rounded-full shrink-0"
            style={{ backgroundColor: listColorOptions.find((c) => c.value === newCatColor)?.color ?? '#3B82F6' }}
          />
          <input
            autoFocus type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
            placeholder={t('fields.categoryNamePlaceholder')}
            className="flex-1 text-[15px] bg-transparent focus:outline-none text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))]"
          />
          <button
            type="button"
            disabled={newCatName.trim().length < 2 || createCategoryMutation.isPending}
            onClick={submitNewCategory}
            className="text-[15px] text-blue-500 font-semibold disabled:text-blue-300"
          >
            {createCategoryMutation.isPending ? '…' : t('common.create')}
          </button>
        </div>
      )}
    </MobileActionSheet>
  );
};

export default TaskModalCategorySheet;
