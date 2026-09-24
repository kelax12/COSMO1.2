// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS · Portefeuille — stockage démo (localStorage)
//
// Séparé du repository pour que `local.repository.ts` puisse photographier
// une tâche supprimée sans importer tout le portefeuille (et sans cycle).
// ═══════════════════════════════════════════════════════════════════

import { readJsonArray, writeJsonOrThrow } from '@/lib/safe-json';
import type { TeamSubtask, TeamTask, TeamTaskComment, TeamTaskDependency } from './types';

export const TEAM_TASK_TRASH_STORAGE_KEY = 'cosmo_team_task_trash';
export const TEAM_PROJECT_LINKS_STORAGE_KEY = 'cosmo_team_project_links';
export const TEAM_PROJECT_UPDATES_STORAGE_KEY = 'cosmo_team_project_updates';
export const TEAM_FOLLOWS_STORAGE_KEY = 'cosmo_team_follows';

/** Photographie d'une tâche supprimée : tout ce que la suppression emporte. */
export interface LocalTrashEntry {
  task: TeamTask;
  subtasks: TeamSubtask[];
  comments: TeamTaskComment[];
  dependencies: TeamTaskDependency[];
  deletedBy: string;
  deletedAt: string;
}

/** Même rétention qu'en production (purge quotidienne à 30 jours, mig. 151). */
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const readLocalTrash = (): LocalTrashEntry[] => {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  return (readJsonArray<LocalTrashEntry>(TEAM_TASK_TRASH_STORAGE_KEY) ?? []).filter(
    (e) => Date.parse(e.deletedAt) >= cutoff,
  );
};

export const writeLocalTrash = (entries: LocalTrashEntry[]): void => {
  writeJsonOrThrow(TEAM_TASK_TRASH_STORAGE_KEY, entries);
};

export const pushLocalTrash = (entry: LocalTrashEntry): void => {
  writeLocalTrash([entry, ...readLocalTrash().filter((e) => e.task.id !== entry.task.id)]);
};
