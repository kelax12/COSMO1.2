// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - React Query Hooks
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getEventsRepository } from '@/lib/repository.factory';
import { IEventsRepository } from './repository';
import { CalendarEvent, CreateEventInput, UpdateEventInput, EventFilters } from './types';
import { eventsKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY - Via centralized factory (demo/production mode)
// ═══════════════════════════════════════════════════════════════════

/**
 * Factory hook to get the events repository
 * Uses centralized factory for demo/production mode switching
 */
const useEventsRepository = (): IEventsRepository => {
  return useMemo(() => getEventsRepository(), []);
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Invalidate all event-related queries
 */
const invalidateAllEventQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: eventsKeys.all });
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all events
 */
export const useEvents = (options?: { enabled?: boolean }) => {
  const repository = useEventsRepository();
  return useQuery({
    queryKey: eventsKeys.lists(),
    queryFn: () => repository.getAll(),
    enabled: options?.enabled ?? true,
  });
};

/**
 * Fetch a single event by ID
 */
export const useEvent = (id: string, options?: { enabled?: boolean }) => {
  const repository = useEventsRepository();
  return useQuery({
    queryKey: eventsKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: (options?.enabled ?? true) && !!id,
  });
};

/**
 * Fetch events linked to a specific task
 */
export const useEventsByTask = (taskId: string, options?: { enabled?: boolean }) => {
  const repository = useEventsRepository();
  return useQuery({
    queryKey: eventsKeys.byTask(taskId),
    queryFn: () => repository.getByTaskId(taskId),
    enabled: (options?.enabled ?? true) && !!taskId,
  });
};

/**
 * Fetch events with filters
 */
export const useFilteredEvents = (filters: EventFilters, options?: { enabled?: boolean }) => {
  const repository = useEventsRepository();
  return useQuery({
    queryKey: eventsKeys.list(filters),
    queryFn: () => repository.getFiltered(filters),
    enabled: options?.enabled ?? true,
  });
};

// ═══════════════════════════════════════════════════════════════════
// COMPUTED HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get today's events
 */
export const useTodaysEvents = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return useFilteredEvents({
    startAfter: today.toISOString(),
    startBefore: tomorrow.toISOString(),
  });
};

// ═══════════════════════════════════════════════════════════════════
// WRITE HOOKS (Mutations)
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a new event
 */
export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();

  return useMutation({
    mutationFn: (input: CreateEventInput) => repository.create(input),
    onSuccess: (newEvent) => {
      // If event is linked to a task, invalidate that query too
      if (newEvent.taskId) {
        queryClient.invalidateQueries({ queryKey: eventsKeys.byTask(newEvent.taskId) });
      }
      invalidateAllEventQueries(queryClient);
    },
  });
};

/**
 * Update an existing event with optimistic update
 */
export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateEventInput }) =>
      repository.update(id, updates),

    // Optimistic update
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: eventsKeys.all });

      // Snapshot current state
      const previousEvents = queryClient.getQueryData<CalendarEvent[]>(eventsKeys.lists());

      // Optimistically update the list
      if (previousEvents) {
        queryClient.setQueryData<CalendarEvent[]>(eventsKeys.lists(), (old) =>
          old?.map((event) =>
            event.id === id ? { ...event, ...updates } : event
          )
        );
      }

      return { previousEvents };
    },

    // Rollback on error
    onError: (_error, _variables, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(eventsKeys.lists(), context.previousEvents);
      }
    },

    // Refetch on settle
    onSettled: (updatedEvent) => {
      if (updatedEvent) {
        // Update specific event in cache
        queryClient.setQueryData(eventsKeys.detail(updatedEvent.id), updatedEvent);
        // If linked to a task, invalidate that query
        if (updatedEvent.taskId) {
          queryClient.invalidateQueries({ queryKey: eventsKeys.byTask(updatedEvent.taskId) });
        }
      }
      invalidateAllEventQueries(queryClient);
    },
  });
};

/**
 * Delete an event with optimistic update
 */
export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();

  return useMutation({
    mutationFn: (id: string) => repository.delete(id),

    // Optimistic update
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: eventsKeys.all });

      // Snapshot current state
      const previousEvents = queryClient.getQueryData<CalendarEvent[]>(eventsKeys.lists());

      // Get the event before deletion (for taskId reference)
      const eventToDelete = previousEvents?.find(e => e.id === id);

      // Optimistically remove from list
      if (previousEvents) {
        queryClient.setQueryData<CalendarEvent[]>(eventsKeys.lists(), (old) =>
          old?.filter((event) => event.id !== id)
        );
      }

      return { previousEvents, eventToDelete };
    },

    // Rollback on error
    onError: (_error, _id, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(eventsKeys.lists(), context.previousEvents);
      }
    },

    // Cleanup on settle
    onSettled: (_result, _error, deletedId, context) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: eventsKeys.detail(deletedId) });
      
      // If was linked to a task, invalidate that query
      if (context?.eventToDelete?.taskId) {
        queryClient.invalidateQueries({ 
          queryKey: eventsKeys.byTask(context.eventToDelete.taskId) 
        });
      }
      
      invalidateAllEventQueries(queryClient);
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS for convenience
// ═══════════════════════════════════════════════════════════════════

export type { CalendarEvent, CreateEventInput, UpdateEventInput, EventFilters } from './types';
export { eventsKeys } from './constants';
