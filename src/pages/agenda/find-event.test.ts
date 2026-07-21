import { describe, it, expect } from 'vitest';
import { findSourceEvent } from './find-event';
import type { CalendarEvent } from '@/modules/events';

function ev(partial: Partial<CalendarEvent> & { id: string }): CalendarEvent {
  return {
    title: 'Événement',
    start: '2026-07-21T09:00:00.000Z',
    end: '2026-07-21T10:00:00.000Z',
    ...partial,
  } as CalendarEvent;
}

describe('findSourceEvent', () => {
  it('trouve un événement simple par id exact', () => {
    const events = [ev({ id: 'a' }), ev({ id: 'b' })];
    expect(findSourceEvent(events, 'b')?.id).toBe('b');
  });

  it('résout une instance récurrente virtuelle vers son master', () => {
    const events = [ev({ id: 'master-1', recurrence: 'weekly' })];
    expect(findSourceEvent(events, 'master-1::2026-07-28')?.id).toBe('master-1');
  });

  it(
    'BUG RÉGRESSION : deux événements partageant le même taskId — l’id exact ' +
    'doit toujours gagner sur le fallback taskId, quel que soit l’ordre dans le tableau',
    () => {
      // Reproduit le scénario réel : un événement dupliqué (handleDuplicateEvent)
      // partage le taskId de l'original. L'utilisateur glisse/clique le SECOND
      // (id "evt-B", apparaissant après "evt-A" dans le tableau) : sans priorité
      // stricte sur l'id exact, un simple find(e => e.id===X || e.taskId===Y)
      // retournerait "evt-A" (mauvais événement, ancien horaire).
      const events = [
        ev({ id: 'evt-A', taskId: 'task-1', start: '2026-07-21T09:00:00.000Z', end: '2026-07-21T10:00:00.000Z' }),
        ev({ id: 'evt-B', taskId: 'task-1', start: '2026-07-22T14:00:00.000Z', end: '2026-07-22T15:00:00.000Z' }),
      ];
      const found = findSourceEvent(events, 'evt-B', 'task-1');
      expect(found?.id).toBe('evt-B');
      expect(found?.start).toBe('2026-07-22T14:00:00.000Z');
    },
  );

  it('fallback par taskId uniquement si l’id exact est absent', () => {
    const events = [ev({ id: 'server-id', taskId: 'task-9' })];
    // id FullCalendar temporaire (pas encore réconcilié) → repli par taskId.
    expect(findSourceEvent(events, 'temp-fc-id', 'task-9')?.id).toBe('server-id');
  });

  it('retourne undefined si ni id ni taskId ne correspondent', () => {
    const events = [ev({ id: 'a' })];
    expect(findSourceEvent(events, 'ghost')).toBeUndefined();
  });
});
