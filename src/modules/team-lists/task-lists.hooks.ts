// ═══════════════════════════════════════════════════════════════════
// TEAM-LISTS MODULE - ce que la fiche d'une tâche lit et écrit
//
// Séparé du reste des hooks (`hooks.ts`) le 2026-10-15 : `TeamTaskModal` ne
// lit que les listes et ne fait que ranger SA tâche. Importer `hooks.ts`
// faisait voyager la création, le renommage et la suppression avec
// « Annuler » dans son chunk (budget de `TeamTaskModal`).
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getTeamListsRepository } from '@/lib/repository.factory';
import { translator } from '@/i18n/useT';
import { teamListKeys } from './constants';

const useRepo = () => getTeamListsRepository();

export const useTeamLists = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamListKeys.list(orgId ?? ''),
    queryFn: () => repository.getLists(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60,
  });
};

/**
 * Pose les listes d'UNE tâche (fiche de tâche) : n'écrit que la différence
 * entre `before` et `after`. Chaque écriture est indépendante.
 */
export const useSetTaskTeamLists = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({ taskId, before, after }: { taskId: string; before: string[]; after: string[] }) => {
      const results = await Promise.allSettled([
        ...after.filter((id) => !before.includes(id)).map((listId) => repository.addTask(listId, taskId)),
        ...before.filter((id) => !after.includes(id)).map((listId) => repository.removeTask(listId, taskId)),
      ]);
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason instanceof Error ? failed.reason : new Error(String(failed.reason));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: teamListKeys.list(orgId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.addTaskToList', { message: error.message })),
  });
};
