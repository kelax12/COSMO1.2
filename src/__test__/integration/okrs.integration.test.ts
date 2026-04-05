// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - React Query Integration Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';

import {
  useOkrs,
  useOkr,
  useCreateOkr,
  useUpdateOkr,
  useDeleteOkr,
  useOkrsWithProgress,
  useOkrsByStatus,
  useOkrStats,
  useAtRiskOkrs,
} from '@/modules/okrs';
import { OKRS_STORAGE_KEY } from '@/modules/okrs/constants';
import { OKR, KeyResult } from '@/modules/okrs/types';

// ═══════════════════════════════════════════════════════════════════
// MOCK SETUP
// ═══════════════════════════════════════════════════════════════════

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return { Wrapper, queryClient };
};

// ═══════════════════════════════════════════════════════════════════
// READ HOOKS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKRs React Query Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('useOkrs', () => {
    it('should fetch OKRs and return empty array initially', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useOkrs(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it('should fetch OKRs from localStorage', async () => {
      const mockOkrs: OKR[] = [
        {
          id: '1',
          title: 'Q1 Growth',
          status: 'in_progress',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          keyResults: [
            { id: 'kr-1', title: 'Increase users', targetValue: 1000, currentValue: 500, unit: 'users' },
          ],
        },
      ];
      mockLocalStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(mockOkrs));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useOkrs(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].title).toBe('Q1 Growth');
    });
  });

  describe('useOkr', () => {
    it('should fetch single OKR by ID', async () => {
      const mockOkrs: OKR[] = [
        {
          id: 'okr-123',
          title: 'Revenue Target',
          status: 'in_progress',
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          keyResults: [],
        },
      ];
      mockLocalStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(mockOkrs));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useOkr('okr-123'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.title).toBe('Revenue Target');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// MUTATION HOOKS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKRs Mutations Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('useCreateOkr', () => {
    it('should create a new OKR', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateOkr(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate({
          title: 'New OKR',
          status: 'not_started',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          keyResults: [],
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(OKRS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('New OKR');
    });
  });

  describe('useUpdateOkr', () => {
    it('should update existing OKR', async () => {
      const mockOkrs: OKR[] = [
        {
          id: '1',
          title: 'Original',
          status: 'not_started',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          keyResults: [],
        },
      ];
      mockLocalStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(mockOkrs));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useUpdateOkr(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate({ id: '1', updates: { title: 'Updated', status: 'in_progress' } });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(OKRS_STORAGE_KEY) || '[]');
      expect(stored[0].title).toBe('Updated');
      expect(stored[0].status).toBe('in_progress');
    });
  });

  describe('useDeleteOkr', () => {
    it('should delete OKR by ID', async () => {
      const mockOkrs: OKR[] = [
        { id: '1', title: 'OKR 1', status: 'in_progress', startDate: '2026-01-01', endDate: '2026-03-31', keyResults: [] },
        { id: '2', title: 'OKR 2', status: 'not_started', startDate: '2026-01-01', endDate: '2026-03-31', keyResults: [] },
      ];
      mockLocalStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(mockOkrs));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useDeleteOkr(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate('1');
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(OKRS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('2');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKRs Derived Hooks Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('useOkrsWithProgress', () => {
    it('should calculate progress for each OKR', async () => {
      const mockOkrs: OKR[] = [
        {
          id: '1',
          title: 'OKR with 50% progress',
          status: 'in_progress',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          keyResults: [
            { id: 'kr-1', title: 'KR1', targetValue: 100, currentValue: 50, unit: '%' },
            { id: 'kr-2', title: 'KR2', targetValue: 100, currentValue: 50, unit: '%' },
          ],
        },
      ];
      mockLocalStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(mockOkrs));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useOkrsWithProgress(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0].progress).toBe(50);
      expect(result.current.data?.[0].keyResults[0].progress).toBe(50);
    });

    it('should cap progress at 100%', async () => {
      const mockOkrs: OKR[] = [
        {
          id: '1',
          title: 'Over-achieved OKR',
          status: 'completed',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          keyResults: [
            { id: 'kr-1', title: 'KR1', targetValue: 100, currentValue: 150, unit: 'users' },
          ],
        },
      ];
      mockLocalStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(mockOkrs));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useOkrsWithProgress(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0].progress).toBe(100);
      expect(result.current.data?.[0].keyResults[0].progress).toBe(100);
    });
  });

  describe('useOkrsByStatus', () => {
    it('should group OKRs by status', async () => {
      const mockOkrs: OKR[] = [
        { id: '1', title: 'Not Started', status: 'not_started', startDate: '2026-01-01', endDate: '2026-03-31', keyResults: [] },
        { id: '2', title: 'In Progress', status: 'in_progress', startDate: '2026-01-01', endDate: '2026-03-31', keyResults: [] },
        { id: '3', title: 'Completed', status: 'completed', startDate: '2026-01-01', endDate: '2026-03-31', keyResults: [] },
        { id: '4', title: 'At Risk', status: 'at_risk', startDate: '2026-01-01', endDate: '2026-03-31', keyResults: [] },
      ];
      mockLocalStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(mockOkrs));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useOkrsByStatus(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.not_started).toHaveLength(1);
      expect(result.current.data?.in_progress).toHaveLength(1);
      expect(result.current.data?.completed).toHaveLength(1);
      expect(result.current.data?.at_risk).toHaveLength(1);
    });
  });

  describe('useOkrStats', () => {
    it('should calculate OKR statistics', async () => {
      const mockOkrs: OKR[] = [
        {
          id: '1',
          title: 'OKR 1',
          status: 'completed',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          keyResults: [
            { id: 'kr-1', title: 'KR', targetValue: 100, currentValue: 100, unit: '%' },
          ],
        },
        {
          id: '2',
          title: 'OKR 2',
          status: 'in_progress',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          keyResults: [
            { id: 'kr-2', title: 'KR', targetValue: 100, currentValue: 50, unit: '%' },
          ],
        },
      ];
      mockLocalStorage.setItem(OKRS_STORAGE_KEY, JSON.stringify(mockOkrs));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useOkrStats(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.total).toBe(2);
      expect(result.current.data?.completed).toBe(1);
      expect(result.current.data?.inProgress).toBe(1);
      expect(result.current.data?.avgProgress).toBe(75); // (100 + 50) / 2
      expect(result.current.data?.totalKeyResults).toBe(2);
      expect(result.current.data?.completedKeyResults).toBe(1);
    });
  });
});
