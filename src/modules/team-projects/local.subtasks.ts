// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — sous-tâches en mode DÉMO (mig. 092)
//
// Séparé de `local.repository.ts` le 2026-09-26 pour le garder sous le
// plafond de 600 lignes, sur le modèle de `local.labels.ts`.
// ═══════════════════════════════════════════════════════════════════

import { localizeSeed } from '@/lib/seed-i18n';
import { safeGetItem, safeSetItem, writeJsonOrThrow } from '@/lib/safe-json';
import { makeApiError } from '@/lib/normalizeApiError';
import type { CreateTeamSubtaskInput, TeamSubtask, UpdateTeamSubtaskInput } from './types';
import { TEAM_TASK_SUBTASKS_STORAGE_KEY } from './constants';
import { DEMO_USER_ID, DEMO_SUBTASKS, DEMO_SUBTASKS_EN } from './demo-seed';

/** Même lecture que `local.repository.ts` : une valeur illisible est ré-ensemencée. */
function readSubtasks(): TeamSubtask[] {
  const data = safeGetItem(TEAM_TASK_SUBTASKS_STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data) as TeamSubtask[];
    } catch {
      // illisible : on repart de la graine, comme au premier passage
    }
  }
  const clone = JSON.parse(JSON.stringify(localizeSeed(DEMO_SUBTASKS, DEMO_SUBTASKS_EN))) as TeamSubtask[];
  safeSetItem(TEAM_TASK_SUBTASKS_STORAGE_KEY, JSON.stringify(clone));
  return clone;
}

const save = (s: TeamSubtask[]): void => writeJsonOrThrow(TEAM_TASK_SUBTASKS_STORAGE_KEY, s);

export function getSubtasks(taskId: string): TeamSubtask[] {
  // Même ordre que la requête Supabase (position, puis création) : la démo
  // et la prod doivent afficher la liste identiquement.
  return readSubtasks()
    .filter((s) => s.taskId === taskId)
    .sort((a, b) => a.position - b.position || (a.createdAt < b.createdAt ? -1 : 1));
}

export function createSubtask(input: CreateTeamSubtaskInput): TeamSubtask {
  const all = readSubtasks();
  const subtask: TeamSubtask = {
    id: crypto.randomUUID(),
    taskId: input.taskId,
    title: input.title,
    completed: false,
    position: input.position ?? all.filter((s) => s.taskId === input.taskId).length,
    createdBy: DEMO_USER_ID,
    createdAt: new Date().toISOString(),
  };
  save([...all, subtask]);
  return subtask;
}

export function updateSubtask(subtaskId: string, input: UpdateTeamSubtaskInput): TeamSubtask {
  const all = readSubtasks();
  const subtask = all.find((s) => s.id === subtaskId);
  if (!subtask) throw makeApiError('not_found');
  if (input.title !== undefined) subtask.title = input.title;
  if (input.completed !== undefined) subtask.completed = input.completed;
  if (input.position !== undefined) subtask.position = input.position;
  save(all);
  return subtask;
}

export function deleteSubtask(subtaskId: string): void {
  save(readSubtasks().filter((s) => s.id !== subtaskId));
}
