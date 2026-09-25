// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — hooks : MEMBRES d'un projet et CHIFFRES serveur
// (mig. 190, 191 · recommandations de l'étape 6)
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { todayKeyInTz } from '@/lib/timezone';
import { translator } from '@/i18n/useT';
import { teamProjectKeys } from './constants';
import type { TeamProjectRole } from './types';

const useRepo = () => getTeamProjectsRepository();

export const useTeamProjectMembers = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.projectMembers(orgId ?? ''),
    queryFn: () => repository.getProjectMembers(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60,
  });
};

export const useSetProjectMember = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ projectId, userId, role }: { projectId: string; userId: string; role: TeamProjectRole }) =>
      repository.setProjectMember(projectId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectMembers(orgId) });
      // Être membre rend un projet VISIBLE : la liste des projets change pour
      // la personne ajoutée, et pour l'appelant si c'est lui-même.
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
    },
    onError: (error: Error) =>
      toast.error(translator('errors').t('mutation.projectMember', { message: error.message })),
  });
};

export const useRemoveProjectMember = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      repository.removeProjectMember(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectMembers(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
    },
    onError: (error: Error) =>
      toast.error(translator('errors').t('mutation.projectMember', { message: error.message })),
  });
};

/**
 * Avancement de chaque projet, COMPTÉ PAR LE SERVEUR sur toutes ses tâches.
 * La clé est un sous-chemin de `teamProjectKeys.tasks(orgId)` : toute mutation
 * de tâche l'invalide déjà, sans une ligne de plus dans chaque mutation.
 * `today` : date locale dans le fuseau retenu, jamais celle du serveur (UTC).
 */
export const useTeamProjectTaskStats = (orgId: string | undefined) => {
  const repository = useRepo();
  const today = todayKeyInTz();
  return useQuery({
    queryKey: [...teamProjectKeys.tasks(orgId ?? ''), 'project-stats', today],
    queryFn: () => repository.getProjectTaskStats(orgId as string, today),
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });
};

/** Charge de chaque membre (tâches ouvertes, en retard, à 7 jours), comptée par le serveur. */
export const useTeamMemberWorkload = (orgId: string | undefined) => {
  const repository = useRepo();
  const today = todayKeyInTz();
  return useQuery({
    queryKey: [...teamProjectKeys.tasks(orgId ?? ''), 'member-workload', today],
    queryFn: () => repository.getMemberWorkload(orgId as string, today),
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });
};
