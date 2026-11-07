// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - Interface du repository (contrat des deux implémentations)
// ═══════════════════════════════════════════════════════════════════
//
// Forme unique (V12.3, src/modules/CLAUDE.md § Forme d'un module) : ce fichier ne
// porte que l'interface et ses types. Démo : `local.repository.ts`, seed :
// `local.seed.ts`, production : `supabase.repository.ts`.

import type { TeamList, CreateTeamListInput, UpdateTeamListInput } from './types';

export interface ITeamListsRepository {
  /** Listes de l'organisation, `taskIds` renseignés, triées par position. */
  getLists(orgId: string): Promise<TeamList[]>;
  createList(orgId: string, input: CreateTeamListInput): Promise<TeamList>;
  updateList(listId: string, input: UpdateTeamListInput): Promise<void>;
  deleteList(listId: string): Promise<void>;
  addTask(listId: string, taskId: string): Promise<void>;
  removeTask(listId: string, taskId: string): Promise<void>;
}
