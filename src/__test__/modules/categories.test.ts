// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Category, CreateCategoryInput } from '@/modules/categories/types';
import { categoryKeys, CATEGORIES_STORAGE_KEY } from '@/modules/categories/constants';

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

describe('Categories Types', () => {
  it('should create valid Category object', () => {
    const category: Category = {
      id: 'cat-1',
      name: 'Work',
      color: '#3B82F6',
    };

    expect(category.id).toBe('cat-1');
    expect(category.name).toBe('Work');
    expect(category.color).toBe('#3B82F6');
  });

  it('should create valid CreateCategoryInput', () => {
    const input: CreateCategoryInput = {
      name: 'Personal',
      color: '#10B981',
    };

    expect(input.name).toBe('Personal');
    expect(input.color).toBe('#10B981');
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Categories Constants', () => {
  it('should have correct storage key', () => {
    expect(CATEGORIES_STORAGE_KEY).toBe('cosmo_categories');
  });

  it('should have correct query keys structure', () => {
    expect(categoryKeys.all).toEqual(['categories']);
    expect(categoryKeys.lists()).toEqual(['categories', 'list']);
    expect(categoryKeys.detail('cat-1')).toEqual(['categories', 'detail', 'cat-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CATEGORY VALIDATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Category Validation', () => {
  it('should accept valid hex color', () => {
    const isValidHexColor = (color: string) => /^#[0-9A-Fa-f]{6}$/.test(color);
    
    expect(isValidHexColor('#3B82F6')).toBe(true);
    expect(isValidHexColor('#10B981')).toBe(true);
    expect(isValidHexColor('#EF4444')).toBe(true);
  });

  it('should reject invalid hex color', () => {
    const isValidHexColor = (color: string) => /^#[0-9A-Fa-f]{6}$/.test(color);
    
    expect(isValidHexColor('red')).toBe(false);
    expect(isValidHexColor('#FFF')).toBe(false); // Too short
    expect(isValidHexColor('3B82F6')).toBe(false); // Missing #
  });

  it('should validate category name is not empty', () => {
    const isValidName = (name: string) => name.trim().length > 0;
    
    expect(isValidName('Work')).toBe(true);
    expect(isValidName('  Personal  ')).toBe(true);
    expect(isValidName('')).toBe(false);
    expect(isValidName('   ')).toBe(false);
  });
});
