// ═══════════════════════════════════════════════════════════════════
// HABITS MODULE - React Query Integration Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';

import {
  useHabits,
  useHabit,
  useCreateHabit,
  useToggleHabitCompletion,
  useHabitsWithStats,
  useHabitStats,
  useTodaysHabitStatus,
} from '@/modules/habits';
import { HABITS_STORAGE_KEY } from '@/modules/habits/constants';
import { Habit } from '@/modules/habits/types';

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

describe('Habits React Query Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('useHabits', () => {
    it('should fetch habits and return empty array initially', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useHabits(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it('should fetch habits from localStorage', async () => {
      const mockHabits: Habit[] = [
        { id: '1', name: 'Exercise', frequency: 'daily', color: '#10B981', completedDates: [], streak: 0 },
        { id: '2', name: 'Read', frequency: 'daily', color: '#3B82F6', completedDates: [], streak: 0 },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useHabits(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe('Exercise');
    });
  });

  describe('useHabit', () => {
    it('should fetch single habit by ID', async () => {
      const mockHabits: Habit[] = [
        { id: 'habit-123', name: 'Meditation', frequency: 'daily', color: '#8B5CF6', completedDates: [], streak: 5 },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useHabit('habit-123'), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.name).toBe('Meditation');
      expect(result.current.data?.streak).toBe(5);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// MUTATION HOOKS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Habits Mutations Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('useCreateHabit', () => {
    it('should create a new habit', async () => {
      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useCreateHabit(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate({
          name: 'New Habit',
          frequency: 'daily',
          color: '#EF4444',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(HABITS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('New Habit');
      expect(stored[0].completedDates).toEqual([]);
    });
  });

  describe('useToggleHabitCompletion', () => {
    it('should add date when marking as complete', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockHabits: Habit[] = [
        { id: '1', name: 'Exercise', frequency: 'daily', color: '#000', completedDates: [], streak: 0 },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useToggleHabitCompletion(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate({ id: '1', date: today });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(HABITS_STORAGE_KEY) || '[]');
      expect(stored[0].completedDates).toContain(today);
    });

    it('should remove date when unmarking as complete', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockHabits: Habit[] = [
        { id: '1', name: 'Exercise', frequency: 'daily', color: '#000', completedDates: [today], streak: 1 },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useToggleHabitCompletion(), { wrapper: Wrapper });

      await act(async () => {
        result.current.mutate({ id: '1', date: today });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const stored = JSON.parse(mockLocalStorage.getItem(HABITS_STORAGE_KEY) || '[]');
      expect(stored[0].completedDates).not.toContain(today);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// DERIVED HOOKS INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Habits Derived Hooks Integration', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('useHabitsWithStats', () => {
    it('should calculate stats for each habit', async () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      const mockHabits: Habit[] = [
        { 
          id: '1', 
          name: 'Exercise', 
          frequency: 'daily', 
          color: '#10B981', 
          completedDates: [today, yesterday],
          streak: 2 
        },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useHabitsWithStats(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0].totalCompletions).toBe(2);
      expect(result.current.data?.[0].currentStreak).toBeGreaterThanOrEqual(0);
    });
  });

  describe('useHabitStats', () => {
    it('should calculate global habit statistics', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const mockHabits: Habit[] = [
        { id: '1', name: 'H1', frequency: 'daily', color: '#000', completedDates: [today], streak: 1 },
        { id: '2', name: 'H2', frequency: 'daily', color: '#000', completedDates: [], streak: 0 },
        { id: '3', name: 'H3', frequency: 'weekly', color: '#000', completedDates: [today], streak: 1 },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useHabitStats(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.total).toBe(3);
      expect(result.current.data?.completedToday).toBe(2);
      expect(result.current.data?.completionRateToday).toBe(67); // 2/3 ≈ 67%
    });
  });

  describe('useTodaysHabitStatus', () => {
    it('should return today completion status for each habit', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const mockHabits: Habit[] = [
        { id: '1', name: 'Done', frequency: 'daily', color: '#10B981', completedDates: [today], streak: 1 },
        { id: '2', name: 'Not Done', frequency: 'daily', color: '#EF4444', completedDates: [], streak: 0 },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const { Wrapper } = createWrapper();
      const { result } = renderHook(() => useTodaysHabitStatus(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.[0].isCompletedToday).toBe(true);
      expect(result.current.data?.[1].isCompletedToday).toBe(false);
    });
  });
});
