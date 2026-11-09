import { useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { showUndoToast } from '@/lib/undo-toast';
import { getTasksRepository } from '@/lib/repository.factory';
import { useIsDemo } from '@/lib/app-mode.store';
import { withTimeout } from '@/lib/withTimeout';
import { ITasksRepository } from './repository';
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters, TaskDependency } from './types';
import { nextOccurrenceDeadline } from './recurrence';
import { applyStatusSync } from './status-sync';
import { taskKeys } from './constants';
import { dependencyErrorCode } from './dependency-errors';
import { validateAsync } from '@/lib/validation/lazy';
import { translator } from '@/i18n/useT';
import { recordDemoCreationIfDemo } from '@/lib/demo-engagement';
import { loadWorkingSet } from './working-set';
import { normalizeTaskQuery, isEmptyTaskQuery, type TaskQuery } from './task-query';
import {
  patchTaskCaches, snapshotTaskCaches, restoreTaskCaches, findTaskInCaches,
  invalidateSecondaryTaskQueries,
} from './cache-patch';

/**
 * Filet de sécurité si le canal Realtime tombe sans se reconnaître déconnecté.
 * Ce n'est PAS le mécanisme de synchronisation — voir `useSharedTasksRealtime`.
 * Cadence volontairement lente : c'est le levier direct du coût d'egress
 * Supabase (audit archi 2026-08-07, C2).
 */
const COLLAB_POLL_INTERVAL_MS = 5 * 60_000;

// Sélection du repository : le factory est déjà un singleton paramétré par
// `appModeStore.isDemo`, et `resetRepositories()` le vide à chaque bascule
// (AuthContext). Le `useMemo(..., [isDemo])` qui vivait ici était donc
// redondant, et son commentaire était faux : `resetRepositories()` est aussi
// appelé sur des chemins où `isDemo` NE change pas (déconnexion d'une vraie
// session), où la mémo rendait alors l'instance que le factory venait de
// jeter. Six modules (events, lists, categories, friends, team-projects,
// organizations) font déjà cet appel direct. Audit A-2, item C-06.
const useTasksRepository = (): ITasksRepository => getTasksRepository();

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS (Phase 1)
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all tasks
 */
/**
 * Le JEU DE TRAVAIL : toutes les tâches non terminées, plus celles terminées
 * depuis `RECENT_COMPLETED_DAYS` jours (cf. `working-set.ts`).
 *
 * Ce n'est PAS « toutes les tâches » depuis la V14.1 (PER-01). Un écran qui
 * compte, cherche ou calcule sur l'historique complet passe par sa propre
 * requête : `useTaskArchive`, `useTaskSubset`, `useTaskCount`.
 */
