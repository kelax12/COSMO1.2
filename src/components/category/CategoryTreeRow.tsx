import React from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, MoreHorizontal } from 'lucide-react';
import { useT } from '@/i18n/useT';

/**
 * Une ligne de l'arbre des catégories dans la modale de gestion.
 *
 * ⚠️ Rôles ARIA d'arbre : la ligne est un `treeitem`, elle porte son niveau et
 * son état déplié. Sans eux, un lecteur d'écran lit une liste plate, et
 * l'indentation visuelle ne dit rien.
 *
 * ⚠️ `aria-level` commence à 1 pour une racine, comme `treeDepth`.
 */
interface CategoryTreeRowProps {
  id: string;
  name: string;
  color: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onAddChild: () => void;
  onMove: () => void;
  onDelete: () => void;
  /** Vrai quand la profondeur maximale est atteinte : « + » est désactivé. */
  atMaxDepth: boolean;
}

const CategoryTreeRow: React.FC<CategoryTreeRowProps> = ({
  id, name, color, depth, hasChildren, isExpanded,
  onToggle, onNameChange, onColorChange, onAddChild, onMove, onDelete, atMaxDepth,
}) => {
  const { t } = useT('tasks');

  return (
    <div
      role="treeitem"
      aria-level={depth}
      aria-expanded={hasChildren ? isExpanded : undefined}
      // Repris par les tests, et utile pour retrouver une ligne précise dans
      // l'arbre sans dépendre du texte affiché (qui change avec la locale).
      data-category-id={id}
      className="flex items-center gap-2 min-h-11"
      style={{ paddingInlineStart: `${(depth - 1) * 16}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={isExpanded ? t('colorModal.collapse') : t('colorModal.expand')}
          className="p-1 shrink-0"
        >
          {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </button>
      ) : (
        <span className="w-6 shrink-0" aria-hidden="true" />
      )}

      <input
        type="color"
        value={color}
        onChange={(e) => onColorChange(e.target.value)}
        aria-label={t('colorModal.colorFor', { name })}
        className="w-7 h-7 shrink-0 rounded"
      />

      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        aria-label={t('colorModal.nameFor', { name })}
        placeholder={t('colorModal.namePlaceholder')}
        className="flex-1 min-w-0 min-h-11 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-[rgb(var(--color-accent-solid))] dark:focus:border-slate-500 transition-all"
      />

      <button
        type="button"
        onClick={onAddChild}
        disabled={atMaxDepth}
        aria-label={t('colorModal.addChildTo', { name })}
        title={atMaxDepth ? t('colorModal.maxDepthReached') : undefined}
        className="min-w-11 min-h-11 flex items-center justify-center shrink-0 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={16} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onMove}
        aria-label={t('colorModal.moveCategory', { name })}
        className="min-w-11 min-h-11 flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={t('colorModal.deleteCategory', { name })}
        className="min-w-11 min-h-11 flex items-center justify-center shrink-0 text-red-500 hover:text-red-600 transition-colors"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
};

export default CategoryTreeRow;
