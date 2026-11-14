import { useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { showUndoToast } from '@/lib/undo-toast';
import { getTasksRepository } from '@/lib/repository.factory';
import { useIsDemo } from '@/lib/app-mode.store';
import { withTimeout } from '@/lib/withTimeout';
import { ITasksRepository } from './repository';
import { Task, CreateTaskInput, UpdateTaskInput, TaskDependency } from './types';
import { nextOccurrenceDeadline } from './recurrence';
import { applyStatusSync } from './status-sync';
import { taskKeys } from './constants';
import { dependencyErrorCode } from './dependency-errors';
import { validateAsync } from '@/lib/validation/lazy';
import { translator } from '@/i18n/useT';
import { recordDemoCreationIfDemo } from '@/lib/demo-engagement';
import { loadWorkingSet, mergeTasksById } from './working-set';
import { normalizeTaskQuery, isEmptyTaskQuery, type TaskQuery } from './task-query';
import {
  patchTaskCaches, snapshotTaskCaches, restoreTaskCaches, findTaskInCaches,
  invalidateSecondaryTaskQueries,
} from './cache-patch';

/** Filet de sécurité si le canal Realtime tombe sans se reconnaître (pas le mécanisme de synchronisation : `useSharedTasksRealtime`). Cadence lente : levier de l'egress Supabase (C2). */
const COLLAB_POLL_INTERVAL_MS = 5 * 60_000;

// Le factory est un singleton paramétré par `appModeStore.isDemo`, vidé par `resetRepositories()` (aussi appelé sans changement de `isDemo`) : pas de `useMemo` ici (C-06).
const useTasksRepository = (): ITasksRepository => getTasksRepository();

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS (Phase 1)
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all tasks
 */
/**
 * Le JEU DE TRAVAIL : tâches non terminées + terminées depuis `RECENT_COMPLETED_DAYS` jours (`working-set.ts`).
 * ❌ Pas « toutes les tâches » (PER-01) : l'historique passe par `useTaskArchive`, `useTaskSubset`, `useTaskCount`.
 */
export const useTasks = (options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  const isDemo = useIsDemo();
  return useQuery({
    queryKey: taskKeys.lists(),
    queryFn: () => withTimeout(loadWorkingSet(repository), 10_000),
    enabled: options?.enabled ?? true,
    // Collaboration sans realtime : sondage seulement s'il existe une tâche collaborative ACTIVE.
    // ⚠️ Cher : chaque tick est un `getAll()` complet (egress, C2). Le mécanisme principal est Realtime (`useSharedTasksRealtime`, App.tsx) ; ceci est un FILET (5 min) pour un WebSocket tombé sans reconnexion.
    refetchInterval: isDemo
      ? false
      : (query) => {
          const hasCollaborative = (query.state.data as Task[] | undefined)?.some((t) => t.isCollaborative);
          return hasCollaborative ? COLLAB_POLL_INTERVAL_MS : false;
        },
    // Permet au focus/à la navigation de rapatrier un partage récent — c'est
    // ce qui rend l'allongement de l'intervalle indolore côté perception.
    staleTime: isDemo ? undefined : 30_000,
    refetchOnWindowFocus: isDemo ? false : true,
    refetchIntervalInBackground: false,
  });
};

/**
 * Boite de reception : taches partagees avec moi et pas encore acceptees (absentes de `useTasks()` jusqu'a acceptation, mig. 103). Desactive en demo.
 */
export const usePendingSharedTasks = () => {
  const repository = useTasksRepository();
  const isDemo = useIsDemo();
  return useQuery({
    queryKey: taskKeys.pendingShared(),
    queryFn: () => repository.getPendingSharedTasks(),
    enabled: !isDemo,
    // Pas de sondage : `useSharedTasksRealtime` (App.tsx) invalide cette clé.
    staleTime: 1000 * 30,
    refetchOnWindowFocus: !isDemo,
  });
};

/**
 * Fetch a single task by ID
 */
export const useTask = (id: string, options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
};

// 🗑️ Supprimés (C-49), sans consommateur : `useTasksByDate`, `useTodaysTasks`, `useBookmarkedTasks`, `useCompletedTasks`, `useFilteredTasks`. `getFiltered` reste une capacité du repository.

/** Tâches non terminées, dérivées du jeu de travail (qui les contient TOUTES, sans plafond PostgREST, V14.1). */
const selectPending = (tasks: Task[]) => tasks.filter((t) => !t.completed);
export const usePendingTasks = () => {
  const query = useTasks();
  const data = useMemo(() => (query.data ? selectPending(query.data) : undefined), [query.data]);
  return { ...query, data };
};

// ═══════════════════════════════════════════════════════════════════
// Lectures au-delà du jeu de travail (V14.1, PER-01)
// ═══════════════════════════════════════════════════════════════════

/** Taille d'une page de l'archive : de quoi remplir deux écrans, rendu virtualisé. */
export const ARCHIVE_PAGE_SIZE = 50;

/**
 * Pages serveur d'un sous-ensemble (l'archive « Terminées » d'abord) : curseur
 * de clé, `created_at` puis `id` décroissants. `fetchNextPage` charge la
 * suite ; rien n'est jamais tronqué, la dernière page dit `hasMore: false`.
 */
export const useTaskArchive = (query: TaskQuery, options?: { enabled?: boolean; pageSize?: number }) => {
  const repository = useTasksRepository();
  const normalized = normalizeTaskQuery(query);
  const pageSize = options?.pageSize ?? ARCHIVE_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: [...taskKeys.archive(normalized), pageSize] as const,
    queryFn: ({ pageParam }) =>
      repository.getPage({
        query: normalized,
        limit: pageSize,
        cursor: pageParam?.cursor,
        cursorDate: pageParam?.cursorDate,
      }),
    initialPageParam: null as null | { cursor: string; cursorDate: string },
    getNextPageParam: (last) =>
      last.hasMore && last.nextCursor && last.nextCursorDate !== null
        ? { cursor: last.nextCursor, cursorDate: last.nextCursorDate }
        : undefined,
    enabled: options?.enabled ?? true,
  });
};

