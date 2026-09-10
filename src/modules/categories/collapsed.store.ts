// ═══════════════════════════════════════════════════════════════════
// ÉTAT REPLIÉ DE L'ARBRE DES CATÉGORIES
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE MAGASIN NE VIT PAS DANS `ui-states`.
//
// Il y a d'abord vécu, et ça a coûté 1,4 ko à TOUT LE MONDE. `ui-states` est
// chargé d'emblée, parce que le `Layout` l'importe : ce qu'on y pose atterrit
// dans le chunk d'ENTRÉE, donc dans le premier octet servi à quelqu'un qui
// ouvre la landing. Or cet état-là ne sert qu'à qui ouvre l'arbre des
// catégories.
//
// Mesuré : chunk d'entrée à 77,0 ko au point de départ de la branche, 78,4 ko
// une fois le magasin posé dans `ui-states`, pour un plafond de 78,0
// (`npm run check:bundle`). ❌ Le plafond ne se remonte pas — c'est le code qui
// se déplace.
//
// ⚠️ Volontairement PAS ré-exporté par `src/modules/categories/index.ts` : ce
// baril est importé par une douzaine de composants, et l'y ajouter remettrait
// le magasin exactement là d'où il sort. Ses deux consommateurs le nomment.
//
// 🔴 ON MÉMORISE CE QUI EST REPLIÉ, jamais ce qui est déplié. Une catégorie
// nouvellement créée n'est dans aucune des deux listes, et le défaut doit être
// « visible » : mémoriser les dépliées ferait naître chaque nouvel enfant
// invisible sous son parent.
//
// ⚠️ Un seul magasin, partagé par la modale de gestion et l'arbre du filtre.
// Deux magasins, ce seraient deux états qui divergent dès qu'on replie une
// branche d'un côté.

import { useCallback, useSyncExternalStore } from 'react';

/** Catégories repliées dans l'arbre, par identifiant. */
export const CATEGORY_COLLAPSED_KEY = 'cosmo_category_collapsed';

/**
 * ⚠️ Lecture dans un `try/catch` : un `JSON.parse` nu sur `localStorage` fait
 * tomber la page si la valeur est corrompue (règle B14).
 */
function readCollapsedCategories(): string[] {
  try {
    const stored = localStorage.getItem(CATEGORY_COLLAPSED_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch { /* ignore */ }
  return [];
}

let collapsedCategoriesState: string[] = readCollapsedCategories();
const collapsedCategoriesListeners = new Set<() => void>();

// Synchronisation entre onglets, comme les magasins de `ui-states`.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CATEGORY_COLLAPSED_KEY) {
      collapsedCategoriesState = readCollapsedCategories();
      collapsedCategoriesListeners.forEach((l) => l());
    }
  });
}

export const useCollapsedCategories = () => {
  const collapsed = useSyncExternalStore(
    (cb) => { collapsedCategoriesListeners.add(cb); return () => collapsedCategoriesListeners.delete(cb); },
    () => collapsedCategoriesState,
    () => collapsedCategoriesState,
  );

  const setCollapsed = useCallback((id: string, isCollapsed: boolean) => {
    const next = isCollapsed
      ? [...collapsedCategoriesState.filter((c) => c !== id), id]
      : collapsedCategoriesState.filter((c) => c !== id);
    collapsedCategoriesState = next;
    try { localStorage.setItem(CATEGORY_COLLAPSED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    collapsedCategoriesListeners.forEach((l) => l());
  }, []);

  const isCollapsed = useCallback((id: string) => collapsed.includes(id), [collapsed]);

  return { collapsed, setCollapsed, isCollapsed };
};
