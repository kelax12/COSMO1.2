import React, { useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bookmark, CheckCircle2, CheckSquare, Plus, Search, Sparkles, Users, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { measureKeyboardInset, useKeyboardInset } from '@/lib/hooks/use-keyboard-inset';
import { useQuickFilter, setQuickFilter } from '@/components/task-table/quick-filter.store';
import { requestSelectMode, useSelectModeActive } from '@/components/task-table/select-mode.store';
import type { QuickFilter } from '@/components/task-table/TaskQuickFilters';
import type { TaskList } from '@/modules/lists';
import { VIRTUAL_TODAY_ID } from './task-page-filter';
import { resolveListColor } from './list-colors';
import { setSearchOpen, useSearchOpen } from './search-open.store';
import MobileSortButton from './MobileSortButton';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

/**
 * Recherche de la page Tâches, ancrée en bas, MOBILE UNIQUEMENT (`md:hidden`), modèle Notes (iOS) : barre du bas qui ne défile jamais, un champ vide propose des entrées.
 * Les cinq suggestions sont EXACTEMENT les pastilles de `TaskQuickFilters` (store partagé, `quick-filter.store.ts`) : aucun filtre nouveau.
 * 🔴 Le filtre rapide actif se RETIRE depuis ici : la barre de pastilles est masquée sur mobile, sans la pilule il n'y aurait aucun retour à toutes les tâches.
 */

interface Props {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  /** De quoi proposer les listes en plus des filtres : quatre valeurs groupées, elles ne se comprennent qu'ensemble. */
  listPicker: {
    lists: TaskList[];
    selectedListId: string | null;
    onSelect: (listId: string) => void;
    /** « Aujourd'hui » peut etre masquee par la personne : on ne la propose pas. */
    todayHidden: boolean;
  };
  /** Le tri : groupé comme `listPicker`. */
  sort: {
    field: string;
    direction: 'asc' | 'desc';
    onFieldChange: (value: string) => void;
    onToggleDirection: () => void;
  };
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

/** Une ligne de la carte : un filtre rapide, « Aujourd'hui », ou une liste. */
type Row = {
  key: string;
  label: string;
  active: boolean;
  onPick: () => void;
  /** Filtres et « Aujourd'hui » portent une icone, les listes une pastille. */
  icon?: React.ElementType;
  dot?: string;
};

/** Libellé de la pilule « filtre rapide actif », posée dans la barre fermée. */
const ACTIVE_LABEL_KEY: Record<Exclude<QuickFilter, 'none'>, KeyOf<'tasks'>> = {
  bookmarked: 'table.quickFilter.bookmarked',
  completed: 'table.quickFilter.completedShort',
  overdue: 'table.quickFilter.overdue',
  collaboration: 'table.quickFilter.collaboration',
};

/** Montée du viewport visuel AU-DESSUS de sa valeur au repos à partir de laquelle un clavier est tenu pour ouvert. Relatif, jamais absolu : le repos vaut 0 sur émulateur et ~60 à 100 px dans Safari iOS. */
const KEYBOARD_LIFT_PX = 80;

const MobileTaskSearch: React.FC<Props> = ({ searchTerm, onSearchTermChange, listPicker, sort }) => {
  const { t } = useT('tasks');
  const { t: tCommon } = useT('common');
  // L'ouverture vit dans un store : `TasksPage` efface son en-tête, ses listes
  // et son tri pendant la recherche, et `SwipeHintBanner` s'efface aussi, deux
  // niveaux plus bas. Cf. `search-open.store.ts`.
  const open = useSearchOpen();
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeQuickFilter, toggleQuickFilter } = useQuickFilter();
  const keyboardInset = useKeyboardInset(open);
  // Pendant la sélection, la barre s'efface : la barre d'actions groupées se
  // pose exactement à sa place (`safe-area + 84px`), et on ne cherche pas une
  // tâche pendant qu'on en coche cinq.
  const selectModeActive = useSelectModeActive();

  // ── Ouvrir DOIT lever le clavier ──
  // 🔴 Sur iOS, `focus()` n'ouvre le clavier que PENDANT la tâche du geste ; `useModalA11y` focalise dans un `useEffect` (autre tâche). `flushSync` commite l'ouverture dans le clic : le champ existe déjà, `useModalA11y` ne le déplace pas (focus déjà dans la surface).
  const openAndFocus = useCallback(() => {
    flushSync(() => setSearchOpen(true));
    inputRef.current?.focus();
  }, []);

  const close = useCallback(() => setSearchOpen(false), []);
  const { ref: panelRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: close,
    label: t('search.dialogAria'),
    initialFocusRef: inputRef,
  });

  // ── Ligne de base du viewport visuel ──
  // 🔴 Mesurée À L'OUVERTURE, sur l'appareil, clavier fermé (0 sur émulateur, ~60 à 100 px dans Safari iOS) : jamais comparée à des constantes.
  // ⚠️ Lue par `measureKeyboardInset()`, PAS dans l'état du hook, qui vaut encore 0 à l'ouverture (un repos serait pris pour un clavier).
  const restingInset = useRef(0);
  useEffect(() => {
    if (open) restingInset.current = measureKeyboardInset();
  }, [open]);

  const keyboardUp = keyboardInset - restingInset.current > KEYBOARD_LIFT_PX;

  // ── Le clavier se referme, la recherche aussi (modèle Notes) ──
  // Signal : le champ PERD LE FOCUS (touche « OK » iOS, repli du clavier). Le viewport visuel ne sert qu'à placer le champ.
  // ⚠️ Un `blur` nu rendrait les suggestions INTOUCHABLES (blur avant `click`) : le garde `pointerInPanel`, posé au `pointerdown` dans le panneau et levé après, empêche le blur de fermer pendant un appui.
  const pointerInPanel = useRef(false);
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (pointerInPanel.current) return;
    // Tab vers la croix ou une suggestion : le focus RESTE dans la surface. Fermer ici
    // rendait ces commandes inatteignables au clavier (mesuré, AM-2).
    const next = event.relatedTarget;
    if (next instanceof Node && panelRef.current?.contains(next)) return;
    close();
  };

  // 🔴 Le garde se lève sur `window`, jamais sur le panneau : taper une suggestion DÉMONTE le panneau, son `onPointerUp` n'arriverait jamais et le garde resterait levé. Remis à zéro à chaque ouverture.
  useEffect(() => {
    if (!open) return;
    pointerInPanel.current = false;
    const release = () => { pointerInPanel.current = false; };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [open]);

  const pick = (suggestion: Suggestion) => {
    if (suggestion.kind === 'select') requestSelectMode();
    else toggleQuickFilter(suggestion.value);
    // Une suggestion APPLIQUE et referme : l'écran filtré est la réponse,
    // rester dans l'overlay obligerait à le fermer pour voir le résultat.
    close();
  };

  // -- Les lignes de la carte : les cinq filtres, puis les listes --
  // Une seule collection (séparateur sur toutes sauf la dernière) ; les listes sont ici car la barre de chips s'efface pendant la recherche.
  const rows: Row[] = [
    ...SUGGESTIONS.map((suggestion) => ({
      key: suggestion.labelKey,
      label: t(suggestion.labelKey),
      icon: suggestion.icon,
      active: suggestion.kind === 'filter' && activeQuickFilter === suggestion.value,
      onPick: () => pick(suggestion),
    })),
    ...(listPicker.todayHidden ? [] : [{
      key: VIRTUAL_TODAY_ID,
      label: t('filters.today'),
      icon: Sparkles,
      active: listPicker.selectedListId === VIRTUAL_TODAY_ID,
      onPick: () => { listPicker.onSelect(VIRTUAL_TODAY_ID); close(); },
    }]),
    ...listPicker.lists.map((list) => ({
      key: list.id,
      label: list.name,
      dot: resolveListColor(list.color),
      active: listPicker.selectedListId === list.id,
      onPick: () => { listPicker.onSelect(list.id); close(); },
    })),
  ];

  const barBottom = 'calc(4rem + env(safe-area-inset-bottom) + 0.5rem)';

  // Champ vide = écran plein, opaque, suggestions. Dès la première frappe le fond s'efface : la liste de tâches reste visible, seul le champ ancré demeure.
  const showSuggestions = searchTerm.trim() === '';

  if (selectModeActive) return null;

  return (
    <>
      {/* La barre fermée s'efface pendant que l'overlay est ouvert : son champ
          y est repris, plus bas, au-dessus du clavier. Sans ce retrait elle
          réapparaît DERRIÈRE le voile dès qu'un caractère est saisi (la carte
          de suggestions, qui la masquait, disparaît alors) : deux champs de
          recherche l'un au-dessus de l'autre, dont un inerte. */}
      <div
        className={`${open ? 'hidden' : ''} md:hidden fixed inset-x-0 z-30 px-gutter flex items-center gap-2`}
        style={{ bottom: barBottom }}
        data-tutorial-id="tasks-search"
      >
        <div className="flex flex-1 min-w-0 items-center gap-2 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg shadow-black/10 pl-4 pr-2 h-12">
          <button
            type="button"
            onClick={openAndFocus}
            className="flex flex-1 items-center gap-2 min-w-0 h-full text-left"
            aria-label={`${t('search.open')} : ${searchTerm || t('search.placeholder')}`}
            aria-haspopup="dialog"
          >
            <Search size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
            <span
              className={`truncate text-label ${
                searchTerm ? 'text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              {searchTerm || t('search.placeholder')}
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

        {/* Le tri quitte la rangee du haut pour se poser ici, sous le pouce. */}
        <MobileSortButton
          field={sort.field}
          direction={sort.direction}
          onFieldChange={sort.onFieldChange}
          onToggleDirection={sort.onToggleDirection}
        />

        {/* Maquette 150 : le « + » rejoint la barre. Trois couches flottaient
            l'une sur l'autre (FAB, cette barre, la barre d'onglets) et le FAB
            couvrait la pastille de la dernière ligne visible. Même évènement
            que l'ancien FAB global de `/tasks`, même nom accessible. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-task-create'))}
          aria-label={tCommon('nav.createTask')}
          data-tutorial-id="tasks-create"
          className="shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-black/10 active:scale-95 transition-transform"
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="search-panel"
            ref={panelRef}
            {...dialogProps}
            // ⚠️ `initial` porte l'opacité ET `y`, jamais `y` seul : sous `prefers-reduced-motion` la valeur initiale RESTE appliquée (surface `fixed` 16 px trop bas).
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            onPointerDownCapture={() => { pointerInPanel.current = true; }}
            // 🔴 Surface PLEINE et OPAQUE, pas un voile : chercher REMPLACE l'écran ; on sort par la croix, le repli du clavier ou Échap.
            // `z-50` : le cran PUBLIÉ des modales (`docs/UI-PATTERNS.md`). La carte démo (`z-[190]`) passe par-dessus toutes les modales ; ne pas inventer un cran (garde `design-system.guard`).
            className={`md:hidden fixed inset-0 z-50 flex flex-col px-gutter ${
              showSuggestions
                ? 'bg-[rgb(var(--color-background))]'
                // Transparent ET transparent aux gestes : la liste derrière
                // reste lisible et touchable, seul le champ capte les appuis.
                : 'pointer-events-none'
            }`}
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
              // Clavier ouvert : hauteur-clavier PLUS la gouttière de 12 px du repos (la barre d'outils Safari n'appartient pas à la page).
              paddingBottom: keyboardUp
                ? `calc(${keyboardInset}px + 0.75rem)`
                : 'calc(env(safe-area-inset-bottom) + 0.75rem)',
            }}
          >
            {showSuggestions && (
              <>
                {/* Le titre vit AU-DESSUS de la carte, pas dedans : casse
                    normale, 22 px, gras. L'en-tête gris en capitales qui
                    occupait la première ligne de la carte est supprimé. */}
                <p className="px-1 pb-3 text-title font-bold text-[rgb(var(--color-text-primary))]">
                  {t('search.suggestions')}
                </p>
                <div className="rounded-2xl bg-[rgb(var(--color-surface))] overflow-y-auto overscroll-contain min-h-0">
                  <ul>
                    {rows.map((row, index) => {
                      const Icon = row.icon;
                      // Séparateur EN RETRAIT, porté par un conteneur INTÉRIEUR au bouton (sur le `<li>` il traverserait la colonne d'icônes), jamais sous la dernière ligne.
                      const separated = index < rows.length - 1;
                      return (
                        <li key={row.key}>
                          <button
                            type="button"
                            onClick={row.onPick}
                            aria-pressed={row.active}
                            className="flex w-full items-center gap-3 pl-4 text-left active:bg-[rgb(var(--color-hover))]"
                          >
                            {Icon ? (
                              <Icon size={20} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent))]" />
                            ) : (
                              // Pastille de couleur : c'est la marque d'une liste
                              // dans toute la page (chips, feuille d'actions), on
                              // ne lui invente pas une icone.
                              <span aria-hidden="true" className="shrink-0 w-5 flex items-center justify-center">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.dot }} />
                              </span>
                            )}
                            <span
                              className={`flex flex-1 items-center gap-3 min-h-touch py-3 mr-4 ${
                                separated ? 'border-b border-[rgb(var(--color-border))]' : ''
                              }`}
                            >
                              <span className="flex-1 truncate text-body text-[rgb(var(--color-text-primary))]">
                                {row.label}
                              </span>
                              {row.active && (
                                <CheckCircle2 size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent))]" />
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}

            {/* Le vide du modèle : la carte reste en haut, le champ en bas. */}
            <div className="flex-1" aria-hidden="true" />

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* 🔴 La PILULE est portée par ce conteneur, pas par l'input.
                  `index.css` impose à TOUT `input` une bordure 1px et, au
                  focus, une bordure + un halo à la couleur d'accent, en
                  `!important` : c'est de là que venait l'anneau bleu, pas d'une
                  classe Tailwind qu'on pourrait retirer. L'échappatoire prévue
                  est `no-input-chrome`, mais elle force aussi
                  `border-radius: 0` : le champ doit donc être transparent à
                  l'intérieur d'un conteneur qui porte la forme. */}
              <div className="flex flex-1 items-center gap-2 h-12 rounded-full bg-[rgb(var(--color-chip-bg))] px-4">
                <Search size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
                <input
                  ref={inputRef}
                  id="search-tasks-mobile"
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  value={searchTerm}
                  onChange={(e) => onSearchTermChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') close(); }}
                  onBlur={handleBlur}
                  placeholder={t('search.placeholder')}
                  aria-label={t('filter.searchByName')}
                  className="no-input-chrome flex-1 min-w-0 bg-transparent text-body text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={t('search.close')}
                className="shrink-0 flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--color-chip-bg))] text-[rgb(var(--color-text-secondary))] active:bg-[rgb(var(--color-hover))]"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileTaskSearch;
