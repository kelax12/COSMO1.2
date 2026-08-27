import { lazy } from 'react';
import type { ComponentType } from 'react';
import { ensureNamespaces, type Namespace } from '@/i18n/catalog';
import { localeStore } from '@/i18n/store';

/**
 * Import paresseux + rechargement si le chunk est obsolète.
 *
 * Cas visé : après un déploiement, le vieux `index.html` encore en mémoire dans
 * le navigateur référence des chunks qui n'existent plus sur le CDN. On retente
 * une fois, puis on force un reload pour récupérer un `index.html` frais.
 *
 * ── Second rôle : les catalogues i18n ──
 *
 * Seuls `common` et `errors` sont dans le chunk d'entrée (cf.
 * `src/i18n/catalog.ts`). Les 17 autres voyagent avec la page qui les utilise,
 * et sont attendus ICI, avant que le module ne résolve.
 *
 * 🔴 C'est le seul endroit où ces catalogues doivent être attendus. Le
 * `<Suspense>` qui enveloppe déjà l'import couvre l'attente. Déplacer ce
 * chargement dans un `useEffect` ferait rendre l'écran AVANT le catalogue, donc
 * afficherait des clés brutes (`org.project.name`) pendant une frame.
 *
 * Les deux chargements partent EN PARALLÈLE : le catalogue ne s'ajoute pas au
 * temps de chargement, il s'y superpose.
 *
 * ⚠️ Extrait de `src/App.tsx` (où il ne servait qu'aux routes) pour être
 * réutilisable à l'intérieur d'une page — les onglets de /entreprise s'en
 * servent. La logique n'a pas changé d'une ligne ; seul le type s'est ouvert
 * aux composants À PROPS, les routes n'en ayant aucune.
 *
 * ⚠️ `src/i18n/lazy-namespaces.guard.test.ts` lit les appels `lazyWithRetry`
 * **dans `App.tsx`** pour vérifier que chaque route déclare les catalogues de
 * son sous-arbre. Un appel posé ailleurs (comme dans OrganizationPage) n'est
 * pas vu par cette garde : ne jamais y compter sur le second argument pour
 * charger un catalogue que la ROUTE ne déclare pas déjà.
 */
export const lazyWithRetry = <P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  namespaces: readonly Namespace[] = [],
) =>
  lazy(async () => {
    const STORAGE_KEY = 'cosmo:chunk-reload-attempt';
    try {
      const [mod] = await Promise.all([
        factory(),
        ensureNamespaces(namespaces, localeStore.locale),
      ]);
      sessionStorage.removeItem(STORAGE_KEY);
      return mod;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isChunkError =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Importing a module script failed') ||
        message.includes('error loading dynamically imported module');

      if (isChunkError && !sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.setItem(STORAGE_KEY, '1');
        window.location.reload();
        // Promise jamais résolue : la page va recharger.
        return new Promise<{ default: ComponentType<P> }>(() => {});
      }
      throw err;
    }
  });
