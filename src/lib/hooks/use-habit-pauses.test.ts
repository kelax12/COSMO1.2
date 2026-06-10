// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHabitPauses, pausePresets } from './use-habit-pauses';

const NOW = new Date('2026-06-10T12:00:00.000Z');

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useHabitPauses', () => {
  it('pauseUntil marks the habit paused and persists; resume clears it', () => {
    const { result } = renderHook(() => useHabitPauses());
    const until = new Date('2026-06-15T23:59:59.000Z');

    act(() => { result.current.pauseUntil('h1', until); });
    expect(result.current.isPaused('h1')).toBe(true);
    expect(result.current.getPauseUntil('h1')?.toISOString()).toBe(until.toISOString());
    expect(JSON.parse(localStorage.getItem('cosmo:habit-pauses') as string)).toEqual({
      h1: until.toISOString(),
    });

    act(() => { result.current.resume('h1'); });
    expect(result.current.isPaused('h1')).toBe(false);
    expect(result.current.getPauseUntil('h1')).toBeNull();
  });

  it('expired pauses are cleaned at load and treated as not paused', () => {
    localStorage.setItem('cosmo:habit-pauses', JSON.stringify({
      h1: '2020-01-01T00:00:00.000Z', // expirée
      h2: '2099-01-01T00:00:00.000Z', // future
      h3: 'not-a-date',               // corrompue
    }));
    const { result } = renderHook(() => useHabitPauses());
    expect(result.current.isPaused('h1')).toBe(false);
    expect(result.current.isPaused('h2')).toBe(true);
    expect(result.current.isPaused('h3')).toBe(false);
    expect(Object.keys(result.current.pauses)).toEqual(['h2']);
  });

  it('syncs across hook instances in the same tab (custom event)', () => {
    const a = renderHook(() => useHabitPauses());
    const b = renderHook(() => useHabitPauses());
    act(() => { a.result.current.pauseUntil('h1', new Date('2026-07-01T00:00:00.000Z')); });
    expect(b.result.current.isPaused('h1')).toBe(true);
  });
});

describe('pausePresets (now figé au mercredi 2026-06-10)', () => {
  it('tomorrow = lendemain 23:59:59.999 locale', () => {
    const d = pausePresets.tomorrow();
    expect(d.getDate()).toBe(11);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });

  it('endOfWeek = dimanche suivant', () => {
    const d = pausePresets.endOfWeek();
    expect(d.getDay()).toBe(0); // dimanche
    expect(d.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('endOfMonth = dernier jour du mois courant', () => {
    const d = pausePresets.endOfMonth();
    expect(d.getMonth()).toBe(5); // juin (0-indexé)
    expect(d.getDate()).toBe(30);
  });
});
