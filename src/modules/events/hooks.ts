import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getEventsRepository } from '@/lib/repository.factory';
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from './types';
import { eventsKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY HOOK
// ═══════════════════════════════════════════════════════════════════

const useEventsRepository = () => getEventsRepository();

const invalidateAllEventQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: eventsKeys.all, refetchType: 'none' });
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useEvents = () => {
  const repository = useEventsRepository();
  return useQuery({
    queryKey: eventsKeys.lists(),
    queryFn: () => repository.getAll(),
  });
};

/**
 * Charge UNIQUEMENT les événements de la fenêtre temporelle [startISO, endISO]
 * (+ tous les récurrents — cf. window.ts). Pagination serveur de l'agenda :
 * évite de tout charger en mémoire. La clé est nichée sous lists() → les
 * mutations (setQueriesData lists()) mettent ce cache à jour de façon optimiste.
 * Désactivé tant que la fenêtre n'est pas connue.
 */
export const useEventsWindow = (startISO: string | null, endISO: string | null) => {
  const repository = useEventsRepository();
  return useQuery({
    queryKey: eventsKeys.window(startISO ?? '', endISO ?? ''),
    queryFn: () => repository.getWindow(startISO!, endISO!),
    enabled: !!startISO && !!endISO,
    // Garde les events de la fenêtre précédente affichés pendant le chargement
    // de la nouvelle (pas de flash vide en navigation calendrier).
    placeholderData: keepPreviousData,
  });
};

export const useEvent = (id: string) => {
  const repository = useEventsRepository();
  return useQuery({
    queryKey: eventsKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: !!id,
  });
};

export const useEventsByTask = (taskId: string) => {
  const repository = useEventsRepository();
  return useQuery({
    queryKey: eventsKeys.byTask(taskId),
    queryFn: () => repository.getByTaskId(taskId),
    enabled: !!taskId,
  });
};

