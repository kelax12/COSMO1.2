import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bookmark, CheckCircle2, CheckSquare, Search, Users, X } from 'lucide-react';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { measureKeyboardInset, useKeyboardInset } from '@/lib/hooks/use-keyboard-inset';
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

/**
 * Montée du viewport visuel, AU-DESSUS de sa valeur au repos, à partir de
 * laquelle on tient un clavier pour ouvert. Relatif, jamais absolu : la valeur
 * au repos vaut 0 sur un émulateur et ~60 à 100 px dans Safari iOS.
 */
const KEYBOARD_LIFT_PX = 80;

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

  // ── Ligne de base du viewport visuel ────────────────────────────────
  //
  // 🔴 Mesurée À L'OUVERTURE, sur l'appareil, clavier encore fermé. Elle vaut
  // 0 sur un émulateur et ~60 à 100 px dans Safari iOS, dont la barre d'outils
  // rogne déjà le viewport visuel. Une première version comparait la mesure
  // brute à des constantes (« > 60 = clavier ouvert ») : verte ici, fausse sur
  // un vrai téléphone, où le champ flottait et où replier le clavier ne
  // refermait plus rien.
  //
  // ⚠️ Lue par `measureKeyboardInset()`, PAS dans l'état du hook : celui-ci ne
  // publie sa première valeur qu'après son effet, donc il vaut encore 0 à
  // l'instant où l'overlay s'ouvre. Mesuré : ligne de base à 0 au lieu de 90,
  // donc un repos pris pour un clavier, donc le champ posé 90 px trop haut
  // dès l'ouverture.
  const restingInset = useRef(0);
  useEffect(() => {
    if (open) restingInset.current = measureKeyboardInset();
  }, [open]);

  const keyboardUp = keyboardInset - restingInset.current > KEYBOARD_LIFT_PX;

  // ── Le clavier se referme, la recherche aussi (modèle Notes) ────────
  //
  // Le signal est le champ qui PERD LE FOCUS : la touche « OK » de la barre
  // d'accessoires iOS, comme le repli du clavier, le déclenchent. Le viewport
  // visuel ne sert plus qu'à placer le champ — le faire arbitrer la fermeture
  // demandait de savoir à quelle hauteur repose un appareil qu'on n'a pas.
  //
  // ⚠️ Un `blur` nu rendrait les suggestions INTOUCHABLES : sur un appui, le
  // champ perd le focus AVANT que le `click` n'atteigne la ligne. D'où le
  // garde `pointerInPanel`, posé au `pointerdown` n'importe où dans le
  // panneau et levé après coup : pendant un appui, le blur ne ferme rien, et
  // c'est le gestionnaire de la ligne qui décide.
  const pointerInPanel = useRef(false);
  const handleBlur = () => {
    if (pointerInPanel.current) return;
    close();
  };

  // 🔴 Le garde se lève sur `window`, jamais sur le panneau. Taper une
  // suggestion DÉMONTE le panneau depuis le gestionnaire de clic : son
  // `onPointerUp` n'arrive alors jamais, le garde resterait levé pour de bon,
  // et le repli du clavier ne refermerait plus rien pour le reste de la
  // session. Remise à zéro aussi à chaque ouverture, pour ne rien devoir au
  // cycle de vie d'une surface qui va et vient.
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

  const barBottom = 'calc(4rem + env(safe-area-inset-bottom) + 0.5rem)';

  // Champ vide = l'écran du modèle (plein, opaque, suggestions). Dès la
  // première frappe, le fond s'efface : le modèle remplit cet espace avec ses
  // résultats, et COSMO ne le peut pas sans remonter toute sa liste de tâches
  // ici. Plutôt que de chercher à l'aveugle derrière un fond opaque, on rend
  // la liste à la vue et on ne garde que le champ ancré.
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
        className={`${open ? 'hidden' : ''} md:hidden fixed inset-x-0 z-30 px-gutter`}
        style={{ bottom: barBottom }}
        data-tutorial-id="tasks-search"
      >
        <div className="flex items-center gap-2 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg shadow-black/10 pl-4 pr-2 h-12">
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
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="search-panel"
            ref={panelRef}
            {...dialogProps}
            // ⚠️ `initial` porte l'opacité ET `y`, jamais `y` seul : sous
            // `prefers-reduced-motion`, `MotionConfig reducedMotion="user"` ne
            // joue pas les transforms et la valeur initiale RESTE appliquée.
            // Une surface `fixed` resterait 16 px trop bas, définitivement.
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            onPointerDownCapture={() => { pointerInPanel.current = true; }}
            // 🔴 Surface PLEINE et OPAQUE, pas un voile sur la liste. Dans le
            // modèle, chercher REMPLACE l'écran : la liste de notes disparaît,
            // le fond est celui de l'app, et rien ne transparaît derrière. Il
            // n'y a donc plus de « taper à côté pour fermer » : on sort par la
            // croix, par le repli du clavier, ou par Échap.
            // `z-50` : le cran PUBLIÉ des modales et feuilles
            // (`docs/UI-PATTERNS.md`), et rien d'autre. En mode démo, la carte
            // « Gardez votre organisation » (`z-[190]`) se pose par-dessus,
            // mais elle se pose par-dessus TOUTES les modales de l'app : c'est
            // une propriété de ce composant-là, pas un défaut de cet écran, et
            // inventer un cran de plus pour la contourner rouvrirait ce que la
            // garde `design-system.guard` a fermé.
            className={`md:hidden fixed inset-0 z-50 flex flex-col px-gutter ${
              showSuggestions
                ? 'bg-[rgb(var(--color-background))]'
                // Transparent ET transparent aux gestes : la liste derrière
                // reste lisible et touchable, seul le champ capte les appuis.
                : 'pointer-events-none'
            }`}
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
              // Clavier ouvert : on remonte du hauteur-clavier, PLUS la même
              // gouttière de 12 px qu'au repos. Le modèle garde cette
              // respiration au-dessus des touches ; la coller à 0 ne retirait
              // rien à la barre d'outils de Safari, qui n'appartient pas à la
              // page et qu'aucune règle CSS n'atteint.
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
                <div className="rounded-2xl bg-[rgb(var(--color-surface))] overflow-hidden">
                  <ul>
                    {SUGGESTIONS.map((suggestion, index) => {
                      const Icon = suggestion.icon;
                      const isActive = suggestion.kind === 'filter' && activeQuickFilter === suggestion.value;
                      // Séparateur EN RETRAIT : il commence à l'aplomb du
                      // libellé et s'arrête avant le bord droit, jamais bord à
                      // bord, et jamais sous la dernière ligne. Il est donc
                      // porté par un conteneur INTÉRIEUR au bouton : posé sur
                      // le `<li>`, il traverserait aussi la colonne d'icônes.
                      const separated = index < SUGGESTIONS.length - 1;
                      return (
                        <li key={suggestion.labelKey}>
                          <button
                            type="button"
                            onClick={() => pick(suggestion)}
                            aria-pressed={suggestion.kind === 'filter' ? isActive : undefined}
                            className="flex w-full items-center gap-3 pl-4 text-left active:bg-[rgb(var(--color-hover))]"
                          >
                            <Icon
                              size={20}
                              aria-hidden="true"
                              className="shrink-0 text-[rgb(var(--color-accent))]"
                            />
                            <span
                              className={`flex flex-1 items-center gap-3 min-h-touch py-3 mr-4 ${
                                separated ? 'border-b border-[rgb(var(--color-border))]' : ''
                              }`}
                            >
                              <span className="flex-1 text-body text-[rgb(var(--color-text-primary))]">
                                {t(suggestion.labelKey)}
                              </span>
                              {isActive && (
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
