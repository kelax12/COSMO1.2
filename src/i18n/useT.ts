// Hook de traduction — `const { t, tp } = useT('common')`.
//
// `t` est typée par le catalogue `fr` : une clé inexistante est une erreur de
// compilation, pas une chaîne brute affichée en prod.

import { useMemo } from 'react';
import { getCatalog, getFallbackCatalog, type KeyOf, type Namespace, type PluralKeyOf } from './catalog';
import { localeStore, useLocale } from './store';
import { translate, type TranslationVars } from './translate';
import type { Locale } from './locale';

export interface Translator<N extends Namespace> {
  /** Traduit une clé. `t('actions.save')`, `t('greeting', { name })`. */
  t: (key: KeyOf<N>, vars?: TranslationVars) => string;
  /** Traduit une clé plurielle. `tp('count.task', 3)` → « 3 tâches ». */
  tp: (key: PluralKeyOf<N>, count: number, vars?: TranslationVars) => string;
  locale: Locale;
}

export function useT<N extends Namespace>(namespace: N): Translator<N> {
  const locale = useLocale();

  return useMemo(() => {
    const catalog = getCatalog(locale, namespace);
    const fallbackCatalog = getFallbackCatalog(namespace);

    return {
      locale,
      t: (key: KeyOf<N>, vars?: TranslationVars) =>
        translate(key as string, { catalog, fallbackCatalog, locale, vars }),
      tp: (key: PluralKeyOf<N>, count: number, vars?: TranslationVars) =>
        translate(key as string, { catalog, fallbackCatalog, locale, vars, count }),
    };
  }, [locale, namespace]);
}

/**
 * Variante hors React — repositories, helpers, `normalizeApiError`.
 *
 * Lit la locale courante dans le store à CHAQUE appel : un module qui
 * mémoriserait le résultat figerait la langue au premier import (le piège des
 * messages zod, cf. plan i18n §4).
 */
export function getTranslator<N extends Namespace>(namespace: N, locale: Locale): Translator<N> {
  const catalog = getCatalog(locale, namespace);
  const fallbackCatalog = getFallbackCatalog(namespace);
  return {
    locale,
    t: (key: KeyOf<N>, vars?: TranslationVars) =>
      translate(key as string, { catalog, fallbackCatalog, locale, vars }),
    tp: (key: PluralKeyOf<N>, count: number, vars?: TranslationVars) =>
      translate(key as string, { catalog, fallbackCatalog, locale, vars, count }),
  };
}

/**
 * Traducteur pour la locale COURANTE, sans passer la locale à la main.
 *
 * Pensé pour les `onError`/`onSuccess` des mutations dans les hooks de module :
 * ce sont des callbacks, pas des rendus, donc `useT` n'y est pas appelable, et
 * leur faire remonter un `t` depuis chaque composant appelant aurait demandé de
 * changer la signature de tous les hooks métier.
 *
 * ⚠️ À APPELER DANS le callback, jamais au niveau du module : `translator('errors')`
 * évalué à l'import figerait la langue pour toute la session — c'est exactement
 * le piège corrigé sur les constantes de libellés (chartConfig, NAV_GROUPS…).
 *
 *   onError: (e) => toast.error(translator('errors').t('mutation.createTask', { message: e.message }))
 */
export function translator<N extends Namespace>(namespace: N): Translator<N> {
  return getTranslator(namespace, localeStore.locale);
}
