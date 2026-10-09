import { describe, it, expect } from 'vitest';
import { BOARD_COLUMNS, DONE_WINDOW_DAYS, groupTasksByStatus, moveIntent } from './board.helpers';
import type { Task } from '@/modules/tasks';

let seq = 0;
const t = (p: Partial<Task>): Task => ({
  id: p.id ?? `t${seq++}`,
  name: 'x', priority: 3, category: '', deadline: '', estimatedTime: 0,
  bookmarked: false, completed: false, ...p,
});
const NOW = new Date('2026-10-08T12:00:00Z');

describe('groupTasksByStatus', () => {
  it('quatre colonnes, vides comprises, dans l ordre', () => {
    expect(BOARD_COLUMNS).toEqual(['todo', 'in_progress', 'blocked', 'done']);
    const g = groupTasksByStatus([], NOW);
    expect(Object.keys(g)).toEqual([...BOARD_COLUMNS]);
    expect(Object.values(g).every((col) => col.length === 0)).toBe(true);
  });

  it('ligne servie sans statut : todo ou done selon completed', () => {
    const g = groupTasksByStatus([
      t({ id: 'a' }),
      t({ id: 'b', completed: true, completedAt: '2026-10-07T10:00:00Z' }),
    ], NOW);
    expect(g.todo.map((x) => x.id)).toEqual(['a']);
    expect(g.done.map((x) => x.id)).toEqual(['b']);
  });

  it('range chaque statut ouvert dans sa colonne', () => {
    const g = groupTasksByStatus([
      t({ id: 'p', status: 'in_progress' }),
      t({ id: 'b', status: 'blocked' }),
    ], NOW);
    expect(g.in_progress.map((x) => x.id)).toEqual(['p']);
    expect(g.blocked.map((x) => x.id)).toEqual(['b']);
  });

  it(`Terminée : ${DONE_WINDOW_DAYS} derniers jours seulement, la plus récente d abord`, () => {
    const g = groupTasksByStatus([
      t({ id: 'old', completed: true, status: 'done', completedAt: '2026-09-20T10:00:00Z' }),
      t({ id: 'nodate', completed: true, status: 'done' }),
      t({ id: 'd1', completed: true, status: 'done', completedAt: '2026-10-02T10:00:00Z' }),
      t({ id: 'd2', completed: true, status: 'done', completedAt: '2026-10-08T09:00:00Z' }),
    ], NOW);
    expect(g.done.map((x) => x.id)).toEqual(['d2', 'd1']);
  });

  it('colonnes ouvertes : en retard, puis par échéance, puis sans date par priorité', () => {
    const g = groupTasksByStatus([
      t({ id: 'nodate-p5', priority: 5 }),
      t({ id: 'nodate-p1', priority: 1 }),
      t({ id: 'nodate-p0', priority: 0 }),
      t({ id: 'soon', deadline: '2026-10-10T00:00:00Z' }),
      t({ id: 'late', deadline: '2026-10-01T00:00:00Z' }),
      t({ id: 'sooner', deadline: '2026-10-09T00:00:00Z' }),
    ], NOW);
    expect(g.todo.map((x) => x.id)).toEqual(['late', 'sooner', 'soon', 'nodate-p1', 'nodate-p5', 'nodate-p0']);
  });

  it('ne modifie pas le tableau reçu', () => {
    const input = [t({ id: 'b', priority: 5 }), t({ id: 'a', priority: 1 })];
    groupTasksByStatus(input, NOW);
    expect(input.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('moveIntent', () => {
  it('vers Terminée : passe par la bascule (seule à générer l occurrence)', () => {
    expect(moveIntent('todo', 'done')).toBe('toggle');
    expect(moveIntent('blocked', 'done')).toBe('toggle');
  });
  it('hors de Terminée ou entre colonnes ouvertes : statut', () => {
    expect(moveIntent('done', 'in_progress')).toBe('status');
    expect(moveIntent('todo', 'blocked')).toBe('status');
  });
  it('même colonne : rien', () => {
    expect(moveIntent('blocked', 'blocked')).toBe('none');
  });
});
