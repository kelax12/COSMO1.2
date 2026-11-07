// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { createOfflineCache, useOfflineCache } from './use-offline-cache';
import { createAuthEvents } from './auth-events';
import { readLocalCache, writeLocalCache } from './session-cache';
import { taskKeys } from '@/modules/tasks/constants';
import { habitKeys } from '@/modules/habits/constants';

let qc: QueryClient;

/** Simule une lecture réseau réussie, ce que l'écrivain écoute. */
async function fetchSucceeds(key: readonly unknown[], data: unknown) {
  await qc.fetchQuery({ queryKey: key, queryFn: async () => data, staleTime: 0 });
}

beforeEach(() => {
  localStorage.clear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});

describe('createOfflineCache', () => {
  it('pré-remplit React Query depuis localStorage', () => {
    writeLocalCache('u1', 'tasks', [{ id: 't1' }]);
    writeLocalCache('u1', 'habits', [{ id: 'h1' }]);
    createOfflineCache(qc).restore('u1', true);
    expect(qc.getQueryData(taskKeys.lists())).toEqual([{ id: 't1' }]);
    expect(qc.getQueryData(habitKeys.lists())).toEqual([{ id: 'h1' }]);
  });

  it("ne pose rien sans cache (pas d'entrée vide qui passerait pour une donnée)", () => {
    createOfflineCache(qc).restore('u1', true);
    expect(qc.getQueryCache().find({ queryKey: taskKeys.lists() })).toBeUndefined();
  });

  it("l'écrivain persiste chaque lecture réussie des listes, et rien d'autre", async () => {
    createOfflineCache(qc).restore('u1', true);
    await fetchSucceeds(taskKeys.lists(), [{ id: 'frais' }]);
    await fetchSucceeds(habitKeys.lists(), [{ id: 'h' }]);
    await fetchSucceeds(['autre'], 'x');
    expect(readLocalCache('u1', 'tasks')).toEqual([{ id: 'frais' }]);
    expect(readLocalCache('u1', 'habits')).toEqual([{ id: 'h' }]);
    expect(Object.keys(localStorage).sort()).toEqual(['cosmo:qcache:u1:habits', 'cosmo:qcache:u1:tasks']);
  });

  it("au démarrage, le second restore (INITIAL_SESSION) garde l'écrivain en place", async () => {
    const cache = createOfflineCache(qc);
    cache.restore('u1', true);
    cache.restore('u1', true);
    await fetchSucceeds(taskKeys.lists(), ['a']);
    expect(readLocalCache('u1', 'tasks')).toEqual(['a']);
  });

  it("un changement d'identité réabonne l'écrivain pour le NOUVEL utilisateur", async () => {
    const cache = createOfflineCache(qc);
    cache.restore('u1', true);
    cache.restore('u2', false);
    await fetchSucceeds(taskKeys.lists(), ['b']);
    expect(readLocalCache('u2', 'tasks')).toEqual(['b']);
    expect(readLocalCache('u1', 'tasks')).toBeNull();
  });

  it("TÉMOIN : un restore initial après celui d'un autre compte n'en change pas la cible", async () => {
    // Comportement d'origine conservé : en mode initial, un écrivain déjà
    // abonné reste celui qu'il était.
    const cache = createOfflineCache(qc);
    cache.restore('u1', true);
    cache.restore('u2', true);
    await fetchSucceeds(taskKeys.lists(), ['c']);
    expect(readLocalCache('u1', 'tasks')).toEqual(['c']);
  });

  it("dispose coupe l'écrivain ; forget et purgeAll effacent", async () => {
    const cache = createOfflineCache(qc);
    cache.restore('u1', true);
    cache.dispose();
    await fetchSucceeds(taskKeys.lists(), ['d']);
    expect(readLocalCache('u1', 'tasks')).toBeNull();

    writeLocalCache('u1', 'tasks', ['x']);
    writeLocalCache('u2', 'tasks', ['y']);
    cache.forget('u1');
    expect(readLocalCache('u1', 'tasks')).toBeNull();
    expect(readLocalCache('u2', 'tasks')).toEqual(['y']);
    cache.purgeAll();
    expect(readLocalCache('u2', 'tasks')).toBeNull();
  });
});

describe('useOfflineCache', () => {
  it('branche dataScopeOpened, userLeaving, signedOut ; libère tout au démontage', async () => {
    const events = createAuthEvents();
    writeLocalCache('u1', 'tasks', ['cache']);
    const view = renderHook(() => useOfflineCache(events, qc));

    events.emit('dataScopeOpened', { userId: 'u1', initial: true });
    expect(qc.getQueryData(taskKeys.lists())).toEqual(['cache']);

    events.emit('userLeaving', 'u1');
    expect(readLocalCache('u1', 'tasks')).toBeNull();

    writeLocalCache('u9', 'habits', ['z']);
    events.emit('signedOut', undefined);
    expect(readLocalCache('u9', 'habits')).toBeNull();

    view.unmount();
    await fetchSucceeds(taskKeys.lists(), ['après']);
    expect(readLocalCache('u1', 'tasks')).toBeNull();
  });
});
