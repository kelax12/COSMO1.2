// ═══════════════════════════════════════════════════════════════════
// Le mode sélection, vu depuis l'extérieur de `TaskTable`
//
// Deux choses, et une seule raison : la barre de recherche mobile
// (`MobileTaskSearch`), ancrée en bas de l'écran, hors de l'arbre de
// `TaskTable`.
//
//   1. ENTRER dans le mode depuis sa suggestion « Sélectionner » — un appui,
//      un sens, donc un évènement `window`, comme `focus-overdue-tasks` ;
//   2. SAVOIR qu'on y est, pour s'effacer : la barre d'actions groupées se
//      pose à `safe-area + 84px`, exactement là où vit la barre de recherche.
//      Deux barres empilées au même endroit, et l'une des deux ne sert à rien
//      pendant qu'on coche des tâches.
//
// ⚠️ `active` est un MIROIR, pas la source. La vérité reste dans
// `useTaskSelection` (entrer, sortir, ce qui est coché). Un seul écrivain :
// `TaskQuickFilters`, qui reçoit déjà `selectMode` en prop et est monté en
// permanence — masqué sur mobile, pas démonté. Ne jamais écrire ce miroir
// depuis un second endroit : deux écrivains pour un booléen, c'est la
// divergence garantie le jour où l'un des deux oublie un chemin de sortie.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useSyncExternalStore } from 'react';

export const SELECT_MODE_REQUEST_EVENT = 'request-select-mode';

/** Demande l'entrée en mode sélection depuis n'importe où dans l'arbre. */
export function requestSelectMode(): void {
  window.dispatchEvent(new CustomEvent(SELECT_MODE_REQUEST_EVENT));
}

let active = false;
const listeners = new Set<() => void>();

const getSnapshot = (): boolean => active;
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) active = false;
  };
};

/**
 * Écoute la demande d'entrée, et publie l'état courant.
 *
 * Les deux vivent dans le même hook parce qu'ils ont le même unique
 * propriétaire : la pastille « Sélectionner » de `TaskQuickFilters`. Le
 * rapprochement évite qu'un futur consommateur ne publie le miroir de son côté.
 */
export function useSelectModeBridge(selectMode: boolean, onRequest: () => void): void {
  useEffect(() => {
    if (active === selectMode) return;
    active = selectMode;
    listeners.forEach((fn) => fn());
  }, [selectMode]);

  useEffect(() => {
    const handler = () => onRequest();
    window.addEventListener(SELECT_MODE_REQUEST_EVENT, handler);
    return () => window.removeEventListener(SELECT_MODE_REQUEST_EVENT, handler);
  }, [onRequest]);
}

/** Vrai pendant que la page Tâches est en mode sélection. */
export function useSelectModeActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
