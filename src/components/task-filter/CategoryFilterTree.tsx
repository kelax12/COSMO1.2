import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { buildTree, type Category, type CategoryNode } from '@/modules/categories';
import { useCollapsedCategories } from '@/modules/ui-states';
import { useT } from '@/i18n/useT';

interface CategoryFilterTreeProps {
  categories: readonly Category[];
  selectedCategories: string[];
  onToggle: (id: string) => void;
}

/**
 * Arbre repliable dans le popover de filtres (tâche 12, vague 1, Gap 2).
 *
 * 🔴 POURQUOI un arbre et pas la liste à plat d'avant. Décision produit
 * assumée : filtrer est aussi une façon de NAVIGUER la hiérarchie, pas
 * seulement de cocher un nom dans un tas. `buildTree` (déjà utilisé par
 * `ColorSettingsModal`) donne l'ordre d'affichage ; l'état replié/déplié est
 * PARTAGÉ avec cette modale via `useCollapsedCategories` — un même compte a
 * un seul état de pliage, pas un par écran.
 *
 * ⚠️ Cocher un PARENT ne coche PAS ses enfants ici. La règle « une catégorie
 * cochée remonte toute sa branche » vit déjà dans `filterTasksForPage`
 * (`src/pages/tasks/task-page-filter.ts`) via `descendantIdSet` — l'exprimer
 * une seconde fois ici (en cochant visuellement les enfants) créerait deux
 * endroits où la même règle pourrait diverger. La case à cocher ne reflète
 * QUE la sélection explicite de l'utilisateur.
 */
const CategoryFilterTree: React.FC<CategoryFilterTreeProps> = ({
  categories, selectedCategories, onToggle,
}) => {
  const { t } = useT('tasks');
  const { isCollapsed, setCollapsed } = useCollapsedCategories();

  // Aplatit l'arbre en lignes visibles, en s'arrêtant sous un nœud replié —
  // même logique que `ColorSettingsModal`, dupliquée volontairement : cette
  // modale gère aussi le renommage, la couleur, le déplacement et la
  // suppression, une case à cocher n'a rien à faire dans cette forme-là.
  const rows: Array<{ category: Category; depth: number; hasChildren: boolean }> = [];
  const flattenVisible = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      const hasChildren = node.children.length > 0;
      rows.push({ category: node.category, depth, hasChildren });
      if (hasChildren && !isCollapsed(node.category.id)) {
        flattenVisible(node.children, depth + 1);
      }
    }
  };
  flattenVisible(buildTree(categories), 1);

  return (
    <div
      role="tree"
      aria-label={t('filter.filterCategories')}
      className="grid max-h-[180px] gap-1 overflow-y-auto pr-1 custom-scrollbar"
    >
      {rows.map(({ category, depth, hasChildren }) => (
        <div
          key={category.id}
          role="treeitem"
          aria-level={depth}
          aria-expanded={hasChildren ? !isCollapsed(category.id) : undefined}
          className="flex items-center gap-2 py-1 text-sm"
          style={{ color: 'rgb(var(--color-text-primary))', paddingInlineStart: `${(depth - 1) * 16}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setCollapsed(category.id, !isCollapsed(category.id))}
              aria-label={isCollapsed(category.id) ? t('colorModal.expand') : t('colorModal.collapse')}
              className="p-1 shrink-0"
            >
              {isCollapsed(category.id)
                ? <ChevronRight size={14} aria-hidden="true" />
                : <ChevronDown size={14} aria-hidden="true" />}
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          )}
          <label className="flex flex-1 min-w-0 cursor-pointer items-center gap-2">
            <Checkbox
              checked={selectedCategories.includes(category.id)}
              onCheckedChange={() => onToggle(category.id)}
            />
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} aria-hidden="true" />
            <span className="truncate">{category.name}</span>
          </label>
        </div>
      ))}
    </div>
  );
};

export default CategoryFilterTree;
