import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      if (newEvent.taskId) {
        queryClient.invalidateQueries({ queryKey: eventsKeys.byTask(newEvent.taskId) });
      }
      invalidateAllEventQueries(queryClient);
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
      const previousEvents = queryClient.getQueryData<CalendarEvent[]>(eventsKeys.lists());
      if (previousEvents) {
        queryClient.setQueryData<CalendarEvent[]>(eventsKeys.lists(), (old) =>
          old?.map((event) => event.id === id ? { ...event, ...updates } : event)
        );
      }
      return { previousEvents };
    },

    // Rollback on error (useUpdateEvent)
    onError: (error: Error, _variables, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(eventsKeys.lists(), context.previousEvents);
      }
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
      const previousEvents = queryClient.getQueryData<CalendarEvent[]>(eventsKeys.lists());
      const eventToDelete = previousEvents?.find((e) => e.id === id);
      if (previousEvents) {
        queryClient.setQueryData<CalendarEvent[]>(eventsKeys.lists(), (old) =>
          old?.filter((event) => event.id !== id)
        );
      }
      return { previousEvents, eventToDelete };
    },

    // Rollback on error (useDeleteEvent)
    onError: (error: Error, _id, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(eventsKeys.lists(), context.previousEvents);
      }
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
// DERIVED HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useEventsByDate = (date: string) => {
  const { data: events = [] } = useEvents();
  return useMemo(
    () => events.filter((e) => e.startTime.startsWith(date)),
    [events, date]
  );
};

export const useUpcomingEvents = (limit = 5) => {
  const { data: events = [] } = useEvents();
  const now = new Date().toISOString();
  return useMemo(
    () =>
      events
        .filter((e) => e.startTime >= now)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .slice(0, limit),
    [events, now, limit]
  );
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type { CalendarEvent, CreateEventInput, UpdateEventInput } from './types';
export { eventsKeys } from './constants';
