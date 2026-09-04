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
// ─── Chargement : deux namespaces eager, les 17 autres à la demande ───
//
// Le repli `fr` doit être disponible SYNCHRONIQUEMENT, `t()` ne renvoie pas de
// promesse, donc un namespace absent afficherait sa clé brute. Mais tous les
// namespaces ne sont pas nécessaires au même moment : seuls `common` et
// `errors` sont atteignables depuis le SHELL de l'application (mesuré par
// `scripts/i18n-shell-namespaces.mjs`, verrouillé par
// `src/i18n/lazy-namespaces.guard.test.ts`). Les 17 autres appartiennent à une
// page lazy, et sont chargés en même temps QU'ELLE.
//
// Ce que ça change, mesuré (docs/PERFORMANCE.md) : le catalogue `fr` pesait
// 178 ko bruts dans le chunk d'entrée, dont ~140 ko pour des pages que la
// plupart des sessions n'ouvrent jamais (`org` 50 ko, `landing` 34 ko,
// `guide` 14 ko…).
//
// ⚠️ **Le gate est au niveau de la ROUTE, pas du composant.** `lazyWithRetry`
// (src/App.tsx) attend les namespaces déclarés AVANT de résoudre le module de
// page : le `<Suspense>` qui enveloppe déjà chaque route couvre l'attente, donc
// aucun rendu ne peut avoir lieu avec un catalogue manquant. Charger le
// namespace DANS le composant produirait exactement le flash de clés brutes que
// ce découpage doit éviter.

import { DEFAULT_LOCALE, isLocale, type Locale } from './locale';
import { lookup, type CatalogNode } from './translate';

// Les deux seuls catalogues du chunk d'entrée. Tout ajout ici doit être
// justifié par la mesure du shell, pas par le confort.
import frCommon from '@/locales/fr/common.json';
import frErrors from '@/locales/fr/errors.json';

// Les autres formes sont référencées en position de TYPE uniquement
// (`typeof import(...)`), ce qui est effacé à la compilation : le typage des
// clés reste complet sans remettre un seul octet de JSON dans l'entrée.
type Shape<P extends string> = P extends keyof FrModules ? FrModules[P] : never;
interface FrModules {
  admin: typeof import('@/locales/fr/admin.json');
  agenda: typeof import('@/locales/fr/agenda.json');
  dashboard: typeof import('@/locales/fr/dashboard.json');
  bugReport: typeof import('@/locales/fr/bugReport.json');
  csv: typeof import('@/locales/fr/csv.json');
  eventModal: typeof import('@/locales/fr/eventModal.json');
  guide: typeof import('@/locales/fr/guide.json');
  habits: typeof import('@/locales/fr/habits.json');
  invite: typeof import('@/locales/fr/invite.json');
  landing: typeof import('@/locales/fr/landing.json');
  legal: typeof import('@/locales/fr/legal.json');
  okr: typeof import('@/locales/fr/okr.json');
  overlays: typeof import('@/locales/fr/overlays.json');
  org: typeof import('@/locales/fr/org.json');
  premium: typeof import('@/locales/fr/premium.json');
  seo: typeof import('@/locales/fr/seo.json');
  settings: typeof import('@/locales/fr/settings.json');
  statistics: typeof import('@/locales/fr/statistics.json');
  taskModal: typeof import('@/locales/fr/taskModal.json');
  tasks: typeof import('@/locales/fr/tasks.json');
  tutorials: typeof import('@/locales/fr/tutorials.json');
}

