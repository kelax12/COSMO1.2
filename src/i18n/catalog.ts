// Registre des catalogues de traduction + typage des clés.
//
// Les catalogues sont des `.json` (et non des `.ts`) : `prerender.mjs` est du
// Node brut sans bundler et doit lire exactement les mêmes fichiers. Effet de
// bord utile : `vitest.config.ts` ne couvre que `src/**/*.{ts,tsx}`, donc les
// ~1 000 clés de données sont hors des seuils de couverture.
//
// Le catalogue `fr` est la SOURCE DE VÉRITÉ : c'est lui qui définit le type des
// clés et sert de repli. Un catalogue traduit incomplet ne casse pas l'app
// (repli clé par clé, cf. src/i18n/translate.ts) — `npm run i18n:check` est ce
// qui empêche l'incomplétude d'atteindre la prod.

import { ALL_LOCALES, type Locale } from './locale';
import { lookup, type CatalogNode } from './translate';

import frCommon from '@/locales/fr/common.json';
import frErrors from '@/locales/fr/errors.json';
import enCommon from '@/locales/en/common.json';
import enErrors from '@/locales/en/errors.json';

/**
 * Espaces de noms, alignés sur le découpage en chunks de l'app (une page lazy
 * = un namespace). `common` et `errors` sont chargés avec l'entrée car ils
 * servent avant tout rendu de page.
 */
export type Namespace = 'common' | 'errors';

/** Forme du catalogue de référence, par namespace — base du typage des clés. */
interface CatalogShapes {
  common: typeof frCommon;
  errors: typeof frErrors;
}

// ──────────────────────────────────────────────────────────────────
// Typage des clés — dérivé du catalogue `fr`
// ──────────────────────────────────────────────────────────────────

type Join<K extends string, Rest extends string> = Rest extends '' ? K : `${K}.${Rest}`;

/** Chemins pointés menant à une chaîne (`'actions.save'`). */
type LeafPaths<T> = T extends string
  ? ''
  : { [K in keyof T & string]: Join<K, LeafPaths<T[K]>> }[keyof T & string];

/** Bases des clés plurielles : `count.task_other` → `count.task`. */
type PluralBases<T> = LeafPaths<T> extends infer Path
  ? Path extends `${infer Base}_other`
    ? Base
    : never
  : never;

/** Clés valides pour `t()` dans un namespace donné. */
export type KeyOf<N extends Namespace> = LeafPaths<CatalogShapes[N]>;

/** Clés valides pour `tp()` (pluriel) dans un namespace donné. */
export type PluralKeyOf<N extends Namespace> = PluralBases<CatalogShapes[N]>;

// ──────────────────────────────────────────────────────────────────
// Registre
// ──────────────────────────────────────────────────────────────────

type Registry = Record<Locale, Partial<Record<Namespace, CatalogNode>>>;

function emptyRegistry(): Registry {
  const registry = {} as Registry;
  for (const locale of ALL_LOCALES) registry[locale] = {};
  return registry;
}

const registry: Registry = emptyRegistry();

// `fr` est chargé statiquement : il est le repli de toutes les autres locales,
// donc toujours nécessaire. Le cast est sûr — un objet JSON importé EST un
// `CatalogNode`, mais TypeScript infère un type littéral plus étroit.
registry.fr.common = frCommon as CatalogNode;
registry.fr.errors = frErrors as CatalogNode;

// `common` et `errors` servent avant tout rendu de page : ils restent chargés
// avec l'entrée pour chaque locale servie. Les namespaces volumineux (`tasks`,
// `landing`…) passeront par `registerCatalog` en chargement paresseux.
registry.en.common = enCommon as CatalogNode;
registry.en.errors = enErrors as CatalogNode;

/** Catalogue chargé pour cette locale et ce namespace, `null` si absent. */
export function getCatalog(locale: Locale, namespace: Namespace): CatalogNode | null {
  return registry[locale]?.[namespace] ?? null;
}

/** Catalogue de référence — repli de toutes les locales. */
export function getFallbackCatalog(namespace: Namespace): CatalogNode | null {
  return registry.fr[namespace] ?? null;
}

/**
 * Enregistre un catalogue.
 *
 * Point d'extension du chargement paresseux : quand `en`/`es` arriveront
 * (phase 2), un `import('@/locales/en/tasks.json')` par route appellera cette
 * fonction. Tant qu'un seul catalogue existe, il n'y a rien à charger — pas de
 * machinerie asynchrone non testée dans le socle.
 */
export function registerCatalog(locale: Locale, namespace: Namespace, catalog: CatalogNode): void {
  registry[locale][namespace] = catalog;
}

/** `true` si le namespace est disponible pour cette locale. */
export function hasCatalog(locale: Locale, namespace: Namespace): boolean {
  return getCatalog(locale, namespace) !== null;
}

/**
 * Résout une clé avec repli, mais retourne `null` si elle n'existe nulle part
 * — au lieu de la clé elle-même comme `translate()`.
 *
 * Nécessaire partout où « la clé est absente » est une information métier et
 * non un bug d'affichage. Cas type : `normalizeApiError` doit distinguer un
 * code d'erreur whitelisté d'un code inconnu, parce qu'un code inconnu impose
 * de retomber sur le message générique et surtout de NE PAS relayer le message
 * brut du serveur (faille V7/N1).
 */
export function resolveMessage(namespace: Namespace, key: string, locale: Locale): string | null {
  const catalog = getCatalog(locale, namespace);
  if (catalog) {
    const hit = lookup(catalog, key);
    if (hit !== null) return hit;
  }
  const fallback = getFallbackCatalog(namespace);
  return fallback ? lookup(fallback, key) : null;
}
