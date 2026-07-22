// Source de vérité unique du thème COSMO.
//
// La résolution du thème était dupliquée à trois endroits (`src/main.tsx` pour
// l'application avant le premier paint, `src/hooks/useDarkMode.ts` pour l'app
// React, `src/components/ThemeToggle.tsx` pour la liste affichée) — trois
// copies qui pouvaient diverger. Tout passe désormais par ce module.

export type Theme = 'light' | 'dark' | 'gris' | 'noir';

export const THEME_STORAGE_KEY = 'theme';

/** Breakpoint mobile — aligné sur `useIsMobile()` (src/lib/hooks/use-mobile.tsx). */
const MOBILE_BREAKPOINT = 768;

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'gris' || value === 'noir';
}

/**
 * Thème appliqué quand l'utilisateur n'a jamais choisi.
 *
 * Sur mobile on part sur `gris` (fond graphite + accent bleu, palette GitHub) :
 * c'est la base du design system mobile. Sur desktop on conserve le
 * comportement historique (préférence système) — le desktop n'est pas
 * concerné par la refonte mobile.
 */
export function defaultTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  if (window.innerWidth < MOBILE_BREAKPOINT) return 'gris';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Thème persisté s'il est valide, sinon `defaultTheme()`.
 *
 * Migration : `black` (ancien nom de la palette GitHub, renommée `gris` quand
 * le vrai thème Noir — OLED + monochrome — a été restauré comme 4e thème), et
 * les encore plus anciens `midnight`/`monochrome`, sont réécrits vers `gris`
 * en localStorage pour ne pas faire retomber un utilisateur existant sur
 * `defaultTheme()` (qui donnerait `light` sur desktop). Aucun de ces anciens
 * noms ne migre automatiquement vers `noir` — c'est un choix explicite.
 */
export function resolveInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'black' || saved === 'midnight' || saved === 'monochrome') {
      localStorage.setItem(THEME_STORAGE_KEY, 'gris');
      return 'gris';
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
 * - `gris` : override graphite/accent bleu (palette GitHub) des variables de couleur
 * - `noir` : override OLED quasi-noir + accent quasi-blanc (haute accessibilité)
 */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  // `test` / `glass` / `midnight` / `monochrome` / `black` : reliquats
  // d'anciens thèmes, purgés au passage.
  root.classList.remove('dark', 'gris', 'noir', 'black', 'test', 'monochrome', 'midnight', 'glass');

  if (theme !== 'light') root.classList.add('dark');
  if (theme === 'gris') root.classList.add('gris');
  if (theme === 'noir') root.classList.add('noir');
}
