// ═══════════════════════════════════════════════════════════════════
// UI-STATE MODULE - Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ColorSettings, PriorityRange, UIState } from '@/modules/ui-states/types';
import {
  DEFAULT_FAVORITE_COLORS,
  DEFAULT_PRIORITY_RANGE,
  DEFAULT_COLOR_SETTINGS,
  FAVORITE_COLORS_KEY,
  PRIORITY_RANGE_KEY,
} from '@/modules/ui-states/constants';

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

describe('UI-State Types', () => {
  it('should create valid ColorSettings', () => {
    const settings: ColorSettings = {
      'cat-1': 'Work',
      'cat-2': 'Personal',
    };

    expect(settings['cat-1']).toBe('Work');
    expect(settings['cat-2']).toBe('Personal');
  });

  it('should create valid PriorityRange', () => {
    const range: PriorityRange = [1, 5];

    expect(range[0]).toBe(1);
    expect(range[1]).toBe(5);
  });

  it('should create valid UIState', () => {
    const state: UIState = {
      favoriteColors: ['#3B82F6', '#10B981'],
      priorityRange: [2, 4],
      colorSettings: { 'cat-1': 'Work' },
    };

    expect(state.favoriteColors).toHaveLength(2);
    expect(state.priorityRange).toEqual([2, 4]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('UI-State Constants', () => {
  it('should have correct storage keys', () => {
    expect(FAVORITE_COLORS_KEY).toBe('cosmo_favorite_colors');
    expect(PRIORITY_RANGE_KEY).toBe('cosmo_priority_range');
  });

  it('should have valid default favorite colors', () => {
    expect(DEFAULT_FAVORITE_COLORS).toHaveLength(6);
    expect(DEFAULT_FAVORITE_COLORS).toContain('#3B82F6');
    expect(DEFAULT_FAVORITE_COLORS).toContain('#10B981');
  });

  it('should have valid default priority range', () => {
    expect(DEFAULT_PRIORITY_RANGE).toEqual([1, 5]);
  });

  it('should have valid default color settings', () => {
    expect(Object.keys(DEFAULT_COLOR_SETTINGS)).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FAVORITE COLORS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Favorite Colors Operations', () => {
  it('should add color to favorites', () => {
    const addColor = (colors: string[], newColor: string): string[] => {
      if (colors.includes(newColor)) return colors;
      return [...colors, newColor];
    };

    const colors = ['#3B82F6', '#10B981'];
    const updated = addColor(colors, '#EF4444');

    expect(updated).toHaveLength(3);
    expect(updated).toContain('#EF4444');
  });

  it('should not duplicate color in favorites', () => {
    const addColor = (colors: string[], newColor: string): string[] => {
      if (colors.includes(newColor)) return colors;
      return [...colors, newColor];
    };

    const colors = ['#3B82F6', '#10B981'];
    const updated = addColor(colors, '#3B82F6');

    expect(updated).toHaveLength(2);
  });

  it('should remove color from favorites', () => {
    const removeColor = (colors: string[], colorToRemove: string): string[] => {
      return colors.filter(c => c !== colorToRemove);
    };

    const colors = ['#3B82F6', '#10B981', '#EF4444'];
    const updated = removeColor(colors, '#10B981');

    expect(updated).toHaveLength(2);
    expect(updated).not.toContain('#10B981');
  });

  it('should validate hex color format', () => {
    const isValidHexColor = (color: string): boolean => {
      return /^#[0-9A-Fa-f]{6}$/.test(color);
    };

    expect(isValidHexColor('#3B82F6')).toBe(true);
    expect(isValidHexColor('#fff')).toBe(false);
    expect(isValidHexColor('red')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PRIORITY RANGE TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Priority Range Operations', () => {
  it('should validate priority is within range', () => {
    const isInRange = (priority: number, range: PriorityRange): boolean => {
      return priority >= range[0] && priority <= range[1];
    };

    const range: PriorityRange = [2, 4];

    expect(isInRange(1, range)).toBe(false);
    expect(isInRange(2, range)).toBe(true);
    expect(isInRange(3, range)).toBe(true);
    expect(isInRange(4, range)).toBe(true);
    expect(isInRange(5, range)).toBe(false);
  });

  it('should validate range bounds', () => {
    const isValidRange = (range: PriorityRange): boolean => {
      return range[0] >= 1 && range[1] <= 5 && range[0] <= range[1];
    };

    expect(isValidRange([1, 5])).toBe(true);
    expect(isValidRange([2, 4])).toBe(true);
    expect(isValidRange([3, 3])).toBe(true); // Single priority
    expect(isValidRange([4, 2])).toBe(false); // Invalid: min > max
    expect(isValidRange([0, 5])).toBe(false); // Invalid: min < 1
    expect(isValidRange([1, 6])).toBe(false); // Invalid: max > 5
  });

  it('should filter tasks by priority range', () => {
    const filterByPriority = <T extends { priority: number }>(items: T[], range: PriorityRange): T[] => {
      return items.filter(item => item.priority >= range[0] && item.priority <= range[1]);
    };

    const tasks = [
      { id: '1', priority: 1 },
      { id: '2', priority: 2 },
      { id: '3', priority: 3 },
      { id: '4', priority: 4 },
      { id: '5', priority: 5 },
    ];

    const filtered = filterByPriority(tasks, [2, 4]);

    expect(filtered).toHaveLength(3);
    expect(filtered.map(t => t.id)).toEqual(['2', '3', '4']);
  });
});

