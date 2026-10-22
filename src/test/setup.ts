// Vitest global setup. Registers DOM cleanup after each test so that
// @testing-library/react renders don't accumulate in document.body across
// tests in the same file. The dynamic import keeps node-environment tests
// (the vast majority — pure logic) from loading react-dom needlessly.
import { afterEach, beforeAll } from 'vitest';

// ──────────────────────────────────────────────────────────────────
// Locale déterministe
//
// jsdom annonce `navigator.language = 'en-US'`. Sans cette contrainte, le store
// i18n résout `en` dans les tests DOM et `fr` dans les tests node : les dates,
// les libellés et les pluriels changeraient selon l'ENVIRONNEMENT du test, pas
// selon ce qu'il vérifie. Un test qui casse en changeant `environment` n'apprend
// rien sur le code.
//
// Le français est la locale de référence : c'est aussi ce que les assertions
// existantes attendent. Un test qui veut vérifier une autre langue doit la
// poser explicitement via `localeStore.setLocale()`.
// ──────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────
// Tous les catalogues, chargés d'avance
//
// 🔴 POURQUOI (2026-09-04). Deux namespaces seulement sont EAGER dans le
// bundle (`common`, `errors`) ; les autres arrivent par `import()` quand la
// route qui les déclare se charge. Un test, lui, ne charge aucune route : il
// ne voyait donc que ces deux-là, et tout code lisant un namespace paresseux
// rendait sa clé brute.
//
// Tant que `common` contenait presque tout, ça ne se voyait pas. En sortir
// neuf sections (C-14, namespace `overlays`) a fait tomber trois fichiers de
// test d'un coup — non parce que le produit avait cassé, mais parce que la
// suite dépendait d'un détail de DÉCOUPAGE du bundle. Un test qui casse en
// déplaçant une clé d'un catalogue à l'autre n'apprend rien sur le code.
//
// On enregistre donc les catalogues de référence (fr) pour tout le monde. Un
// test qui veut vérifier une autre langue la pose explicitement.
// ──────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const { registerCatalog } = await import('@/i18n/catalog');
  type Catalog = Parameters<typeof registerCatalog>[2];
  const modules = import.meta.glob('@/locales/fr/*.json', { eager: true }) as Record<
    string,
    { default: Catalog }
  >;
  for (const [path, mod] of Object.entries(modules)) {
    const ns = path.split('/').pop()?.replace('.json', '');
    if (!ns) continue;
    // Le cast est confiné ici : `import.meta.glob` ne peut pas typer ses clés,
    // et `registerCatalog` ignore un namespace inconnu.
    registerCatalog('fr', ns as Parameters<typeof registerCatalog>[1], mod.default);
  }
});

beforeAll(async () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('cosmo_locale', 'fr');
  } catch {
    /* stockage indisponible — le défaut reste le français */
  }
  const { localeStore } = await import('@/i18n/store');
  localeStore.setLocale('fr');
});

afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});
