// ═══════════════════════════════════════════════════════════════════
// Le filtre rapide de la page Tâches, partagé par deux surfaces
//
// Il vivait en `useState` dans `TaskTable`, seul endroit qui l'affichait
// (`TaskQuickFilters`). Depuis la refonte mobile de la recherche, une seconde
// surface le pilote ET doit le LIRE pour marquer la suggestion active : la
// barre de recherche ancrée en bas (`MobileTaskSearch`), qui n'est pas dans
// l'arbre de `TaskTable`.
//
// ⚠️ Un évènement `window` ne suffisait plus. C'est la convention du dépôt
// pour traverser une hiérarchie pour UN appui (`open-task-create`,
// `focus-overdue-tasks`), mais un évènement va dans un seul sens : la barre
// resterait aveugle au filtre courant. D'où un store externe — même forme que
// `app-mode.store.ts`, `useSyncExternalStore`, aucune dépendance.
//
// 🔴 Ce n'est PAS une préférence : c'est un état d'écran. Le dernier abonné
// parti (page démontée), il revient à `none` — sinon « Retard » resterait
// posé à la visite suivante, sans que rien à l'écran ne dise pourquoi la
// liste est courte.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useSyncExternalStore } from 'react';
import type { QuickFilter } from './TaskQuickFilters';

let current: QuickFilter = 'none';
const listeners = new Set<() => void>();

const getSnapshot = (): QuickFilter => current;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) current = 'none';
  };
};

/** Pose un filtre rapide (ou `none` pour tout montrer). */
export function setQuickFilter(next: QuickFilter): void {
  if (current === next) return;
  current = next;
  listeners.forEach((fn) => fn());
}

/**
 * Filtre rapide courant + bascule.
 *
 * `toggle` BASCULE : rappelé avec le filtre déjà actif, il l'éteint. C'est le
 * comportement des pastilles, et la raison pour laquelle `useOverdueFocus`
 * vérifie l'état avant d'appeler.
 */
export function useQuickFilter(): {
  activeQuickFilter: QuickFilter;
  toggleQuickFilter: (filter: Exclude<QuickFilter, 'none'>) => void;
} {
  const activeQuickFilter = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const toggleQuickFilter = useCallback(
    (filter: Exclude<QuickFilter, 'none'>) => setQuickFilter(current === filter ? 'none' : filter),
    [],
  );
  return { activeQuickFilter, toggleQuickFilter };
}
