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
