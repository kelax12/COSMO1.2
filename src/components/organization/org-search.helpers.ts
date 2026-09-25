// Recherche globale de l'organisation (palette Ctrl+K, mig. 191) — fonctions
// pures : ordre des groupes, lien de chaque résultat, lecture du détail.
//
// Le serveur rend des lignes à plat (`search_org`), bornées PAR TYPE. Le
// regroupement et l'ordre d'affichage se décident ici, une fois.

import type { OrgSearchKind, OrgSearchResult } from '@/modules/organizations/governance.types';
import type { TeamProjectStatus, TeamTaskStatus } from '@/modules/team-projects';
import { buildOrgLink, orgTeamPath } from './deep-link.helpers';

/** Ordre des groupes : ce qu'on ouvre le plus souvent d'abord. */
export const ORG_SEARCH_ORDER: readonly OrgSearchKind[] = ['project', 'task', 'milestone', 'okr', 'kr', 'member', 'team'];

export function groupOrgResults(rows: OrgSearchResult[]): Map<OrgSearchKind, OrgSearchResult[]> {
  const groups = new Map<OrgSearchKind, OrgSearchResult[]>();
  for (const r of rows) {
    const list = groups.get(r.kind) ?? [];
    list.push(r);
    groups.set(r.kind, list);
  }
  return groups;
}

/**
 * Où mène un résultat. Un jalon ouvre SON projet, un résultat clé SON
 * objectif : ni l'un ni l'autre n'a de page à lui.
 */
export function orgSearchLink(r: OrgSearchResult): string {
  switch (r.kind) {
    case 'project': return buildOrgLink('projects', { project: r.id });
    case 'milestone': return buildOrgLink('projects', r.parentId ? { project: r.parentId } : undefined);
    case 'task': return buildOrgLink('projects', { task: r.id });
    case 'okr': return buildOrgLink('okr', { okr: r.id });
    case 'kr': return buildOrgLink('okr', r.parentId ? { okr: r.parentId } : undefined);
    case 'member': return buildOrgLink('members', { member: r.id });
    case 'team': return orgTeamPath(r.id);
  }
}

const PROJECT_DETAILS: readonly (TeamProjectStatus | 'archived')[] = ['planned', 'active', 'on_hold', 'done', 'archived'];
const TASK_DETAILS: readonly TeamTaskStatus[] = ['todo', 'in_progress', 'review', 'blocked', 'done'];

/** Détail d'un projet : son statut, ou `archived`. Toute autre valeur est ignorée. */
export const isProjectDetail = (v: string | null): v is TeamProjectStatus | 'archived' =>
  !!v && (PROJECT_DETAILS as readonly string[]).includes(v);

export const isTaskDetail = (v: string | null): v is TeamTaskStatus =>
  !!v && (TASK_DETAILS as readonly string[]).includes(v);

/** Une date locale 'YYYY-MM-DD', et rien d'autre (le détail vient du serveur). */
export const isDayKey = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
