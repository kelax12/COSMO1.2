import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bookmark, CheckCircle2, CheckSquare, Search, Users, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { useKeyboardInset } from '@/lib/hooks/use-keyboard-inset';
import { useQuickFilter, setQuickFilter } from '@/components/task-table/quick-filter.store';
import { requestSelectMode, useSelectModeActive } from '@/components/task-table/select-mode.store';
import type { QuickFilter } from '@/components/task-table/TaskQuickFilters';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

/**
 * Recherche de la page Tâches, ancrée en bas — MOBILE UNIQUEMENT (`md:hidden`).
 *
 * ── Ce qui change, et pourquoi ────────────────────────────────────────
 * La recherche et « + d'options » vivaient dans la rangée de filtres, en HAUT
 * de la page : deux commandes hors de portée du pouce, qui poussaient la
 * liste vers le bas sur l'écran où la place manque le plus. Le modèle est
 * celui de Notes (iOS) : la recherche est la barre du bas, elle ne défile
 * jamais, et un champ vide propose des entrées plutôt qu'un curseur nu.
 *
 * Les cinq suggestions sont EXACTEMENT les pastilles de `TaskQuickFilters`
 * (`md:flex`, donc visibles telles quelles sur desktop) : aucun filtre
 * nouveau, un second chemin vers les mêmes. D'où le store partagé plutôt
 * qu'une copie d'état — cf. `quick-filter.store.ts`.
 *
 * 🔴 Le filtre rapide actif se RETIRE depuis ici. Sur mobile la barre de
 * pastilles est masquée : sans la pilule posée dans la barre ci-dessous, une
 * liste filtrée sur « Retard » n'offrirait plus aucun moyen de revenir à
 * toutes les tâches.
 *
 * Desktop : ce composant est entièrement `md:hidden`, il ne touche à rien.
 */

interface Props {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
}

type Suggestion =
  | { kind: 'filter'; value: Exclude<QuickFilter, 'none'>; labelKey: KeyOf<'tasks'>; icon: React.ElementType }
  | { kind: 'select'; labelKey: KeyOf<'tasks'>; icon: React.ElementType };

const SUGGESTIONS: Suggestion[] = [
  { kind: 'filter', value: 'bookmarked', labelKey: 'table.quickFilter.bookmarked', icon: Bookmark },
  { kind: 'filter', value: 'completed', labelKey: 'table.quickFilter.completedShort', icon: CheckCircle2 },
  { kind: 'filter', value: 'overdue', labelKey: 'table.quickFilter.overdue', icon: AlertTriangle },
  { kind: 'filter', value: 'collaboration', labelKey: 'table.quickFilter.collaboration', icon: Users },
  { kind: 'select', labelKey: 'table.select', icon: CheckSquare },
];

/** Libellé de la pilule « filtre rapide actif », posée dans la barre fermée. */
const ACTIVE_LABEL_KEY: Record<Exclude<QuickFilter, 'none'>, KeyOf<'tasks'>> = {
  bookmarked: 'table.quickFilter.bookmarked',
  completed: 'table.quickFilter.completedShort',
  overdue: 'table.quickFilter.overdue',
  collaboration: 'table.quickFilter.collaboration',
};

