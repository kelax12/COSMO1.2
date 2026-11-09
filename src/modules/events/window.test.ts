import { describe, it, expect } from 'vitest';
import {
  isRecurringEvent,
  eventInWindow,
  selectEventsInWindow,
  buildWindowOrFilter,
} from './window';
import { CalendarEvent } from './types';

const WIN_START = '2026-06-01T00:00:00.000Z';
const WIN_END = '2026-06-30T23:59:59.999Z';

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e', title: 't', start: '2026-06-15T10:00:00.000Z', end: '2026-06-15T11:00:00.000Z', ...over,
});

describe('isRecurringEvent', () => {
  it('vrai pour daily/weekly/custom, faux pour none/undefined', () => {
    expect(isRecurringEvent({ recurrence: 'daily' })).toBe(true);
    expect(isRecurringEvent({ recurrence: 'weekly' })).toBe(true);
    expect(isRecurringEvent({ recurrence: 'custom' })).toBe(true);
    expect(isRecurringEvent({ recurrence: 'none' })).toBe(false);
    expect(isRecurringEvent({ recurrence: undefined })).toBe(false);
  });
});

describe('eventInWindow', () => {
  it('inclut TOUJOURS un récurrent, même hors fenêtre (piège 42-récurrence)', () => {
    const weeklyBefore = ev({ recurrence: 'weekly', start: '2026-01-05T10:00:00.000Z', end: '2026-01-05T11:00:00.000Z' });
    expect(eventInWindow(weeklyBefore, WIN_START, WIN_END)).toBe(true);
  });

  it('inclut un non-récurrent qui chevauche la fenêtre', () => {
    expect(eventInWindow(ev({}), WIN_START, WIN_END)).toBe(true);
  });

  it('exclut un non-récurrent entièrement avant la fenêtre', () => {
    const before = ev({ start: '2026-05-01T10:00:00.000Z', end: '2026-05-01T11:00:00.000Z' });
    expect(eventInWindow(before, WIN_START, WIN_END)).toBe(false);
  });

  it('exclut un non-récurrent entièrement après la fenêtre', () => {
    const after = ev({ start: '2026-07-10T10:00:00.000Z', end: '2026-07-10T11:00:00.000Z' });
    expect(eventInWindow(after, WIN_START, WIN_END)).toBe(false);
  });

  it('inclut un événement multi-jours qui enjambe la fenêtre', () => {
    const spanning = ev({ start: '2026-05-28T10:00:00.000Z', end: '2026-06-02T11:00:00.000Z' });
    expect(eventInWindow(spanning, WIN_START, WIN_END)).toBe(true);
  });
});

describe('selectEventsInWindow', () => {
  it('garde récurrents + chevauchants, retire les hors-fenêtre', () => {
    const events = [
      ev({ id: 'in' }),
      ev({ id: 'rec', recurrence: 'weekly', start: '2025-01-01T10:00:00.000Z', end: '2025-01-01T11:00:00.000Z' }),
      ev({ id: 'before', start: '2026-04-01T10:00:00.000Z', end: '2026-04-01T11:00:00.000Z' }),
    ];
    const kept = selectEventsInWindow(events, WIN_START, WIN_END).map((e) => e.id);
    expect(kept).toContain('in');
    expect(kept).toContain('rec');
    expect(kept).not.toContain('before');
  });
});

describe('buildWindowOrFilter', () => {
  it('reflète eventInWindow : branche récurrents + branche plage (overlap)', () => {
    const f = buildWindowOrFilter(WIN_START, WIN_END);
    expect(f).toBe(
      `recurrence.in.(daily,weekly,custom),and(start_time.lte.${WIN_END},end_time.gte.${WIN_START})`,
    );
    // pas de virgule parasite dans les bornes (casserait le parsing .or())
    expect(WIN_START.includes(',')).toBe(false);
    expect(WIN_END.includes(',')).toBe(false);
  });
});

// ── Bords de la fenêtre (V14.2, PER-01) ────────────────────────────────
// Postgres compare des `timestamptz` ; la démo doit rendre les MÊMES lignes.
describe('eventInWindow · bords, comparaison d’instants', () => {
  it('bornes INCLUSES : fin pile au début, début pile à la fin', () => {
    expect(eventInWindow(ev({ start: '2026-05-31T23:00:00.000Z', end: WIN_START }), WIN_START, WIN_END)).toBe(true);
    expect(eventInWindow(ev({ start: WIN_END, end: '2026-07-01T01:00:00.000Z' }), WIN_START, WIN_END)).toBe(true);
  });

  it('une milliseconde dehors, c’est dehors', () => {
    expect(eventInWindow(ev({ start: '2026-05-31T23:00:00.000Z', end: '2026-05-31T23:59:59.999Z' }), WIN_START, WIN_END)).toBe(false);
    expect(eventInWindow(ev({ start: '2026-07-01T00:00:00.000Z', end: '2026-07-01T01:00:00.000Z' }), WIN_START, WIN_END)).toBe(false);
  });

  it('TÉMOIN : un événement rendu au format de la base (+00:00) qui finit pile au début reste dedans', () => {
    // Même instant que WIN_START, au format PostgREST (sans millisecondes).
    const pgEnd = '2026-06-01T00:00:00+00:00';
    // L'ancienne comparaison de chaînes l'excluait : '+' se classe avant '.'.
    expect(pgEnd >= WIN_START).toBe(false);
    expect(eventInWindow(ev({ start: '2026-05-31T23:00:00+00:00', end: pgEnd }), WIN_START, WIN_END)).toBe(true);
  });

  it('TÉMOIN : un début sans millisecondes pile sur la borne de fin reste dedans', () => {
    const end = '2026-06-30T23:59:59.000Z';
    const start = '2026-06-30T23:59:59Z';
    // 'Z' se classe après '.' : l'ancienne comparaison l'excluait aussi.
    expect(start <= end).toBe(false);
    expect(eventInWindow(ev({ start, end: '2026-07-01T00:30:00Z' }), WIN_START, end)).toBe(true);
  });

  it('un décalage horaire explicite est un instant comme un autre', () => {
    // 01:30 à Paris (+02:00) le 1er juin = 23:30 UTC le 31 mai : hors fenêtre UTC.
    expect(eventInWindow(ev({ start: '2026-06-01T01:00:00+02:00', end: '2026-06-01T01:30:00+02:00' }), WIN_START, WIN_END)).toBe(false);
    // 02:30 à Paris = 00:30 UTC le 1er juin : dedans.
    expect(eventInWindow(ev({ start: '2026-06-01T02:00:00+02:00', end: '2026-06-01T02:30:00+02:00' }), WIN_START, WIN_END)).toBe(true);
  });
});
