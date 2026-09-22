import React from 'react';
import { X } from 'lucide-react';
import type { TaskList } from '@/modules/lists';
import { VIRTUAL_TODAY_ID } from './task-page-filter';
import { useT } from '@/i18n/useT';

/**
 * Ce qui réduit la liste, dit à l'écran, avec de quoi le retirer (#35).
 *
 * Trois filtres peuvent rétrécir la page sans que rien ne le dise : une liste,
 * des catégories, une recherche. Cette rangée les nomme, donne un ✕ à chacun et
 * rappelle le compte n/N — c'est la réponse au « où sont passées mes tâches ? ».
 *
 * Extraite de `TasksPage` le 2026-09-22, quand la page a dépassé son plafond de
 * 600 lignes (`architecture.guard`). La frontière n'est pas un compte de lignes
 * mais une SURFACE : elle ne décide d'aucun filtre, elle les rend visibles et
 * les rend à zéro.
 */

interface Props {
  selectedListId: string | null;
  lists: TaskList[];
  selectedCategories: string[];
  searchTerm: string;
  /** Tâches affichées après filtrage, et total, pour le compte n/N. */
  shownCount: number;
  totalCount: number;
  onClearList: () => void;
  onClearCategories: () => void;
  onClearSearch: () => void;
  /** Posée par la page : elle s'efface pendant la recherche mobile. */
  className?: string;
}

/** Pilule bleue commune aux trois filtres : même forme, même geste. */
const PILL =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 '
  + 'dark:bg-[rgb(var(--color-accent-solid))]/10 text-blue-700 dark:text-blue-300 border '
  + 'border-blue-200 dark:border-[rgb(var(--color-accent-solid))]/30 hover:bg-blue-100 '
  + 'dark:hover:bg-[rgb(var(--color-accent-solid-hover))]/20 transition-colors';

const ActiveFiltersRow: React.FC<Props> = ({
  selectedListId,
  lists,
  selectedCategories,
  searchTerm,
  shownCount,
  totalCount,
  onClearList,
  onClearCategories,
  onClearSearch,
  className = '',
}) => {
  const { t, tp } = useT('tasks');
  const hasSearch = searchTerm.trim() !== '';
  const activeCount = [selectedListId, selectedCategories.length > 0, hasSearch].filter(Boolean).length;
  if (activeCount === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 mb-4 ${className}`} role="status">
      {selectedListId && (
        <button type="button" onClick={onClearList} className={PILL} aria-label={t('actions.clearListFilter')}>
          {t('filters.listPrefix', {
            name: selectedListId === VIRTUAL_TODAY_ID
              ? t('filters.today')
              : lists.find((l) => l.id === selectedListId)?.name ?? t('filters.list'),
          })}
          <X size={14} aria-hidden="true" />
        </button>
      )}
      {selectedCategories.length > 0 && (
        <button type="button" onClick={onClearCategories} className={PILL} aria-label={t('actions.clearCategoryFilter')}>
          {selectedCategories.length === 1
            ? t('filters.category')
            : t('filters.categoriesCount', { count: selectedCategories.length })}
          <X size={14} aria-hidden="true" />
        </button>
      )}
      {hasSearch && (
        <button type="button" onClick={onClearSearch} className={PILL} aria-label={t('actions.clearSearch')}>
          {t('filters.searchPrefix', { term: searchTerm.trim() })}
          <X size={14} aria-hidden="true" />
        </button>
      )}

      {/* Maquette 101 : le compte est une PRÉCISION, pas un message —
          `text-caption` et non `text-sm`. Et « tout retirer » n'apparaît qu'à
          partir de DEUX filtres : avec un seul, la croix de la pilule fait déjà
          exactement ça. */}
      <span className="text-caption text-[rgb(var(--color-text-muted))]">
        {tp('filters.shown', totalCount, { shown: shownCount })}
      </span>
      {activeCount > 1 && (
        <button
          type="button"
          onClick={() => { onClearList(); onClearCategories(); onClearSearch(); }}
          className="sm:hidden text-caption font-medium text-[rgb(var(--color-accent))] underline-offset-4 hover:underline min-h-touch px-1"
          aria-label={t('sort.resetAria')}
        >
          {t('filters.clearAll')}
        </button>
      )}
    </div>
  );
};

export default ActiveFiltersRow;
