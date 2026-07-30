// Formatage localisé — dates, nombres, devise.
//
// ⚠️ POINT D'ENTRÉE UNIQUE pour la locale `date-fns`. Avant ce module, 22
// fichiers faisaient `import { fr } from 'date-fns/locale'` en dur. Toute
// nouvelle utilisation passe par `getDateLocale()`.
//
// ⚠️ NE PAS CONFONDRE avec `toLocaleDateString('en-CA')`, utilisé volontairement
// dans `src/lib/date-presets.ts`, `src/lib/quick-add-parser.ts` et
// `src/lib/stats-insights.ts` : ce n'est PAS un formatage anglais, c'est
// l'idiome qui produit un `YYYY-MM-DD` en heure LOCALE. Le localiser
// ressusciterait la classe de bugs de décalage de fuseau déjà éradiquée
// (cf. src/i18n/en-ca-guard.test.ts, qui échoue si l'idiome disparaît).

import { enUS, es, fr } from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns';
import { BCP47_TAG, DEFAULT_LOCALE, type Locale } from './locale';
import { localeStore } from './store';

const DATE_LOCALES: Record<Locale, DateFnsLocale> = {
  fr,
  en: enUS,
  es,
};

/** Locale `date-fns` correspondante. Sans argument : la locale courante. */
export function getDateLocale(locale?: Locale): DateFnsLocale {
  return DATE_LOCALES[locale ?? localeStore.locale] ?? DATE_LOCALES[DEFAULT_LOCALE];
}

/** Étiquette BCP 47 pour les API `Intl` / `toLocale*String`. */
export function getIntlTag(locale?: Locale): string {
  return BCP47_TAG[locale ?? localeStore.locale] ?? BCP47_TAG[DEFAULT_LOCALE];
}

/**
 * Remplace les `date.toLocaleDateString('fr-FR', opts)` (41 occurrences).
 * Les options `Intl` restent celles de l'appelant.
 */
export function formatDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
  locale?: Locale
): string {
  return date.toLocaleDateString(getIntlTag(locale), options);
}

/** Idem pour l'heure. */
export function formatTime(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
  locale?: Locale
): string {
  return date.toLocaleTimeString(getIntlTag(locale), options);
}

/** Nombre localisé (séparateurs de milliers et décimale). */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: Locale
): string {
  return new Intl.NumberFormat(getIntlTag(locale), options).format(value);
}

/**
 * Montant en euros, formaté selon la locale (« 3,50 € » / « €3.50 »).
 *
 * La devise reste l'EUR dans toutes les langues : la facturation est en euros,
 * il n'y a aucune conversion. Seule la PRÉSENTATION change.
 */
export function formatCurrency(
  amount: number,
  locale?: Locale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(getIntlTag(locale), {
    style: 'currency',
    currency: 'EUR',
    ...options,
  }).format(amount);
}
