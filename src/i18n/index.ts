// Export public du module i18n. Toujours importer depuis `@/i18n`.

export {
  ALL_LOCALES,
  BCP47_TAG,
  DEFAULT_LOCALE,
  LOCALE_LABEL,
  LOCALE_STORAGE_KEY,
  OG_LOCALE,
  SUPPORTED_LOCALES,
  applyLocale,
  detectLocale,
  isLocale,
  isSupportedLocale,
  localeFromPathname,
  persistLocale,
  readStoredLocale,
  resolveInitialLocale,
  type Locale,
} from './locale';

export { localeStore, useLocale } from './store';

export { getTranslator, translator, useT, type Translator } from './useT';

export {
  getCatalog,
  getFallbackCatalog,
  hasCatalog,
  listNamespaces,
  loadCatalogs,
  registerCatalog,
  resolveMessage,
  type KeyOf,
  type Namespace,
  type PluralKeyOf,
} from './catalog';

export {
  interpolate,
  lookup,
  pluralSuffix,
  translate,
  type CatalogNode,
  type TranslationVars,
} from './translate';

export {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
  formatTime,
  getDateLocale,
  getIntlTag,
} from './format';

export {
  ROUTE_SLUGS,
  SITE_ORIGIN,
  canonicalUrl,
  localizePath,
  routeIdFromSlug,
  routeSlug,
  stripLocalePrefix,
  type RouteId,
} from './routes';