const MobileTaskSearch: React.FC<Props> = ({ searchTerm, onSearchTermChange }) => {
  const { t } = useT('tasks');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeQuickFilter, toggleQuickFilter } = useQuickFilter();
  const keyboardInset = useKeyboardInset(open);
  // Pendant la sélection, la barre s'efface : la barre d'actions groupées se
  // pose exactement à sa place (`safe-area + 84px`), et on ne cherche pas une
  // tâche pendant qu'on en coche cinq.
  const selectModeActive = useSelectModeActive();

  const close = useCallback(() => setOpen(false), []);
  const { ref: panelRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: close,
    label: t('search.dialogAria'),
    initialFocusRef: inputRef,
  });

  const pick = (suggestion: Suggestion) => {
    if (suggestion.kind === 'select') requestSelectMode();
    else toggleQuickFilter(suggestion.value);
    // Une suggestion APPLIQUE et referme : l'écran filtré est la réponse,
    // rester dans l'overlay obligerait à le fermer pour voir le résultat.
    close();
  };

  // La barre du bas se cache pendant que l'overlay est ouvert : son champ y
  // est repris, à la même place, au-dessus du clavier.
  const barBottom = 'calc(4rem + env(safe-area-inset-bottom) + 0.5rem)';

  if (selectModeActive) return null;

  return (
    <>
      <div
        className="md:hidden fixed inset-x-0 z-30 px-gutter"
        style={{ bottom: barBottom }}
        data-tutorial-id="tasks-search"
      >
        <div className="flex items-center gap-2 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]/95 backdrop-blur-md shadow-lg shadow-black/10 pl-4 pr-2 h-12">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-1 items-center gap-2 min-w-0 h-full text-left"
            aria-label={t('search.open')}
            aria-haspopup="dialog"
          >
            <Search size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
            <span
              className={`truncate text-label ${
                searchTerm ? 'text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              {searchTerm || t('filter.searchPlaceholder')}
            </span>
          </button>

          {activeQuickFilter !== 'none' && (
            <button
              type="button"
              onClick={() => setQuickFilter('none')}
              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] pl-3 pr-2 py-1.5 text-caption font-medium"
              aria-label={t('search.clearQuickFilter', { name: t(ACTIVE_LABEL_KEY[activeQuickFilter]) })}
            >
              <span>{t(ACTIVE_LABEL_KEY[activeQuickFilter])}</span>
              <X size={13} aria-hidden="true" />
            </button>
          )}

          {searchTerm && activeQuickFilter === 'none' && (
            <button
              type="button"
              onClick={() => onSearchTermChange('')}
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
              aria-label={t('filter.clearSearch')}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="search-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={close}
              role="presentation"
              className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              key="search-panel"
              ref={panelRef}
              {...dialogProps}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 px-gutter pt-3"
              style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + 0.75rem + ${keyboardInset}px)` }}
            >
              {searchTerm.trim() === '' && (
                <div className="rounded-2xl bg-[rgb(var(--color-surface))] overflow-hidden shadow-2xl">
                  <p className="px-4 pt-3 pb-2 text-caption font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                    {t('search.suggestions')}
                  </p>
                  <ul>
                    {SUGGESTIONS.map((suggestion) => {
                      const Icon = suggestion.icon;
                      const isActive = suggestion.kind === 'filter' && activeQuickFilter === suggestion.value;
                      return (
                        <li key={suggestion.labelKey} className="border-t border-[rgb(var(--color-border))]">
                          <button
                            type="button"
                            onClick={() => pick(suggestion)}
                            aria-pressed={suggestion.kind === 'filter' ? isActive : undefined}
                            className="flex w-full items-center gap-3 px-4 min-h-touch text-left active:bg-[rgb(var(--color-hover))]"
                          >
                            <Icon
                              size={20}
                              aria-hidden="true"
                              className="shrink-0 text-[rgb(var(--color-accent))]"
                            />
                            <span className="flex-1 text-label text-[rgb(var(--color-text-primary))]">
                              {t(suggestion.labelKey)}
                            </span>
                            {isActive && (
                              <CheckCircle2 size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent))]" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    size={18}
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]"
                  />
                  <input
                    ref={inputRef}
                    id="search-tasks-mobile"
                    type="search"
                    inputMode="search"
                    enterKeyHint="search"
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') close(); }}
                    placeholder={t('filter.searchPlaceholder')}
                    aria-label={t('filter.searchByName')}
                    className="w-full h-12 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] pl-11 pr-4 text-label text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
                  />
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 px-2 min-h-touch text-label font-medium text-[rgb(var(--color-accent))]"
                >
                  {t('search.cancel')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileTaskSearch;
