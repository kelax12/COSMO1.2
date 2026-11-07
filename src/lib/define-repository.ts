// ═══════════════════════════════════════════════════════════════════
// defineRepository : LA manière d'instancier un dépôt (démo / Supabase)
// ═══════════════════════════════════════════════════════════════════
//
// Chaque dépôt se déclare par UN appel à `defineRepository(démo, production)`,
// et chaque côté est soit `eager` (classe importée statiquement, instanciée au
// premier accès), soit `lazy` (module chargé par `import()` au premier APPEL de
// méthode). Le singleton, l'oubli au changement de mode (faille B20) et
// `resetRepositories()` sont portés par ce seul mécanisme. Avant V12.3, le
// factory écrivait trois listes de singletons à la main (et `resetRepositories()`
// en oubliait trois), `org-config` avait son propre mandataire et `org-reports`
// choisissait son dépôt dans ses hooks.
//
// Les déclarations vivent dans `src/lib/repository.factory.ts`, sauf pour deux
// modules d'administration (`org-config`, `org-reports`) qui gardent leur
// accesseur dans leur propre dossier : le factory est dans le chunk d'ENTRÉE,
// et leurs écrans ne se chargent qu'à la demande.
//
// Ce qui rend `lazy` sûr, et ce qui le casserait : le mandataire est synchrone
// à la construction et n'attend le module qu'au premier APPEL : il suppose une
// interface 100 % asynchrone (que des méthodes rendant une promesse). Qu'une
// interface gagne un membre synchrone, une propriété ou un getter, et le
// mandataire cesse d'être transparent pour lui : ce dépôt doit alors passer en
// `eager` des deux côtés.

import { appModeStore } from './app-mode.store';

export type Implementation<T> =
  | { readonly kind: 'eager'; readonly make: () => T }
  | { readonly kind: 'lazy'; readonly load: () => Promise<T> };

/** Classe importée statiquement, instanciée au premier accès. */
export const eager = <T>(make: () => T): Implementation<T> => ({ kind: 'eager', make });

/** Module chargé par `import()` au premier appel de méthode (interface 100 % asynchrone). */
export const lazy = <T>(load: () => Promise<T>): Implementation<T> => ({ kind: 'lazy', load });

/**
 * Mandataire synchrone d'un dépôt dont le module arrive plus tard.
 *
 * Chaque méthode appelée attend le chargement puis délègue. Le module n'est
 * demandé qu'une fois : `pending` mémorise l'import en vol, sinon deux appels
 * simultanés (le cas normal : plusieurs hooks montent ensemble) en
 * déclencheraient deux.
 */
function lazyRepository<T extends object>(load: () => Promise<T>): T {
  let instance: T | null = null;
  let pending: Promise<T> | null = null;

  const resolve = (): Promise<T> => {
    if (instance) return Promise.resolve(instance);
    pending ??= load().then((repo) => {
      instance = repo;
      return repo;
    });
    return pending;
  };

  return new Proxy({} as T, {
    get: (_target, prop) => {
      // `then` doit rester absent : sans ça, `await getXRepository()` prendrait
      // le mandataire pour une promesse et tenterait de la dérouler.
      if (prop === 'then') return undefined;
      return (...args: unknown[]) =>
        resolve().then((repo) => {
          const method = (repo as Record<string | symbol, unknown>)[prop];
          if (typeof method !== 'function') {
            throw new Error(
              `dépôt différé : « ${String(prop)} » n'est pas une méthode. ` +
                'Le chargement différé suppose une interface 100 % asynchrone.',
            );
          }
          return (method as (...a: unknown[]) => unknown).apply(repo, args);
        });
    },
  });
}

interface Slot {
  instance: object | null;
}
const slots: Slot[] = [];

/**
 * Déclare un dépôt et rend son accesseur `getXRepository()`.
 *
 * L'instance est créée au premier accès selon `appModeStore.isDemo`, puis
 * gardée jusqu'au prochain changement de mode ou `resetRepositories()`.
 */
export function defineRepository<T extends object>(
  demo: Implementation<T>,
  supabase: Implementation<T>,
): () => T {
  const slot: Slot = { instance: null };
  slots.push(slot);
  return () => {
    if (!slot.instance) {
      const impl = appModeStore.isDemo ? demo : supabase;
      slot.instance = impl.kind === 'eager' ? impl.make() : lazyRepository(impl.load);
    }
    return slot.instance as T;
  };
}

/**
 * Oublie TOUS les dépôts déclarés (utile aux tests, appelé par `loginDemo()`).
 *
 * Appelé aussi à chaque changement de mode : sans ça, tout chemin qui appelle
 * `appModeStore.setDemo(...)` hors de `loginDemo()` laisserait des dépôts
 * pointant vers le mauvais backend (faille B20).
 */
export function resetRepositories(): void {
  for (const slot of slots) slot.instance = null;
}
appModeStore.subscribe(() => resetRepositories());
