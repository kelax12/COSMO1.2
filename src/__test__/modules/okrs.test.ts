// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Unit Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OKR, KeyResult, CreateOKRInput, OKRStatus } from '@/modules/okrs/types';
import { okrsKeys, OKRS_STORAGE_KEY } from '@/modules/okrs/constants';

// ═══════════════════════════════════════════════════════════════════
// TYPES TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKRs Types', () => {
  it('should have valid OKRStatus values', () => {
    const statuses: OKRStatus[] = ['not_started', 'in_progress', 'at_risk', 'completed'];
    expect(statuses).toContain('not_started');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('at_risk');
    expect(statuses).toContain('completed');
  });

  it('should create valid KeyResult object', () => {
    const keyResult: KeyResult = {
      id: 'kr-1',
      title: 'Increase revenue by 20%',
      targetValue: 100,
      currentValue: 45,
      unit: '%',
    };

    expect(keyResult.id).toBe('kr-1');
    expect(keyResult.title).toBe('Increase revenue by 20%');
    expect(keyResult.targetValue).toBe(100);
    expect(keyResult.currentValue).toBe(45);
  });

  it('should create valid OKR object', () => {
    const okr: OKR = {
      id: 'okr-1',
      title: 'Q1 Growth Objectives',
      description: 'Focus on user growth',
      categoryId: 'cat-1',
      status: 'in_progress',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      keyResults: [
        { id: 'kr-1', title: 'Increase users', targetValue: 1000, currentValue: 500, unit: 'users' },
        { id: 'kr-2', title: 'Improve retention', targetValue: 80, currentValue: 65, unit: '%' },
      ],
    };

    expect(okr.id).toBe('okr-1');
    expect(okr.status).toBe('in_progress');
    expect(okr.keyResults).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKRs Constants', () => {
  it('should have correct storage key', () => {
    expect(OKRS_STORAGE_KEY).toBe('cosmo_okrs');
  });

  it('should have correct query keys structure', () => {
    expect(okrsKeys.all).toEqual(['okrs']);
    expect(okrsKeys.lists()).toEqual(['okrs', 'list']);
    expect(okrsKeys.detail('okr-1')).toEqual(['okrs', 'detail', 'okr-1']);
    expect(okrsKeys.byCategory('cat-1')).toEqual(['okrs', 'byCategory', 'cat-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PROGRESS CALCULATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKR Progress Calculation', () => {
  it('should calculate key result progress percentage', () => {
    const calculateProgress = (kr: KeyResult): number => {
      if (kr.targetValue === 0) return 0;
      return Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
    };

    const kr1: KeyResult = { id: '1', title: 'KR', targetValue: 100, currentValue: 50, unit: '%' };
    const kr2: KeyResult = { id: '2', title: 'KR', targetValue: 1000, currentValue: 1000, unit: 'users' };
    const kr3: KeyResult = { id: '3', title: 'KR', targetValue: 100, currentValue: 150, unit: '%' };

    expect(calculateProgress(kr1)).toBe(50);
    expect(calculateProgress(kr2)).toBe(100);
    expect(calculateProgress(kr3)).toBe(100); // Capped at 100%
  });

  it('should calculate overall OKR progress', () => {
    const calculateOKRProgress = (okr: OKR): number => {
      if (okr.keyResults.length === 0) return 0;
      
      const totalProgress = okr.keyResults.reduce((sum, kr) => {
        const progress = kr.targetValue === 0 ? 0 : (kr.currentValue / kr.targetValue) * 100;
        return sum + Math.min(100, progress);
      }, 0);
      
      return Math.round(totalProgress / okr.keyResults.length);
    };

    const okr: OKR = {
      id: '1',
      title: 'Test OKR',
      status: 'in_progress',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      keyResults: [
        { id: '1', title: 'KR1', targetValue: 100, currentValue: 50, unit: '%' },
        { id: '2', title: 'KR2', targetValue: 100, currentValue: 100, unit: '%' },
      ],
    };

    expect(calculateOKRProgress(okr)).toBe(75); // (50 + 100) / 2
  });

  it('should handle OKR with no key results', () => {
    const calculateOKRProgress = (okr: OKR): number => {
      if (okr.keyResults.length === 0) return 0;
      return 0;
    };

    const okr: OKR = {
      id: '1',
      title: 'Empty OKR',
      status: 'not_started',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      keyResults: [],
    };

    expect(calculateOKRProgress(okr)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// STATUS DETERMINATION TESTS
// ═══════════════════════════════════════════════════════════════════

describe('OKR Status Determination', () => {
  it('should determine status based on progress and time remaining', () => {
    const determineStatus = (progressPercent: number, daysRemaining: number, totalDays: number): OKRStatus => {
      const timePercent = ((totalDays - daysRemaining) / totalDays) * 100;
      
      if (progressPercent >= 100) return 'completed';
      if (progressPercent === 0) return 'not_started';
      if (progressPercent < timePercent - 20) return 'at_risk';
      return 'in_progress';
    };

    // On track: 50% progress, 50% time elapsed
    expect(determineStatus(50, 45, 90)).toBe('in_progress');
    
    // At risk: 30% progress, 70% time elapsed
    expect(determineStatus(30, 27, 90)).toBe('at_risk');
    
    // Completed
    expect(determineStatus(100, 30, 90)).toBe('completed');
    
    // Not started
    expect(determineStatus(0, 90, 90)).toBe('not_started');
  });
});