/**
 * Un sous-ensemble ENTIER, borné par nature : une fenêtre de `completed_at`
 * (statistiques, graphiques), les tâches d'une catégorie (impact d'une
 * suppression), une liste d'identifiants (créneaux de l'agenda).
 */
export const useTaskSubset = (query: TaskQuery, options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  const normalized = normalizeTaskQuery(query);
  return useQuery({
    queryKey: taskKeys.subset(normalized),
    queryFn: () => repository.listAll(normalized),
    enabled: (options?.enabled ?? true) && !isEmptyTaskQuery(normalized),
    placeholderData: keepPreviousData,
  });
};

/** Nombre exact de tâches d'un sous-ensemble, compté côté serveur. */
export const useTaskCount = (query: TaskQuery, options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  const normalized = normalizeTaskQuery(query);
  return useQuery({
    queryKey: taskKeys.count(normalized),
    queryFn: () => repository.count(normalized),
    enabled: options?.enabled ?? true,
  });
};

/**
 * Lecture ponctuelle de TOUTES les tâches, hors cache (export CSV). Une
 * fonction et non un hook : l'export se déclenche au clic, il n'a aucune
 * raison de tenir l'historique complet en mémoire le reste du temps.
 */
export const useLoadAllTasks = () => {
  const repository = useTasksRepository();
  return useCallback(() => repository.getAll(), [repository]);
};

/**
 * Le jeu de travail COMPLÉTÉ des tâches `ids` absentes (terminées depuis plus de `RECENT_COMPLETED_DAYS` jours), relues par identifiant : créneaux de l'agenda, arêtes de dépendance. `ids` doit être mémoïsé par l'appelant.
 */
export const useTasksIncluding = (ids: readonly string[]): Task[] => {
  const { data: working = [] } = useTasks();
  const missing = useMemo(() => {
    const known = new Set(working.map((t) => t.id));
    return [...new Set(ids)].filter((id) => !!id && !known.has(id));
  }, [working, ids]);
  const { data: extra } = useTaskSubset({ ids: missing });
  return useMemo(() => mergeTasksById(working, extra ?? []), [working, extra]);
};

/** Une tâche par identifiant, où qu'elle soit en cache (jeu de travail, archive), sinon relue par `getById`. */
export const useKnownTask = (id: string | null | undefined) => {
  const queryClient = useQueryClient();
  const { data: working } = useTasks();
  const cached = id ? working?.find((t) => t.id === id) ?? findTaskInCaches(queryClient, id) : undefined;
  const { data: fetched } = useTask(id ?? '', { enabled: !!id && !cached });
  return cached ?? fetched ?? undefined;
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Phase 2) - Mutations
// ═══════════════════════════════════════════════════════════════════

/**
 * Helper to invalidate all task-related queries
 */
const invalidateAllTaskQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  // Invalidate all queries that start with ['tasks']
  queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
};

/**
 * Create a new task
 */
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      // Garde UX : message FR lisible avant l'appel réseau (cf. lib/validation).
      await validateAsync('task.create', input);
      return repository.create(input);
    },
    onSuccess: (newTask) => {
      // Engagement démo (src/lib/demo-engagement.ts) : no-op hors démo.
      recordDemoCreationIfDemo();
      // Injecte directement dans le cache sans refetch réseau
      queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) => {
        if (!old) return [newTask];
        return [newTask, ...old]; // La nouvelle tâche en tête de liste
      });
      // Invalide en arrière-plan pour synchroniser les queries filtrées
      queryClient.invalidateQueries({
        queryKey: taskKeys.lists(),
        refetchType: 'none',
      });
      // Archive, sous-ensembles et compteurs montés : recomptés tout de suite.
      void invalidateSecondaryTaskQueries(queryClient);
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.createTask', { message: error.message }));
    },
  });
};

