// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS · Portefeuille — hooks React Query
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getTeamPortfolioRepository } from '@/lib/repository.factory';
import { translator } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { teamProjectKeys } from './constants';
import type { ProjectHealth, ProjectRole } from './types';
import type { CreateProjectFullInput, DuplicateProjectInput } from './portfolio.types';

const useRepo = () => getTeamPortfolioRepository();
const errorToast = (key: KeyOf<'errors'>) => (error: Error) =>
  toast.error(translator('errors').t(key, { message: error.message }));

// ─── Rattachements ───────────────────────────────────────────────────

export const useProjectLinks = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.projectLinks(orgId ?? ''),
    queryFn: () => repository.getProjectLinks(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useSetProjectTeams = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, add, remove }: { projectId: string; add: string[]; remove: string[] }) => {
      for (const teamId of add) await repository.addProjectTeam(orgId, projectId, teamId);
      for (const teamId of remove) await repository.removeProjectTeam(projectId, teamId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectLinks(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
    },
    onError: errorToast('mutation.projectLinks'),
  });
};

export const useSetProjectMember = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId, role }: { projectId: string; userId: string; role: ProjectRole | null }) =>
      role
        ? repository.setProjectMember(orgId, projectId, userId, role)
        : repository.removeProjectMember(projectId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectLinks(orgId) }),
    onError: errorToast('mutation.projectLinks'),
  });
};

// ─── Santé ───────────────────────────────────────────────────────────

export const useProjectUpdates = (projectId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.projectUpdates(projectId ?? ''),
    queryFn: () => repository.getProjectUpdates(projectId as string),
    enabled: !!projectId,
    staleTime: 1000 * 60,
  });
};

export const usePostProjectUpdate = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, health, note }: { projectId: string; health: ProjectHealth; note: string }) =>
      repository.postProjectUpdate(projectId, health, note),
    onSuccess: (_d, { projectId }) => {
      toast.success(translator('errors').t('success.projectUpdatePosted'));
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectUpdates(projectId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
    },
    onError: errorToast('mutation.projectUpdate'),
  });
};

// ─── Création atomique, duplication ─────────────────────────────────

export const useCreateProjectFull = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectFullInput) => repository.createProjectFull(orgId, input),
    onSuccess: () => {
      toast.success(translator('errors').t('success.projectCreated'));
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectLinks(orgId) });
    },
    onError: errorToast('mutation.createProject'),
  });
};

export const useDuplicateProject = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DuplicateProjectInput) => repository.duplicateProject(input),
    onSuccess: () => {
      toast.success(translator('errors').t('success.projectDuplicated'));
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectLinks(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.dependencies(orgId) });
    },
    onError: errorToast('mutation.duplicateProject'),
  });
};

// ─── Corbeille ───────────────────────────────────────────────────────

export const useTaskTrash = (orgId: string | undefined, enabled = true) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.trash(orgId ?? ''),
    queryFn: () => repository.getTrash(orgId as string),
    enabled: !!orgId && enabled,
    staleTime: 1000 * 30,
  });
};

/**
 * Restaure une tâche supprimée sous son identifiant d'origine, avec ses
 * sous-tâches, ses commentaires et ses dépendances (mig. 151). C'est aussi
 * ce qu'appelle le bouton « Annuler » d'une suppression : l'ancienne
 * annulation recréait une tâche NEUVE, sans rien de ce qui en dépendait.
 */
export const useRestoreTeamTask = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => repository.restoreTask(taskId),
    onSuccess: () => {
      toast.success(translator('errors').t('success.taskRestored'));
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.trash(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.dependencies(orgId) });
    },
    onError: errorToast('mutation.restoreTask'),
  });
};

// ─── Historique d'une tâche ─────────────────────────────────────────

export const useTeamTaskHistory = (taskId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.activity(taskId ?? ''),
    queryFn: () => repository.getTaskActivity(taskId as string),
    enabled: !!taskId,
    staleTime: 1000 * 30,
  });
};

// ─── Suivre ──────────────────────────────────────────────────────────

export const useMyFollows = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.follows(orgId ?? ''),
    queryFn: () => repository.getMyFollows(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useToggleFollow = (orgId: string) => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id, follow }: { kind: 'task' | 'project'; id: string; follow: boolean }) =>
      kind === 'task'
        ? repository.setTaskFollow(orgId, id, follow)
        : repository.setProjectFollow(orgId, id, follow),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.follows(orgId) }),
    onError: errorToast('mutation.follow'),
  });
};
