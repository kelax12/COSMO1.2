import React from 'react';
import { ChevronRight, ChevronDown, Plus, FolderInput, Trash2, MoreHorizontal } from 'lucide-react';
import { useT } from '@/i18n/useT';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

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
          className="p-1 shrink-0 text-blue-600 dark:text-blue-400"
        >
          {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </button>
      ) : (
        <span className="w-6 shrink-0" aria-hidden="true" />
      )}

      <div className="relative group bg-[rgb(var(--color-surface))] rounded-[10px] shrink-0">
        <div
          className="h-7 w-7 rounded-[10px] shrink-0 cursor-pointer shadow-sm hover:brightness-110 transition-all"
          style={{ backgroundColor: color }}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          aria-label={t('colorModal.colorFor', { name })}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-[10px] bg-transparent"
        />
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        aria-label={t('colorModal.nameFor', { name })}
        placeholder={t('colorModal.namePlaceholder')}
        className="flex-1 min-w-0 min-h-11 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl px-3 py-2 text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-[rgb(var(--color-accent-solid))] dark:focus:border-slate-500 transition-all"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('colorModal.moreActions', { name })}
            className="min-w-11 min-h-11 flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        {/* z-[10000] : le menu doit passer AU-DESSUS de la modale (z-[80]),
            comme dans AssigneesPicker. */}
        <DropdownMenuContent align="end" className="z-[10000]">
          <DropdownMenuItem
            onClick={onAddChild}
            disabled={atMaxDepth}
            title={atMaxDepth ? t('colorModal.maxDepthReached') : undefined}
          >
            <Plus size={14} aria-hidden="true" /> {t('colorModal.createSubcategory')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMove}>
            <FolderInput size={14} aria-hidden="true" /> {t('colorModal.moveTitle')}
          </DropdownMenuItem>
          {/* !text-red-500 : même correctif que list.tsx (rowMenu.delete) —
              le sélecteur Tailwind data-[variant=destructive]:*:[svg]:!text-destructive
              de dropdown-menu.tsx ne s'applique pas, l'icône reste grise au
              survol sans cet override explicite (cf. f563586d). */}
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            <Trash2 size={14} aria-hidden="true" className="!text-red-500" /> {t('colorModal.deleteTitle')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default CategoryTreeRow;
