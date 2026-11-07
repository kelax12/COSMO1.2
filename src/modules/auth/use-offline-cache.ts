// ═══════════════════════════════════════════════════════════════════
// Cache hors ligne de la session : tâches et habitudes en localStorage
// ═══════════════════════════════════════════════════════════════════
//
// Deux sens :
//   · au démarrage ou au changement de compte, le cache React Query est
//     pré-rempli depuis `localStorage` : la page s'affiche aussitôt avec la
//     donnée de la veille, le préchargement (`use-session-preload.ts`) la
//     remplace en silence ;
//   · chaque lecture réussie des listes est réécrite (abonnement au
//     QueryCache), pour le prochain démarrage à froid.
//
// Le stockage lui-même (clés, TTL, purge) est dans `session-cache.ts`.
// Extrait d'`AuthContext.tsx` le 2026-11-07 (ARC-03), sans changement de
// comportement : abonné à `dataScopeOpened`, `userLeaving` et `signedOut`.

import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/modules/tasks/constants';
import { habitKeys } from '@/modules/habits/constants';
import { readLocalCache, writeLocalCache, clearLocalCache, purgeAllLocalCache } from './session-cache';
import { dlog } from './auth-debug';
import type { AuthEvents } from './auth-events';

export interface OfflineCache {
  /** Pré-remplit React Query pour `userId` et (ré)abonne l'écrivain. */
  restore(userId: string, initial: boolean): void;
  forget(userId: string): void;
  purgeAll(): void;
  dispose(): void;
}

export function createOfflineCache(queryClient: QueryClient): OfflineCache {
  // Désabonnement de l'écrivain courant. Un seul écrivain à la fois.
  let writerUnsub: (() => void) | undefined;

  // Abonne au QueryCache un écrivain qui persiste tâches et habitudes à
  // chaque lecture réussie. Un par utilisateur authentifié.
  const startWriter = (userId: string) => {
    writerUnsub?.();
    const taskKeyStr = JSON.stringify(taskKeys.lists());
    const habitKeyStr = JSON.stringify(habitKeys.lists());
    writerUnsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const action = event.action as { type: string };
      if (action.type !== 'success') return;
      const qk = JSON.stringify(event.query.queryKey);
      if (qk === taskKeyStr) {
        writeLocalCache(userId, 'tasks', event.query.state.data);
      } else if (qk === habitKeyStr) {
        writeLocalCache(userId, 'habits', event.query.state.data);
      }
    });
  };

  return {
    restore(userId, initial) {
      const cachedTasks = readLocalCache(userId, 'tasks');
      if (cachedTasks) queryClient.setQueryData(taskKeys.lists(), cachedTasks);
      dlog(`restoreAndRefresh: tasks cache hit=${!!cachedTasks}`);

      const cachedHabits = readLocalCache(userId, 'habits');
      if (cachedHabits) queryClient.setQueryData(habitKeys.lists(), cachedHabits);
      dlog(`restoreAndRefresh: habits cache hit=${!!cachedHabits}`);

      // Au démarrage, `getSession` et `INITIAL_SESSION` arrivent tous deux :
      // le premier abonne, le second garde l'écrivain en place. Un changement
      // d'identité, lui, réabonne toujours, pour le nouvel utilisateur.
      if (!initial || !writerUnsub) startWriter(userId);
    },
    forget: clearLocalCache,
    // L-11: purge every cached cosmo:qcache:* entry, not only the user
    // we just signed out. Defense for shared devices.
    purgeAll: purgeAllLocalCache,
    dispose() {
      writerUnsub?.();
      writerUnsub = undefined;
    },
  };
}

export function useOfflineCache(events: AuthEvents, queryClient: QueryClient): void {
  useEffect(() => {
    const cache = createOfflineCache(queryClient);
    const unsubscribe = events.subscribe({
      dataScopeOpened: ({ userId, initial }) => cache.restore(userId, initial),
      userLeaving: cache.forget,
      signedOut: cache.purgeAll,
    });
    return () => {
      unsubscribe();
      cache.dispose();
    };
  }, [events, queryClient]);
}
