// ═══════════════════════════════════════════════════════════════════
// Filtres de tâches du mode entreprise : UN état, dans l'URL
//
// Cohérence globale (2026-09-25) : l'onglet Tâches filtrait dans un état local
// (perdu au rechargement, impossible à partager), l'onglet Projets dans des
// préférences enregistrées (qui revenaient trois jours plus tard sur une liste
// filtrée sans qu'on s'en souvienne). Deux grammaires pour la même question,
// « quelles tâches je regarde ? ».
//
// Désormais les deux onglets lisent le MÊME état, ici, rangé dans l'URL : un
// lien partage exactement ce qu'on voit, le bouton précédent défait un filtre,
// et la barre qui l'affiche est la même (`OrgTaskFilterBar`).
//
// Paramètres préfixés `f` : `?project=` et `?team=` sont déjà des ADRESSES
// d'objet (page projet, page d'équipe), cf. `deep-link.helpers`.
// ═══════════════════════════════════════════════════════════════════

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { TaskStatusFilter } from './team-projects.helpers';

export const TASK_STATUS_FILTERS: readonly TaskStatusFilter[] = ['open', 'overdue', 'doneThisWeek', 'all'];

export interface OrgTaskFilters {
  /** '' = toutes les équipes, 'org' = sans équipe, sinon un id d'équipe. */
  team: string;
  /** Assigné filtré, ou null pour tout le monde. */
  assignee: string | null;
  /** Projet filtré (onglet Tâches), ou null. */
  project: string | null;
  status: TaskStatusFilter;
  /** Recherche libre. */
  q: string;
}

export const TASK_FILTER_PARAMS = {
  team: 'fTeam',
  assignee: 'fAssignee',
  project: 'fProject',
  status: 'fStatus',
  q: 'fQ',
} as const satisfies Record<keyof OrgTaskFilters, string>;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_QUERY = 100;
const idOrNull = (raw: string | null): string | null => (raw && ID_RE.test(raw) ? raw : null);

/**
 * Lit les filtres. Une URL est une entrée non fiable : toute valeur hors
 * vocabulaire est ignorée, jamais propagée. `defaultStatus` est celui de
 * l'onglet (Tâches ouvre sur « ouvertes », Projets sur « tout »).
 */
export function readTaskFilters(params: URLSearchParams, defaultStatus: TaskStatusFilter): OrgTaskFilters {
  const rawTeam = params.get(TASK_FILTER_PARAMS.team);
  const rawStatus = params.get(TASK_FILTER_PARAMS.status);
  return {
    team: rawTeam === 'org' ? 'org' : idOrNull(rawTeam) ?? '',
    assignee: idOrNull(params.get(TASK_FILTER_PARAMS.assignee)),
    project: idOrNull(params.get(TASK_FILTER_PARAMS.project)),
    status: TASK_STATUS_FILTERS.includes(rawStatus as TaskStatusFilter) ? (rawStatus as TaskStatusFilter) : defaultStatus,
    q: (params.get(TASK_FILTER_PARAMS.q) ?? '').slice(0, MAX_QUERY),
  };
}

/**
 * Écrit les filtres dans une COPIE de `params` : les adresses d'objet
 * (`?project=`, `?task=`…) survivent. Une valeur égale au défaut n'est pas
 * écrite, pour que l'URL « nue » reste l'état d'arrivée.
 */
export function writeTaskFilters(
  params: URLSearchParams,
  filters: OrgTaskFilters,
  defaultStatus: TaskStatusFilter,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  set(TASK_FILTER_PARAMS.team, filters.team || null);
  set(TASK_FILTER_PARAMS.assignee, filters.assignee);
  set(TASK_FILTER_PARAMS.project, filters.project);
  set(TASK_FILTER_PARAMS.status, filters.status === defaultStatus ? null : filters.status);
  set(TASK_FILTER_PARAMS.q, filters.q.trim() ? filters.q.slice(0, MAX_QUERY) : null);
  return next;
}

/** Un filtre (hors défaut) est-il actif ? */
export const hasActiveTaskFilter = (f: OrgTaskFilters, defaultStatus: TaskStatusFilter): boolean =>
  f.team !== '' || f.assignee !== null || f.project !== null || f.status !== defaultStatus || f.q.trim() !== '';

/** Tâche dans le périmètre équipe (via son projet) et assigné. */
export const matchesScope = (
  task: { assigneeIds: string[]; projectId: string },
  filters: Pick<OrgTaskFilters, 'team' | 'assignee'>,
  teamOfProject: (projectId: string) => string | null | undefined,
): boolean => {
  if (filters.assignee && !task.assigneeIds.includes(filters.assignee)) return false;
  if (!filters.team) return true;
  const teamId = teamOfProject(task.projectId) ?? null;
  return filters.team === 'org' ? teamId === null : teamId === filters.team;
};

/** État des filtres + écriture, dans l'URL. `replace` : filtrer n'empile pas l'historique à chaque frappe. */
export const useOrgTaskFilters = (defaultStatus: TaskStatusFilter) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readTaskFilters(searchParams, defaultStatus), [searchParams, defaultStatus]);
  const setFilters = useCallback(
    (patch: Partial<OrgTaskFilters>) =>
      setSearchParams(
        (prev) => writeTaskFilters(prev, { ...readTaskFilters(prev, defaultStatus), ...patch }, defaultStatus),
        { replace: true },
      ),
    [setSearchParams, defaultStatus],
  );
  return { filters, setFilters };
};
