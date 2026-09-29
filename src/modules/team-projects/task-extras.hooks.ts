// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — hooks de la fiche de tâche : historique par
// tâche (mig. 094) et brouillon appliqué après création
//
// Retirés le 2026-09-05 (C-49) : aucun écran ne les montait. Rebranchés le
// 2026-09-25 par la fiche de tâche d'équipe (audit des popups entreprise :
// « ni étiquettes ni historique »). Seuls les hooks qu'un écran consomme
// reviennent : `orphan-hooks.guard.test.ts` refuserait les autres.
// Étiquettes (mig. 093) retirées du mode entreprise le 2026-09-28.
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { translator } from '@/i18n/useT';
import { teamProjectKeys } from './constants';

const useRepo = () => getTeamProjectsRepository();

/** Journal d'une tâche (onglet Historique). Écrit par trigger, jamais par l'app. */
export const useTeamTaskActivity = (taskId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.activity(taskId ?? ''),
    queryFn: () => repository.getTaskActivity(taskId as string),
    enabled: !!taskId,
    staleTime: 1000 * 15,
  });
};

/** Ce qu'une fiche en CRÉATION a saisi et qui a besoin de l'id de la tâche. */
export interface TeamTaskDraftExtras {
  subtasks: string[];
  /** Tâches qui bloquent la nouvelle (« bloquée par »). */
  blockedByIds: string[];
}

/**
 * Applique le brouillon d'une fiche en création, une fois la tâche créée :
 * sous-tâches, dépendances. Audit des popups du 2026-09-25 : ces
 * éléments n'existaient qu'en édition, il fallait créer, fermer,
 * rouvrir. Chaque écriture est indépendante : un échec n'annule pas les
 * autres, et il est dit (la tâche, elle, existe déjà).
 */
export const useApplyTeamTaskDraft = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({ taskId, draft }: { taskId: string; draft: TeamTaskDraftExtras }) => {
      const results = await Promise.allSettled([
        ...draft.subtasks.map((title, position) => repository.createSubtask({ taskId, title, position })),
        ...draft.blockedByIds.map((dependsOnId) => repository.addTaskDependency(taskId, dependsOnId, orgId)),
      ]);
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason instanceof Error ? failed.reason : new Error(String(failed.reason));
    },
    onSettled: (_d, _e, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.subtasks(taskId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.dependencies(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.teamTaskDraft', { message: error.message })),
  });
};
