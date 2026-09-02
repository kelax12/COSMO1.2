// Source unique des raccourcis clavier — partagée entre le popup d'aide
// (ShortcutsHelp, touche « ? ») et l'onglet Apparence des Paramètres.
// Ainsi la liste ne diverge jamais entre les deux surfaces.
//
// ⚠️ Les libellés sont des CLÉS, pas des phrases. Une constante de module qui
// porte du texte traduit fige la langue au premier import — c'est le piège déjà
// rencontré sur `chartConfig` et `NAV_GROUPS`, et la raison pour laquelle cette
// liste est restée entièrement en français alors que tout l'écran autour d'elle
// était traduit. La traduction a lieu au rendu, dans `ShortcutsList`.

import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

type CommonKey = KeyOf<'common'>;

export interface Shortcut {
  /** Suite de touches à presser (affichées comme des <kbd>). */
  keys: string[];
  labelKey: CommonKey;
}

export interface ShortcutGroup {
  titleKey: CommonKey;
  items: Shortcut[];
  /** true = touches pressées l'une APRÈS l'autre (affiche « puis » entre elles). */
  sequential?: boolean;
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: 'shortcuts.groups.general',
    items: [
      { keys: ['N'], labelKey: 'shortcuts.keys.newTask' },
      { keys: [IS_MAC ? '⌘' : 'Ctrl', 'K'], labelKey: 'shortcuts.keys.commandPalette' },
      { keys: ['/'], labelKey: 'shortcuts.keys.searchTasks' },
      { keys: ['['], labelKey: 'shortcuts.keys.toggleSidebar' },
      { keys: ['?'], labelKey: 'shortcuts.keys.help' },
      { keys: ['Échap'], labelKey: 'shortcuts.keys.closeOverlay' },
    ],
  },
  {
    titleKey: 'shortcuts.groups.navigation',
    sequential: true,
    items: [
      { keys: ['G', 'D'], labelKey: 'shortcuts.keys.goDashboard' },
      { keys: ['G', 'T'], labelKey: 'shortcuts.keys.goTasks' },
      { keys: ['G', 'A'], labelKey: 'shortcuts.keys.goAgenda' },
      { keys: ['G', 'H'], labelKey: 'shortcuts.keys.goHabits' },
      { keys: ['G', 'O'], labelKey: 'shortcuts.keys.goOkr' },
      { keys: ['G', 'S'], labelKey: 'shortcuts.keys.goStatistics' },
    ],
  },
  {
    titleKey: 'shortcuts.groups.tasks',
    items: [
      { keys: ['↑', '↓'], labelKey: 'shortcuts.keys.moveRows' },
      { keys: ['Entrée'], labelKey: 'shortcuts.keys.openTask' },
      { keys: ['X'], labelKey: 'shortcuts.keys.toggleTask' },
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
export const ShortcutsList: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { t } = useT('common');
  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.titleKey}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-muted))' }}>
            {t(group.titleKey)}
          </p>
          <ul className="space-y-2.5">
            {group.items.map((s) => (
              <li key={s.labelKey} className="flex items-center justify-between gap-4">
                <span className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>{t(s.labelKey)}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {s.keys.map((k, i) => (
                    <span key={`${s.labelKey}-${k}-${i}`} className="flex items-center gap-1">
                      {i > 0 && group.sequential && (
                        <span className="text-[11px]" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('shortcuts.then')}</span>
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
};
