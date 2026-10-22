// ═══════════════════════════════════════════════════════════════════
// « La recherche mobile est ouverte » — lu par la PAGE, écrit par la barre
//
// Dès qu'un caractère est saisi, l'écran de recherche devient transparent pour
// rendre la liste filtrée à la vue (cf. `MobileTaskSearch`). Or tout ce qui
// vit AU-DESSUS de la première tâche — titre de page, compteurs, listes, tri,
// pilules de filtre, astuce de balayage — repoussait cette liste sous le champ
// : sur un iPhone, il restait une tâche et demie visible entre le dernier
// bandeau et le clavier. Ces surfaces s'effacent donc pendant la recherche.
//
// ⚠️ Un état local dans `TasksPage` ne suffisait pas : `SwipeHintBanner` vit
// deux niveaux plus bas, dans `TaskTable`, qui est à son plafond de 600 lignes
// (`architecture.guard`) et ne peut pas recevoir une prop de plus. Un store
// externe se lit où on en a besoin sans traverser l'arbre.
//
// 🔴 État d'ÉCRAN, pas préférence : le dernier abonné parti (page démontée),
// il revient à `false`. Même forme que `quick-filter.store.ts`.
// ═══════════════════════════════════════════════════════════════════
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

const getSnapshot = (): boolean => open;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) open = false;
  };
};

/** Ouvre ou ferme l'écran de recherche mobile. */
export function setSearchOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  listeners.forEach((fn) => fn());
}

/** Vrai tant que l'écran de recherche mobile est ouvert. */
export function useSearchOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Classes à poser sur les blocs qui s'effacent pendant la recherche.
 *
 * ⚠️ Deux variantes, parce que la classe de RETOUR doit rendre à chaque bloc
 * son affichage NATUREL : `md:block` sur une rangée `flex` la casserait dès que
 * la fenêtre s'élargit pendant une recherche. L'écran est `md:hidden`, mais
 * `searchOpen`, lui, reste vrai.
 *
 * Ici plutôt que dans `TasksPage`, qui frôle son plafond de 600 lignes.
 */
export function useHiddenWhileSearching(): { block: string; flex: string } {
  const open = useSearchOpen();
  return {
    block: open ? 'hidden md:block' : '',
    flex: open ? 'hidden md:flex' : '',
  };
}
