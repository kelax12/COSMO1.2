// Source de vérité unique du thème COSMO.
//
// La résolution du thème était dupliquée à trois endroits (`src/main.tsx` pour
// l'application avant le premier paint, `src/hooks/useDarkMode.ts` pour l'app
// React, `src/components/ThemeToggle.tsx` pour la liste affichée) — trois
// copies qui pouvaient diverger. Tout passe désormais par ce module.

export type Theme = 'light' | 'dark' | 'black';

export const THEME_STORAGE_KEY = 'theme';

/** Breakpoint mobile — aligné sur `useIsMobile()` (src/lib/hooks/use-mobile.tsx). */
const MOBILE_BREAKPOINT = 768;

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'black';
}

/**
 * Thème appliqué quand l'utilisateur n'a jamais choisi.
 *
 * Sur mobile on part sur `black` (fond graphite + accent bleu, palette GitHub) :
 * c'est la base du design system mobile. Sur desktop on conserve le
 * comportement historique (préférence système) — le desktop n'est pas
 * concerné par la refonte mobile.
 */
export function defaultTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  if (window.innerWidth < MOBILE_BREAKPOINT) return 'black';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Thème persisté s'il est valide, sinon `defaultTheme()`.
 *
 * Migration : `midnight` et `monochrome` (anciens thèmes, fusionnés en un
 * seul `black` — palette GitHub) sont réécrits vers `black` en localStorage
 * pour ne pas faire retomber un utilisateur existant sur `defaultTheme()`
 * (qui donnerait `light` sur desktop).
 */
export function resolveInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'midnight' || saved === 'monochrome') {
      localStorage.setItem(THEME_STORAGE_KEY, 'black');
      return 'black';
    }
    if (isTheme(saved)) return saved;
  } catch {
    /* localStorage inaccessible (navigation privée stricte) */
  }
  return defaultTheme();
}

/**
 * Pose les classes du thème sur `<html>`.
 *
 * - `dark` : variants Tailwind `dark:` + bloc `.dark` de src/index.css
 * - `black` : override graphite/accent bleu (palette GitHub) des variables de couleur
 */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  // `test` / `glass` / `midnight` / `monochrome` : reliquats d'anciens thèmes, purgés au passage.
  root.classList.remove('dark', 'black', 'test', 'monochrome', 'midnight', 'glass');

  if (theme !== 'light') root.classList.add('dark');
  if (theme === 'black') root.classList.add('black');
}
