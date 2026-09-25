// ═══════════════════════════════════════════════════════════════════
// Filtres de l'annuaire des membres (/entreprise/members)
//
// Audit « passage à l'échelle » du 2026-09-23 : à cent membres, la seule
// recherche par nom ne suffit plus. On filtre par équipe, rôle, manager
// direct, « non placé », période d'arrivée, et le filtre vit dans l'URL
// pour qu'un lien le partage.
//
// Tout ce qui est lu de l'URL passe par `readDirectoryFilters` : une URL est
// une entrée non fiable, chaque valeur est bornée à un vocabulaire fermé ou à
// l'alphabet d'un identifiant (même contrat que `readEntityParam`).
// ═══════════════════════════════════════════════════════════════════

import { buildOrgTree, isManagerOf, type OrgMember } from '@/modules/organizations';
import { filterMembersByQuery } from './member-search.helpers';

export const DIRECTORY_ROLES = ['admin', 'manager', 'member'] as const;
export type DirectoryRole = (typeof DIRECTORY_ROLES)[number];

/** Périodes d'arrivée : « depuis moins de… », plus « depuis plus d'un an ». */
export const JOINED_PERIODS = ['7d', '30d', '90d', '1y', 'older'] as const;
export type JoinedPeriod = (typeof JOINED_PERIODS)[number];

export interface DirectoryFilters {
  query: string;
  teamId: string | null;
  role: DirectoryRole | null;
  managerId: string | null;
  unplaced: boolean;
  joined: JoinedPeriod | null;
}

export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = {
  query: '',
  teamId: null,
  role: null,
  managerId: null,
  unplaced: false,
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
  managerId: 'dirManager',
  unplaced: 'dirUnplaced',
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
    managerId: idOrNull(params.get(DIRECTORY_PARAMS.managerId)),
    unplaced: params.get(DIRECTORY_PARAMS.unplaced) === '1',
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
  set(DIRECTORY_PARAMS.managerId, filters.managerId);
  set(DIRECTORY_PARAMS.unplaced, filters.unplaced ? '1' : null);
  set(DIRECTORY_PARAMS.joined, filters.joined);
  return next;
}

/** Nombre de filtres actifs HORS recherche (la recherche a son propre champ). */
export const activeFilterCount = (f: DirectoryFilters): number =>
  [f.teamId, f.role, f.managerId, f.unplaced || null, f.joined].filter(Boolean).length;

/** Rôle AFFICHÉ : `manager` est dérivé de la pyramide, jamais stocké. */
export const directoryRoleOf = (m: OrgMember, members: OrgMember[]): DirectoryRole =>
  m.role === 'admin' ? 'admin' : isManagerOf(members, m.userId) ? 'manager' : 'member';

const DAY = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<Exclude<JoinedPeriod, 'older'>, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

export function joinedWithin(joinedAt: string, period: JoinedPeriod, now: number): boolean {
  const t = Date.parse(joinedAt);
  if (Number.isNaN(t)) return false;
  const age = now - t;
  return period === 'older' ? age > 365 * DAY : age <= PERIOD_DAYS[period] * DAY;
}

interface ApplyContext {
  ownerId: string;
  /** Toutes les équipes de l'organisation (une équipe VIDE reste un filtre valide). */
  teamIds: Set<string>;
  /** userId → ids des équipes du membre. */
  teamIdsByUser: Map<string, Set<string>>;
  now: number;
}

/**
 * Applique filtres ET recherche, dans l'ordre de l'annuaire. « Non placé » a
 * la définition de la pyramide (`buildOrgTree`) : sans manager ni subordonné,
 * propriétaire exclu. Un identifiant d'équipe ou de manager inconnu ne vide
 * pas l'annuaire en silence : il est ignoré, comme une valeur hors vocabulaire.
 */
export function applyDirectoryFilters(
  members: OrgMember[],
  filters: DirectoryFilters,
  { ownerId, teamIds, teamIdsByUser, now }: ApplyContext,
): OrgMember[] {
  const unplacedIds = filters.unplaced
    ? new Set(buildOrgTree(members, ownerId).unplaced.map((m) => m.userId))
    : null;
  const knownManager = !!filters.managerId && members.some((m) => m.userId === filters.managerId);
  const knownTeam = !!filters.teamId && teamIds.has(filters.teamId);

  const filtered = members.filter((m) => {
    if (filters.teamId && knownTeam && !teamIdsByUser.get(m.userId)?.has(filters.teamId)) return false;
    if (filters.role && directoryRoleOf(m, members) !== filters.role) return false;
    if (knownManager && m.managerId !== filters.managerId) return false;
    if (unplacedIds && !unplacedIds.has(m.userId)) return false;
    if (filters.joined && !joinedWithin(m.joinedAt, filters.joined, now)) return false;
    return true;
  });
  return filterMembersByQuery(filtered, filters.query);
}

/** Managers proposés par le filtre « manager direct » : ceux qui ont au moins un direct. */
export const directManagers = (members: OrgMember[]): OrgMember[] =>
  members
    .filter((m) => isManagerOf(members, m.userId))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
