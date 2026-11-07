// ═══════════════════════════════════════════════════════════════════
// Préchargements de session : tâches et habitudes dès l'ouverture
// ═══════════════════════════════════════════════════════════════════
//
// `staleTime: 0` force une relecture réseau même quand le cache hors ligne
// (`use-offline-cache.ts`) vient d'estampiller la donnée comme « fraîche » :
// l'utilisateur voit la donnée de la veille tout de suite, puis la donnée
// fraîche arrive en silence en ~400 à 700 ms. Un second appel (getSession
// puis INITIAL_SESSION) est sans coût : `prefetchQuery` déduplique.
//
// 🔴 S'abonne APRÈS le cache hors ligne (ordre des hooks dans
// `AuthProvider`) : précharger avant d'avoir pré-rempli écraserait le gain.
//
// Extrait d'`AuthContext.tsx` le 2026-11-07 (ARC-03).

import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { getTasksRepository, getHabitsRepository } from '@/lib/repository.factory';
import { taskKeys } from '@/modules/tasks/constants';
import { habitKeys } from '@/modules/habits/constants';
import { withTimeout } from '@/lib/withTimeout';
import { dlog } from './auth-debug';
import type { AuthEvents } from './auth-events';

export function prefetchSessionData(queryClient: QueryClient): void {
  dlog('restoreAndRefresh: prefetchQuery(tasks) START');
  const tTasks = performance.now();
  queryClient.prefetchQuery({
    queryKey: taskKeys.lists(),
    queryFn: () => withTimeout(getTasksRepository().getAll(), 10_000),
    staleTime: 0,
  }).then(() => dlog(`restoreAndRefresh: prefetchQuery(tasks) DONE in ${Math.round(performance.now() - tTasks)}ms`))
    .catch((err) => dlog(`restoreAndRefresh: prefetchQuery(tasks) FAIL: ${(err as Error).message}`));

  dlog('restoreAndRefresh: prefetchQuery(habits) START');
  const tHabits = performance.now();
  queryClient.prefetchQuery({
    queryKey: habitKeys.lists(),
    queryFn: () => withTimeout(getHabitsRepository().fetchHabits(), 10_000),
    staleTime: 0,
  }).then(() => dlog(`restoreAndRefresh: prefetchQuery(habits) DONE in ${Math.round(performance.now() - tHabits)}ms`))
    .catch((err) => dlog(`restoreAndRefresh: prefetchQuery(habits) FAIL: ${(err as Error).message}`));
}

export function useSessionPreload(events: AuthEvents, queryClient: QueryClient): void {
  useEffect(
    () => events.subscribe({ dataScopeOpened: () => prefetchSessionData(queryClient) }),
    [events, queryClient],
  );
}
