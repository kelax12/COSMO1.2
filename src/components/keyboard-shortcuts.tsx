// Source unique des raccourcis clavier — partagée entre le popup d'aide
// (ShortcutsHelp, touche « ? ») et l'onglet Apparence des Paramètres.
// Ainsi la liste ne diverge jamais entre les deux surfaces.

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

export interface Shortcut {
  /** Suite de touches à presser (affichées comme des <kbd>). */
  keys: string[];
  label: string;
}

export interface ShortcutGroup {
  title: string;
  items: Shortcut[];
  /** true = touches pressées l'une APRÈS l'autre (affiche « puis » entre elles). */
  sequential?: boolean;
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Général',
    items: [
      { keys: ['N'], label: 'Nouvelle tâche (quick-add en langage naturel)' },
      { keys: [IS_MAC ? '⌘' : 'Ctrl', 'K'], label: 'Palette de commandes (recherche globale, actions)' },
      { keys: ['/'], label: 'Rechercher dans la page Tâches' },
      { keys: ['['], label: 'Replier / déplier la barre latérale' },
      { keys: ['?'], label: 'Afficher cette aide' },
      { keys: ['Échap'], label: 'Fermer le modal / la palette en cours' },
    ],
  },
  {
    title: 'Navigation rapide (g puis…)',
    sequential: true,
    items: [
      { keys: ['G', 'D'], label: 'Aller à l’Accueil' },
      { keys: ['G', 'T'], label: 'Aller aux Tâches' },
      { keys: ['G', 'A'], label: 'Aller à l’Agenda' },
      { keys: ['G', 'H'], label: 'Aller aux Habitudes' },
      { keys: ['G', 'O'], label: 'Aller aux OKR' },
      { keys: ['G', 'S'], label: 'Aller aux Statistiques' },
    ],
  },
  {
    title: 'Liste de tâches',
    items: [
      { keys: ['↑', '↓'], label: 'Naviguer entre les lignes' },
      { keys: ['Entrée'], label: 'Ouvrir la tâche focalisée' },
      { keys: ['X'], label: 'Compléter / dé-compléter la tâche focalisée' },
    ],
  },
];

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd
    className="px-2 py-1 rounded-md border text-xs font-semibold"
    style={{
      borderColor: 'rgb(var(--color-border))',
      backgroundColor: 'rgb(var(--color-hover))',
      color: 'rgb(var(--color-text-primary))',
    }}
  >
    {children}
  </kbd>
);

/**
 * Rendu partagé de la liste des raccourcis (groupes + lignes).
 * `compact` réduit les marges verticales pour l'intégration dans une carte.
 */
export const ShortcutsList: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className={compact ? 'space-y-4' : 'space-y-5'}>
    {SHORTCUT_GROUPS.map((group) => (
      <div key={group.title}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-muted))' }}>
          {group.title}
        </p>
        <ul className="space-y-2.5">
          {group.items.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4">
              <span className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>{s.label}</span>
              <span className="flex items-center gap-1 shrink-0">
                {s.keys.map((k, i) => (
                  <span key={`${s.label}-${k}-${i}`} className="flex items-center gap-1">
                    {i > 0 && group.sequential && (
                      <span className="text-[11px]" style={{ color: 'rgb(var(--color-text-muted))' }}>puis</span>
                    )}
                    <Kbd>{k}</Kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);
