import { describe, expect, it } from 'vitest';
import type { TeamTaskActivity } from '@/modules/team-projects';
import { groupByActor, highlights, kindCounts, recentItems } from './apercu-activity.helpers';

const NOW = new Date('2026-10-20T12:00:00Z');
const entry = (id: string, actorId: string, taskId: string, field: string, hoursAgo: number, oldValue: string | null = null, newValue: string | null = null) =>
  ({ id, taskId, orgId: 'o', actorId, field, oldValue, newValue, createdAt: new Date(NOW.getTime() - hoursAgo * 3600e3).toISOString() } as TeamTaskActivity);

const log = [
  entry('1', 'lea', 't1', 'status', 1, 'todo', 'done'),
  entry('2', 'lea', 't2', 'created', 3),
  entry('3', 'tom', 'mine', 'deadline', 2, '2026-10-20', '2026-10-24'),
  entry('4', 'me', 'mine', 'status', 4, 'todo', 'done'),
  entry('5', 'lea', 't3', 'created', 30),
];

describe('Activité de l’équipe', () => {
  it('ne garde que les dernières 24 h', () => {
    expect(recentItems(log, NOW).map((i) => i.id)).toEqual(['1', '3', '2', '4']);
  });

  it('compte par type', () => {
    expect(kindCounts(recentItems(log, NOW))).toEqual({ completed: 2, created: 1, assigned: 0, postponed: 1 });
  });

  it('met en tête ce qu’un autre a fait sur mes tâches', () => {
    expect(highlights(recentItems(log, NOW), new Set(['mine']), 'me')[0].id).toBe('3');
  });

  it('groupe par personne, la plus récente en tête, et filtre', () => {
    const items = recentItems(log, NOW);
    const groups = groupByActor(items, new Set(['mine']), 'me');
    expect(groups.map((g) => [g.actorId, g.items.length, g.onMine])).toEqual([['lea', 2, false], ['tom', 1, true], ['me', 1, false]]);
    expect(groupByActor(items, new Set(['mine']), 'me', 'mine').map((g) => g.actorId)).toEqual(['tom']);
    expect(groupByActor(items, new Set(['mine']), 'me', 'completed').map((g) => g.actorId)).toEqual(['lea', 'me']);
  });
});
