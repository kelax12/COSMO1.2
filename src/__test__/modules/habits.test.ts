// ═══════════════════════════════════════════════════════════════════
// HABITS MODULE - Unit Tests
// Synchronisé avec src/modules/habits/types.ts
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageHabitsRepository } from '@/modules/habits/local.repository';
import { Habit, CreateHabitInput } from '@/modules/habits/types';
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
// Corrected: Habit uses `completions: Record<string, boolean>` (not completedDates[])
//            and requires `icon`, `estimatedTime`
// ═══════════════════════════════════════════════════════════════════

describe('Habits Types', () => {
  it('should create a valid Habit object with real fields', () => {
    const habit: Habit = {
      id: '1',
      name: 'Morning run',
      frequency: 'daily',
      estimatedTime: 30,
      color: '#3B82F6',
      icon: '🏃',
      completions: {},
    };

    expect(habit.id).toBe('1');
    expect(habit.name).toBe('Morning run');
    expect(habit.frequency).toBe('daily');
    expect(habit.completions).toEqual({});
  });

  it('should support completions as Record<string, boolean>', () => {
    const habit: Habit = {
      id: '2',
      name: 'Read',
      frequency: 'daily',
      estimatedTime: 20,
      color: '#10B981',
      icon: '📚',
      completions: {
        '2026-01-01': true,
        '2026-01-02': false,
        '2026-01-03': true,
      },
    };

    expect(habit.completions['2026-01-01']).toBe(true);
    expect(habit.completions['2026-01-02']).toBe(false);
    expect(Object.keys(habit.completions)).toHaveLength(3);
  });

  it('should allow optional fields to be undefined', () => {
    const habit: Habit = {
      id: '3',
      name: 'Meditate',
      frequency: 'weekly',
      estimatedTime: 15,
      color: '#8B5CF6',
      icon: '🧘',
      completions: {},
    };

    expect(habit.description).toBeUndefined();
    expect(habit.createdAt).toBeUndefined();
    expect(habit.userId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Habits Constants', () => {
  it('should have correct storage key', () => {
    expect(HABITS_STORAGE_KEY).toBe('cosmo_demo_habits');
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

describe('LocalStorageHabitsRepository', () => {
  let repository: LocalStorageHabitsRepository;

  // Helper — crée un Habit valide selon les vrais types
  const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'default-id',
    name: 'Default Habit',
    frequency: 'daily',
    estimatedTime: 15,
    color: '#3B82F6',
    icon: '⭐',
    completions: {},
    ...overrides,
  });

  beforeEach(() => {
    mockLocalStorage.clear();
    // Seed [] pour éviter l'injection des DEMO_HABITS
    mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify([]));
    repository = new LocalStorageHabitsRepository();
  });

  describe('fetchHabits', () => {
    it('should return empty array when no habits exist', async () => {
      const habits = await repository.fetchHabits();
      expect(habits).toEqual([]);
    });

    it('should return habits from localStorage', async () => {
      const mockHabits: Habit[] = [
        makeHabit({ id: '1', name: 'Habit 1' }),
        makeHabit({ id: '2', name: 'Habit 2' }),
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const habits = await repository.fetchHabits();
      expect(habits).toHaveLength(2);
      expect(habits[0].name).toBe('Habit 1');
    });
  });

  describe('getById', () => {
    it('should return null for non-existent habit', async () => {
      const habit = await repository.getById('non-existent');
      expect(habit).toBeNull();
    });

    it('should return habit by id', async () => {
      const mockHabits: Habit[] = [makeHabit({ id: '1', name: 'Yoga' })];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const habit = await repository.getById('1');
      expect(habit).not.toBeNull();
      expect(habit?.name).toBe('Yoga');
    });
  });

  describe('createHabit', () => {
    it('should create a new habit with generated id', async () => {
      const input: CreateHabitInput = {
        name: 'New Habit',
        frequency: 'daily',
        estimatedTime: 10,
        color: '#3B82F6',
        icon: '💧',
      };

      const habit = await repository.createHabit(input);

      expect(habit.id).toBeDefined();
      expect(habit.name).toBe('New Habit');
      expect(habit.completions).toEqual({});
    });

    it('should persist habit to localStorage', async () => {
      const input: CreateHabitInput = {
        name: 'Persisted Habit',
        frequency: 'weekly',
        estimatedTime: 30,
        color: '#10B981',
        icon: '📖',
      };

      await repository.createHabit(input);

      const stored = JSON.parse(mockLocalStorage.getItem(HABITS_STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Persisted Habit');
    });
  });

  describe('updateHabit', () => {
    it('should update existing habit', async () => {
      const mockHabits: Habit[] = [makeHabit({ id: '1', name: 'Original' })];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const updated = await repository.updateHabit('1', { name: 'Updated' });

      expect(updated.name).toBe('Updated');
      expect(updated.frequency).toBe('daily'); // Unchanged
    });

    it('should throw error for non-existent habit', async () => {
      await expect(repository.updateHabit('non-existent', { name: 'Test' }))
        .rejects.toThrow();
    });
  });

  describe('deleteHabit', () => {
    it('should delete existing habit', async () => {
      const mockHabits: Habit[] = [
        makeHabit({ id: '1', name: 'Habit 1' }),
        makeHabit({ id: '2', name: 'Habit 2' }),
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      await repository.deleteHabit('1');

      const remaining = JSON.parse(mockLocalStorage.getItem(HABITS_STORAGE_KEY) || '[]');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('2');
    });
  });

  describe('toggleCompletion', () => {
    it('should set completion to true when not completed', async () => {
      const mockHabits: Habit[] = [makeHabit({ id: '1', completions: {} })];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const today = new Date().toISOString().split('T')[0];
      const habit = await repository.toggleCompletion('1', today);

      expect(habit.completions[today]).toBe(true);
    });

    it('should toggle completion to false when already true', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockHabits: Habit[] = [
        makeHabit({ id: '1', completions: { [today]: true } }),
      ];
      mockLocalStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(mockHabits));

      const habit = await repository.toggleCompletion('1', today);

      // toggleCompletion inverse la valeur booléenne
      expect(habit.completions[today]).toBe(false);
    });

    it('should throw error for non-existent habit', async () => {
      await expect(repository.toggleCompletion('non-existent', '2026-01-01'))
        .rejects.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// STREAK CALCULATION TESTS
// Note: La logique de streak est dans hooks.derived.ts, pas le repository
// ═══════════════════════════════════════════════════════════════════

describe('Streak Calculation Logic', () => {
  it('should calculate consecutive days streak', () => {
    // Reproduit la logique de calcul de streak sur completions
    const calculateStreak = (completions: Record<string, boolean>): number => {
      const completedDates = Object.entries(completions)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
        .sort()
        .reverse();

      if (completedDates.length === 0) return 0;

      let streak = 1;
      for (let i = 1; i < completedDates.length; i++) {
        const curr = new Date(completedDates[i - 1]);
        const prev = new Date(completedDates[i]);
        const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    };

    expect(calculateStreak({ '2026-01-01': true, '2026-01-02': true, '2026-01-03': true })).toBe(3);
    expect(calculateStreak({ '2026-01-01': true, '2026-01-03': true })).toBe(1); // Gap
    expect(calculateStreak({})).toBe(0);
    expect(calculateStreak({ '2026-01-01': false, '2026-01-02': true })).toBe(1); // false ignoré
  });
});
