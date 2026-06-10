// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Fake repository — only the methods exercised here.
const fakeRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getEventsRepository: () => fakeRepo }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { useEvents, useCreateEvent } from './hooks';
import { eventsKeys } from './constants';
import type { CalendarEvent } from './types';

const sampleEvent: CalendarEvent = {
  id: 'e1', title: 'Réunion',
  start: '2026-06-10T10:00:00.000Z', end: '2026-06-10T11:00:00.000Z',
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  fakeRepo.getAll.mockReset();
  fakeRepo.create.mockReset();
});

describe('useEvents', () => {
  it('fetches events from the repository', async () => {
    fakeRepo.getAll.mockResolvedValue([sampleEvent]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useEvents(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleEvent]);
    expect(fakeRepo.getAll).toHaveBeenCalledTimes(1);
  });
});

describe('useCreateEvent', () => {
  it('calls repo.create and appends the new event to the list cache', async () => {
    const created: CalendarEvent = { ...sampleEvent, id: 'e2', title: 'Sport' };
    fakeRepo.create.mockResolvedValue(created);
    const { qc, wrapper } = makeWrapper();
    qc.setQueryData(eventsKeys.lists(), [sampleEvent]);

    const { result } = renderHook(() => useCreateEvent(), { wrapper });
    await result.current.mutateAsync({
      title: 'Sport', start: sampleEvent.start, end: sampleEvent.end,
    });

    expect(fakeRepo.create).toHaveBeenCalledTimes(1);
    const cached = qc.getQueryData<CalendarEvent[]>(eventsKeys.lists());
    expect(cached).toHaveLength(2);
    expect(cached?.[1]).toEqual(created); // appended at the end
  });
});
