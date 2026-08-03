// Registre des catalogues de traduction + typage des clés.
//
// Les catalogues sont des `.json` (et non des `.ts`) : `prerender.mjs` est du
// Node brut sans bundler et doit lire exactement les mêmes fichiers. Effet de
// bord utile : `vitest.config.ts` ne couvre que `src/**/*.{ts,tsx}`, donc les
// clés de données sont hors des seuils de couverture.
//
// Le catalogue `fr` est la SOURCE DE VÉRITÉ : c'est lui qui définit le type des
// clés et sert de repli. Un catalogue traduit incomplet ne casse pas l'app
// (repli clé par clé, cf. src/i18n/translate.ts) — `npm run i18n:check` est ce
// qui empêche l'incomplétude d'atteindre la prod.
//
// ─── Ajouter une LANGUE : zéro ligne de code ───
//
// Déposer `src/locales/<code>/*.json` et ajouter le code à `SUPPORTED_LOCALES`
// (src/i18n/locale.ts). Ce module découvre les fichiers tout seul via
// `import.meta.glob` — il n'y a AUCUNE liste de langues à tenir à jour ici.
// C'est délibéré : la version précédente listait un `import` statique par paire
// (locale × namespace), donc ouvrir l'espagnol sur 15 namespaces aurait demandé
// 15 imports + 15 affectations, avec un oubli silencieux à la clé (le repli `fr`
// masque un catalogue non enregistré — la page s'affiche, en français).
//
// ─── Ajouter un NAMESPACE : deux lignes, au même endroit ───
//
// Un `import` du catalogue `fr` + son entrée dans `CatalogShapes`. Ces deux
// lignes ne sont pas de la redondance : l'import statique `fr` est ce qui rend
// le repli disponible AVANT tout await (cf. « Chargement » plus bas), et
// `CatalogShapes` est ce qui donne à `t()` ses clés typées. Aucune des deux ne
// peut être dérivée du glob, dont le type est `Record<string, unknown>`.
//
// ─── Chargement : `fr` eager, le reste à la demande ───
//
// `fr` est dans le chunk d'entrée car il est le repli de TOUTES les locales :
// il doit être là, synchroniquement, sinon une clé non traduite n'a rien sur
// quoi retomber. Les autres langues sont chargées par `loadCatalogs()`, appelé
// une fois par `src/main.tsx` avant le premier rendu.
//
// Pourquoi pas tout en eager : le budget entry est de 150 kB gzip
// (docs/PERFORMANCE.md) et l'entry pèse ~50 kB. Une app entièrement traduite
// représente ~12 kB gzip de JSON par langue — à 3 langues, l'eager mettrait
// 24 kB de catalogues QUE L'UTILISATEUR NE LIRA JAMAIS dans le critical path.
// Le coût du lazy est nul en français (aucun fetch) et d'un petit chunk local
// ailleurs.

import { DEFAULT_LOCALE, isLocale, type Locale } from './locale';
import { lookup, type CatalogNode } from './translate';

import frAdmin from '@/locales/fr/admin.json';
import frAgenda from '@/locales/fr/agenda.json';
import frCommon from '@/locales/fr/common.json';
import frDashboard from '@/locales/fr/dashboard.json';
import frErrors from '@/locales/fr/errors.json';
import frEventModal from '@/locales/fr/eventModal.json';
import frGuide from '@/locales/fr/guide.json';
import frHabits from '@/locales/fr/habits.json';
import frOkr from '@/locales/fr/okr.json';
import frOrg from '@/locales/fr/org.json';
import frPremium from '@/locales/fr/premium.json';
import frSeo from '@/locales/fr/seo.json';
import frSettings from '@/locales/fr/settings.json';
import frStatistics from '@/locales/fr/statistics.json';
import frTaskModal from '@/locales/fr/taskModal.json';
import frTasks from '@/locales/fr/tasks.json';
import frTutorials from '@/locales/fr/tutorials.json';

