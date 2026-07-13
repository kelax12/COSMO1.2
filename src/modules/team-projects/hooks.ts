// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { validateOrThrow } from '@/lib/validation/validate';
import { createTeamProjectSchema, updateTeamProjectSchema, createTeamTaskSchema, updateTeamTaskSchema } from './team-task.schema';
import { teamProjectKeys } from './constants';
import type { CreateTeamProjectInput, UpdateTeamProjectInput, CreateTeamTaskInput, UpdateTeamTaskInput, TeamTaskFilters } from './types';

const useRepo = () => getTeamProjectsRepository();

// ─── Read ────────────────────────────────────────────────────────────

export const useTeamProjects = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.projects(orgId ?? ''),
    queryFn: () => repository.getProjects(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useTeamTasks = (orgId: string | undefined, filters?: TeamTaskFilters) => {
  const repository = useRepo();
  return useQuery({
    // Le cache est indexé sur l'org ; le filtrage se fait côté client dans l'UI
    // (une seule requête par org, cohérent avec le dashboard équipe Phase 4).
    queryKey: teamProjectKeys.tasks(orgId ?? ''),
    queryFn: () => repository.getTasks(orgId as string),
    enabled: !!orgId,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    select: filters
      ? (tasks) =>
          tasks.filter((tk) => {
            if (filters.projectId && tk.projectId !== filters.projectId) return false;
            if (filters.assigneeId && tk.assigneeId !== filters.assigneeId) return false;
            if (filters.completed !== undefined && tk.completed !== filters.completed) return false;
            return true;
          })
      : undefined,
  });
};

// ─── Mutations ───────────────────────────────────────────────────────

export const useCreateTeamProject = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateTeamProjectInput) => {
      const valid = validateOrThrow(createTeamProjectSchema, input);
      return repository.createProject(orgId, valid);
    },
    onSuccess: () => {
      toast.success('Projet créé');
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de créer le projet : ${error.message}`),
  });
};

export const useUpdateTeamProject = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: UpdateTeamProjectInput }) => {
      const valid = validateOrThrow(updateTeamProjectSchema, input);
      return repository.updateProject(projectId, valid as UpdateTeamProjectInput);
    },
    onSuccess: (_project, { input }) => {
      if (input.archived === true) toast.success('Projet archivé');
      else if (input.archived === false) toast.success('Projet restauré');
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de modifier le projet : ${error.message}`),
  });
};

export const useArchiveTeamProject = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (projectId: string) => repository.archiveProject(projectId),
    onSuccess: () => {
      toast.success('Projet archivé');
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible d'archiver le projet : ${error.message}`),
  });
};

export const useCreateTeamTask = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateTeamTaskInput) => {
      const valid = validateOrThrow(createTeamTaskSchema, input);
      return repository.createTask(orgId, valid as CreateTeamTaskInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de créer la tâche : ${error.message}`),
  });
};

export const useUpdateTeamTask = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTeamTaskInput }) => {
      const valid = validateOrThrow(updateTeamTaskSchema, input);
      return repository.updateTask(taskId, valid as UpdateTeamTaskInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de mettre à jour la tâche : ${error.message}`),
  });
};

export const useDeleteTeamTask = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (taskId: string) => repository.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
    },
    onError: (error: Error) => toast.error(`Impossible de supprimer la tâche : ${error.message}`),
  });
};
