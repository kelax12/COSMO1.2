// Registre des catalogues de traduction + typage des clés.
//
// Catalogues en `.json` (`prerender/` est du Node brut qui lit les mêmes fichiers). `fr` est la SOURCE DE VÉRITÉ : il type les clés et sert de repli clé par clé (src/i18n/translate.ts) ; `npm run i18n:check` empêche l'incomplétude d'atteindre la prod.
// Ajouter une LANGUE : déposer `src/locales/<code>/*.json` et ajouter le code à `SUPPORTED_LOCALES` (locale.ts) ; `import.meta.glob` découvre le reste.
// Ajouter un NAMESPACE : un `import` du catalogue `fr` + son entrée dans `CatalogShapes` (le glob est typé `Record<string, unknown>`).
// Chargement : `common` et `errors` sont eager (atteignables depuis le shell, `scripts/i18n-shell-namespaces.mjs`, garde `lazy-namespaces.guard.test.ts`) ; les autres arrivent avec leur page lazy.
// ⚠️ Le gate est au niveau de la ROUTE : `lazyWithRetry` (src/App.tsx) attend les namespaces AVANT de résoudre la page. Charger dans le composant ferait flasher des clés brutes.

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
  tools: typeof import('@/locales/fr/tools.json');
  portfolio: typeof import('@/locales/fr/portfolio.json');
  orgAccount: typeof import('@/locales/fr/orgAccount.json');
  orgAdmin: typeof import('@/locales/fr/orgAdmin.json');
  orgConfig: typeof import('@/locales/fr/orgConfig.json');
  orgGuide: typeof import('@/locales/fr/orgGuide.json');
  persoGuide: typeof import('@/locales/fr/persoGuide.json');
  agenda: typeof import('@/locales/fr/agenda.json');
  dashboard: typeof import('@/locales/fr/dashboard.json');
  bugReport: typeof import('@/locales/fr/bugReport.json');
  csv: typeof import('@/locales/fr/csv.json');
  eventModal: typeof import('@/locales/fr/eventModal.json');
  guide: typeof import('@/locales/fr/guide.json');
  habits: typeof import('@/locales/fr/habits.json');
  invite: typeof import('@/locales/fr/invite.json');
  landing: typeof import('@/locales/fr/landing.json');
  landingEnterprise: typeof import('@/locales/fr/landingEnterprise.json');
  legal: typeof import('@/locales/fr/legal.json');
  legalTerms: typeof import('@/locales/fr/legalTerms.json');
  legalPrivacy: typeof import('@/locales/fr/legalPrivacy.json');
  okr: typeof import('@/locales/fr/okr.json');
  onboarding: typeof import('@/locales/fr/onboarding.json');
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
  /** En-têtes des exports CSV : namespace à part, `common` est eager. */
  /** Formulaire « Signaler un bug » : à part, `BugReportModal` est lazy. */
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
   * Surfaces ouvertes à la demande (raccourcis, palette, boîte de réception, accueil, confirmations, lien de partage, calendrier de saisie, pagination).
   * ⚠️ Pas « tout ce qui est modal » : `shareInvite` reste dans `common`, `ShareInviteClaimer` est monté par le shell (`npm run i18n:namespaces`).
   */
  overlays: Shape<'overlays'>;
  /** Accueil des nouveaux comptes (`FirstRunSetup`, `/entreprise/onboarding`), à part. */
  onboarding: Shape<'onboarding'>;
  /** Premium — page d'offre, mur de fonctionnalité, modale publicitaire. */
  premium: Shape<'premium'>;
  /** Landing publique + pages marketing (à propos, cas d'usage, blog). */
  landing: Shape<'landing'>;
  tools: Shape<'tools'>;
  /** Parcours entreprise de la landing, chargé avec `EnterpriseTrack` (lazy). */
  landingEnterprise: Shape<'landingEnterprise'>;
  /**
   * Pages contractuelles : libellés communs et mentions légales. CGU et confidentialité vivent à part (`legalTerms`, `legalPrivacy`).
   * ⚠️ Les trois fichiers d'une langue forment UN document pour `npm run check:legal-journal` (empreinte sur leur réunion).
   */
  legal: Shape<'legal'>;
  /** Conditions générales d'utilisation (`/cgu`). */
  legalTerms: Shape<'legalTerms'>;
  /** Politique de confidentialité (`/politique-confidentialite`). */
  legalPrivacy: Shape<'legalPrivacy'>;
  /** Mode entreprise — pyramide, équipes, projets, OKR d'équipe, invitations. */
  org: Shape<'org'>;
  /** Portefeuille de projets (M2), chargé avec le seul onglet Projets (`OrganizationPage`). */
  portfolio: Shape<'portfolio'>;
  /** Surfaces rares du propriétaire : Facturation (mig. 180) et assistant de démarrage. Un seul namespace : chacun ajoute des chargeurs au glob du chunk d'entrée. */
  orgAccount: Shape<'orgAccount'>;
  /**
   * Administration du mode entreprise (départ, invitations, actions en masse, droits, transfert, pyramide, revue, corbeille) et textes que SEUL /entreprise affiche. La ROUTE le charge ; `org` (chargé par `Layout`) ne garde que ce que le reste de l'app affiche.
   * ❌ Ne rien remettre dans `org` qu'un écran hors /entreprise n'affiche pas : `lazy-namespaces.guard.test.ts` dit où chaque section est rendue.
   */
  orgAdmin: Shape<'orgAdmin'>;
  /** Configuration d'entreprise (mig. 195-199), chargée par ses écrans (`org-config.lazy.ts`). */
  orgConfig: Shape<'orgConfig'>;
  orgGuide: Shape<'orgGuide'>;
  /** Guide perso (boussole du `Layout` desktop), chargé au premier clic avec `PersoGuideHost`. */
  persoGuide: Shape<'persoGuide'>;
  /** Titres/descriptions des routes publiques — lu aussi par `prerender/`. */
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

