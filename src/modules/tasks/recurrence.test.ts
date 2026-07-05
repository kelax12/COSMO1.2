import { describe, it, expect } from 'vitest';
import { nextOccurrenceDeadline, buildNextOccurrence } from './recurrence';
import type { Task } from './types';

// Mercredi 8 juillet 2026
const NOW = new Date(2026, 6, 8, 15, 0);

const baseTask: Task = {
  id: 't1',
  name: 'Sortir les poubelles',
  priority: 2,
  category: 'cat1',
  deadline: '2026-07-08',
  estimatedTime: 10,
  bookmarked: false,
  completed: true,
  completedAt: '2026-07-08T14:00:00.000Z',
  recurrence: 'weekly',
  subtasks: [{ id: 's1', name: 'sortir le bac jaune', completed: true }],
};

describe('nextOccurrenceDeadline (#26)', () => {
  it('daily : deadline + 1 jour', () => {
    expect(nextOccurrenceDeadline('2026-07-08', 'daily', NOW)).toBe('2026-07-09');
  });

  it('weekly : deadline + 7 jours', () => {
    expect(nextOccurrenceDeadline('2026-07-08', 'weekly', NOW)).toBe('2026-07-15');
  });

  it('monthly : deadline + 1 mois', () => {
    expect(nextOccurrenceDeadline('2026-07-08', 'monthly', NOW)).toBe('2026-08-08');
  });

  it('deadline passée : repart d\'aujourd\'hui (pas d\'occurrence déjà en retard)', () => {
    // Tâche restée en retard depuis le 1er juillet, complétée le 8 : la
    // prochaine occurrence hebdo part du 8, pas du 1er.
    expect(nextOccurrenceDeadline('2026-07-01', 'weekly', NOW)).toBe('2026-07-15');
  });

  it("'none' ou deadline vide : null", () => {
    expect(nextOccurrenceDeadline('2026-07-08', 'none', NOW)).toBeNull();
    expect(nextOccurrenceDeadline('', 'daily', NOW)).toBeNull();
  });

  it('deadline invalide : null', () => {
    expect(nextOccurrenceDeadline('pas-une-date', 'daily', NOW)).toBeNull();
  });
});

describe('buildNextOccurrence (#26)', () => {
  it('construit une occurrence propre : non complétée, sous-tâches décochées', () => {
    const next = buildNextOccurrence(baseTask, NOW);
    expect(next).not.toBeNull();
    expect(next!.completed).toBe(false);
    expect(next!.deadline).toBe('2026-07-15');
    expect(next!.recurrence).toBe('weekly');
    expect(next!.subtasks![0].completed).toBe(false);
    expect(next!.name).toBe(baseTask.name);
  });

  it('ne propage pas les champs collaboratifs', () => {
    const next = buildNextOccurrence({ ...baseTask, isCollaborative: true, pendingInvites: ['a@b.c'] }, NOW);
    expect(next!.isCollaborative).toBeUndefined();
    expect(next!.pendingInvites).toBeUndefined();
  });

  it('tâche non récurrente : null', () => {
    expect(buildNextOccurrence({ ...baseTask, recurrence: 'none' }, NOW)).toBeNull();
    expect(buildNextOccurrence({ ...baseTask, recurrence: undefined }, NOW)).toBeNull();
  });
});
