// Moteur de traduction — résolution de clé pointée, pluriels, interpolation.
//
// Volontairement maison (~120 LOC) plutôt qu'i18next, pour trois raisons
// documentées dans le plan i18n :
//   1. `prerender.mjs` est du Node brut sans bundler et doit lire les MÊMES
//      catalogues → format JSON obligatoire, et aucun runtime à initialiser
//      deux fois ;
//   2. la locale est résolue avant le premier paint, donc le moteur atterrit
//      dans le chunk d'entrée — 1,5 kB ici contre ~40 kB pour i18next
//      (budget bundle, cf. docs/PERFORMANCE.md) ;
//   3. zéro dépendance prod = rien de neuf sous le gate
//      `npm audit --omit=dev --audit-level=high` de la CI.

import type { Locale } from './locale';

/** Arbre de traduction tel que chargé depuis un fichier JSON. */
export interface CatalogNode {
  [key: string]: string | CatalogNode;
}

/** Valeurs interpolables dans un message. */
export type TranslationVars = Record<string, string | number>;

const INTERPOLATION_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Descend un chemin pointé (`actions.save`) dans un catalogue.
 * Retourne `null` si le chemin n'existe pas ou ne mène pas à une chaîne.
 */
export function lookup(catalog: CatalogNode, key: string): string | null {
  let node: string | CatalogNode | undefined = catalog;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return null;
    node = node[segment];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * Remplace les `{{var}}` par leurs valeurs.
 *
 * Une variable absente est laissée telle quelle plutôt que remplacée par du
 * vide : un `{{count}}` visible en préprod est un bug qu'on repère, un trou
 * silencieux ne se voit pas.
 */
export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(INTERPOLATION_RE, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Suffixe de pluriel pour un compte donné, selon les règles CLDR de la locale.
 *
 * `Intl.PluralRules` fait tout le travail et gère les cas non triviaux : le
 * français met 0 au singulier (« 0 tâche »), l'anglais non (« 0 tasks »), et
 * l'espagnol a une catégorie `many` pour les grands nombres. Écrire ces règles
 * à la main serait faux.
 */
export function pluralSuffix(locale: Locale, count: number): string {
  try {
    return new Intl.PluralRules(locale).select(count);
  } catch {
    // Environnement sans ICU complet — dégradation raisonnable.
    return count === 1 ? 'one' : 'other';
  }
}

/**
 * Résout une clé dans le catalogue de la locale, avec repli sur le catalogue
 * de référence (`fr`) clé par clé.
 *
 * Le repli évite d'afficher une clé brute à un utilisateur, mais masque les
 * trous de traduction : `npm run i18n:check` en CI est la seule protection
 * réelle contre un catalogue incomplet.
 *
 * En dernier recours on retourne la clé elle-même — jamais une chaîne vide,
 * qui produirait un bouton sans libellé impossible à diagnostiquer.
 */
export function translate(
  key: string,
  options: {
    catalog: CatalogNode | null;
    fallbackCatalog: CatalogNode | null;
    locale: Locale;
    vars?: TranslationVars;
    count?: number;
  }
): string {
  const { catalog, fallbackCatalog, locale, vars, count } = options;

  const keys: string[] = [];
  if (count !== undefined) {
    // `_other` sert de filet quand la locale demande une catégorie CLDR que le
    // catalogue ne définit pas (`_many` en espagnol, par exemple).
    keys.push(`${key}_${pluralSuffix(locale, count)}`, `${key}_other`);
  }
  keys.push(key);

  for (const candidate of keys) {
    const hit = catalog && lookup(catalog, candidate);
    if (hit !== null && hit !== undefined) {
      return interpolate(hit, withCount(vars, count));
    }
  }

  for (const candidate of keys) {
    const hit = fallbackCatalog && lookup(fallbackCatalog, candidate);
    if (hit !== null && hit !== undefined) {
      return interpolate(hit, withCount(vars, count));
    }
  }

  return key;
}

/** `count` est interpolable sans avoir à le répéter dans `vars`. */
function withCount(vars: TranslationVars | undefined, count: number | undefined): TranslationVars | undefined {
  if (count === undefined) return vars;
  return { count, ...vars };
}