export const useTasks = (options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  const isDemo = useIsDemo();
  return useQuery({
    queryKey: taskKeys.lists(),
    queryFn: () => withTimeout(loadWorkingSet(repository), 10_000),
    enabled: options?.enabled ?? true,
    // Collaboration sans realtime : les modifications d'un collaborateur, ET
    // surtout une NOUVELLE tâche qu'un ami vient de partager, ne se propagent
    // pas d'elles-mêmes (cache React Query, focus-refetch désactivé
    // globalement). On sonde donc périodiquement.
    //
    // ⚠️ Ce sondage est CHER : chaque tick est un `getAll()` complet. L'audit
    // architecture 2026-08-07 (point C2) a mesuré la version précédente —
    // 15 s, déclenchée dès que l'utilisateur avait ≥ 1 AMI — à ≈ 58 Mo/mois
    // d'egress Supabase PAR UTILISATEUR, pour un événement qui, en pratique,
    // ne survient que quelques fois par mois. Deux correctifs ici :
    //
    //   1. La condition passe de « a un ami » (quasi tout le monde, dès le
    //      premier ajout) à « a réellement au moins une tâche collaborative »
    //      — c'est-à-dire une collaboration ACTIVE, pas seulement possible.
    //   2. L'intervalle passe de 15 s à 60 s. Un partage reçu apparaît en
    //      moins d'une minute, ce qui est le bon ordre de grandeur pour une
    //      notification passive ; le focus-refetch ci-dessous couvre le cas
    //      « je reviens sur l'onglet et je veux voir tout de suite ».
    //
    // ➜ Le mécanisme PRINCIPAL est désormais Realtime
    //   (`useSharedTasksRealtime`, monté dans App.tsx) : un partage reçu
    //   invalide la liste immédiatement, pour un coût quasi nul.
    //
    //   Ce sondage n'est plus qu'un FILET DE SÉCURITÉ, d'où sa cadence lente
    //   (5 min) : il couvre le cas où le WebSocket est tombé sans se
    //   reconnecter (proxy d'entreprise, réseau mobile capricieux, onglet
    //   longuement suspendu). Il ne tourne que si une collaboration est
    //   réellement active.
    //
    //   Coût d'egress ramené de ~58 Mo/mois/utilisateur à quelques centaines
    //   de Ko — et à zéro pour tout utilisateur sans partage en cours.
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
 * Boite de reception : taches partagees avec moi et pas encore acceptees.
 *
 * Depuis la mig. 103 ces taches ne sont PLUS dans `useTasks()` — elles n'y
 * entrent qu'apres acceptation. Sans ce hook, il n'y aurait plus aucun moyen
 * de les voir ni de les accepter.
 *
 * Meme cadence que les autres surfaces collaboratives (20 s), et desactive en
 * demo ou le partage cross-compte n'existe pas.
 */
export const usePendingSharedTasks = () => {
  const repository = useTasksRepository();
  const isDemo = useIsDemo();
  return useQuery({
    queryKey: taskKeys.pendingShared(),
    queryFn: () => repository.getPendingSharedTasks(),
    enabled: !isDemo,
    // Plus de sondage : `useSharedTasksRealtime` (App.tsx) écoute déjà
    // `shared_tasks` dans les deux directions et invalide cette clé. Ce hook
    // est monté par `InboxMenu`, il sondait donc en permanence — c'était le
    // dernier `refetchInterval` inconditionnel de l'application.
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

/**
 * Fetch tasks with filters
 */
export const useFilteredTasks = (filters: TaskFilters, options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => repository.getFiltered(filters),
    enabled: options?.enabled ?? true,
  });
};

// ═══════════════════════════════════════════════════════════════════
// Computed Hooks (derived data)
// ═══════════════════════════════════════════════════════════════════

// 🗑️ Supprimés le 2026-09-05 (C-49), aucun consommateur : `useTasksByDate`,
// `useTodaysTasks`, `useBookmarkedTasks`, `useCompletedTasks`.
//
// 🔴 `useFilteredTasks` RESTE, et c'est le piège de cet item : le balayage le
// comptait orphelin parce qu'aucun ÉCRAN ne l'importe. Mais `usePendingTasks`
// l'appelle, dans ce fichier, et `usePendingTasks` sert `DeadlineCalendar` et
// `TasksSummary`. Une liste de « noms sans consommateur direct » n'est pas une
// liste de suppressions sûres.

/**
 * Tâches non terminées.
 *
 * V14.1 : dérivées du jeu de travail, qui les contient TOUTES (sans plafond).
 * L'ancienne lecture `getFiltered({ completed: false })` n'avait pas de
 * `range` et retombait sur le plafond PostgREST par défaut (1 000 lignes),
 * en plus de doubler la requête du jeu de travail.
 */
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
 * Une tâche par son identifiant, où qu'elle soit en cache (jeu de travail,
 * page d'archive), sinon relue par `getById`. Pour une fiche ouverte depuis
 * l'archive : une tâche terminée il y a six mois n'est pas dans le jeu de
 * travail, et la chercher là seulement rendait `undefined`.
 */
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
    // Récurrence (#26) — la date de l'occurrence suivante est calculée ICI,
    // puis transmise au repository qui bascule ET génère dans la MÊME
    // opération (mig. 086, audit archi H1).
    //
    // Pourquoi le calcul reste client : `nextOccurrenceDeadline()` raisonne sur
    // le JOUR CALENDAIRE vécu par l'utilisateur (`@/lib/deadline`), qui dépend
    // du fuseau qu'il a réglé. Le serveur ne le connaît pas ; refaire ce calcul
    // en SQL décalerait les échéances d'un jour pour tout le monde à l'ouest de
    // Greenwich — c'est exactement ce que faisait le cast `::timestamptz` du
    // paramètre `DATE`, refermé par la mig. 133.
    //
    // Ce qui a changé, c'est la GARANTIE : avant, la création était un
    // `create()` fire-and-forget dans `onSuccess`, avec un `.catch(() => {})`.
    // Elle se perdait si l'onglet se fermait ou si le réseau lâchait, et se
    // dupliquait si l'utilisateur décochait puis recochait. Elle est désormais
    // atomique (même transaction) et idempotente (index unique serveur).
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

      // L'occurrence suivante est déjà PERSISTÉE quand on arrive ici (elle est
      // venue avec la réponse). On ne fait plus que rafraîchir le cache.
      // `spawned` est null si la tâche n'est pas récurrente, ou si l'occurrence
      // existait déjà (rejeu idempotent) — dans les deux cas, rien à ajouter.
      if (spawned) {
        queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
          old ? [spawned, ...old] : [spawned]
        );
      }

      showUndoToast(translator('errors').t('success.taskValidated'), () => {
        // Mise à jour optimiste immédiate du cache : la tâche redevient
        // « non complétée » et réapparaît tout de suite dans la liste active
        // (sans attendre un refresh). L'occurrence générée disparaît en même
        // temps — c'est le serveur qui la retire réellement, dans la même
        // transaction que la dé-validation, et seulement si elle est intacte.
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

      // V14.1 : une tâche décochée DEPUIS L'ARCHIVE (terminée il y a plus de
      // `RECENT_COMPLETED_DAYS` jours) n'est pas dans le jeu de travail. Elle
      // y entre, puisqu'elle redevient du travail en cours ; `patchTaskCaches`
      // la retire de l'archive, qui ne garde que des terminées.
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

// ═══════════════════════════════════════════════════════════════════
// PAGINATION DES TÂCHES (V14.1, constat PER-01 de l'audit du 2026-11-06)
//
// La note qui vivait ici disait : « paginer sans pousser filtres, tri et
// comptage côté SQL donnerait des compteurs FAUX ». C'est la règle qu'a
// suivie la V14.1, et elle reste vraie : la pagination ne s'est pas faite en
// coupant `useTasks()` en pages, mais en séparant ce qui est borné de ce qui
// ne l'est pas.
//
//   • `useTasks()` : le jeu de travail, sans plafond (`working-set.ts`). Les
//     compteurs par chip, les smart lists et le tri de la page Tâches ne
//     lisent que des tâches NON terminées, toutes présentes.
//   • `useTaskArchive` : l'archive « Terminées », en pages serveur (curseur
//     de clé, filtres poussés en SQL), rendue virtualisée.
//   • `useTaskCount` : les nombres qui portent sur l'historique, comptés par
//     le serveur, jamais une longueur de tableau partiel.
//   • `useTaskSubset` : un sous-ensemble entier borné par nature (fenêtre de
//     `completed_at`, catégorie, identifiants).
//
// ❌ Ne jamais compter, chercher ou calculer une statistique sur `useTasks()`
// en la prenant pour l'historique complet : elle ne l'est plus.
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// DÉPENDANCES (mig. 132)
// ═══════════════════════════════════════════════════════════════════

/**
 * Tout le graphe de dépendances du compte, en une requête.
 *
 * `enabled` parce que ce hook est monté par le modal de tâche : le charger
 * depuis la page Tâches ferait payer le graphe à des écrans qui ne
 * l'affichent jamais.
 */
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
 * Le refus le plus courant est un CYCLE, rejeté par le trigger (mig. 132).
 * On veut le DIRE plutôt qu'un « une erreur est survenue » : l'utilisateur
 * peut agir sur un cycle, pas sur une erreur anonyme.
 *
 * 🔴 C-48 — cette intention était contredite par les deux modes. En prod, la
 * phrase anglaise du `RAISE` ne matchait pas `BUSINESS_CODE_RE`, donc le refus
 * retombait sur le message générique ; en démo, elle arrivait telle quelle
 * dans le gabarit français. Les deux passent désormais par un IDENTIFIANT
 * catalogué (`dependency-errors.ts`, mig. 137).
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
