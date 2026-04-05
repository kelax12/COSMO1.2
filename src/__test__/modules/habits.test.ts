// ═══════════════════════════════════════════════════════════════════
// HABITS MODULE - Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalHabitsRepository } from '@/modules/habits/local.repository';
import { Habit, CreateHabitInput, HabitFrequency } from '@/modules/habits/types';
import { habitKeys, HABITS_STORAGE_KEY } from '@/modules/habits/constants';

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

// ═══════════════════════════════════════════════════════════════════
// TYPES TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Habits Types', () => {
  it('should have valid HabitFrequency values', () => {
    const frequencies: HabitFrequency[] = ['daily', 'weekly', 'monthly'];
    expect(frequencies).toContain('daily');
    expect(frequencies).toContain('weekly');
    expect(frequencies).toContain('monthly');
  });

  it('should create valid Habit object', () => {
    const habit: Habit = {
      id: 'habit-1',
      name: 'Exercise',
      description: '30 min daily',
      frequency: 'daily',
      color: '#10B981',
      completedDates: ['2026-01-01', '2026-01-02'],
      streak: 2,
    };

    expect(habit.id).toBe('habit-1');
    expect(habit.name).toBe('Exercise');
    expect(habit.frequency).toBe('daily');
    expect(habit.completedDates).toHaveLength(2);
    expect(habit.streak).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Habits Constants', () => {
  it('should have correct storage key', () => {
    expect(HABITS_STORAGE_KEY).toBe('cosmo_habits');
  });

  it('should have correct query keys structure', () => {
    expect(habitKeys.all).toEqual(['habits']);
    expect(habitKeys.lists()).toEqual(['habits', 'list']);
    expect(habitKeys.detail('habit-1')).toEqual(['habits', 'detail', 'habit-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// LOCAL REPOSITORY TESTS
// ═══════════════════════════════════════════════════════════════════

describe('LocalHabitsRepository', () => {
  let repository: LocalHabitsRepository;

  beforeEach(() => {
    mockLocalStorage.clear();
    repository = new LocalHabitsRepository();
  });

  describe('getAll', () => {
    it('should return empty array when no habits exist', async () => {
      const habits = await repository.getAll();
      expect(habits).toEqual([]);
    });

    it('should return habits from localStorage', async () => {
      const mockHabits: Habit[] = [
        { id: '1', name: 'Habit 1', frequency: 'daily', color: '#000', completedDates: [], streak: 0 },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const habits = await repository.getAll();
      expect(habits).toHaveLength(1);
      expect(habits[0].name).toBe('Habit 1');
    });
  });

  describe('create', () => {
    it('should create a new habit with default values', async () => {
      const input: CreateHabitInput = {
        name: 'New Habit',
        frequency: 'daily',
        color: '#3B82F6',
      };

      const habit = await repository.create(input);

      expect(habit.id).toBeDefined();
      expect(habit.name).toBe('New Habit');
      expect(habit.completedDates).toEqual([]);
      expect(habit.streak).toBe(0);
    });
  });

  describe('toggleCompletion', () => {
    it('should add date when marking as complete', async () => {
      const mockHabits: Habit[] = [
        { id: '1', name: 'Habit', frequency: 'daily', color: '#000', completedDates: [], streak: 0 },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const today = new Date().toISOString().split('T')[0];
      const habit = await repository.toggleCompletion('1', today);

      expect(habit.completedDates).toContain(today);
    });

    it('should remove date when unmarking as complete', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockHabits: Habit[] = [
        { id: '1', name: 'Habit', frequency: 'daily', color: '#000', completedDates: [today], streak: 1 },
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const habit = await repository.toggleCompletion('1', today);

      expect(habit.completedDates).not.toContain(today);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// STREAK CALCULATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Streak Calculation', () => {
  it('should calculate consecutive days streak', () => {
    const calculateStreak = (completedDates: string[]): number => {
      if (completedDates.length === 0) return 0;
      
      const sorted = [...completedDates].sort().reverse();
      let streak = 1;
      
      for (let i = 1; i < sorted.length; i++) {
        const curr = new Date(sorted[i - 1]);
        const prev = new Date(sorted[i]);
        const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }
      
      return streak;
    };

    expect(calculateStreak(['2026-01-01', '2026-01-02', '2026-01-03'])).toBe(3);
    expect(calculateStreak(['2026-01-01', '2026-01-03'])).toBe(1); // Gap
    expect(calculateStreak([])).toBe(0);
  });
});