/** Forme du catalogue de référence, par namespace — base du typage des clés. */
interface CatalogShapes {
  /** Tableau de bord admin — KPI de croissance et d'activité. */
  admin: Shape<'admin'>;
  /** Agenda — calendrier, création rapide, revue de créneaux, récurrences. */
  agenda: Shape<'agenda'>;
  /** Chrome de l'app : navigation, actions, libellés partagés. **Eager.** */
  common: typeof frCommon;
  /** Tableau de bord — salutation, résumé du jour, cartes de stats, sections. */
  dashboard: Shape<'dashboard'>;
  /** Messages d'erreur, lus aussi par `normalizeApiError`. **Eager.** */
  errors: typeof frErrors;
  /** Guide d'utilisation — sommaire, sections, étapes, encarts. */
  guide: Shape<'guide'>;
  /**
   * En-têtes et libellés des exports CSV.
   *
   * 🔴 Namespace À PART, et pas dans `common` : il y vivait, et `common` est
   * l'un des DEUX catalogues du chunk d'entrée. Ses 1,4 ko bruts partaient
   * donc chez TOUT visiteur, pour une fonctionnalité qu'on n'atteint que
   * depuis Réglages → Données ou l'aperçu d'entreprise. Mesuré : l'entrée
   * passe de 78 023 à 77 556 o gzip, soit **467 o**, en le sortant.
   */
  /**
   * Formulaire « Signaler un bug ».
   *
   * 🔴 Namespace À PART pour la même raison que `csv` : il vivait dans
   * `common`, donc dans le chunk d'entrée, alors que `BugReportModal` est
   * `lazy()` et que ses 1,2 ko bruts ne servent qu'à ceux qui l'ouvrent.
   */
  bugReport: Shape<'bugReport'>;
  csv: Shape<'csv'>;
  /** Modale d'événement — champs, récurrence, planification, calendrier. */
  eventModal: Shape<'eventModal'>;
  /** Habitudes — liste, tableau de suivi, modale, actions, mur-pub. */
  habits: Shape<'habits'>;
  /** Page publique `/invite/:token` — contexte d'une invitation de partage. */
  invite: Shape<'invite'>;
  /** OKR — page, cartes, catégories, modales, check-in hebdo. */
  okr: Shape<'okr'>;
  /**
   * Surfaces ouvertes À LA DEMANDE : raccourcis clavier, palette de commandes,
   * boîte de réception, accueil du premier compte, confirmations de
   * suppression, champ de lien de partage, calendrier de saisie, avertissement
   * de pagination.
   *
   * 🔴 Namespace À PART, pour la troisième fois la même raison que `csv` et
   * `bugReport` : ces neuf sections vivaient dans `common`, l'un des DEUX
   * catalogues du chunk d'ENTRÉE. Leurs 8,5 ko bruts (fr) + 7,7 (en) partaient
   * donc chez tout visiteur de la landing, du blog ou d'une page légale, pour
   * des surfaces qu'aucun d'eux n'ouvrira jamais — il faut être connecté.
   *
   * ⚠️ Ce n'est PAS « tout ce qui est modal ». `shareInvite` reste dans
   * `common` parce que `ShareInviteClaimer` est monté par le SHELL
   * (`npm run i18n:namespaces` le nomme) : l'y déplacer rendrait `overlays`
   * eager, donc annulerait le gain en le déguisant.
   */
  overlays: Shape<'overlays'>;
  /** Premium — page d'offre, mur de fonctionnalité, modale publicitaire. */
  premium: Shape<'premium'>;
  /** Landing publique + pages marketing (à propos, cas d'usage, blog). */
  landing: Shape<'landing'>;
  /** Pages contractuelles : CGU, confidentialité, mentions légales. */
  legal: Shape<'legal'>;
  /** Mode entreprise — pyramide, équipes, projets, OKR d'équipe, invitations. */
  org: Shape<'org'>;
  /** Titres/descriptions des routes publiques — lu aussi par `prerender.mjs`. */
  seo: Shape<'seo'>;
  /** Réglages — profil, sécurité, apparence, modules, données, aide. */
  settings: Shape<'settings'>;
  /** Statistiques — sections, périodes, graphique, détails, heatmap. */
  statistics: Shape<'statistics'>;
  /** Modale de tâche — champs, sections, feuilles d'action mobiles. */
  taskModal: Shape<'taskModal'>;
  /** Page Tâches — en-tête, filtres, barre de listes, section équipe. */
  tasks: Shape<'tasks'>;
  /** Tutoriels par page — titres et descriptions des étapes. */
  tutorials: Shape<'tutorials'>;
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

/**
 * Namespaces présents dans le chunk d'entrée.
 *
 * La liste n'est pas un choix de confort : c'est le résultat de
 * `node scripts/i18n-shell-namespaces.mjs`, qui parcourt le graphe d'imports
 * STATIQUES depuis `App.tsx` et `main.tsx`. Tout ce qui rend avant qu'une route
 * soit résolue doit être ici, sous peine d'afficher des clés brutes.
 *
 * 🔴 **Ne jamais en ajouter un « au cas où ».** `src/i18n/lazy-namespaces.guard.test.ts`
 * échoue si un namespace eager n'est plus atteignable depuis le shell : la
 * liste ne peut donc que refléter la mesure.
 */
export const EAGER_NAMESPACES = ['common', 'errors'] as const;

// Le cast est sûr — un objet JSON importé EST un `CatalogNode`, mais TypeScript
// en infère un type littéral plus étroit.
registry[DEFAULT_LOCALE] = {
  common: frCommon as CatalogNode,
  errors: frErrors as CatalogNode,
};

/**
 * Namespaces réellement existants.
 *
 * Écrit à la main depuis que les catalogues `fr` ne sont plus tous importés
 * statiquement : on ne peut plus le dériver du registre, qui ne contient au
 * démarrage que les deux namespaces eager. `CatalogShapes` reste la source du
 * TYPE, et l'annotation `readonly Namespace[]` fait échouer la compilation si
 * un nom est mal orthographié. Le test de garde vérifie en plus que la liste
 * couvre exactement les fichiers de `src/locales/fr/`.
 *
 * Sert aussi de whitelist au chargement : un fichier `src/locales/en/blog.json`
 * sans équivalent `fr` est ignoré plutôt qu'enregistré sous un namespace
 * fantôme que `t()` ne saurait pas typer.
 */
const NAMESPACES: readonly Namespace[] = [
  'admin', 'agenda', 'bugReport', 'common', 'csv', 'dashboard', 'errors', 'eventModal',
  'guide',
  'habits', 'invite', 'landing', 'legal', 'okr', 'org', 'premium', 'seo',
  'overlays',
  'settings', 'statistics', 'taskModal', 'tasks', 'tutorials',
];

function isNamespace(value: string): value is Namespace {
  return (NAMESPACES as string[]).includes(value);
}

// ──────────────────────────────────────────────────────────────────
// Découverte automatique des catalogues
// ──────────────────────────────────────────────────────────────────

/**
 * Catalogues à charger paresseusement, toutes les locales, `fr` compris.
 *
 * Le motif DOIT être un littéral : Vite l'analyse statiquement à la
 * compilation, il ne peut pas être construit à partir de `SUPPORTED_LOCALES`
 * ni de `EAGER_NAMESPACES`. C'est sans conséquence, `*` couvre déjà toute
 * locale à venir.
 *
 * Les DEUX exclusions sont les deux namespaces eager, et elles sont là pour une
 * raison mécanique : un fichier à la fois importé statiquement et présent dans
 * un glob dynamique fait émettre à Rollup un avertissement par namespace, et le
 * chargeur ré-enregistrerait un catalogue déjà en mémoire. Elles doivent donc
 * rester alignées sur `EAGER_NAMESPACES`, `catalog.test.ts` le vérifie.
 *
 * ⚠️ `fr` n'est plus exclu en bloc : c'est tout l'objet du découpage. Les 17
 * namespaces de page vivent maintenant dans leur propre chunk, chargé par
 * `ensureNamespaces()` en même temps que la page qui en a besoin.
 */
const CATALOG_LOADERS = import.meta.glob(
  ['../locales/*/*.json', '!../locales/fr/common.json', '!../locales/fr/errors.json'],
  { import: 'default' }
) as Record<string, () => Promise<CatalogNode>>;

/** `../locales/en/common.json` → `{ locale: 'en', namespace: 'common' }`. */
function parseCatalogPath(path: string): { locale: Locale; namespace: Namespace } | null {
  const match = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!match) return null;
  const [, locale, namespace] = match;
  if (!isLocale(locale) || !isNamespace(namespace)) return null;
  return { locale, namespace };
}

