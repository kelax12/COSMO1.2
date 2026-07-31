// Store de locale — source de vérité runtime, lisible hors du routeur.
//
// Pourquoi un store et pas `useParams()` : dans `src/App.tsx`, `Toaster`,
// `CookieBanner`, `ShareInviteClaimer` et `CommandPalette` sont des FRÈRES de
// `<AppRoutes/>`, pas des descendants. Ils n'ont aucun accès aux params de
// route. Un store externe est le seul point de lecture commun à l'app entière.
//
// Même pattern que `src/lib/app-mode.store.ts` : classe + `Set` d'écouteurs +
// `useSyncExternalStore`.

import { useSyncExternalStore } from 'react';
import { resolveRouterBootstrap } from './bootstrap';
import {
  DEFAULT_LOCALE,
  applyLocale,
  isSupportedLocale,
  persistLocale,
  type Locale,
} from './locale';

type LocaleListener = (locale: Locale) => void;

class LocaleStore {
  private _locale: Locale;
  private listeners: Set<LocaleListener> = new Set();

  constructor(initial: Locale) {
    this._locale = initial;
  }

  get locale(): Locale {
    return this._locale;
  }

  /**
   * Change la locale : persiste, met `<html lang>` à jour, notifie.
   *
   * `persist: false` sert au cas « l'URL impose une locale » — le routeur
   * aligne le store sur l'URL sans écraser la préférence de l'utilisateur, qui
   * doit survivre à la visite d'un lien partagé dans une autre langue.
   */
  setLocale(locale: Locale, options: { persist?: boolean } = {}): void {
    if (!isSupportedLocale(locale)) return;
    if (options.persist !== false) persistLocale(locale);
    if (this._locale === locale) return;
    this._locale = locale;
    if (typeof document !== 'undefined') applyLocale(document.documentElement, locale);
    this.listeners.forEach((fn) => fn(locale));
  }

  subscribe(listener: LocaleListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
 * Locale initiale du store — DOIT être calculée par le même amorçage que le
 * routeur (`src/main.tsx`), et non par `resolveInitialLocale`.
 *
 * Les deux ne disent pas la même chose : `resolveInitialLocale` applique la
 * chaîne « URL > préférence > navigateur », alors que l'amorçage applique
 * l'invariant de la phase 2 — **pas de préfixe ⇒ locale par défaut**. Sur
 * `/a-propos` avec un navigateur anglais, le premier répondait `en` et le
 * second `fr`.
 *
 * Cette divergence n'était pas cosmétique : `App.tsx` déclare les slugs publics
 * d'après `useLocale()`, donc le store en `en` faisait chercher le slug
 * `about` — et `/a-propos` tombait en 404 chez tout visiteur anglophone.
 *
 * L'ordre d'évaluation est sûr : les imports d'un module sont évalués avant son
 * corps, donc ce calcul lit l'URL d'origine, exactement comme `main.tsx` juste
 * après. Les deux ne peuvent pas diverger.
 */
function initialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    return resolveRouterBootstrap({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    }).locale;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export const localeStore = new LocaleStore(initialLocale());

/** Locale courante, réactive. */
export function useLocale(): Locale {
  return useSyncExternalStore(
    (callback) => localeStore.subscribe(callback),
    () => localeStore.locale,
    () => localeStore.locale
  );
}
