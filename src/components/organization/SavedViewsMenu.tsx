// Vues enregistrées (mig. 192) — « mon équipe, en retard, priorité haute »
// se nomme une fois et se retrouve d'un clic. Une vue est PERSONNELLE ; la
// partager, c'est partager l'URL de l'écran, qui porte déjà ses filtres.

import { useState } from 'react';
import { Bookmark, Check, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteView, useSaveView, useSavedViews } from '@/modules/organizations/governance.hooks';
import type { SavedViewScope } from '@/modules/organizations/governance.types';
import { useT } from '@/i18n/useT';

interface SavedViewsMenuProps {
  orgId: string;
  scope: SavedViewScope;
  /** Filtres courants de l'écran (paramètres qui s'écartent du défaut). */
  current: Record<string, string>;
  /** Réécrit les filtres de l'écran avec ceux d'une vue. */
  onApply: (filters: Record<string, string>) => void;
}

const sameFilters = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

const SavedViewsMenu = ({ orgId, scope, current, onApply }: SavedViewsMenuProps) => {
  const { t } = useT('org');
  const { data: views = [], isLoading } = useSavedViews(orgId, scope);
  const save = useSaveView(orgId);
  const remove = useDeleteView(orgId, scope);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const activeView = views.find((v) => sameFilters(v.filters, current));
  const hasFilters = Object.keys(current).length > 0;

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    save.mutate({ scope, name: n, filters: current }, {
      onSuccess: () => { setNaming(false); setName(''); },
    });
  };

  if (naming) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="inline-flex items-center gap-1.5"
      >
        <label className="sr-only" htmlFor={`view-name-${scope}`}>{t('savedViews.nameLabel')}</label>
        <input
          id={`view-name-${scope}`}
          autoFocus
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setNaming(false); } }}
          placeholder={t('savedViews.namePlaceholder')}
          className="h-9 w-44 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2.5 text-sm text-[rgb(var(--color-text-primary))]"
        />
        <button type="submit" disabled={!name.trim() || save.isPending} className="h-9 px-3 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {t('savedViews.save')}
        </button>
        <button type="button" onClick={() => setNaming(false)} className="h-9 px-2 rounded-lg text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]">
          {t('savedViews.cancel')}
        </button>
      </form>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
        >
          <Bookmark size={14} aria-hidden="true" />
          <span className="max-w-[140px] truncate">{activeView?.name ?? t('savedViews.trigger')}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {!isLoading && views.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-[rgb(var(--color-text-muted))]">{t('savedViews.empty')}</p>
        )}
        {views.map((v) => (
          <DropdownMenuItem key={v.id} onSelect={() => onApply(v.filters)} className="flex items-center gap-2">
            <span className="w-4 shrink-0">{activeView?.id === v.id && <Check size={14} aria-hidden="true" />}</span>
            <span className="flex-1 truncate">{v.name}</span>
            <button
              type="button"
              aria-label={t('savedViews.delete', { name: v.name })}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); remove.mutate(v.id); }}
              className="p-1 rounded text-[rgb(var(--color-text-muted))] hover:text-red-500"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!hasFilters || !!activeView} onSelect={() => setNaming(true)}>
          {t('savedViews.saveCurrent')}
        </DropdownMenuItem>
        {hasFilters && (
          <DropdownMenuItem onSelect={() => onApply({})}>{t('savedViews.reset')}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SavedViewsMenu;