/** Chargeurs du glob, indexés `locale/namespace`, calculé une fois. */
const LOADERS_BY_KEY = new Map<string, () => Promise<CatalogNode>>();
for (const [path, load] of Object.entries(CATALOG_LOADERS)) {
  const parsed = parseCatalogPath(path);
  if (parsed) LOADERS_BY_KEY.set(`${parsed.locale}/${parsed.namespace}`, load);
}

/**
 * Chargements en cours ou terminés, par couple locale + namespace.
 *
 * On mémorise la PROMESSE et non un booléen : deux routes qui demandent le même
 * namespace en même temps (une navigation rapide, un préchargement au survol)
 * doivent partager le même chargement, pas en déclencher deux.
 */
const loading = new Map<string, Promise<void>>();

/** Charge un couple (locale, namespace), au plus une fois. */
function loadOne(locale: Locale, namespace: Namespace): Promise<void> {
  const key = `${locale}/${namespace}`;
  const pending = loading.get(key);
  if (pending) return pending;

  const load = LOADERS_BY_KEY.get(key);
  // Pas de fichier pour ce couple : ce n'est pas une erreur. En `fr` c'est un
  // namespace eager (déjà en mémoire) ; ailleurs c'est une traduction pas
  // encore écrite, et le repli `fr` couvre l'écran.
  if (!load) {
    const resolved = Promise.resolve();
    loading.set(key, resolved);
    return resolved;
  }

  const task = load()
    .then((catalog) => {
      registerCatalog(locale, namespace, catalog);
    })
    .catch(() => {
      // Un catalogue illisible ne doit pas empêcher l'app de démarrer : le
      // repli `fr` couvre le namespace manquant. Silencieux côté client,
      // attrapé côté CI par `npm run i18n:check` (JSON invalide = erreur).
      //
      // ⚠️ On ne retire PAS l'entrée du cache : réessayer à chaque rendu
      // transformerait un fichier cassé en boucle de requêtes.
    });

  loading.set(key, task);
  return task;
}

