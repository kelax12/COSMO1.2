import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
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

// ═══════════════════════════════════════════════════════════════════
// ÉVÉNEMENTS D'ÉQUIPE (reco UI n° 30)
// ═══════════════════════════════════════════════════════════════════
//
// Il n'y a PAS de table d'événements partagés : un événement d'équipe est
// UNE ligne par participant, posée dans son agenda. La RLS (mig. 128) ne
// permet d'écrire que dans le sien et dans celui des personnes qu'on encadre :
// c'est donc elle qui borne la liste des participants, pas l'écran.

/**
 * Agendas de plusieurs personnes sur une fenêtre, pour chercher un créneau
 * commun. `selfId` lit son propre agenda par `getWindow` (le magasin démo
 * range l'agenda perso ailleurs que celui des membres).
 */
export const useGroupEventsWindow = (
  userIds: string[],
  selfId: string | undefined,
  startISO: string,
  endISO: string,
) => {
  const repository = useEventsRepository();
  // UNE requête pour tout le groupe, pas `useQueries` : ce dernier tire
  // `QueriesObserver` dans le lot `vendor-query` partagé par toute l'app
  // (+3 ko bruts mesurés le 2026-09-29), pour un seul écran qui s'en sert.
  const ids = [...userIds].sort();
  const query = useQuery({
    queryKey: [...eventsKeys.all, 'group', ids.join(','), startISO, endISO] as const,
    queryFn: async () => {
      const results = await Promise.allSettled(ids.map((uid) => (uid === selfId
        ? repository.getWindow(startISO, endISO)
        : repository.getWindowForUser(uid, startISO, endISO))));
      return {
        eventsByUser: results.map((r) => (r.status === 'fulfilled' ? r.value : [])),
        failed: results.filter((r) => r.status === 'rejected').length,
      };
    },
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });
  return {
    eventsByUser: query.data?.eventsByUser ?? [],
    isLoading: query.isLoading,
    failed: query.data?.failed ?? 0,
  };
};

export interface GroupEventResult { created: number; failed: number }

/**
 * Crée le même événement dans l'agenda de chaque participant. `allSettled` :
 * un refus sur une personne (sortie de l'organisation entre-temps) ne doit
 * pas priver les autres de leur invitation. Le compte rendu dit combien.
 */
export const useCreateGroupEvent = () => {
  const queryClient = useQueryClient();
  const repository = useEventsRepository();
  return useMutation({
    mutationFn: async ({ userIds, selfId, input }: { userIds: string[]; selfId?: string; input: CreateEventInput }): Promise<GroupEventResult> => {
      const results = await Promise.allSettled(
        userIds.map((uid) => (uid === selfId ? repository.create(input) : repository.createForUser(uid, input))),
      );
      const created = results.filter((r) => r.status === 'fulfilled').length;
      if (created === 0) {
        const first = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        throw first?.reason instanceof Error ? first.reason : new Error(String(first?.reason));
      }
      return { created, failed: results.length - created };
    },
    onSuccess: () => {
      invalidateAllEventQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: eventsKeys.all });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.createEvent', { message: error.message }));
    },
  });
};
