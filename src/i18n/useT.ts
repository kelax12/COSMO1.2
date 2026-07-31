// Hook de traduction — `const { t, tp } = useT('common')`.
//
// `t` est typée par le catalogue `fr` : une clé inexistante est une erreur de
// compilation, pas une chaîne brute affichée en prod.

import { useMemo } from 'react';
import { getCatalog, getFallbackCatalog, type KeyOf, type Namespace, type PluralKeyOf } from './catalog';
import { useLocale } from './store';
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