/**
 * Garantit que les namespaces demandés sont en mémoire, dans la locale active
 * ET dans `fr` (le repli).
 *
 * ⚠️ **À appeler AVANT le rendu, jamais pendant.** Le point d'appel prévu est
 * `lazyWithRetry` (src/App.tsx) : la promesse est attendue par le `<Suspense>`
 * qui enveloppe déjà chaque route, donc l'utilisateur voit le fallback de
 * chargement habituel, jamais une clé brute. Appeler cette fonction depuis un
 * `useEffect` de composant produirait exactement le flash qu'on veut éviter.
 */
export function ensureNamespaces(
  namespaces: readonly Namespace[],
  locale: Locale
): Promise<void> {
  const wanted = namespaces.filter((ns) => !(EAGER_NAMESPACES as readonly string[]).includes(ns));
  if (wanted.length === 0) return Promise.resolve();

  const tasks: Promise<void>[] = [];
  for (const ns of wanted) {
    // Le repli `fr` d'abord : c'est lui qui garantit qu'une clé non traduite
    // s'affiche quand même. Sans lui, ouvrir une page en `en` avec une
    // traduction partielle montrerait la clé.
    tasks.push(loadOne(DEFAULT_LOCALE, ns));
    if (locale !== DEFAULT_LOCALE) tasks.push(loadOne(locale, ns));
  }
  return Promise.all(tasks).then(() => undefined);
}

/**
 * Charge les catalogues nécessaires au DÉMARRAGE pour une locale.
 *
 * Ne concerne plus que les namespaces eager : les autres arrivent avec leur
 * page. Résout immédiatement pour `DEFAULT_LOCALE` (déjà en mémoire) et pour
 * toute locale sans fichier, dans ce dernier cas l'app rend intégralement via
 * le repli `fr`, ce qui est exactement le comportement voulu pendant qu'une
 * traduction est en cours d'écriture.
 */
export function loadCatalogs(locale: Locale): Promise<void> {
  if (locale === DEFAULT_LOCALE) return Promise.resolve();
  return Promise.all(
    EAGER_NAMESPACES.map((ns) => loadOne(locale, ns))
  ).then(() => undefined);
}

/**
 * Chargeurs disponibles, exposé pour les tests de garde, qui vérifient que le
 * glob couvre bien tous les couples (locale, namespace) attendus.
 */
export function listLoaderKeys(): readonly string[] {
  return [...LOADERS_BY_KEY.keys()];
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

// `listLazyLocales()` a été supprimée le 2026-08-25 : elle n'existait que pour
// vérifier que `fr` était EXCLU du glob, ce qui n'est plus vrai depuis que les
// 17 namespaces de page y sont entrés. `listLoaderKeys()` la remplace et
// vérifie plus : la présence d'un chargeur pour chaque couple attendu, ET son
// absence pour les deux namespaces eager.

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