/**
 * Update an existing task
 */
export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateTaskInput }) => {
      await validateAsync('task.update', updates);
      return repository.update(id, updates);
    },

    // Optimistic update : la liste reflète la modification immédiatement
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const snapshot = snapshotTaskCaches(queryClient);
      // Mig. 214 : la carte change de colonne tout de suite, et du bon côté.
      // V14.1 : dans TOUS les caches, l'archive comprise.
      patchTaskCaches(queryClient, (old) =>
        old.map((task) => (task.id === id ? { ...task, ...applyStatusSync(task, updates) } : task))
      );
      return { snapshot };
    },

    onSuccess: (updatedTask) => {
      // Update specific task in cache
      queryClient.setQueryData(taskKeys.detail(updatedTask.id), updatedTask);
      // Invalidate all list queries
      invalidateAllTaskQueries(queryClient);
    },

    // Rollback on error
    onError: (error: Error, _vars, context) => {
      if (context?.snapshot) restoreTaskCaches(queryClient, context.snapshot);
      toast.error(translator('errors').t('mutation.updateTask2', { message: error.message }));
    },
  });
};

/**
 * Delete a task
 */
export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    mutationFn: (id: string) => repository.delete(id),

    // Optimistic update : la tâche disparaît immédiatement de la liste
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const snapshot = snapshotTaskCaches(queryClient);
      patchTaskCaches(queryClient, (old) => old.filter((task) => task.id !== id));
      return { snapshot };
    },

    onSuccess: (_result, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: taskKeys.detail(deletedId) });
      // Invalidate all list queries
      invalidateAllTaskQueries(queryClient);
    },

    // Rollback on error
    onError: (error: Error, _id, context) => {
      if (context?.snapshot) restoreTaskCaches(queryClient, context.snapshot);
      toast.error(translator('errors').t('mutation.deleteTask', { message: error.message }));
    },
  });
};

/**
 * Toggle task completion status with optimistic update
 */
export const useToggleTaskComplete = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    // Récurrence (#26) : la date de l'occurrence suivante est calculée ICI (`nextOccurrenceDeadline()`, jour calendaire du fuseau réglé, `@/lib/deadline`, mig. 133) ; le repository bascule ET génère dans la même opération, atomique et idempotente (mig. 086, H1).
    mutationFn: (id: string) => {
      // Lu AVANT la bascule optimiste ? Non : `onMutate` passe d'abord. La
      // tâche lue ici est donc déjà basculée ; `nextOccurrenceDeadline` ne lit
      // que l'échéance et la récurrence, que la bascule ne touche pas.
      const task = findTaskInCaches(queryClient, id);
      const nextDeadline = task
        ? nextOccurrenceDeadline(task.deadline, task.recurrence ?? 'none')
        : null;
      return repository.toggleComplete(id, nextDeadline);
    },

    // Quand une tâche passe à « validée », propose un raccourci d'annulation
    // (barre de progression 5 s, en haut à droite). L'annulation re-bascule
    // l'état. On n'affiche rien quand on dé-valide une tâche.
    onSuccess: ({ task: updatedTask, spawned }) => {
      if (!updatedTask?.completed) return;

      // L'occurrence suivante est déjà persistée : on ne fait que rafraîchir le cache (`spawned` est null si non récurrente ou déjà créée).
      if (spawned) {
        queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
          old ? [spawned, ...old] : [spawned]
        );
      }

      showUndoToast(translator('errors').t('success.taskValidated'), () => {
        // Optimiste : la tâche redevient non complétée ; le serveur retire l'occurrence générée si elle est intacte.
        patchTaskCaches(queryClient, (old) =>
          old
            .filter((t) => t.recurrenceParentId !== updatedTask.id)
            .map((t) => (t.id === updatedTask.id ? { ...t, ...applyStatusSync(t, { completed: false }) } : t))
        );
        repository
          // `null` = ne rien générer : on dé-valide, donc le serveur retire
          // l'occurrence au lieu d'en créer une.
          .toggleComplete(updatedTask.id, null)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
            queryClient.invalidateQueries({ queryKey: taskKeys.detail(updatedTask.id) });
          })
          .catch(() => {
            // En cas d'échec serveur, on resynchronise depuis la source.
            queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
          });
      });
    },

    // Optimistic update
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      const snapshot = snapshotTaskCaches(queryClient);
      const toggle = (task: Task): Task => ({
        ...task,
        ...applyStatusSync(task, {
          completed: !task.completed,
          completedAt: !task.completed ? new Date().toISOString() : undefined,
        }),
      });

      // Une tâche décochée DEPUIS L'ARCHIVE entre dans le jeu de travail ; `patchTaskCaches` la retire de l'archive.
      const working = queryClient.getQueryData<Task[]>(taskKeys.lists());
      const original = findTaskInCaches(queryClient, id);
      if (working && original && !working.some((t) => t.id === id)) {
        queryClient.setQueryData<Task[]>(taskKeys.lists(), [original, ...working]);
      }
      patchTaskCaches(queryClient, (old) => old.map((task) => (task.id === id ? toggle(task) : task)));

      return { snapshot };
    },

    // Rollback on error
    onError: (error: Error, _id, context) => {
      if (context?.snapshot) restoreTaskCaches(queryClient, context.snapshot);
      toast.error(translator('errors').t('mutation.updateTask', { message: error.message }));
    },

    // Invalidation sélective post-toggle
    onSettled: (_data, _error, id) => {
      // Ne refetch pas immédiatement, attend le prochain focus
      queryClient.invalidateQueries({
        queryKey: taskKeys.lists(),
        refetchType: 'none',
      });
      // Les compteurs ne se patchent pas : ils se recomptent.
      void invalidateSecondaryTaskQueries(queryClient);
      // Invalide uniquement le détail de la tâche modifiée
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
    },
  });
};

