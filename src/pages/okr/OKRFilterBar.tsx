import React from 'react';
import { Check, ChevronDown, Search, Settings2, X } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { rootCategories, childrenOfCategory, toggleRootCategory } from './category-filter-logic';

export type OKRScope = 'all' | 'perso' | 'entreprise';

interface CategoryLite {
  id: string;
  name: string;
  color: string;
  parentId?: string | null;
}

interface Props {
  query: string;
  onQuery: (q: string) => void;
  categories: CategoryLite[];
  activeCategoryIds: ReadonlySet<string>;
  setActiveCategoryIds: (next: Set<string>) => void;
  resolveColor: (color: string) => string;
  onManageCategories: () => void;
  /** Absent = aucune organisation : le sélecteur de portée n'a rien à trier. */
  scope?: OKRScope;
  onScope?: (scope: OKRScope) => void;
}

const SCOPES: OKRScope[] = ['all', 'perso', 'entreprise'];
/** Table plutôt qu'une clé construite : le scanner i18n lit des clés entières. */
const SCOPE_LABEL_KEY: Record<OKRScope, KeyOf<'okr'>> = {
  all: 'filters.scopeAll',
  perso: 'filters.scopePerso',
  entreprise: 'filters.scopeEntreprise',
};

/**
 * Filtres de la page Objectifs (perso) : recherche par nom, catégorie en menu
 * déroulant (choix unique, une racine emporte ses sous-catégories) et portée
 * Tout / Perso / Entreprise, comme la page Tâches. Remplace les pastilles.
 */
const OKRFilterBar: React.FC<Props> = ({
  query, onQuery, categories, activeCategoryIds, setActiveCategoryIds, resolveColor, onManageCategories, scope, onScope,
}) => {
  const { t } = useT('okr');
  const selected = categories.find((c) => activeCategoryIds.has(c.id) && !(c.parentId && activeCategoryIds.has(c.parentId)));
  const filtered = activeCategoryIds.size > 0 && !!selected;

  const item = (key: string, text: string, active: boolean, onPick: () => void, color?: string, indent = false) => (
    <DropdownMenuItem key={key} onClick={onPick} className={indent ? 'pl-7' : undefined}>
      {color && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />}
      <span className="flex-1 truncate">{text}</span>
      {active && <Check size={16} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent))]" />}
    </DropdownMenuItem>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6" data-tutorial-id="okr-category-filter" data-guide-id="perso-okr-categories">
      <label className="relative flex-1 min-w-[180px] max-w-sm">
        <span className="sr-only">{t('filters.searchLabel')}</span>
        <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('filters.searchPlaceholder')}
          className="w-full h-10 pl-9 pr-8 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => onQuery('')} aria-label={t('filters.clearSearch')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </label>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('filters.categoryAria')}
          className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm font-medium text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
        >
          {filtered && <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveColor(selected.color) }} aria-hidden="true" />}
          <span className="truncate max-w-[180px]">{filtered ? selected.name : t('categories.allLong')}</span>
          <ChevronDown size={16} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto min-w-56">
          {item('all', t('categories.allLong'), activeCategoryIds.size === 0, () => setActiveCategoryIds(new Set()))}
          {rootCategories(categories).flatMap((root) => [
            item(root.id, root.name, selected?.id === root.id, () => setActiveCategoryIds(toggleRootCategory(root.id, new Set(), categories)), resolveColor(root.color)),
            ...childrenOfCategory(root.id, categories).map((child) =>
              item(child.id, child.name, selected?.id === child.id, () => setActiveCategoryIds(new Set([child.id])), resolveColor(child.color), true)),
          ])}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onManageCategories} className="text-[rgb(var(--color-accent))]">
            <Settings2 size={16} aria-hidden="true" /> {t('categories.manage')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {scope && onScope && (
        <div role="group" aria-label={t('filters.scopeAria')} className="ml-auto inline-flex items-center rounded-lg border border-[rgb(var(--color-border))] p-0.5">
          {SCOPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onScope(value)}
              aria-pressed={scope === value}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                scope === value
                  ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                  : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
              }`}
            >
              {t(SCOPE_LABEL_KEY[value])}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OKRFilterBar;
