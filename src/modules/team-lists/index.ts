// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - Public API (mig. 203)
// ═══════════════════════════════════════════════════════════════════

export type { TeamList, CreateTeamListInput, UpdateTeamListInput } from './types';
export { teamListKeys, TEAM_LISTS_STORAGE_KEY, TEAM_LIST_TASKS_STORAGE_KEY } from './constants';
export type { ITeamListsRepository } from './repository';
export { readDefaultTeamListId, writeDefaultTeamListId } from './default-pin';
export {
  useTeamLists,
  useCreateTeamList,
  useUpdateTeamList,
  useAddTaskToTeamList,
  useRemoveTaskFromTeamList,
  useSetTaskTeamLists,
  useDeleteTeamListWithUndo,
} from './hooks';