/**
 * Toggle task bookmark status with optimistic update
 */
export const useToggleTaskBookmark = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();

  return useMutation({
    mutationFn: (id: string) => repository.toggleBookmark(id),

    // Optimistic update
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

      const snapshot = snapshotTaskCaches(queryClient);
      patchTaskCaches(queryClient, (old) =>
        old.map((task) => (task.id === id ? { ...task, bookmarked: !task.bookmarked } : task))
      );
      return { snapshot };
    },

    // Rollback on error
    onError: (error: Error, _id, context) => {
      if (context?.snapshot) restoreTaskCaches(queryClient, context.snapshot);
      toast.error(translator('errors').t('mutation.toggleBookmark', { message: error.message }));
    },

    // Invalidation sélective post-toggle
    onSettled: (_data, _error, id) => {
      // Ne refetch pas immédiatement, attend le prochain focus
      queryClient.invalidateQueries({
        queryKey: taskKeys.lists(),
        refetchType: 'none',
      });
      // Invalide uniquement le détail de la tâche modifiée
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
    },
  });
};

// ═══ PAGINATION DES TÂCHES (PER-01) ═══
// `useTasks()` : jeu de travail sans plafond. `useTaskArchive` : « Terminées » en pages serveur. `useTaskCount` : nombres d'historique comptés serveur. `useTaskSubset` : sous-ensemble entier borné.
// ❌ Ne jamais compter, chercher ou calculer une statistique sur `useTasks()` en la prenant pour l'historique complet.

// ═══════════════════════════════════════════════════════════════════
// DÉPENDANCES (mig. 132)
// ═══════════════════════════════════════════════════════════════════

/** Tout le graphe de dépendances du compte, en une requête ; `enabled` car monté par le modal de tâche. */
export const useTaskDependencies = (options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  return useQuery<TaskDependency[]>({
    queryKey: taskKeys.dependencies(),
    queryFn: () => repository.getDependencies(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 30,
  });
};

/**
 * Message d'un refus de dépendance. Un refus NOMMÉ est rendu tel quel (il est
 * déjà une phrase de catalogue, actionnable) ; tout le reste passe par le
 * gabarit générique, qui dit au moins de quoi il s'agit.
 */
const dependencyErrorMessage = (error: Error): string => {
  const t = translator('errors').t;
  const code = dependencyErrorCode(error);
  if (code) return t(`api.${code}` as never);
  return t('mutation.taskDependency', { message: error.message });
};

/**
 * Le refus le plus courant est un CYCLE (trigger, mig. 132) : on le DIT. Les deux modes passent par un IDENTIFIANT catalogué (`dependency-errors.ts`, mig. 137), C-48.
 */
export const useAddTaskDependency = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: TaskDependency) =>
      repository.addDependency(taskId, dependsOnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dependencies() });
    },
    onError: (error: Error) => toast.error(dependencyErrorMessage(error)),
  });
};

export const useRemoveTaskDependency = () => {
  const queryClient = useQueryClient();
  const repository = useTasksRepository();
  return useMutation({
    mutationFn: ({ taskId, dependsOnId }: TaskDependency) =>
      repository.removeDependency(taskId, dependsOnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.dependencies() });
    },
    onError: (error: Error) => toast.error(dependencyErrorMessage(error)),
  });
};
