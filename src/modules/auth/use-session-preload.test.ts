// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  getAll: vi.fn(async () => [{ id: 'reseau' }]),
  fetchHabits: vi.fn(async () => [{ id: 'h-reseau' }]),
}));
vi.mock('@/lib/repository.factory', () => ({
  getTasksRepository: () => ({ getAll: () => h.getAll() }),
  getHabitsRepository: () => ({ fetchHabits: () => h.fetchHabits() }),
}));

import { prefetchSessionData, useSessionPreload } from './use-session-preload';
import { createAuthEvents } from './auth-events';
import { taskKeys } from '@/modules/tasks/constants';
import { habitKeys } from '@/modules/habits/constants';

let qc: QueryClient;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});

describe('prefetchSessionData', () => {
  it('relit tâches et habitudes même sur une donnée tout juste posée (staleTime 0)', async () => {
    qc.setQueryData(taskKeys.lists(), [{ id: 'cache' }]);
    prefetchSessionData(qc);
    await settle();
    expect(h.getAll).toHaveBeenCalledTimes(1);
    expect(h.fetchHabits).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData(taskKeys.lists())).toEqual([{ id: 'reseau' }]);
    expect(qc.getQueryData(habitKeys.lists())).toEqual([{ id: 'h-reseau' }]);
  });

  it("un échec réseau n'échappe pas (prefetch avalé, rien ne remonte)", async () => {
    h.getAll.mockRejectedValueOnce(new Error('hors ligne'));
    expect(() => prefetchSessionData(qc)).not.toThrow();
    await settle();
    expect(qc.getQueryState(taskKeys.lists())?.status).toBe('error');
  });
});

describe('useSessionPreload', () => {
  it('précharge à chaque dataScopeOpened, plus rien après démontage', async () => {
    const events = createAuthEvents();
    const view = renderHook(() => useSessionPreload(events, qc));
    events.emit('userLeaving', 'u1');
    expect(h.getAll).not.toHaveBeenCalled();
    events.emit('dataScopeOpened', { userId: 'u1', initial: true });
    await settle();
    expect(h.getAll).toHaveBeenCalledTimes(1);
    view.unmount();
    events.emit('dataScopeOpened', { userId: 'u1', initial: false });
    await settle();
    expect(h.getAll).toHaveBeenCalledTimes(1);
  });
});
