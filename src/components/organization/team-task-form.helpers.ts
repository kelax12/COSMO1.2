// Dérivations pures du formulaire de `TeamTaskModal` : valeurs initiales,
// détection d'un changement, charge utile commune à la création et à la mise
// à jour. Sorties de la fiche pour être testées seules (ARCHITECTURE § 3).
import type { TeamProject, TeamTask, TeamTaskStatus } from '@/modules/team-projects';

export const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Les champs que la fiche édite. */
export interface TeamTaskFormValues {
  status: TeamTaskStatus;
  name: string;
  description: string;
  priority: number | null;
  deadline: string;
  /** Plus saisi dans la fiche : la valeur existante, conservée. */
  startDate: string;
  estimatedTime: string;
  projectId: string;
  categoryId: string | null;
  assigneeIds: string[];
  validatorId: string | null;
}

export interface TeamTaskFormDefaults {
  task?: TeamTask;
  projects: TeamProject[];
  defaultProjectId?: string;
  defaultAssigneeIds?: string[];
  defaultStatus?: TeamTaskStatus;
  requireProjectChoice: boolean;
}

/**
 * Valeurs d'ouverture. Pas de priorité présélectionnée en création : le
 * fallback à 3 (défaut DB, mig. 062) n'intervient qu'au save. Le projet n'est
 * pas le premier de la liste quand l'appelant exige un choix (le « + » d'une
 * colonne de kanban n'a aucun projet en contexte). La catégorie (mig. 111) est
 * pré-remplie par celle du projet d'ouverture, en création seulement.
 */
export function initialTeamTaskForm(d: TeamTaskFormDefaults): TeamTaskFormValues {
  return d.task ? teamTaskFormFromTask(d.task) : newTeamTaskForm(d);
}

/** Édition : les valeurs de la tâche, champs absents vidés. */
function teamTaskFormFromTask(task: TeamTask): TeamTaskFormValues {
  return {
    status: task.status,
    name: task.name,
    description: task.description ?? '',
    priority: task.priority ?? null,
    deadline: task.deadline ?? '',
    startDate: task.startDate ?? '',
    estimatedTime: task.estimatedTime?.toString() ?? '',
    projectId: task.projectId,
    categoryId: task.categoryId ?? null,
    assigneeIds: task.assigneeIds,
    validatorId: task.validatorId ?? null,
  };
}

/** Création : présélections de l'appelant, sinon le premier projet (sauf choix exigé). */
function newTeamTaskForm(d: TeamTaskFormDefaults): TeamTaskFormValues {
  const { projects } = d;
  const firstProjectId = d.requireProjectChoice ? '' : projects[0]?.id ?? '';
  const openingProjectId = d.defaultProjectId ?? (d.requireProjectChoice ? '' : projects[0]?.id);
  return {
    status: d.defaultStatus ?? 'in_progress',
    name: '',
    description: '',
    priority: null,
    deadline: '',
    startDate: '',
    estimatedTime: '',
    projectId: d.defaultProjectId ?? firstProjectId,
    categoryId: projects.find((p) => p.id === openingProjectId)?.categoryId ?? null,
    assigneeIds: d.defaultAssigneeIds ?? [],
    validatorId: null,
  };
}

const minutesOf = (estimatedTime: string) => (estimatedTime.trim() === '' ? undefined : Number(estimatedTime));

/** Un champ diffère de la tâche de référence (listes comprises, une fois connues). */
export function teamTaskHasChanges(
  form: TeamTaskFormValues,
  ref: TeamTask,
  lists: { listIds: string[]; baseListIds: string[] | null },
): boolean {
  return (
    form.status !== ref.status ||
    form.name !== ref.name ||
    form.description !== (ref.description ?? '') ||
    form.priority !== ref.priority ||
    form.deadline !== (ref.deadline ?? '') ||
    form.startDate !== (ref.startDate ?? '') ||
    (minutesOf(form.estimatedTime) ?? 0) !== (ref.estimatedTime ?? 0) ||
    form.projectId !== ref.projectId ||
    form.categoryId !== (ref.categoryId ?? null) ||
    form.validatorId !== (ref.validatorId ?? null) ||
    !sameSet(form.assigneeIds, ref.assigneeIds) ||
    (lists.baseListIds !== null && !sameSet(lists.listIds, lists.baseListIds))
  );
}

/**
 * Charge utile commune à la création et à la mise à jour. Le début est ramené
 * à l'échéance si celle-ci passe avant (CHECK mig. 153) ; une priorité ou une
 * durée vide n'est pas envoyée.
 */
export function buildTeamTaskCommon(form: TeamTaskFormValues) {
  const minutes = minutesOf(form.estimatedTime);
  const { startDate, deadline, priority } = form;
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    ...(priority !== null ? { priority } : {}),
    deadline,
    startDate: startDate && deadline && startDate > deadline ? deadline : startDate,
    status: form.status,
    ...(minutes !== undefined && !Number.isNaN(minutes) ? { estimatedTime: minutes } : {}),
    assigneeIds: form.assigneeIds,
    categoryId: form.categoryId,
    validatorId: form.validatorId,
  };
}
