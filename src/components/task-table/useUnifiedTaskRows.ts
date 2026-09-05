// ═══════════════════════════════════════════════════════════════════
// Quelles lignes la liste de tâches montre, et dans quel ordre
//
// FRONTIÈRE : dérivation pure. Ce hook ne déclenche aucune écriture, ne
// connaît aucune modale, aucun mode de sélection, aucune mutation. Il prend
// deux gisements (les tâches personnelles, les tâches d'équipe qui me sont
// assignées), applique les mêmes filtres aux deux, et rend une liste unique
// triée — plus le décompte de ce qu'elle ne montre pas.
//
// ⚠️ La règle qui justifie que les deux gisements soient traités ICI et pas
// séparément : les filtres perso (favoris, retard, collaboration) n'ont
// AUCUN équivalent côté équipe. Quand l'un d'eux est actif on masque les
// tâches d'équipe, plutôt que d'afficher une liste qu'aucun de ces filtres
// ne décrit. Séparer les deux calculs ferait diverger cette règle.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useMemo } from 'react';
import type { Task } from '@/modules/tasks';
import type { TeamTask, TeamProject } from '@/modules/team-projects';
import { filterAndSortTasks } from '@/modules/tasks/task-filtering';
import { myAssignedTasks } from '../organization/team-projects.helpers';
import type { UnifiedTaskRow } from './list';

export type QuickFilter = 'none' | 'bookmarked' | 'completed' | 'overdue' | 'collaboration';
export type ScopeFilter = 'all' | 'perso' | 'entreprise';

interface Params {
  tasks: Task[];
  allTeamTasks: TeamTask[];
  teamProjectsById: Map<string, TeamProject>;
  userId?: string;
  quickFilter: QuickFilter;
  scopeFilter: ScopeFilter;
  showCompleted: boolean;
  priorityRange: [number, number];
  sortField?: string;
  sortDirection: 'asc' | 'desc';
  searchTerm?: string;
}

export function useUnifiedTaskRows({
  tasks,
  allTeamTasks,
  teamProjectsById,
  userId,
  quickFilter,
  scopeFilter,
  showCompleted,
  priorityRange,
  sortField,
  sortDirection,
  searchTerm,
}: Params): { unifiedRows: UnifiedTaskRow[]; hiddenCompletedCount: number } {
  // Filtrage et tri mémoïsés — logique pure extraite (task-filtering.ts, testée).
  const sortedTasks = useMemo(
    () => filterAndSortTasks({
      tasks,
      quickFilter,
      showCompleted,
      priorityRange,
      sortField,
      sortDirection,
    }),
    [tasks, quickFilter, showCompleted, priorityRange, sortField, sortDirection],
  );

  // ── Tâches d'équipe assignées à moi, filtrées comme les tâches perso ──
  const teamTasksVisibleForQuickFilter = quickFilter === 'none' || quickFilter === 'completed';
  const teamCompletedState = quickFilter === 'completed' ? true : showCompleted;

  const myTeamTasks = useMemo(() => {
    if (!userId || !teamTasksVisibleForQuickFilter) return [];
    let result = myAssignedTasks(allTeamTasks, userId).filter((t) => t.completed === teamCompletedState);
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(lower));
    }
    result = result.filter((t) => t.priority >= priorityRange[0] && t.priority <= priorityRange[1]);
    return result;
  }, [allTeamTasks, userId, teamTasksVisibleForQuickFilter, teamCompletedState, searchTerm, priorityRange]);

  const scopedPersoTasks = useMemo(
    () => (scopeFilter === 'entreprise' ? [] : sortedTasks),
    [scopeFilter, sortedTasks],
  );
  const scopedTeamTasks = useMemo(
    () => (scopeFilter === 'perso' ? [] : myTeamTasks),
    [scopeFilter, myTeamTasks],
  );

  // Maquette 50 — « La fin de la liste se dit ». Le décompte porte sur les
  // tâches TERMINÉES que la vue courante n'affiche pas : c'est la seule chose
  // que le marqueur puisse proposer d'ouvrir.
  const hiddenCompletedCount = useMemo(
    () => (showCompleted ? 0 : tasks.filter((t) => t.completed).length),
    [tasks, showCompleted],
  );

  // Fusion triée : mêmes clés de tri que compareTasks (task-filtering.ts),
  // adaptées aux deux formes (Task / TeamTask). Les champs sans équivalent
  // côté équipe (catégorie, date de création) laissent l'ordre d'insertion
  // (perso d'abord) — cas secondaire, non prioritaire ici.
  const unifiedRows: UnifiedTaskRow[] = useMemo(() => {
    const rows: UnifiedTaskRow[] = [
      ...scopedPersoTasks.map((task) => ({ kind: 'perso' as const, id: task.id, task })),
      ...scopedTeamTasks.map((task) => ({
        kind: 'entreprise' as const,
        id: task.id,
        task,
        project: teamProjectsById.get(task.projectId),
      })),
    ];

    if (!sortField) return rows;

    const sortValue = (row: UnifiedTaskRow) => {
      const t = row.task;
      switch (sortField) {
        case 'name': return t.name;
        case 'priority': return t.priority;
        case 'deadline': return t.deadline ? new Date(t.deadline).getTime() : Number.POSITIVE_INFINITY;
        case 'estimatedTime': return t.estimatedTime ?? 0;
        case 'completedAt': return showCompleted && t.completedAt ? new Date(t.completedAt).getTime() : 0;
        default: return 0;
      }
    };

    return [...rows].sort((a, b) => {
      if (sortField === 'priority') {
        // Une tâche sans priorité (0) est la MOINS prioritaire, quel que soit
        // le sens de tri — même règle que compareTasks (task-filtering.ts).
        const aNone = a.task.priority === 0;
        const bNone = b.task.priority === 0;
        if (aNone && bNone) return 0;
        if (aNone) return 1;
        if (bNone) return -1;
      }
      const va = sortValue(a);
      const vb = sortValue(b);
      const comparison = typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb)
        : (va as number) - (vb as number);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [scopedPersoTasks, scopedTeamTasks, teamProjectsById, sortField, sortDirection, showCompleted]);

  return { unifiedRows, hiddenCompletedCount };
}