// ═══════════════════════════════════════════════════════════════════
// MUTATION HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();

  return useMutation({
    mutationFn: (input: CreateEventInput) => repository.create(input),
    onSuccess: (newEvent) => {
      // Ajoute aux caches list-like (cache complet + toutes les fenêtres).
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: eventsKeys.lists() },
        (old) => [...(old ?? []), newEvent],
      );
      if (newEvent.taskId) {
        queryClient.invalidateQueries({ queryKey: eventsKeys.byTask(newEvent.taskId) });
      }
      // Réconcilie les fenêtres (un nouvel event hors fenêtre courante sera
      // retiré au refetch ; refetchType none = pas de round-trip immédiat).
      invalidateAllEventQueries(queryClient);
      toast.success('Événement créé');
    },
    onError: (error: Error) => {
      toast.error(`Impossible de créer l'événement : ${error.message}`);
    },
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateEventInput }) =>
      repository.update(id, updates),

    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: eventsKeys.all });
      // Snapshot de TOUS les caches list-like (complet + fenêtres) pour rollback.
      const previous = queryClient.getQueriesData<CalendarEvent[]>({ queryKey: eventsKeys.lists() });
      queryClient.setQueriesData<CalendarEvent[]>({ queryKey: eventsKeys.lists() }, (old) =>
        old?.map((event) => (event.id === id ? { ...event, ...updates } : event)),
      );
      return { previous };
    },

    // Rollback on error (useUpdateEvent) — restaure chaque cache snapshoté.
    onError: (error: Error, _variables, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(`Impossible de modifier l'événement : ${error.message}`);
    },

    onSettled: (updatedEvent) => {
      if (updatedEvent) {
        queryClient.setQueryData(eventsKeys.detail(updatedEvent.id), updatedEvent);
        if (updatedEvent.taskId) {
          queryClient.invalidateQueries({ queryKey: eventsKeys.byTask(updatedEvent.taskId) });
        }
      }
      invalidateAllEventQueries(queryClient);
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();

  return useMutation({
    mutationFn: (id: string) => repository.delete(id),

    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: eventsKeys.all });
      const previous = queryClient.getQueriesData<CalendarEvent[]>({ queryKey: eventsKeys.lists() });
      // Récupère l'event supprimé depuis n'importe quel cache list-like.
      let eventToDelete: CalendarEvent | undefined;
      for (const [, data] of previous) {
        const found = data?.find((e) => e.id === id);
        if (found) { eventToDelete = found; break; }
      }
      queryClient.setQueriesData<CalendarEvent[]>({ queryKey: eventsKeys.lists() }, (old) =>
        old?.filter((event) => event.id !== id),
      );
      return { previous, eventToDelete };
    },

    // Rollback on error (useDeleteEvent) — restaure chaque cache snapshoté.
    onError: (error: Error, _id, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(`Impossible de supprimer l'événement : ${error.message}`);
    },

    onSettled: (_result, _error, deletedId, context) => {
      queryClient.removeQueries({ queryKey: eventsKeys.detail(deletedId) });
      if (context?.eventToDelete?.taskId) {
        queryClient.invalidateQueries({
          queryKey: eventsKeys.byTask(context.eventToDelete.taskId),
        });
      }
      invalidateAllEventQueries(queryClient);
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// MEMBER AGENDA HOOKS (mode entreprise — manager voit/gère un subordonné)
// ═══════════════════════════════════════════════════════════════════

/** Fenêtre d'agenda d'un membre géré (RLS mig. 077). Désactivé si pas d'userId. */
export const useMemberEventsWindow = (
  userId: string | null,
  startISO: string | null,
  endISO: string | null,
) => {
  const repository = useEventsRepository();
  return useQuery({
    queryKey: eventsKeys.memberWindow(userId ?? '', startISO ?? '', endISO ?? ''),
    queryFn: () => repository.getWindowForUser(userId!, startISO!, endISO!),
    enabled: !!userId && !!startISO && !!endISO,
    placeholderData: keepPreviousData,
  });
};

/** Met à jour de façon optimiste toutes les fenêtres d'agenda de `userId`. */
const patchMemberWindows = (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  updater: (events: CalendarEvent[]) => CalendarEvent[],
) => {
  queryClient.setQueriesData<CalendarEvent[]>({ queryKey: eventsKeys.member(userId) }, (old) =>
    old ? updater(old) : old,
  );
};

export const useCreateMemberEvent = (userId: string) => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();
  return useMutation({
    mutationFn: (input: CreateEventInput) => repository.createForUser(userId, input),
    onSuccess: (newEvent) => {
      patchMemberWindows(queryClient, userId, (old) => [...old, newEvent]);
      queryClient.invalidateQueries({ queryKey: eventsKeys.member(userId), refetchType: 'none' });
      toast.success('Événement ajouté à l\'agenda');
    },
    onError: (error: Error) => toast.error(`Impossible d'ajouter l'événement : ${error.message}`),
  });
};

export const useUpdateMemberEvent = (userId: string) => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateEventInput }) =>
      repository.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: eventsKeys.member(userId) });
      const previous = queryClient.getQueriesData<CalendarEvent[]>({ queryKey: eventsKeys.member(userId) });
      patchMemberWindows(queryClient, userId, (old) =>
        old.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      );
      return { previous };
    },
    onError: (error: Error, _v, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(`Impossible de modifier l'événement : ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: eventsKeys.member(userId), refetchType: 'none' });
    },
  });
};

export const useDeleteMemberEvent = (userId: string) => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();
  return useMutation({
    mutationFn: (id: string) => repository.delete(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: eventsKeys.member(userId) });
      const previous = queryClient.getQueriesData<CalendarEvent[]>({ queryKey: eventsKeys.member(userId) });
      patchMemberWindows(queryClient, userId, (old) => old.filter((e) => e.id !== id));
      return { previous };
    },
    onError: (error: Error, _id, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(`Impossible de supprimer l'événement : ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: eventsKeys.member(userId), refetchType: 'none' });
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useEventsByDate = (date: string) => {
  const { data: events = [] } = useEvents();
  return useMemo(
    () => events.filter((e) => e.start.startsWith(date)),
    [events, date]
  );
};

export const useUpcomingEvents = (limit = 5) => {
  const { data: events = [] } = useEvents();
  const now = new Date().toISOString();
  return useMemo(
    () =>
      events
        .filter((e) => e.start >= now)
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, limit),
    [events, now, limit]
  );
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type { CalendarEvent, CreateEventInput, UpdateEventInput } from './types';
export { eventsKeys } from './constants';
