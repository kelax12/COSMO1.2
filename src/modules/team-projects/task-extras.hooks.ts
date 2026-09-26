// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — hooks de la fiche de tâche : étiquettes, historique par
// tâche (mig. 093, 094) et brouillon appliqué après création
//
// Retirés le 2026-09-05 (C-49) : aucun écran ne les montait. Rebranchés le
// 2026-09-25 par la fiche de tâche d'équipe (audit des popups entreprise :
// « ni étiquettes ni historique »). Seuls les hooks qu'un écran consomme
// reviennent : `orphan-hooks.guard.test.ts` refuserait les autres.
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { translator } from '@/i18n/useT';
import { teamProjectKeys } from './constants';
import type { CreateTeamLabelInput } from './types';

const useRepo = () => getTeamProjectsRepository();

/** Vocabulaire d'étiquettes de l'organisation. Il bouge rarement. */
export const useTeamLabels = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.labels(orgId ?? ''),
    queryFn: () => repository.getLabels(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

/** Étiquettes posées sur UNE tâche — `undefined` tant qu'elle n'existe pas. */
export const useTaskLabels = (taskId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.taskLabels(taskId ?? ''),
    queryFn: () => repository.getTaskLabels(taskId as string),
    enabled: !!taskId,
    staleTime: 1000 * 30,
  });
};

/** Création réservée aux managers (policy `team_labels_insert`). */
export const useCreateTeamLabel = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateTeamLabelInput) => repository.createLabel(orgId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.labels(orgId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.createLabel', { message: error.message })),
  });
};

/**
 * Pose ou retire une étiquette. Le `taskId` voyage dans les variables : la
 * fiche en création pose les étiquettes choisies APRÈS avoir obtenu l'id.
 */
export const useToggleTaskLabel = () => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ taskId, labelId, attached }: { taskId: string; labelId: string; attached: boolean }) =>
      attached ? repository.removeTaskLabel(taskId, labelId) : repository.addTaskLabel(taskId, labelId),
    onSuccess: (_d, { taskId }) => queryClient.invalidateQueries({ queryKey: teamProjectKeys.taskLabels(taskId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateLabels', { message: error.message })),
  });
};

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
  labelIds: string[];
}

/**
 * Applique le brouillon d'une fiche en création, une fois la tâche créée :
 * sous-tâches, dépendances, étiquettes. Audit des popups du 2026-09-25 : ces
 * trois éléments n'existaient qu'en édition, il fallait créer, fermer,
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
        ...draft.labelIds.map((labelId) => repository.addTaskLabel(taskId, labelId)),
      ]);
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason instanceof Error ? failed.reason : new Error(String(failed.reason));
    },
    onSettled: (_d, _e, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.subtasks(taskId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.dependencies(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.taskLabels(taskId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.teamTaskDraft', { message: error.message })),
  });
};
