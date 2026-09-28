// Filtre « étiquette » de l'onglet Tâches (audit du 2026-09-24, M8). À part de
// `task-extras.hooks.ts`, que la fiche de tâche embarque et qui a un cliquet.
import { useQuery } from '@tanstack/react-query';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { teamProjectKeys } from './constants';

/** Ids des tâches qui portent une étiquette. `null` = aucun filtre, rien ne part. */
export const useTaskIdsWithLabel = (labelId: string | null) => {
  const repository = getTeamProjectsRepository();
  return useQuery({
    queryKey: [...teamProjectKeys.all, 'label-tasks', labelId ?? ''] as const,
    queryFn: async () => new Set(await repository.getTaskIdsWithLabel(labelId as string)),
    enabled: !!labelId,
    staleTime: 1000 * 30,
  });
};
