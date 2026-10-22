// ═══════════════════════════════════════════════════════════════════
// Filtres de l'onglet Projets : la barre commune (`OrgTaskFilterBar`) et les
// préréglages (`FilterPresets`) y trient des PROJETS, plus des tâches
// (répartition Projets / Tâches du 2026-09-27). Même état d'URL que l'onglet
// Tâches (`task-filters.ts`), autre lecture :
//   - personne : les projets qu'elle porte ou où elle a une tâche ouverte ;
//   - « en retard » : échéance du projet dépassée, ou une tâche ouverte en retard ;
//   - plage d'échéance (« Cette semaine ») : échéance du projet dans la plage,
//     ou une tâche ouverte qui y tombe.
// ═══════════════════════════════════════════════════════════════════

import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { isTaskOverdue } from './team-projects.helpers';
import type { OrgTaskFilters } from './task-filters';
import { isMyProject } from './portfolio.helpers';

/** Aujourd'hui, date locale (convention en-CA du projet). */
const todayLocal = (): string => new Date().toLocaleDateString('en-CA');

/** Le projet a-t-il dépassé son échéance, ou porte-t-il une tâche en retard ? */
export const isProjectOverdue = (project: TeamProject, projectTasks: TeamTask[], today = todayLocal()): boolean => {
  const openTasks = projectTasks.filter((t) => !t.completed);
  if (project.dueDate && project.dueDate < today && openTasks.length > 0) return true;
  return openTasks.some(isTaskOverdue);
};

const inRange = (date: string | null | undefined, from: string, to: string): boolean =>
  !!date && (!from || date >= from) && (!to || date <= to);

/** Le projet passe-t-il les filtres de portée, d'état et d'échéance ? */
export const matchesProjectFilters = (
  project: TeamProject,
  filters: Pick<OrgTaskFilters, 'assignee' | 'status' | 'dueFrom' | 'dueTo'>,
  allTasks: TeamTask[],
  today = todayLocal(),
): boolean => {
  const projectTasks = allTasks.filter((t) => t.projectId === project.id);
  if (filters.assignee && !isMyProject(project, filters.assignee, projectTasks)) return false;
  if (filters.status === 'overdue' && !isProjectOverdue(project, projectTasks, today)) return false;
  if (filters.dueFrom || filters.dueTo) {
    const dueInRange = inRange(project.dueDate, filters.dueFrom, filters.dueTo)
      || projectTasks.some((t) => !t.completed && inRange(t.deadline, filters.dueFrom, filters.dueTo));
    if (!dueInRange) return false;
  }
  return true;
};
