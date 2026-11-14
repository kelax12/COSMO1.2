// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS MODULE - React Query hooks
// ═══════════════════════════════════════════════════════════════════

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getTeamProjectsRepository } from '@/lib/repository.factory';
import { validateAsync } from '@/lib/validation/lazy';
import { teamProjectKeys, TEAM_TASKS_READ_LIMIT } from './constants';
import type { UpdateTeamSubtaskInput } from './types';
import type { UpdateTeamProjectInput, CreateTeamTaskInput, UpdateTeamTaskInput, TeamTaskFilters, TeamProject } from './types';
import { translator } from '@/i18n/useT';
import { dependencyErrorCode } from '@/modules/tasks/dependency-errors';

const useRepo = () => getTeamProjectsRepository();

// ─── Read ────────────────────────────────────────────────────────────

/** Projets de l'organisation, archivés compris, MODÈLES EXCLUS (mig. 153) : un modèle est une ligne de `team_projects`, sans ce filtre il apparaîtrait comme un projet en cours. */
export const useTeamProjects = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.projects(orgId ?? ''),
    queryFn: () => repository.getProjects(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    // Donnée partagée : au retour sur l'onglet, on resynchronise (reco #12).
    refetchOnWindowFocus: true,
    select: selectRealProjects,
  });
};

const selectRealProjects = (projects: TeamProject[]) => projects.filter((p) => !p.isTemplate);

/**
 * Tâches d'équipe de l'organisation.
 * Montée par des surfaces PERMANENTES (`CommandPalette`, `TaskTable`, « Aujourd'hui ») : par défaut AUCUN sondage, `refetchOnWindowFocus` suffit (c'est la lecture la plus chère du produit, prédicat RLS non indexable, `SCALABILITY.md` §2, mig. 113). `live: true` est réservé aux écrans de /entreprise qui REGARDENT la liste ; le cache est partagé, un observateur `live` rafraîchit tous les autres.
 * `background` est le symétrique : un consommateur qui n'en dérive qu'un compteur (`useOrgBadges`, monté par `Layout`). Sa source qui fait autorité est la boîte de réception, tenue à jour par `useOrgInboxRealtime` ; les tâches ne servent que de filet (orgs d'avant la mig. 095).
 * ⚠️ `background` n'éteint rien pour les autres : `staleTime` et `refetchOnWindowFocus` sont PAR OBSERVATEUR.
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

/**
 * « Ensemble de travail » : toutes les tâches OUVERTES + celles terminées depuis `since` (ISO), filtrées côté serveur AVANT le plafond. `since = null` : lecture complète de `useTeamTasks`, même clé de cache.
 * ⚠️ `since` doit être STABLE d'un rendu à l'autre (début de jour, pas `new Date()`) : il entre dans la clé, sous-chemin de `teamProjectKeys.tasks(orgId)` (les invalidations des mutations la couvrent).
 */
export const useTeamTaskWorkingSet = (
  orgId: string | undefined,
  since: string | null,
  options?: { live?: boolean },
) => {
  const repository = useRepo();
  return useQuery({
    queryKey: since
      ? [...teamProjectKeys.tasks(orgId ?? ''), 'working-set', since]
      : teamProjectKeys.tasks(orgId ?? ''),
    queryFn: () =>
      repository.getTasks(orgId as string, since ? { openOrCompletedSince: since } : undefined),
    enabled: !!orgId,
    staleTime: 1000 * 30,
    ...(options?.live ? { refetchInterval: 20_000 } : {}),
    refetchOnWindowFocus: true,
  });
};

/**
 * Ensemble de travail PAGINÉ (mig. 191) : même lecture que `useTeamTaskWorkingSet`, par pages de `TEAM_TASKS_READ_LIMIT` (création décroissante, puis id) ; `fetchNextPage` charge la suite. Clé sous `teamProjectKeys.tasks(orgId)` : toute mutation de tâche l'invalide.
 */
