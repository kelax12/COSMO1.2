// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { validateAsync } from '@/lib/validation/lazy';
import { teamProjectKeys } from './constants';
import type { UpdateTeamSubtaskInput, CreateTeamLabelInput, UpdateTeamLabelInput } from './types';
import type { CreateTeamProjectInput, UpdateTeamProjectInput, CreateTeamTaskInput, UpdateTeamTaskInput, TeamTaskFilters } from './types';
import { translator } from '@/i18n/useT';

const useRepo = () => getTeamProjectsRepository();

// ─── Read ────────────────────────────────────────────────────────────

export const useTeamProjects = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.projects(orgId ?? ''),
    queryFn: () => repository.getProjects(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    // Donnée partagée : au retour sur l'onglet, on resynchronise (reco #12).
    refetchOnWindowFocus: true,
  });
};

/**
 * Tâches d'équipe de l'organisation.
 *
 * `live` distingue les deux usages, exactement comme `useOrgMembers` — et pour
 * la même raison, en plus cher.
 *
 * Ce hook est monté par des surfaces PERMANENTES (`CommandPalette`, `TaskTable`,
 * la vue « Aujourd'hui »), pas seulement par /entreprise. Un `refetchInterval`
 * inconditionnel faisait donc payer à tout membre d'une organisation une lecture
 * org-wide de `team_tasks` toutes les 20 s, sur TOUTES les pages, sans que
 * personne ne regarde la liste — et c'est la lecture la plus chère du produit
 * (prédicat RLS non indexable, cf. `SCALABILITY.md` §2 et mig. 113).
 *
 * Par défaut : pas de sondage, `refetchOnWindowFocus` suffit (le retour d'onglet
 * est le bon déclencheur — garde-fou egress, CLAUDE.md § synchronisation de la
 * collaboration). `live: true` est réservé aux écrans de /entreprise où l'on
 * REGARDE la liste et où l'on attend de voir une tâche arriver.
 *
 * Le cache étant partagé (même `queryKey`), il suffit qu'UN observateur demande
 * `live` pour que la donnée reste fraîche pour tous les autres montés en même
 * temps : le sondage suit donc l'écran affiché, pas le nombre de consommateurs.
 *
 * `background` est le symétrique de `live`, pour l'usage inverse : un
 * consommateur qui n'AFFICHE pas la liste et n'en dérive qu'un compteur.
 * Il en existe un seul, mais c'est le pire possible — `useOrgBadges`, monté par
 * `Layout`, donc sur TOUTES les pages protégées, pour tout membre d'une
 * organisation. Avec la politique par défaut, chaque retour d'onglet et chaque
 * navigation espacée de plus de 30 s relançait la lecture la plus chère du
 * produit (`get_my_team_tasks`, cf. SCALABILITY.md §2) pour repeindre une
 * pastille. Le compteur ne perd rien à attendre : sa source qui fait autorité
 * est la boîte de réception (`unreadNotifications`), tenue à jour en Realtime
 * par `useOrgInboxRealtime` ; les tâches ne servent que de filet pour les
 * organisations d'avant la mig. 095.
 *
 * ⚠️ `background` n'éteint rien pour les autres : `staleTime` et
 * `refetchOnWindowFocus` sont PAR OBSERVATEUR. Sur /entreprise, les écrans qui
 * regardent la liste gardent leur politique, et c'est la leur qui déclenche.
 */
