import { describe, it, expect } from 'vitest';
import { mapHabitFromDb, mapHabitToDb, HabitRow } from './mappers';
import type { Habit } from './types';

const baseRow: HabitRow = {
  id: 'h1',
  name: 'Habit',
  frequency: 'daily',
  estimated_time: 10,
  color: '#fff',
  icon: 'star',
};

describe('mapHabitFromDb', () => {
  it('maps snake_case to camelCase', () => {
    const h = mapHabitFromDb({ ...baseRow, completions: { '2026-06-01': true }, created_at: 'c', user_id: 'u' });
    expect(h).toMatchObject({ id: 'h1', estimatedTime: 10, createdAt: 'c', userId: 'u' });
    expect(h.completions).toEqual({ '2026-06-01': true });
  });

  it('defaults completions to an empty object', () => {
    expect(mapHabitFromDb(baseRow).completions).toEqual({});
  });
});

describe('mapHabitToDb (whitelist / anti-mass-assignment)', () => {
  it('NEVER emits user_id, even if forged (faille V1)', () => {
    const forged = { name: 'x', userId: 'evil', user_id: 'evil2' } as Partial<Habit> & { user_id?: string };
    const out = mapHabitToDb(forged);
    expect('user_id' in out).toBe(false);
    expect(out).toEqual({ name: 'x' });
  });

  it('maps only provided fields to snake_case', () => {
    expect(mapHabitToDb({ estimatedTime: 5, frequency: 'weekly' })).toEqual({ estimated_time: 5, frequency: 'weekly' });
  });

  it('maps every whitelisted field (full coverage)', () => {
    const out = mapHabitToDb({
      name: 'n', description: 'd', frequency: 'monthly', estimatedTime: 7,
      color: '#000', icon: 'fire', completions: { '2026-01-01': true },
    });
    expect(out).toEqual({
      name: 'n', description: 'd', frequency: 'monthly', estimated_time: 7,
      color: '#000', icon: 'fire', completions: { '2026-01-01': true },
    });
  });
});
