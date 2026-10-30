// ═══════════════════════════════════════════════════════════════════
// Filtres de l'annuaire des membres (/entreprise/members)
//
// Audit « passage à l'échelle » du 2026-09-23 : à cent membres, la seule
// recherche par nom ne suffit plus. On filtre par équipe, rôle et période
// d'arrivée, et le filtre vit dans l'URL pour qu'un lien le partage. Les
// filtres « manager direct » et « non placé » sont partis avec l'organigramme
// (mig. 229) ; un ancien lien qui les porte est simplement ignoré.
//
// Tout ce qui est lu de l'URL passe par `readDirectoryFilters` : une URL est
// une entrée non fiable, chaque valeur est bornée à un vocabulaire fermé ou à
// l'alphabet d'un identifiant (même contrat que `readEntityParam`).
// ═══════════════════════════════════════════════════════════════════

import type { OrgMember } from '@/modules/organizations';
import { filterMembersByQuery } from './member-search.helpers';

export const DIRECTORY_ROLES = ['admin', 'member'] as const;
export type DirectoryRole = (typeof DIRECTORY_ROLES)[number];

/** Périodes d'arrivée : « depuis moins de… », plus « depuis plus d'un an ». */
export const JOINED_PERIODS = ['7d', '30d', '90d', '1y', 'older'] as const;
export type JoinedPeriod = (typeof JOINED_PERIODS)[number];

export interface DirectoryFilters {
  query: string;
  teamId: string | null;
  role: DirectoryRole | null;
  joined: JoinedPeriod | null;
}

export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = {
  query: '',
  teamId: null,
  role: null,
  joined: null,
};

/**
 * Paramètres d'URL. Préfixés `dir` : `/entreprise/members` porte déjà
 * `?member=` (fiche), et un `?team=` nu entrerait en collision avec un futur
 * lien vers une équipe.
 */
export const DIRECTORY_PARAMS = {
  query: 'dirQ',
  teamId: 'dirTeam',
  role: 'dirRole',
  joined: 'dirJoined',
} as const satisfies Record<keyof DirectoryFilters, string>;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_QUERY = 100;

const oneOf = <T extends string>(values: readonly T[], raw: string | null): T | null =>
  raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : null;

const idOrNull = (raw: string | null): string | null => (raw && ID_RE.test(raw) ? raw : null);

/** Lit les filtres depuis l'URL. Toute valeur hors vocabulaire est ignorée, jamais propagée. */
export function readDirectoryFilters(params: URLSearchParams): DirectoryFilters {
  return {
    query: (params.get(DIRECTORY_PARAMS.query) ?? '').slice(0, MAX_QUERY),
    teamId: idOrNull(params.get(DIRECTORY_PARAMS.teamId)),
    role: oneOf(DIRECTORY_ROLES, params.get(DIRECTORY_PARAMS.role)),
    joined: oneOf(JOINED_PERIODS, params.get(DIRECTORY_PARAMS.joined)),
  };
}

/** Écrit les filtres dans une COPIE de `params` : les autres paramètres (`member`, …) survivent. */
export function writeDirectoryFilters(params: URLSearchParams, filters: DirectoryFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  set(DIRECTORY_PARAMS.query, filters.query.trim() ? filters.query.slice(0, MAX_QUERY) : null);
  set(DIRECTORY_PARAMS.teamId, filters.teamId);
  set(DIRECTORY_PARAMS.role, filters.role);
  set(DIRECTORY_PARAMS.joined, filters.joined);
  return next;
}

/** Nombre de filtres actifs HORS recherche (la recherche a son propre champ). */
export const activeFilterCount = (f: DirectoryFilters): number =>
  [f.teamId, f.role, f.joined].filter(Boolean).length;

/** Grade AFFICHÉ : administrateur ou membre. Le reste, ce sont les rôles personnalisés. */
export const directoryRoleOf = (m: OrgMember): DirectoryRole => (m.role === 'admin' ? 'admin' : 'member');

const DAY = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<Exclude<JoinedPeriod, 'older'>, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

export function joinedWithin(joinedAt: string, period: JoinedPeriod, now: number): boolean {
  const t = Date.parse(joinedAt);
  if (Number.isNaN(t)) return false;
  const age = now - t;
  return period === 'older' ? age > 365 * DAY : age <= PERIOD_DAYS[period] * DAY;
}

interface ApplyContext {
  /** Toutes les équipes de l'organisation (une équipe VIDE reste un filtre valide). */
  teamIds: Set<string>;
  /** userId → ids des équipes du membre. */
  teamIdsByUser: Map<string, Set<string>>;
  now: number;
}

/**
 * Applique filtres ET recherche, dans l'ordre de l'annuaire. Un identifiant
 * d'équipe inconnu ne vide pas l'annuaire en silence : il est ignoré, comme
 * une valeur hors vocabulaire.
 */
export function applyDirectoryFilters(
  members: OrgMember[],
  filters: DirectoryFilters,
  { teamIds, teamIdsByUser, now }: ApplyContext,
): OrgMember[] {
  const knownTeam = !!filters.teamId && teamIds.has(filters.teamId);

  const filtered = members.filter((m) => {
    if (filters.teamId && knownTeam && !teamIdsByUser.get(m.userId)?.has(filters.teamId)) return false;
    if (filters.role && directoryRoleOf(m) !== filters.role) return false;
    if (filters.joined && !joinedWithin(m.joinedAt, filters.joined, now)) return false;
    return true;
  });
  return filterMembersByQuery(filtered, filters.query);
}

