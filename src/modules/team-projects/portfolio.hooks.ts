// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — hooks du PORTEFEUILLE (mig. 153, M2)
//
// Création atomique (projet + tâches + jalons), jalons, dépendances entre
// projets. Séparé de `hooks.ts` : ce fichier-là porte déjà les tâches, les
// commentaires et les sous-tâches.
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { validateAsync } from '@/lib/validation/lazy';
import { translator } from '@/i18n/useT';
import { dependencyErrorCode } from '@/modules/tasks/dependency-errors';
import { teamProjectKeys } from './constants';
import type {
  CreateTeamProjectInput,
  CreateTeamProjectMilestoneInput,
  DraftProjectMilestone,
  DraftProjectTask,
  UpdateTeamProjectMilestoneInput,
} from './types';

const useRepo = () => getTeamProjectsRepository();

/**
 * Projet + tâches initiales + jalons, en UNE transaction serveur. Remplace la
 * boucle de `mutateAsync` qui laissait un projet à moitié créé au premier
 * échec (audit Projets, 2026-09-24). Sert aussi la duplication et les modèles.
 */
export const useCreateTeamProjectWithTasks = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({ input, tasks, milestones }: {
      input: CreateTeamProjectInput;
      tasks?: DraftProjectTask[];
      milestones?: DraftProjectMilestone[];
    }) => {
      const valid = await validateAsync('teamProject.create', input);
      return repository.createProjectWithTasks(orgId, valid as CreateTeamProjectInput, tasks, milestones);
    },
    onSuccess: (_id, { tasks, milestones }) => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
      if (tasks && tasks.length > 0) queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
      if (milestones && milestones.length > 0) queryClient.invalidateQueries({ queryKey: teamProjectKeys.milestones(orgId) });
    },
    onError: (error: Error) =>
      toast.error(translator('errors').t('mutation.createProject', { message: error.message })),
  });
};

// ─── Jalons ──────────────────────────────────────────────────────────

export const useTeamProjectMilestones = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.milestones(orgId ?? ''),
    queryFn: () => repository.getMilestones(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
};

// ⚠️ `org`, pas `portfolio` : ce fichier est exporté par le baril du module,
// importé par des pages qui ne chargent pas le catalogue du portefeuille.
const milestoneError = (error: Error) =>
  toast.error(translator('org').t('projects.milestoneFailed', { message: error.message }));

export const useCreateProjectMilestone = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateTeamProjectMilestoneInput) => repository.createMilestone(orgId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.milestones(orgId) }),
    onError: milestoneError,
  });
};

export const useUpdateProjectMilestone = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ milestoneId, input }: { milestoneId: string; input: UpdateTeamProjectMilestoneInput }) =>
      repository.updateMilestone(milestoneId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.milestones(orgId) }),
    onError: milestoneError,
  });
};

export const useDeleteProjectMilestone = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (milestoneId: string) => repository.deleteMilestone(milestoneId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.milestones(orgId) }),
    onError: milestoneError,
  });
};

// ─── Dépendances entre projets ───────────────────────────────────────

export const useTeamProjectDependencies = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.projectDependencies(orgId ?? ''),
    queryFn: () => repository.getProjectDependencies(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
};

/** Le refus le plus courant est un CYCLE : il se dit avec son identifiant (mig. 137). */
const projectDependencyError = (error: Error) => {
  const code = dependencyErrorCode(error);
  toast.error(code
    ? translator('errors').t(`api.${code}` as never)
    : translator('org').t('projects.dependencyFailed', { message: error.message }));
};

export const useAddProjectDependency = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ projectId, dependsOnId }: { projectId: string; dependsOnId: string }) =>
      repository.addProjectDependency(projectId, dependsOnId, orgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectDependencies(orgId) }),
    onError: projectDependencyError,
  });
};

export const useRemoveProjectDependency = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ projectId, dependsOnId }: { projectId: string; dependsOnId: string }) =>
      repository.removeProjectDependency(projectId, dependsOnId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectDependencies(orgId) }),
    onError: projectDependencyError,
  });
};