/** Forme du catalogue de référence, par namespace — base du typage des clés. */
interface CatalogShapes {
  /** Tableau de bord admin — KPI de croissance et d'activité. */
  admin: typeof frAdmin;
  /** Agenda — calendrier, création rapide, revue de créneaux, récurrences. */
  agenda: typeof frAgenda;
  /** Chrome de l'app : navigation, actions, libellés partagés. */
  common: typeof frCommon;
  /** Tableau de bord — salutation, résumé du jour, cartes de stats, sections. */
  dashboard: typeof frDashboard;
  /** Messages d'erreur — lus aussi par `normalizeApiError`. */
  errors: typeof frErrors;
  /** Guide d'utilisation — sommaire, sections, étapes, encarts. */
  guide: typeof frGuide;
  /** Modale d'événement — champs, récurrence, planification, calendrier. */
  eventModal: typeof frEventModal;
  /** Habitudes — liste, tableau de suivi, modale, actions, mur-pub. */
  habits: typeof frHabits;
  /** OKR — page, cartes, catégories, modales, check-in hebdo. */
  okr: typeof frOkr;
  /** Premium — page d'offre, mur de fonctionnalité, modale publicitaire. */
  premium: typeof frPremium;
  /** Mode entreprise — pyramide, équipes, projets, OKR d'équipe, invitations. */
  org: typeof frOrg;
  /** Titres/descriptions des routes publiques — lu aussi par `prerender.mjs`. */
  seo: typeof frSeo;
  /** Réglages — profil, sécurité, apparence, modules, données, aide. */
  settings: typeof frSettings;
  /** Statistiques — sections, périodes, graphique, détails, heatmap. */
  statistics: typeof frStatistics;
  /** Modale de tâche — champs, sections, feuilles d'action mobiles. */
  taskModal: typeof frTaskModal;
  /** Page Tâches — en-tête, filtres, barre de listes, section équipe. */
  tasks: typeof frTasks;
  /** Tutoriels par page — titres et descriptions des étapes. */
  tutorials: typeof frTutorials;
}

/**
 * Espaces de noms, alignés sur le découpage en chunks de l'app (une page lazy
 * = un namespace). Dérivé de `CatalogShapes` pour qu'ajouter un namespace ne
 * puisse pas oublier de mettre ce type à jour.
 */
export type Namespace = keyof CatalogShapes;

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

type Registry = Partial<Record<Locale, Partial<Record<Namespace, CatalogNode>>>>;

const registry: Registry = {};

// Le cast est sûr — un objet JSON importé EST un `CatalogNode`, mais TypeScript
// en infère un type littéral plus étroit.
registry[DEFAULT_LOCALE] = {
  admin: frAdmin as CatalogNode,
  agenda: frAgenda as CatalogNode,
  common: frCommon as CatalogNode,
  dashboard: frDashboard as CatalogNode,
  errors: frErrors as CatalogNode,
  eventModal: frEventModal as CatalogNode,
  guide: frGuide as CatalogNode,
  habits: frHabits as CatalogNode,
  okr: frOkr as CatalogNode,
  org: frOrg as CatalogNode,
  premium: frPremium as CatalogNode,
  seo: frSeo as CatalogNode,
  settings: frSettings as CatalogNode,
  statistics: frStatistics as CatalogNode,
  taskModal: frTaskModal as CatalogNode,
  tasks: frTasks as CatalogNode,
  tutorials: frTutorials as CatalogNode,
};

/**
 * Namespaces réellement existants, dérivés du catalogue de référence.
 *
 * Sert de whitelist au chargement : un fichier `src/locales/en/blog.json` sans
 * équivalent `fr` est ignoré plutôt qu'enregistré sous un namespace fantôme que
 * `t()` ne saurait pas typer. `npm run i18n:check` signale déjà ce cas comme
 * clé orpheline — ici on se contente de ne pas propager l'incohérence.
 */
const NAMESPACES = Object.keys(registry[DEFAULT_LOCALE] ?? {}) as Namespace[];

function isNamespace(value: string): value is Namespace {
  return (NAMESPACES as string[]).includes(value);
}

// ──────────────────────────────────────────────────────────────────
// Découverte automatique des catalogues
// ──────────────────────────────────────────────────────────────────

/**
 * Catalogues à charger paresseusement — toutes les locales SAUF la référence.
 *
 * Le motif DOIT être un littéral : Vite l'analyse statiquement à la
 * compilation, il ne peut pas être construit à partir de `SUPPORTED_LOCALES`.
 * C'est sans conséquence — `*` couvre déjà toute locale à venir.
 *
 * L'exclusion `!../locales/fr/*` code en dur la locale de RÉFÉRENCE, pas une
 * langue de la liste : `fr` est importé statiquement plus haut (il est le
 * repli), et le laisser dans le glob le rendait à la fois statique et
 * dynamique — Rollup émettait alors un avertissement par namespace, et le
 * chargeur aurait ré-enregistré des catalogues déjà en mémoire. Ajouter une
 * langue ne touche jamais cette ligne ; seul un changement de `DEFAULT_LOCALE`
 * le ferait (et `catalog.test.ts` échouerait alors).
 */