export const useTeamTaskPages = (
  orgId: string | undefined,
  since: string | null,
  options?: { live?: boolean },
) => {
  const repository = useRepo();
  return useInfiniteQuery({
    queryKey: [...teamProjectKeys.tasks(orgId ?? ''), 'pages', since ?? 'all'],
    queryFn: ({ pageParam }) =>
      repository.getTasks(orgId as string, {
        ...(since ? { openOrCompletedSince: since } : {}),
        limit: TEAM_TASKS_READ_LIMIT,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < TEAM_TASKS_READ_LIMIT ? undefined : pages.length * TEAM_TASKS_READ_LIMIT,
    enabled: !!orgId,
    staleTime: 1000 * 30,
    ...(options?.live ? { refetchInterval: 20_000 } : {}),
    refetchOnWindowFocus: true,
  });
};

/**
 * Lecture CIBLÉE : le serveur filtre, trie et plafonne avant de répondre (l'Aperçu : `assigneeId: moi`, « 20 prochaines échéances »…).
 * ⚠️ Les filtres entrent dans la clé de cache : STABLES d'un rendu à l'autre (dates figées au début du jour, `ids` triés). Clé sous `teamProjectKeys.tasks(orgId)`.
 */
export const useTeamTaskSlice = (
  orgId: string | undefined,
  filters: TeamTaskFilters,
  options?: { live?: boolean; enabled?: boolean },
) => {
  const repository = useRepo();
  return useQuery({
    queryKey: [...teamProjectKeys.tasks(orgId ?? ''), 'slice', filters],
    queryFn: () => repository.getTasks(orgId as string, filters),
    enabled: !!orgId && (options?.enabled ?? true),
    staleTime: 1000 * 30,
    ...(options?.live ? { refetchInterval: 20_000 } : {}),
    refetchOnWindowFocus: true,
  });
};

// ─── Mutations ───────────────────────────────────────────────────────

// 🗑️ `useCreateTeamProject` retiré : un projet ne se crée que par LE formulaire (`OrgCreateForms`, `useCreateTeamProjectWithTasks`, une transaction).

export const useUpdateTeamProject = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: async ({ projectId, input }: { projectId: string; input: UpdateTeamProjectInput }) => {
      const valid = await validateAsync('teamProject.update', input);
      return repository.updateProject(projectId, valid as UpdateTeamProjectInput);
    },
    onSuccess: (_project, { input }) => {
      // Archiver ne toaste PLUS ici : l'écran qui archive montre un toast
      // « Annuler » (audit Projets), et deux toasts pour un geste
      // en feraient un de trop.
      if (input.archived === false) toast.success(translator('errors').t('success.projectRestored'));
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.projects(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.updateProject', { message: error.message })),
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
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.trash(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteTask', { message: error.message })),
  });
};

/** Sort une tâche de la corbeille (mig. 152) : le « Annuler » de toutes les suppressions, la tâche revient À L'IDENTIQUE (statut, catégorie, sous-tâches, dépendances, commentaires, historique). */
export const useRestoreTeamTask = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (taskId: string) => repository.restoreTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.tasks(orgId) });
      queryClient.invalidateQueries({ queryKey: teamProjectKeys.trash(orgId) });
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.restoreTask', { message: error.message })),
  });
};

/** Suppression définitive d'une tâche à la corbeille (admin, mig. 193). */
export const usePurgeTeamTask = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: (taskId: string) => repository.purgeTask(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.trash(orgId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.purgeTask', { message: error.message })),
  });
};

/** La corbeille de l'organisation : ce que l'appelant peut restaurer (30 jours). */
export const useTeamTrash = (orgId: string | undefined, enabled = true) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.trash(orgId ?? ''),
    queryFn: () => repository.getTrash(orgId as string),
    enabled: !!orgId && enabled,
    staleTime: 0,
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

/** Les trois mutations invalident la même clé sans patcher le cache : `position` est réattribuée côté serveur à la création. */
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

// 🗑️ Les SIX hooks d'étiquettes d'équipe (mig. 093) sont supprimés (C-49) : `useTeamLabels`, `useTeamTaskLabels`, `useCreateTeamLabel`, `useUpdateTeamLabel`, `useDeleteTeamLabel`, `useToggleTaskLabel`.
// ⚠️ La TABLE `team_labels` et sa jonction RESTENT en base (mig. 093 appliquée en prod, une suppression de données est irréversible) : seul le front part.

// ─── Historique (mig. 094) — lecture seule ───────────────────────────

/** Journal de l'organisation depuis `since` (revue hebdomadaire, #26). `since` doit être STABLE : il entre dans la clé de cache. */
export const useOrgActivity = (orgId: string | undefined, since: string) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.orgActivity(orgId ?? '', since),
    queryFn: () => repository.getOrgActivity(orgId as string, since),
    enabled: !!orgId,
    staleTime: 1000 * 60,
  });
};

// 🗑️ `useTeamTaskActivity` supprime (C-49) : le journal PAR
// TACHE n'etait monte par aucun ecran. `useOkrActivity`/`useOrgActivity`

// ci-dessus, lui, sert la revue hebdomadaire — le journal reste lisible.
// ─── Dépendances entre tâches (mig. 108) ─────────────────────────────

/** Toutes les arêtes de l'organisation, en une requête (chemin critique d'un projet entier, surlignage de chaque carte). */
export const useTeamTaskDependencies = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: teamProjectKeys.dependencies(orgId ?? ''),
    queryFn: () => repository.getTaskDependencies(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });
};

/**
 * Message d'un refus de dépendance d'équipe (C-48) : un refus NOMMÉ est rendu tel quel (phrase de catalogue, mig. 108/109).
 * ⚠️ « tâche introuvable » et « tâche hors périmètre » rendent le MÊME texte : les distinguer rouvrirait l'oracle d'existence refermé par la mig. 109.
 */
const dependencyErrorMessage = (error: Error): string => {
  const code = dependencyErrorCode(error);
  if (code) return translator('errors').t(`api.${code}` as never);
  return translator('org').t('projects.dependencyFailed', { message: error.message });
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
      toast.error(dependencyErrorMessage(error)),
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
      toast.error(dependencyErrorMessage(error)),
  });
};
