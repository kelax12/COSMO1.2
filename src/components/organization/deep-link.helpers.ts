// ═══════════════════════════════════════════════════════════════════
// Deep-links de l'espace entreprise
//
// Chaque section est une ROUTE (`/entreprise/projects`) depuis le 2026-09-23 ;
// `?task=` / `?project=` / `?member=` ouvrent en plus la bonne entité. C'est ce
// qui rend une tâche collable dans une conversation — sans ça, « regarde cette
// tâche » se termine toujours par « cherche-la dans l'onglet Projets ».
//
// ⚠️ L'ancienne forme `/entreprise?tab=…` reste servie, par redirection
// (`OrganizationPage`), et DOIT le rester : les Edge Functions Stripe
// (`stripe-org-checkout`, `stripe-org-portal`) et les e-mails déjà envoyés par
// `renewal-notice` pointent sur `/entreprise?tab=billing`.
//
// Ce module ne tire aucune icône : `App.tsx` l'importe pour valider la
// dernière page visitée, il vit donc dans le chunk d'entrée.
// ═══════════════════════════════════════════════════════════════════

/** Sections adressables par un segment de chemin. L'Aperçu est `/entreprise` lui-même. */
export const ORG_SECTION_SEGMENTS = [
  'tasks',
  'projects',
  'okr',
  'stats',
  'pyramid',
  // Audit Membres du 2026-09-24 : « quatre pages en une ». Personnes garde
  // l'adresse historique `members` (liens et e-mails déjà envoyés), Équipes et
  // Paramètres en sortent.
  'members',
  'teams',
  // Paramètres de l'organisation (M13, audit du 2026-09-24) : profil,
  // organisations, forfait et zone dangereuse, réunis au même endroit.
  'settings',
  'billing',
] as const;

export type OrgSectionSegment = (typeof ORG_SECTION_SEGMENTS)[number];

/** Vrai si `value` est un segment de section connu (jamais un préfixe libre). */
export const isOrgSectionSegment = (value: string | null | undefined): value is OrgSectionSegment =>
  !!value && (ORG_SECTION_SEGMENTS as readonly string[]).includes(value);

/** Chemin d'une section. `overview`, vide ou inconnu → `/entreprise`. */
export const orgSectionPath = (section: string | null | undefined): string =>
  isOrgSectionSegment(section) ? `/entreprise/${section}` : '/entreprise';

/**
 * Un id vient toujours d'un UUID Supabase. On borne longueur et alphabet : la
 * valeur finit dans un `find()` puis dans du JSX, et une URL est une entrée
 * non fiable comme une autre.
 */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Page d'une équipe : `/entreprise/teams/<id>`. */
export const orgTeamPath = (teamId: string): string => `/entreprise/teams/${teamId}`;

/** Id d'équipe lu dans le chemin, ou null s'il est absent ou malformé. */
export const readTeamIdSegment = (value: string | null | undefined): string | null =>
  value && ID_RE.test(value) ? value : null;

/**
 * Chemin `/entreprise`, `/entreprise/<section connue>` ou
 * `/entreprise/teams/<id>` ?
 *
 * Sert à `RESUMABLE_PAGES` : la dernière page visitée est une valeur relue du
 * stockage local, donc une entrée non fiable. On la valide contre la liste des
 * sections, jamais contre un préfixe (cf. `no-open-redirect.test.ts`).
 */
export const isOrgPath = (pathname: string): boolean => {
  if (pathname === '/entreprise') return true;
  const prefix = '/entreprise/';
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  if (isOrgSectionSegment(rest)) return true;
  const teamPrefix = 'teams/';
  return rest.startsWith(teamPrefix) && readTeamIdSegment(rest.slice(teamPrefix.length)) !== null;
};

/** Entités adressables par l'URL de /entreprise. `okr` : recherche globale (mig. 191). */
export type EntityParam = 'task' | 'project' | 'member' | 'okr';

/** Lit un id d'entité dans l'URL, ou null si absent / malformé. */
export const readEntityParam = (
  params: URLSearchParams,
  key: EntityParam,
): string | null => {
  const raw = params.get(key);
  if (!raw || !ID_RE.test(raw)) return null;
  return raw;
};

/**
 * Construit un lien /entreprise (section + entité optionnelle).
 *
 * `extra` porte les paramètres qui précisent l'ÉTAT d'une entité déjà ciblée,
 * pas une entité de plus — `?memberTab=agenda` sur une fiche membre (#18).
 * Ils restent hors de `EntityParam` parce qu'ils ne se relisent pas avec
 * `readEntityParam` : leurs valeurs sont un vocabulaire fermé, validé contre
 * ce que l'utilisateur a le DROIT de voir, pas contre un alphabet d'id.
 */
export const buildOrgLink = (
  section: string,
  entity?: Partial<Record<EntityParam, string>>,
  extra?: Record<string, string>,
): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...entity, ...extra })) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  const path = orgSectionPath(section);
  return qs ? `${path}?${qs}` : path;
};

/**
 * Traduit une ancienne URL `/entreprise?tab=X&…` en `/entreprise/X?…`, en
 * gardant tous les autres paramètres (`checkout` au retour de Stripe, `task`,
 * `member`, `memberTab`). Renvoie null quand il n'y a rien à traduire.
 */
export const legacyOrgTabRedirect = (params: URLSearchParams): string | null => {
  const tab = params.get('tab');
  if (tab === null) return null;
  const rest = new URLSearchParams(params);
  rest.delete('tab');
  const qs = rest.toString();
  const path = orgSectionPath(tab);
  return qs ? `${path}?${qs}` : path;
};
