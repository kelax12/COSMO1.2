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

describe('jours prévus (mig. 251)', () => {
  it('lit scheduled_days et schedule_history', () => {
    const h = mapHabitFromDb({
      ...baseRow,
      scheduled_days: [1, 3, 5],
      schedule_history: [{ from: '2026-11-13', days: [1, 3, 5] }],
    });
    expect(h.scheduledDays).toEqual([1, 3, 5]);
    expect(h.scheduleHistory).toEqual([{ from: '2026-11-13', days: [1, 3, 5] }]);
  });

  it('NULL et [] ne posent aucun champ (tous les jours)', () => {
    const h = mapHabitFromDb({ ...baseRow, scheduled_days: null, schedule_history: [] });
    expect(h).not.toHaveProperty('scheduledDays');
    expect(h).not.toHaveProperty('scheduleHistory');
  });

  it('écrit les jours normalisés ; 7 jours ou vide = NULL', () => {
    expect(mapHabitToDb({ scheduledDays: [5, 1, 3, 3] }).scheduled_days).toEqual([1, 3, 5]);
    expect(mapHabitToDb({ scheduledDays: [0, 1, 2, 3, 4, 5, 6] }).scheduled_days).toBeNull();
    expect(mapHabitToDb({ scheduledDays: [] }).scheduled_days).toBeNull();
  });

  it("n'émet rien quand les jours ne sont pas fournis", () => {
    const out = mapHabitToDb({ name: 'x' });
    expect(out).not.toHaveProperty('scheduled_days');
    expect(out).not.toHaveProperty('schedule_history');
  });

  it('écrit l’historique avec des jours normalisés', () => {
    expect(
      mapHabitToDb({ scheduleHistory: [{ from: '2026-11-13', days: [5, 1, 1] }] }).schedule_history,
    ).toEqual([{ from: '2026-11-13', days: [1, 5] }]);
  });
});

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