/** Espaces de noms, un par page lazy, dérivés de `CatalogShapes`. */
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
 * Namespaces du chunk d'entrée : résultat de `node scripts/i18n-shell-namespaces.mjs`.
 * ❌ Jamais « au cas où » : `lazy-namespaces.guard.test.ts` échoue si l'un n'est plus atteignable depuis le shell.
 */
export const EAGER_NAMESPACES = ['common', 'errors'] as const;

// Le cast est sûr — un objet JSON importé EST un `CatalogNode`, mais TypeScript
// en infère un type littéral plus étroit.
registry[DEFAULT_LOCALE] = {
  common: frCommon as CatalogNode,
  errors: frErrors as CatalogNode,
};

/**
 * Namespaces existants, écrits à la main (le registre ne contient au démarrage que les eager). Le test de garde vérifie qu'ils couvrent `src/locales/fr/` ; sert aussi de whitelist au chargement.
 */
const NAMESPACES: readonly Namespace[] = [
  'admin', 'agenda', 'bugReport', 'common', 'csv', 'dashboard', 'errors', 'eventModal',
  'guide',
  'habits', 'invite', 'landing', 'landingEnterprise', 'legal', 'legalPrivacy', 'legalTerms', 'okr', 'org', 'orgAccount', 'orgAdmin', 'orgConfig', 'orgGuide', 'persoGuide', 'portfolio', 'premium', 'seo',
  'onboarding',
  'overlays',
  'settings', 'statistics', 'taskModal', 'tasks', 'tools', 'tutorials',
];

function isNamespace(value: string): value is Namespace {
  return (NAMESPACES as string[]).includes(value);
}

// ──────────────────────────────────────────────────────────────────
// Découverte automatique des catalogues
// ──────────────────────────────────────────────────────────────────

/**
 * Catalogues à charger paresseusement, toutes locales.
 * Le motif DOIT être un littéral (analyse statique Vite). Les deux exclusions sont les namespaces eager (sinon avertissement Rollup) : alignées sur `EAGER_NAMESPACES`, `catalog.test.ts` le vérifie.
 */
const CATALOG_LOADERS = import.meta.glob(
  // `boot` : écran de secours d'avant React, importé statiquement par
  // `lib/boot-watchdog.ts`, jamais chargé par ce registre.
  ['../locales/*/*.json', '!../locales/fr/common.json', '!../locales/fr/errors.json', '!../locales/*/boot.json'],
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

/** Chargements par couple locale + namespace : on mémorise la PROMESSE, deux demandes simultanées partagent un chargement. */
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
      // Un catalogue illisible n'empêche pas le démarrage (repli `fr`, `npm run i18n:check` en CI).
      // ⚠️ On ne retire PAS l'entrée du cache : réessayer à chaque rendu bouclerait en requêtes.
    });

  loading.set(key, task);
  return task;
}

/**
 * Garantit les namespaces demandés en mémoire, locale active ET `fr`.
 * ⚠️ À appeler AVANT le rendu (`lazyWithRetry`, src/App.tsx), jamais dans un `useEffect` : flash de clés brutes.
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
 * Charge les catalogues du DÉMARRAGE pour une locale (namespaces eager seulement). Résout tout de suite pour `DEFAULT_LOCALE` ou une locale sans fichier : l'app rend alors via le repli `fr`.
 */
export function loadCatalogs(locale: Locale): Promise<void> {
  if (locale === DEFAULT_LOCALE) return Promise.resolve();
  return Promise.all(
    EAGER_NAMESPACES.map((ns) => loadOne(locale, ns))
  ).then(() => undefined);
}

/** Chargeurs disponibles, exposés aux tests de garde. */
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

/** Enregistre un catalogue (tests, chargement hors glob). */
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

// `listLoaderKeys()` vérifie la présence d'un chargeur pour chaque couple attendu,
// ET son absence pour les deux namespaces eager.

/**
 * Résout une clé avec repli, `null` si absente (au lieu de la clé comme `translate()`).
 * Sert quand l'absence est une information : `normalizeApiError` ne doit PAS relayer le message brut d'un code inconnu (faille V7/N1).
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
