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
import {
  applyLocale,
  isSupportedLocale,
  persistLocale,
  resolveInitialLocale,
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

export const localeStore = new LocaleStore(resolveInitialLocale());

/** Locale courante, réactive. */
export function useLocale(): Locale {
  return useSyncExternalStore(
    (callback) => localeStore.subscribe(callback),
    () => localeStore.locale,
    () => localeStore.locale
  );
}
