// ═══════════════════════════════════════════════════════════════════
// LISTS MODULE - Interface du repository (contrat des deux implémentations)
// ═══════════════════════════════════════════════════════════════════
//
// Forme unique (V12.3, src/modules/CLAUDE.md § Forme d'un module) : ce fichier ne
// porte que l'interface et ses types. Démo : `local.repository.ts`, seed :
// `local.seed.ts`, production : `supabase.repository.ts`.

import type { TaskList, CreateListInput, UpdateListInput } from './types';
import type { CreateOptions } from '@/lib/restore-id';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IListsRepository {
  // Read operations
  getAll(): Promise<TaskList[]>;
  // Write operations
  create(input: CreateListInput, options?: CreateOptions): Promise<TaskList>;
  update(id: string, updates: UpdateListInput): Promise<TaskList>;
  delete(id: string): Promise<void>;

  // Task association operations
  addTaskToList(taskId: string, listId: string): Promise<TaskList>;
  removeTaskFromList(taskId: string, listId: string): Promise<TaskList>;
}
