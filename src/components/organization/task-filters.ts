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
  // ─── Attributs de la tâche (audit 2026-09-24, onglet Tâches) ───────
  /** Priorités retenues (1..5), [] = toutes. */
  priorities: number[];
  /** Plage d'échéance, bornes incluses, 'YYYY-MM-DD' ou ''. */
  dueFrom: string;
  dueTo: string;
  /** Seulement les tâches SANS échéance (exclusif avec la plage). */
  noDue: boolean;
  /** Catégorie d'entreprise (sous-catégories comprises), ou null. */
  category: string | null;
  /** Tri ET regroupement du tableau : UN seul critère (fusion du 2026-09-27,
   *  cf. `GROUPABLE_SORT_CRITERIA`). */
  group: TaskSortCriterion;
  /** Seulement les tâches bloquées par une dépendance non terminée (onglet Tâches). */
  blocked: boolean;
}

/**
 * Le tableau ne connaît plus deux menus (« Trier » et « Regrouper ») : un
 * seul critère fait les deux. Les cinq premiers affichent une ligne d'en-tête
 * de groupe dans la liste (`GROUPABLE_SORT_CRITERIA`) ; nom et durée restent
 * une liste plate — grouper par nom ou par durée n'apporte rien.
 */
export type TaskSortCriterion = 'priority' | 'deadline' | 'project' | 'assignee' | 'status' | 'name' | 'estimatedTime';
export const TASK_SORT_CRITERIA: readonly TaskSortCriterion[] = ['priority', 'deadline', 'project', 'assignee', 'status', 'name', 'estimatedTime'];
export const GROUPABLE_SORT_CRITERIA: readonly TaskSortCriterion[] = ['priority', 'deadline', 'project', 'assignee', 'status'];
export const isGroupableSort = (c: TaskSortCriterion): boolean => (GROUPABLE_SORT_CRITERIA as readonly string[]).includes(c);

/** Tranches d'échéance du regroupement « Par échéance ». Mêmes 6 jours que
 *  le préréglage « Cette semaine » (`FilterPresets.in6Days`). */
export const DEADLINE_BUCKETS = ['overdue', 'today', 'thisWeek', 'later', 'noDue'] as const;
export type DeadlineBucket = typeof DEADLINE_BUCKETS[number];

const parseLocalIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Bucket d'une échéance par rapport à `todayIso` (date locale, 'YYYY-MM-DD'). */
export function deadlineBucketOf(deadline: string | undefined, todayIso: string): DeadlineBucket {
  if (!deadline) return 'noDue';
  const diffDays = Math.round((parseLocalIso(deadline).getTime() - parseLocalIso(todayIso).getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 6) return 'thisWeek';
  return 'later';
}

export const TASK_FILTER_PARAMS = {
  team: 'fTeam',
  assignee: 'fAssignee',
  project: 'fProject',
  status: 'fStatus',
  q: 'fQ',
  priorities: 'fPrio',
  dueFrom: 'fDueFrom',
  dueTo: 'fDueTo',
  noDue: 'fNoDue',
  category: 'fCat',
  group: 'fGroup',
  blocked: 'fBlocked',
} as const satisfies Record<keyof OrgTaskFilters, string>;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_QUERY = 100;
const idOrNull = (raw: string | null): string | null => (raw && ID_RE.test(raw) ? raw : null);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateOrEmpty = (raw: string | null): string => (raw && DATE_RE.test(raw) ? raw : '');
const parsePriorities = (raw: string | null): number[] =>
  [...new Set((raw ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 5))].sort();

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
    priorities: parsePriorities(params.get(TASK_FILTER_PARAMS.priorities)),
    dueFrom: dateOrEmpty(params.get(TASK_FILTER_PARAMS.dueFrom)),
    dueTo: dateOrEmpty(params.get(TASK_FILTER_PARAMS.dueTo)),
    noDue: params.get(TASK_FILTER_PARAMS.noDue) === '1',
    category: idOrNull(params.get(TASK_FILTER_PARAMS.category)),
    group: (TASK_SORT_CRITERIA as readonly string[]).includes(params.get(TASK_FILTER_PARAMS.group) ?? '')
      ? (params.get(TASK_FILTER_PARAMS.group) as TaskSortCriterion)
      // Défaut ET repli d'une ancienne valeur (l'ex-'none' du regroupement
      // séparé, retiré le 2026-09-27) : « Par priorité » était déjà le tri
      // par défaut, donc rien ne change pour qui n'avait jamais regroupé.
      : 'priority',
    blocked: params.get(TASK_FILTER_PARAMS.blocked) === '1',
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
  set(TASK_FILTER_PARAMS.priorities, filters.priorities.length ? [...filters.priorities].sort().join(',') : null);
  set(TASK_FILTER_PARAMS.dueFrom, filters.noDue ? null : filters.dueFrom || null);
  set(TASK_FILTER_PARAMS.dueTo, filters.noDue ? null : filters.dueTo || null);
  set(TASK_FILTER_PARAMS.noDue, filters.noDue ? '1' : null);
  set(TASK_FILTER_PARAMS.category, filters.category);
  set(TASK_FILTER_PARAMS.group, filters.group === 'priority' ? null : filters.group);
  set(TASK_FILTER_PARAMS.blocked, filters.blocked ? '1' : null);
  return next;
}

/** Un filtre (hors défaut) est-il actif ? */
export const hasActiveTaskFilter = (f: OrgTaskFilters, defaultStatus: TaskStatusFilter): boolean =>
  f.team !== '' || f.assignee !== null || f.project !== null || f.status !== defaultStatus || f.q.trim() !== ''
  || f.blocked || hasAttributeFilter(f);

/** Un filtre sur les attributs de la tâche (priorité, échéance, catégorie) est-il actif ? */
export const hasAttributeFilter = (f: OrgTaskFilters): boolean =>
  f.priorities.length > 0 || f.dueFrom !== '' || f.dueTo !== '' || f.noDue || f.category !== null;

/** Filtres d'attributs remis à zéro : ce que « Tout effacer » rétablit. */
export const CLEARED_ATTRIBUTE_FILTERS: Pick<OrgTaskFilters, 'priorities' | 'dueFrom' | 'dueTo' | 'noDue' | 'category'> = {
  priorities: [], dueFrom: '', dueTo: '', noDue: false, category: null,
};

/**
 * Tâche retenue par les filtres d'attributs. `categoryIds` : la catégorie
 * filtrée ET ses descendantes (une sous-catégorie EST dans sa mère).
 */
export const matchesAttributes = (
  task: { priority: number; deadline?: string; categoryId?: string | null },
  f: Pick<OrgTaskFilters, 'priorities' | 'dueFrom' | 'dueTo' | 'noDue' | 'category'>,
  ctx: { categoryIds?: ReadonlySet<string> } = {},
): boolean => {
  if (f.priorities.length && !f.priorities.includes(task.priority)) return false;
  const due = task.deadline || '';
  if (f.noDue) {
    if (due) return false;
  } else {
    if ((f.dueFrom || f.dueTo) && !due) return false;
    if (f.dueFrom && due < f.dueFrom) return false;
    if (f.dueTo && due > f.dueTo) return false;
  }
  if (f.category) {
    const ids = ctx.categoryIds ?? new Set([f.category]);
    if (!task.categoryId || !ids.has(task.categoryId)) return false;
  }
  return true;
};

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
