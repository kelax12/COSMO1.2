// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { TeamTask } from '@/modules/team-projects';
import {
  OVERDUE_BUCKET,
  deadlineBuckets,
  defaultBucketKey,
  loadNotes,
  postponedDeadline,
  saveNotes,
} from './apercu-new-widgets.helpers';

const task = (id: string, deadline?: string) => ({ id, name: id, deadline } as TeamTask);
const NOW = new Date(2026, 9, 19, 10);

describe('Mes échéances', () => {
  it('range sur 7 jours, avec un panier en retard en tête', () => {
    const buckets = deadlineBuckets([task('a', '2026-10-17'), task('b', '2026-10-19'), task('c', '2026-10-25'), task('d', '2026-10-26'), task('e')], NOW);
    expect(buckets).toHaveLength(8);
    expect(buckets[0].key).toBe(OVERDUE_BUCKET);
    expect(buckets[0].tasks.map((t) => t.id)).toEqual(['a']);
    expect(buckets[1].key).toBe('2026-10-19');
    expect(buckets[1].tasks.map((t) => t.id)).toEqual(['b']);
    expect(buckets[7].tasks.map((t) => t.id)).toEqual(['c']);
  });

  it('sans retard, sept paniers seulement, et le défaut est le premier non vide', () => {
    const buckets = deadlineBuckets([task('c', '2026-10-22')], NOW);
    expect(buckets).toHaveLength(7);
    expect(defaultBucketKey(buckets)).toBe('2026-10-22');
    expect(defaultBucketKey(deadlineBuckets([], NOW))).toBe('2026-10-19');
  });

  it('reporter : demain si en retard, sinon le lendemain de l’échéance', () => {
    expect(postponedDeadline('2026-10-10', NOW)).toBe('2026-10-20');
    expect(postponedDeadline('2026-10-22', NOW)).toBe('2026-10-23');
    expect(postponedDeadline(undefined, NOW)).toBe('2026-10-20');
  });
});

describe('Note épinglée', () => {
  beforeEach(() => localStorage.clear());

  it('relit par entreprise et par personne, et écarte ce qui est illisible', () => {
    saveNotes('o', 'u', [{ id: '1', text: 'Appeler', updatedAt: 'x' }]);
    expect(loadNotes('o', 'u')).toEqual([{ id: '1', text: 'Appeler', updatedAt: 'x' }]);
    expect(loadNotes('o', 'v')).toEqual([]);
    localStorage.setItem('cosmo_apercu_notes_v1:o:w', '[{"id":1},{oops');
    expect(loadNotes('o', 'w')).toEqual([]);
    localStorage.setItem('cosmo_apercu_notes_v1:o:z', '[{"id":1},{"id":"2","text":"ok","updatedAt":"y"}]');
    expect(loadNotes('o', 'z')).toEqual([{ id: '2', text: 'ok', updatedAt: 'y' }]);
  });
});

describe('pastille d’échéance', () => {
  it('hier, aujourd’hui, demain, sinon passé ou plus tard', async () => {
    const { deadlineKind } = await import('./apercu-new-widgets.helpers');
    expect(deadlineKind('2026-10-18', NOW)).toBe('yesterday');
    expect(deadlineKind('2026-10-19', NOW)).toBe('today');
    expect(deadlineKind('2026-10-20', NOW)).toBe('tomorrow');
    expect(deadlineKind('2026-10-10', NOW)).toBe('past');
    expect(deadlineKind('2026-10-24', NOW)).toBe('later');
    expect(deadlineKind(undefined, NOW)).toBeNull();
  });
});
