import { describe, it, expect } from 'vitest';
import {
  filterByStatus, sumEstimatedTime, formatDuration,
} from './team-projects.helpers';
import type { TeamTask } from '@/modules/team-projects';

const base: TeamTask = {
  id: 't1', orgId: 'o1', projectId: 'p1', name: 'Tache', priority: 3,
  assigneeIds: [], createdBy: 'u1', completed: false,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

const task = (over: Partial<TeamTask>): TeamTask => ({ ...base, ...over });

/** Date locale 'YYYY-MM-DD' décalée de N jours — le format de `TeamTask.deadline`. */
const iso = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('filterByStatus', () => {
  const tasks = [
    task({ id: 'open', deadline: iso(3) }),
    task({ id: 'late', deadline: iso(-3) }),
    task({ id: 'done', completed: true, completedAt: new Date().toISOString() }),
  ];

  it('retourne tout pour "all"', () => {
    expect(filterByStatus(tasks, 'all')).toHaveLength(3);
  });

  it('ne garde que les tâches ouvertes pour "open"', () => {
    expect(filterByStatus(tasks, 'open').map((t) => t.id)).toEqual(['open', 'late']);
  });

  it('ne garde que les tâches en retard pour "overdue"', () => {
    expect(filterByStatus(tasks, 'overdue').map((t) => t.id)).toEqual(['late']);
  });

  it('ne garde que les tâches terminées cette semaine pour "doneThisWeek"', () => {
    expect(filterByStatus(tasks, 'doneThisWeek').map((t) => t.id)).toEqual(['done']);
  });

  it("exclut une tâche terminée il y a plus d'une semaine", () => {
    const old = task({ id: 'old', completed: true, completedAt: '2020-01-01T00:00:00Z' });
    expect(filterByStatus([old], 'doneThisWeek')).toHaveLength(0);
  });

  it('ne mute pas le tableau reçu', () => {
    const input = [...tasks];
    filterByStatus(input, 'overdue');
    expect(input).toHaveLength(3);
  });
});

describe('sumEstimatedTime', () => {
  it('somme les minutes estimées', () => {
    expect(sumEstimatedTime([task({ estimatedTime: 30 }), task({ estimatedTime: 45 })])).toBe(75);
  });

  it('ignore les tâches sans estimation', () => {
    expect(sumEstimatedTime([task({ estimatedTime: 30 }), task({})])).toBe(30);
  });

  it('retourne 0 sur une liste vide', () => {
    expect(sumEstimatedTime([])).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formate les minutes seules', () => {
    expect(formatDuration(45)).toBe('45 min');
  });

  it('formate les heures rondes', () => {
    expect(formatDuration(120)).toBe('2 h');
  });

  it('formate heures et minutes', () => {
    expect(formatDuration(135)).toBe('2 h 15');
  });

  it('retourne une chaîne vide pour 0', () => {
    expect(formatDuration(0)).toBe('');
  });

  it('retourne une chaîne vide pour une valeur négative', () => {
    expect(formatDuration(-10)).toBe('');
  });
});
