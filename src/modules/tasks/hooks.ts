import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { showUndoToast } from '@/lib/undo-toast';
import { getTasksRepository } from '@/lib/repository.factory';
import { useIsDemo } from '@/lib/app-mode.store';
import { withTimeout } from '@/lib/withTimeout';
import { ITasksRepository } from './repository';
import { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from './types';
import { nextOccurrenceDeadline } from './recurrence';
import { taskKeys } from './constants';
import { validateAsync } from '@/lib/validation/lazy';
import { translator } from '@/i18n/useT';
import { recordDemoCreationIfDemo } from '@/lib/demo-engagement';

/**
 * Filet de sécurité si le canal Realtime tombe sans se reconnaître déconnecté.
 * Ce n'est PAS le mécanisme de synchronisation — voir `useSharedTasksRealtime`.
 * Cadence volontairement lente : c'est le levier direct du coût d'egress
 * Supabase (audit archi 2026-08-07, C2).
 */
const COLLAB_POLL_INTERVAL_MS = 5 * 60_000;

// ═══════════════════════════════════════════════════════════════════
// Repository - Via centralized factory (demo/production mode)
// ═══════════════════════════════════════════════════════════════════
const useTasksRepository = (): ITasksRepository => {
  const isDemo = useIsDemo();
  // isDemo dependency is intentional: re-select repository on mode switch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getTasksRepository(), [isDemo]);
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS (Phase 1)
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all tasks
 */
export const useTasks = (options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  const isDemo = useIsDemo();
  return useQuery({
    queryKey: taskKeys.lists(),
    queryFn: () => withTimeout(repository.getAll(), 10_000),
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
 * Fetch tasks by date (deadline)
 */
export const useTasksByDate = (date: string, options?: { enabled?: boolean }) => {
  const repository = useTasksRepository();
  return useQuery({
    queryKey: taskKeys.byDate(date),
    queryFn: () => repository.getByDate(date),
    enabled: (options?.enabled ?? true) && !!date,
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

/**
 * Get today's tasks
 */
export const useTodaysTasks = () => {
  // Date locale (en-CA → YYYY-MM-DD), pas toISOString (UTC) — sinon le jour
  // courant est décalé entre minuit et ~2h en France (UTC+1/+2).
  const today = new Date().toLocaleDateString('en-CA');
  return useTasksByDate(today);
};

/**
 * Get pending tasks (not completed)
 */
export const usePendingTasks = () => {
  return useFilteredTasks({ completed: false });
};

/**
 * Get bookmarked tasks
 */
export const useBookmarkedTasks = () => {
  return useFilteredTasks({ bookmarked: true });
};

/**
 * Get completed tasks
 */
export const useCompletedTasks = () => {
  return useFilteredTasks({ completed: true });
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
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
          old?.map((task) => (task.id === id ? { ...task, ...updates } : task))
        );
      }
      return { previousTasks };
    },

    onSuccess: (updatedTask) => {
      // Update specific task in cache
      queryClient.setQueryData(taskKeys.detail(updatedTask.id), updatedTask);
      // Invalidate all list queries
      invalidateAllTaskQueries(queryClient);
    },

    // Rollback on error
    onError: (error: Error, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      toast.error(`Impossible de modifier la tâche : ${error.message}`);
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
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
          old?.filter((task) => task.id !== id)
        );
      }
      return { previousTasks };
    },

    onSuccess: (_result, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: taskKeys.detail(deletedId) });
      // Invalidate all list queries
      invalidateAllTaskQueries(queryClient);
    },

    // Rollback on error
    onError: (error: Error, _id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      toast.error(`Impossible de supprimer la tâche : ${error.message}`);
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
    // Pourquoi le calcul reste client : `nextOccurrenceDeadline()` raisonne en
    // date CALENDAIRE LOCALE de l'utilisateur (convention du projet). Le
    // serveur ne connaît pas son fuseau ; refaire ce calcul en SQL décalerait
    // les échéances d'un jour pour une partie des utilisateurs.
    //
    // Ce qui a changé, c'est la GARANTIE : avant, la création était un
    // `create()` fire-and-forget dans `onSuccess`, avec un `.catch(() => {})`.
    // Elle se perdait si l'onglet se fermait ou si le réseau lâchait, et se
    // dupliquait si l'utilisateur décochait puis recochait. Elle est désormais
    // atomique (même transaction) et idempotente (index unique serveur).
    mutationFn: (id: string) => {
      const cached = queryClient.getQueryData<Task[]>(taskKeys.lists());
      const task = cached?.find((t) => t.id === id);
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
        queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
          old
            ?.filter((t) => t.recurrenceParentId !== updatedTask.id)
            .map((t) => (t.id === updatedTask.id ? { ...t, completed: false, completedAt: undefined } : t))
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

      // Snapshot current state
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());

      // Optimistically update
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
          old?.map((task) =>
            task.id === id
              ? {
                  ...task,
                  completed: !task.completed,
                  completedAt: !task.completed ? new Date().toISOString() : undefined,
                }
              : task
          )
        );
      }

      return { previousTasks };
    },

    // Rollback on error
    onError: (error: Error, _id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      toast.error(translator('errors').t('mutation.updateTask', { message: error.message }));
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

      // Snapshot current state
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());

      // Optimistically update
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
          old?.map((task) =>
            task.id === id ? { ...task, bookmarked: !task.bookmarked } : task
          )
        );
      }

      return { previousTasks };
    },

    // Rollback on error
    onError: (error: Error, _id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      toast.error(`Impossible de modifier le signet : ${error.message}`);
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
// `useTasksInfinite` a été SUPPRIMÉ le 2026-08-25. Ne pas le recréer sans
// avoir d'abord réglé ce qui suit.
//
// Il était livré depuis des mois avec ZÉRO consommateur (vérifié : aucune
// occurrence hors sa propre définition et le barrel). C'est le motif que
// `docs/ARCHITECTURE.md` §4 documente : on construit la brique générique, on
// ne migre jamais l'écran, et la doc finit par décrire une architecture qui
// n'existe pas.
//
// ⚠️ CE N'EST PAS LE HOOK QUI MANQUAIT, C'EST LE PRÉREQUIS.
// `TasksPage` calcule ses compteurs par chip, ses smart lists (`overdue` /
// `this-week` / `high-priority`) et son tri EN MÉMOIRE, sur le dataset
// complet. Paginer sans pousser filtres, tri et comptage côté SQL donnerait
// des compteurs FAUX et des smart lists incomplètes — un bug bien pire que le
// payload qu'on cherchait à réduire.
//
// L'ordre de travail, le jour où le volume le justifie :
//   1. une RPC d'agrégats (compteurs par chip, calculés en SQL) ;
//   2. filtres et tri poussés côté serveur ;
//   3. alors seulement, la pagination de la liste.
//
// Marge actuelle : plafond `MAX_ROWS` = 5 000 par compte, maximum observé en
// prod = 289 tâches. Facteur ×17. Le rendu est déjà virtualisé au-delà de
// 50 items — l'affichage n'a jamais été le problème.
//
// `getPage()` est CONSERVÉ sur le repository : ce n'est pas du code mort mais
// une capacité d'interface, implémentée et testée sur tous les modules
// (tasks, events, habits, okrs…). C'est la brique de l'étape 3.
// ═══════════════════════════════════════════════════════════════════