export const useTeamTasks = (
  orgId: string | undefined,
  filters?: TeamTaskFilters,
  options?: { live?: boolean; background?: boolean },
) => {
  const repository = useRepo();
  return useQuery({
    // Le cache est indexé sur l'org ; le filtrage se fait côté client dans l'UI
    // (une seule requête par org, cohérent avec le dashboard équipe Phase 4).
    queryKey: teamProjectKeys.tasks(orgId ?? ''),
    queryFn: () => repository.getTasks(orgId as string),
    enabled: !!orgId,
    staleTime: options?.background ? 1000 * 60 * 5 : 1000 * 30,
    ...(options?.live ? { refetchInterval: 20_000 } : {}),
    refetchOnWindowFocus: !options?.background,
    select: filters
      ? (tasks) =>
          tasks.filter((tk) => {
            if (filters.projectId && tk.projectId !== filters.projectId) return false;
            if (filters.assigneeId && !tk.assigneeIds.includes(filters.assigneeId)) return false;
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
    mutationFn: async (input: CreateTeamProjectInput) => {
      const valid = await validateAsync('teamProject.create', input);
      return repository.createProject(orgId, valid);
    },
    onSuccess: () => {
      toast.success(translator('errors').t('success.projectCreated'));
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.createProject', { message: error.message })),
  });
};

export const useUpdateTeamProject = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({ projectId, input }: { projectId: string; input: UpdateTeamProjectInput }) => {
      const valid = await validateAsync('teamProject.update', input);
      return repository.updateProject(projectId, valid as UpdateTeamProjectInput);
    },
    onSuccess: (_project, { input }) => {
      if (input.archived === true) toast.success(translator('errors').t('success.projectArchived'));
      else if (input.archived === false) toast.success(translator('errors').t('success.projectRestored'));
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateProject', { message: error.message })),
  });
};

export const useArchiveTeamProject = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (projectId: string) => repository.archiveProject(projectId),
    onSuccess: () => {
      toast.success(translator('errors').t('success.projectArchived'));
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.archiveProject', { message: error.message })),
  });
};

export const useCreateTeamTask = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async (input: CreateTeamTaskInput) => {
      const valid = await validateAsync('teamTask.create', input);
      return repository.createTask(orgId, valid as CreateTeamTaskInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.createTask', { message: error.message })),
  });
};

export const useUpdateTeamTask = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({ taskId, input }: { taskId: string; input: UpdateTeamTaskInput }) => {
      const valid = await validateAsync('teamTask.update', input);
      return repository.updateTask(taskId, valid as UpdateTeamTaskInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateTask', { message: error.message })),
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
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteTask', { message: error.message })),
  });
};

// ─── Commentaires (mig. 082, reco #9) ────────────────────────────────

export const useTeamTaskComments = (taskId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.comments(taskId ?? ''),
    queryFn: () => repository.getComments(taskId as string),
    enabled: !!taskId,
    staleTime: 1000 * 15,
    refetchOnWindowFocus: true,
  });
};

export const useAddTeamTaskComment = (taskId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: { body: string; mentions?: string[] }) =>
      repository.addComment({ taskId, body: input.body, mentions: input.mentions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.comments(taskId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.addComment', { message: error.message })),
  });
};

export const useDeleteTeamTaskComment = (taskId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (commentId: string) => repository.deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.comments(taskId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteComment', { message: error.message })),
  });
};

// ─── Sous-tâches (mig. 092) ──────────────────────────────────────────

export const useTeamSubtasks = (taskId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.subtasks(taskId ?? ''),
    queryFn: () => repository.getSubtasks(taskId as string),
    enabled: !!taskId,
    staleTime: 1000 * 15,
  });
};

/**
 * Les trois mutations invalident la même clé plutôt que de patcher le cache :
 * `position` est réattribuée côté serveur à la création, une mise à jour
 * optimiste ferait donc scintiller l'ordre de la liste.
 */
export const useCreateTeamSubtask = (taskId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: { title: string; position?: number }) =>
      repository.createSubtask({ taskId, title: input.title, position: input.position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.subtasks(taskId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.addSubtask', { message: error.message })),
  });
};

export const useUpdateTeamSubtask = (taskId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ subtaskId, input }: { subtaskId: string; input: UpdateTeamSubtaskInput }) =>
      repository.updateSubtask(subtaskId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.subtasks(taskId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateSubtask', { message: error.message })),
  });
};

export const useDeleteTeamSubtask = (taskId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (subtaskId: string) => repository.deleteSubtask(subtaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.subtasks(taskId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteSubtask', { message: error.message })),
  });
};