const CATALOG_LOADERS = import.meta.glob(['../locales/*/*.json', '!../locales/fr/*.json'], {
  import: 'default',
}) as Record<string, () => Promise<CatalogNode>>;

/** `../locales/en/common.json` → `{ locale: 'en', namespace: 'common' }`. */
function parseCatalogPath(path: string): { locale: Locale; namespace: Namespace } | null {
  const match = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!match) return null;
  const [, locale, namespace] = match;
  if (!isLocale(locale) || !isNamespace(namespace)) return null;
  return { locale, namespace };
}

/**
 * Chargements en cours ou terminés, par locale.
 *
 * On mémorise la PROMESSE et non un booléen : deux appels concurrents (le
 * bootstrap et un futur changement de langue à chaud) doivent partager le même
 * chargement, pas en déclencher deux.
 */
const loading = new Map<Locale, Promise<void>>();

/**
 * Charge et enregistre tous les catalogues d'une locale.
 *
 * Résout immédiatement pour `DEFAULT_LOCALE` (déjà en mémoire) et pour toute
 * locale sans fichier — dans ce dernier cas l'app rend intégralement via le
 * repli `fr`, ce qui est exactement le comportement voulu pendant qu'une
 * traduction est en cours d'écriture.
 */
export function loadCatalogs(locale: Locale): Promise<void> {
  if (locale === DEFAULT_LOCALE) return Promise.resolve();

  const pending = loading.get(locale);
  if (pending) return pending;

  type Entry = {
    parsed: { locale: Locale; namespace: Namespace };
    load: () => Promise<CatalogNode>;
  };

  const entries = Object.entries(CATALOG_LOADERS)
    .map(([path, load]) => ({ parsed: parseCatalogPath(path), load }))
    .filter((entry): entry is Entry => entry.parsed !== null && entry.parsed.locale === locale);

  const task = Promise.all(
    entries.map(async ({ parsed, load }) => {
      try {
        registerCatalog(parsed.locale, parsed.namespace, await load());
      } catch {
        // Un catalogue illisible ne doit pas empêcher l'app de démarrer : le
        // repli `fr` couvre le namespace manquant. Silencieux côté client,
        // attrapé côté CI par `npm run i18n:check` (JSON invalide = erreur).
      }
    })
  ).then(() => undefined);

  loading.set(locale, task);
  return task;
}

/** Catalogue chargé pour cette locale et ce namespace, `null` si absent. */
export function getCatalog(locale: Locale, namespace: Namespace): CatalogNode | null {
  return registry[locale]?.[namespace] ?? null;
}

/** Catalogue de référence — repli de toutes les locales. */
export function getFallbackCatalog(namespace: Namespace): CatalogNode | null {
  return registry[DEFAULT_LOCALE]?.[namespace] ?? null;
}

/**
 * Enregistre un catalogue.
 *
 * Public parce que les tests et un éventuel chargement hors glob (catalogue
 * distant, prévisualisation d'une traduction) doivent pouvoir alimenter le
 * registre sans passer par le disque.
 */
export function registerCatalog(locale: Locale, namespace: Namespace, catalog: CatalogNode): void {
  const bucket = registry[locale] ?? (registry[locale] = {});
  bucket[namespace] = catalog;
}

/** `true` si le namespace est disponible pour cette locale. */
export function hasCatalog(locale: Locale, namespace: Namespace): boolean {
  return getCatalog(locale, namespace) !== null;
}

/** Namespaces connus — exposé pour les tests et les outils de diagnostic. */
export function listNamespaces(): readonly Namespace[] {
  return NAMESPACES;
}

/**
 * Locales réellement couvertes par le chargement paresseux.
 *
 * Exposé pour que `catalog.test.ts` puisse vérifier que l'exclusion codée dans
 * le motif du glob correspond bien à `DEFAULT_LOCALE`. Sans ce garde-fou, un
 * changement de locale de référence laisserait l'ancienne en double (statique
 * + dynamique) et la nouvelle sans chargeur — deux bugs silencieux.
 */
export function listLazyLocales(): readonly Locale[] {
  const found = new Set<Locale>();
  for (const path of Object.keys(CATALOG_LOADERS)) {
    const parsed = parseCatalogPath(path);
    if (parsed) found.add(parsed.locale);
  }
  return [...found];
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
