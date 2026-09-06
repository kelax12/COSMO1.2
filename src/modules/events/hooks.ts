import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getEventsRepository } from '@/lib/repository.factory';
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from './types';
import { eventsKeys } from './constants';
import { translator } from '@/i18n/useT';
import { recordDemoCreationIfDemo } from '@/lib/demo-engagement';
import { reportRestoreFailure, splitRestore } from '@/lib/restore-id';

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

// ═══════════════════════════════════════════════════════════════════
// MUTATION HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();

  return useMutation({
    mutationFn: (input: CreateEventInput) => repository.create(input),
    onSuccess: (newEvent) => {
      // Engagement démo (src/lib/demo-engagement.ts) : no-op hors démo.
      recordDemoCreationIfDemo();
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
      toast.success(translator('errors').t('success.eventCreated'));
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.createEvent', { message: error.message }));
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
      toast.error(translator('errors').t('mutation.updateEvent', { message: error.message }));
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
      toast.error(translator('errors').t('mutation.deleteEvent', { message: error.message }));
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
      toast.success(translator('errors').t('success.eventAdded'));
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.addEvent', { message: error.message })),
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
      toast.error(translator('errors').t('mutation.updateEvent', { message: error.message }));
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
      toast.error(translator('errors').t('mutation.deleteEvent', { message: error.message }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: eventsKeys.member(userId), refetchType: 'none' });
    },
  });
};

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useUpcomingEvents = (limit = 5) => {
  const { data: events = [] } = useEvents();
  return useMemo(
    () => {
      // `now` est calculé DANS le mémo. Le lire au corps du hook produisait une
      // valeur neuve à chaque rendu, mise en dépendance : le mémo n'était
      // jamais réutilisé et l'on retriait toute la liste à chaque frame.
      const now = new Date().toISOString();
      return events
        .filter((e) => e.start >= now)
        .sort((a, b) => a.start.localeCompare(b.start))
        .slice(0, limit);
    },
    [events, limit]
  );
};

// ═══════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type { CalendarEvent, CreateEventInput, UpdateEventInput } from './types';
export { eventsKeys } from './constants';

// ═══════════════════════════════════════════════════════════════════
// RESTAURATION (« Annuler ») — recree l'objet sous SON identifiant
// ═══════════════════════════════════════════════════════════════════
//
// Separe de `useCreateEvent` a dessein : l'identifiant passe par le second
// argument de `create()`, hors du payload, donc hors de portee d'un objet de
// formulaire enrichi depuis les devtools. Contrat complet et raison de ce
// decoupage : `src/lib/restore-id.ts` (R-08).
//
// ⚠️ N'appeler QUE depuis un toast d'annulation.
export const useRestoreEvent = () => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();

  return useMutation({
    mutationFn: (snapshot: CalendarEvent) => {
      const { payload, options } = splitRestore(snapshot);
      return repository.create(payload as CreateEventInput, options);
    },
    onSuccess: () => {
      invalidateAllEventQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: eventsKeys.all });
    },
    // Un « Annuler » rate doit se VOIR : `console.error` est supprime du
    // bundle de production (vite.config.ts), l'echec etait donc muet.
    onError: (error: Error) => reportRestoreFailure('event', error),
  });
};