// ─── Labels (mig. 093) ───────────────────────────────────────────────

export const useTeamLabels = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.labels(orgId ?? ''),
    queryFn: () => repository.getLabels(orgId as string),
    enabled: !!orgId,
    // Le vocabulaire bouge rarement — inutile de le refetcher en continu.
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Jonctions tâche ↔ label pour TOUTE l'organisation, en une requête.
 * Les chips s'affichent sur chaque ligne de liste : une requête par tâche
 * ferait exploser les aller-retours sur un écran de 50 tâches.
 */
export const useTeamTaskLabels = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.taskLabels(orgId ?? ''),
    queryFn: () => repository.getTaskLabels(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });
};

export const useCreateTeamLabel = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (input: CreateTeamLabelInput) => repository.createLabel(orgId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.labels(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.createLabel', { message: error.message })),
  });
};

export const useUpdateTeamLabel = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ labelId, input }: { labelId: string; input: UpdateTeamLabelInput }) =>
      repository.updateLabel(labelId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.labels(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateLabel', { message: error.message })),
  });
};

export const useDeleteTeamLabel = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (labelId: string) => repository.deleteLabel(labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.labels(orgId) });
      // La jonction perd des lignes par CASCADE : son cache est périmé aussi.
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.taskLabels(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteLabel', { message: error.message })),
  });
};

/** Pose/retire un label sur une tâche — une seule mutation pour les deux sens. */
export const useToggleTaskLabel = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ taskId, labelId, attached }: { taskId: string; labelId: string; attached: boolean }) =>
      attached
        ? repository.removeTaskLabel(taskId, labelId)
        : repository.addTaskLabel(taskId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.taskLabels(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateLabels', { message: error.message })),
  });
};

// ─── Historique (mig. 094) — lecture seule ───────────────────────────

/**
 * Journal de l'organisation depuis `since` — revue hebdomadaire (#26).
 *
 * `since` doit être STABLE d'un rendu à l'autre : il entre dans la clé de
 * cache, et une borne recalculée à chaque rendu (`new Date()`) créerait une
 * entrée de cache par rendu, donc une requête par rendu.
 */
export const useOrgActivity = (orgId: string | undefined, since: string) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.orgActivity(orgId ?? '', since),
    queryFn: () => repository.getOrgActivity(orgId as string, since),
    enabled: !!orgId,
    staleTime: 1000 * 60,
  });
};

export const useTeamTaskActivity = (taskId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.activity(taskId ?? ''),
    queryFn: () => repository.getTaskActivity(taskId as string),
    enabled: !!taskId,
    staleTime: 1000 * 15,
  });
};

// ─── Dépendances entre tâches (mig. 108) ─────────────────────────────

/**
 * Toutes les arêtes de l'organisation, en une requête.
 *
 * Même raison que `useTeamTaskLabels` : le chemin critique se calcule sur un
 * projet entier et le surlignage s'applique à chaque carte affichée — une
 * requête par tâche multiplierait les allers-retours par le nombre de cartes.
 */
export const useTeamTaskDependencies = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.dependencies(orgId ?? ''),
    queryFn: () => repository.getTaskDependencies(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });
};

export const useAddTaskDependency = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      repository.addTaskDependency(taskId, dependsOnId, orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.dependencies(orgId) });
    },
    // Le refus le plus courant est un CYCLE, rejeté par le trigger (mig. 108).
    // On remonte le message tel quel plutôt qu'un « une erreur est survenue » :
    // l'utilisateur peut agir sur un cycle, pas sur une erreur anonyme.
    onError: (error: Error) =>
      toast.error(translator('org').t('projects.dependencyFailed', { message: error.message })),
  });
};

export const useRemoveTaskDependency = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: { taskId: string; dependsOnId: string }) =>
      repository.removeTaskDependency(taskId, dependsOnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.dependencies(orgId) });
    },
    onError: (error: Error) =>
      toast.error(translator('org').t('projects.dependencyFailed', { message: error.message })),
  });
};
