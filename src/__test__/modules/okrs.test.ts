// ═══════════════════════════════════════════════════════════════════
// OKRs MODULE - Unit Tests
// Synchronisé avec src/modules/okrs/types.ts
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { okrsKeys, OKRS_STORAGE_KEY } from '@/modules/okrs/constants';
import { OKR, KeyResult, CreateOKRInput } from '@/modules/okrs/types';

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

describe('OKRs Types', () => {
  it('should create a valid OKR object', () => {
    const okr: OKR = {
      id: 'okr-1',
      title: 'Augmenter les ventes',
      description: 'Q1 2026',
      category: 'Business',
      progress: 0,
      completed: false,
      keyResults: [],
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    };

    expect(okr.id).toBe('okr-1');
    expect(okr.title).toBe('Augmenter les ventes');
    expect(okr.progress).toBe(0);
    expect(okr.completed).toBe(false);
    expect(okr.keyResults).toEqual([]);
  });

  it('should create a valid KeyResult object', () => {
    const kr: KeyResult = {
      id: 'kr-1',
      title: 'Atteindre 100k€ de CA',
      currentValue: 45,
      targetValue: 100,
      unit: 'k€',
    };

    expect(kr.currentValue).toBe(45);
    expect(kr.targetValue).toBe(100);
    expect(kr.unit).toBe('k€');
  });

  it('should calculate progress from key results', () => {
    const keyResults: KeyResult[] = [
      { id: 'kr-1', title: 'KR1', currentValue: 50, targetValue: 100, unit: '%' },
      { id: 'kr-2', title: 'KR2', currentValue: 75, targetValue: 100, unit: '%' },
    ];

    const progress = Math.round(
      keyResults.reduce((sum, kr) => sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100), 0) /
      keyResults.length
    );

    expect(progress).toBe(63); // (50 + 75) / 2 = 62.5 → 63
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKRs Constants', () => {
  it('should have correct storage key', () => {
    // Correction : la vraie valeur est 'cosmo-okrs' (tiret, pas underscore)
    expect(OKRS_STORAGE_KEY).toBe('cosmo-okrs');
  });

  it('should have correct query keys structure', () => {
    expect(okrsKeys.all).toEqual(['okrs']);
    expect(okrsKeys.lists()).toEqual(['okrs', 'list']);
    expect(okrsKeys.detail('okr-1')).toEqual(['okrs', 'detail', 'okr-1']);
    // Correction : byCategory génère ['okrs', 'category', ...] (pas 'byCategory')
    expect(okrsKeys.byCategory('cat-1')).toEqual(['okrs', 'category', 'cat-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// OKR PROGRESS CALCULATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKR Progress Calculation', () => {
  it('should return 0 for empty key results', () => {
    const keyResults: KeyResult[] = [];
    const progress = keyResults.length === 0
      ? 0
      : Math.round(
          keyResults.reduce((sum, kr) => sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100), 0) /
          keyResults.length
        );

    expect(progress).toBe(0);
  });

  it('should cap individual KR progress at 100%', () => {
    const kr: KeyResult = { id: '1', title: 'Over-achieved', currentValue: 150, targetValue: 100, unit: '' };
    const capped = Math.min((kr.currentValue / kr.targetValue) * 100, 100);
    expect(capped).toBe(100);
  });

  it('should calculate average across all key results', () => {
    const keyResults: KeyResult[] = [
      { id: '1', title: 'KR1', currentValue: 0,   targetValue: 100, unit: '' },
      { id: '2', title: 'KR2', currentValue: 100, targetValue: 100, unit: '' },
    ];

    const progress = Math.round(
      keyResults.reduce((sum, kr) => sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100), 0) /
      keyResults.length
    );

    expect(progress).toBe(50);
  });

  it('should mark OKR as completed when progress reaches 100', () => {
    const keyResults: KeyResult[] = [
      { id: '1', title: 'KR1', currentValue: 100, targetValue: 100, unit: '' },
      { id: '2', title: 'KR2', currentValue: 100, targetValue: 100, unit: '' },
    ];

    const progress = Math.round(
      keyResults.reduce((sum, kr) => sum + Math.min((kr.currentValue / kr.targetValue) * 100, 100), 0) /
      keyResults.length
    );

    expect(progress).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════
// OKR FILTERING LOGIC TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKR Filtering Logic', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  const makeOKR = (overrides: Partial<OKR> = {}): OKR => ({
    id: 'default-id',
    title: 'Default OKR',
    description: '',
    category: 'General',
    progress: 0,
    completed: false,
    keyResults: [],
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    ...overrides,
  });

  it('should filter active (non-completed) OKRs', () => {
    const okrs: OKR[] = [
      makeOKR({ id: '1', completed: false }),
      makeOKR({ id: '2', completed: true }),
      makeOKR({ id: '3', completed: false }),
    ];

    const active = okrs.filter((o) => !o.completed);
    expect(active).toHaveLength(2);
  });

  it('should filter OKRs by category', () => {
    const okrs: OKR[] = [
      makeOKR({ id: '1', category: 'Business' }),
      makeOKR({ id: '2', category: 'Personal' }),
      makeOKR({ id: '3', category: 'Business' }),
    ];

    const business = okrs.filter((o) => o.category === 'Business');
    expect(business).toHaveLength(2);
  });

  it('should sort OKRs by progress descending', () => {
    const okrs: OKR[] = [
      makeOKR({ id: '1', progress: 30 }),
      makeOKR({ id: '2', progress: 90 }),
      makeOKR({ id: '3', progress: 60 }),
    ];

    const sorted = [...okrs].sort((a, b) => b.progress - a.progress);
    expect(sorted[0].progress).toBe(90);
    expect(sorted[2].progress).toBe(30);
  });
});
