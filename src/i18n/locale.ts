// Source de vérité unique de la locale COSMO.
//
// Calqué sur `src/lib/theme.ts` : même découpage (type + guard + défaut +
// résolution + application sur `<html>`), pour la même raison — la résolution
// doit être appelable AVANT le premier paint depuis `src/main.tsx` autant que
// depuis React, sans que les deux copies puissent diverger.
// Deux ensembles distincts, ne pas les confondre :
//   - `ALL_LOCALES`       : le domaine du type `Locale` (les catalogues qui
//                           existent dans src/locales/).
//   - `SUPPORTED_LOCALES` : les locales réellement exposées aux utilisateurs.
// Ouvrir une langue = l'ajouter à `SUPPORTED_LOCALES` (et rien d'autre).

export type Locale = 'fr' | 'en' | 'es';

/** Domaine du type — toute locale pour laquelle un catalogue peut exister. */
export const ALL_LOCALES: readonly Locale[] = ['fr', 'en', 'es'];

/**
 * Locales réellement servies. La locale par défaut est TOUJOURS la première et
 * n'est jamais préfixée dans l'URL (cf. src/i18n/routes.ts).
 *
 * Phase 1 (socle) : `fr` seule — le comportement de l'app est inchangé.
 * Phase 2 ouvrira `en`, phase 6 `es`.
 */
export const SUPPORTED_LOCALES: readonly Locale[] = ['fr'];

export const DEFAULT_LOCALE: Locale = 'fr';

export const LOCALE_STORAGE_KEY = 'cosmo_locale';

/** Étiquette BCP 47 — `Intl.*`, `toLocaleDateString`, `<html lang>` étendu. */
export const BCP47_TAG: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
};

/** Valeur de `og:locale` (Open Graph attend le séparateur `_`). */
export const OG_LOCALE: Record<Locale, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  es: 'es_ES',
};

/** Nom de la langue dans la langue elle-même (sélecteur de langue). */
export const LOCALE_LABEL: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
};

/** `true` si la valeur est une locale connue (catalogue existant). */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (ALL_LOCALES as readonly string[]).includes(value);
}

/** `true` si la valeur est une locale actuellement servie aux utilisateurs. */
export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Locale déduite des préférences du navigateur.
 *
 * On ne compare que la sous-étiquette primaire : `es-419`, `es-MX` et `es` sont
 * tous de l'espagnol pour nous. Une langue non servie est ignorée au profit de
 * la suivante dans la liste, et non rabattue immédiatement sur le défaut — un
 * navigateur réglé sur `['de', 'es']` doit obtenir `es`, pas `fr`.
 */
export function detectLocale(preferred?: readonly string[]): Locale {
  const languages = preferred ?? readNavigatorLanguages();
  for (const tag of languages) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isSupportedLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

function readNavigatorLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  // `navigator.languages` est ordonné par préférence ; `language` est le
  // fallback des vieux WebKit où `languages` peut être vide.
  const list = navigator.languages;
  if (list && list.length > 0) return list;
  return navigator.language ? [navigator.language] : [];
}

/** Lit la préférence persistée, `null` si absente ou invalide. */
export function readStoredLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) return saved;
  } catch {
    /* localStorage inaccessible (navigation privée stricte) */
  }
  return null;
}

/** Persiste la préférence. Silencieux si localStorage est inaccessible. */
export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* navigation privée stricte — la locale reste correcte pour la session */
  }
}

/**
 * Locale initiale, par ordre de précédence :
 *
 *   1. préfixe de l'URL   — une URL partagée doit s'afficher dans SA langue,
 *                            quelle que soit la préférence du visiteur ;
 *   2. préférence persistée ;
 *   3. langue du navigateur ;
 *   4. `DEFAULT_LOCALE`.
 *
 * Fonction de lecture pure : elle ne persiste rien (c'est le rôle du store,
 * cf. src/i18n/store.ts) et ne redirige pas.
 */
export function resolveInitialLocale(pathname?: string): Locale {
  const path = pathname ?? (typeof window === 'undefined' ? '/' : window.location.pathname);
  // Un préfixe reconnu mais non servi (`/es/…` avant l'ouverture de l'espagnol)
  // ne doit pas imposer une locale que l'app ne sait pas rendre : on retombe
  // sur la préférence. Le routeur, lui, répondra 404 sur ce chemin.
  const fromUrl = localeFromPathname(path);
  if (fromUrl && isSupportedLocale(fromUrl)) return fromUrl;
  return readStoredLocale() ?? detectLocale();
}

/**
 * Locale portée par le premier segment du chemin, `null` sinon.
 *
 * Reconnaît TOUTE locale connue (`ALL_LOCALES`), pas seulement celles servies :
 * c'est ce qui permet au routeur de distinguer `/es/tasks` (langue connue, pas
 * encore ouverte → 404 délibéré) de `/de/tasks` (segment quelconque, qui peut
 * très bien être une vraie route). Le filtrage par `isSupportedLocale` est la
 * responsabilité du routeur, pas de l'analyse de chemin.
 *
 * Vit dans ce module — et non dans `routes.ts` qui l'importe — parce que
 * `resolveInitialLocale` en a besoin et que `main.tsx` doit pouvoir l'appeler
 * sans tirer le routeur dans le chunk d'entrée.
 */
export function localeFromPathname(pathname: string): Locale | null {
  const first = pathname.split('/').filter(Boolean)[0];
  if (!first) return null;
  const candidate = first.toLowerCase();
  return isLocale(candidate) ? candidate : null;
}

/**
 * Pose la locale sur `<html>` : `lang` (a11y, moteurs, synthèse vocale) et
 * `dir`. Les trois locales sont LTR ; `dir` est écrit explicitement pour que
 * l'ajout d'une langue RTL n'ait qu'un seul endroit à changer.
 */
export function applyLocale(root: HTMLElement, locale: Locale): void {
  root.setAttribute('lang', locale);
  root.setAttribute('dir', 'ltr');
}
