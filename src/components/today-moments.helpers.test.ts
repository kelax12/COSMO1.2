import { describe, it, expect } from 'vitest';
import { buildMoments, momentOfHour, todayCompletionReport } from './today-moments.helpers';
import type { CalendarEvent } from '@/modules/events';
import type { TodayItem } from '@/modules/today';

const event = (id: string, iso: string, title = id): CalendarEvent =>
  ({ id, title, start: iso, end: iso }) as CalendarEvent;

const task = (id: string, over = false): TodayItem => ({
  id,
  source: 'personal',
  name: id,
  deadline: '2026-09-05',
  done: false,
  priority: 3,
  contextLabel: null,
  href: `/tasks?task=${id}`,
  overdue: over,
});

/** 5 septembre 2026, heure LOCALE — jamais construit depuis une chaîne ISO Z. */
const at = (h: number, m = 0) => new Date(2026, 8, 5, h, m);
const iso = (h: number, m = 0) => at(h, m).toISOString();

describe('buildMoments — les bornes', () => {
  it('coupe à midi et à 18 h', () => {
    expect(momentOfHour(0)).toBe('morning');
    expect(momentOfHour(11)).toBe('morning');
    expect(momentOfHour(12)).toBe('afternoon');
    expect(momentOfHour(17)).toBe('afternoon');
    expect(momentOfHour(18)).toBe('evening');
    expect(momentOfHour(23)).toBe('evening');
  });
});

describe('buildMoments — placement', () => {
  it("range chaque rendez-vous dans le moment de SON heure", () => {
    const groups = buildMoments({
      events: [event('e-soir', iso(18, 30)), event('e-matin', iso(10)), event('e-aprem', iso(12, 30))],
      tasks: [],
      now: at(9),
    });
    expect(groups.map((g) => g.moment)).toEqual(['morning', 'afternoon', 'evening']);
    expect(groups.map((g) => g.entries[0].event?.id)).toEqual(['e-matin', 'e-aprem', 'e-soir']);
  });

  it("met les tâches dans le moment COURANT, jamais sous une heure inventée", () => {
    const matin = buildMoments({ events: [], tasks: [task('t1')], now: at(9) });
    expect(matin).toHaveLength(1);
    expect(matin[0].moment).toBe('morning');
    expect(matin[0].entries[0].time).toBeNull();

    // La MÊME tâche, le même jour, à 20 h : elle a suivi la journée.
    const soir = buildMoments({ events: [], tasks: [task('t1')], now: at(20) });
    expect(soir[0].moment).toBe('evening');
  });

  it("fait passer l'heure avant ce qui n'en a pas, dans un même moment", () => {
    const [group] = buildMoments({
      events: [event('rdv', iso(10))],
      tasks: [task('tache')],
      now: at(9),
    });
    expect(group.entries.map((e) => e.event?.id ?? e.task?.id)).toEqual(['rdv', 'tache']);
  });

  it('ignore les rendez-vous des autres jours et les tâches terminées', () => {
    const groups = buildMoments({
      events: [event('hier', new Date(2026, 8, 4, 10).toISOString())],
      tasks: [{ ...task('faite'), done: true }],
      now: at(9),
    });
    expect(groups).toEqual([]);
  });

  it('ne rend aucun moment vide', () => {
    const groups = buildMoments({ events: [event('e', iso(21))], tasks: [], now: at(21) });
    expect(groups.map((g) => g.moment)).toEqual(['evening']);
  });

  it("survit à une date de début illisible plutôt que de vider l'écran", () => {
    const groups = buildMoments({
      events: [event('cassé', 'pas-une-date'), event('bon', iso(10))],
      tasks: [],
      now: at(9),
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].entries.map((e) => e.event?.id)).toEqual(['bon']);
  });
});

describe('todayCompletionReport — maquette 49', () => {
  const habit = (id: string, days: Record<string, boolean>) =>
    ({ id, name: id, completions: days }) as unknown as Parameters<
      typeof todayCompletionReport
    >[0]['habits'][number];

  const doneTask = (id: string, at: Date | null) =>
    ({
      id,
      name: id,
      completed: true,
      completedAt: at ? at.toISOString() : undefined,
    }) as unknown as Parameters<typeof todayCompletionReport>[0]['tasks'][number];

  it("compte ce qui a été fait AUJOURD'HUI, et rend l'heure du dernier", () => {
    const r = todayCompletionReport({
      tasks: [doneTask('t1', at(9, 5)), doneTask('t2', at(18, 42)), doneTask('hier', new Date(2026, 8, 4, 10))],
      habits: [habit('h1', { '2026-09-05': true }), habit('h2', { '2026-09-04': true })],
      events: [event('e', iso(10))],
      now: at(20),
    });
    expect(r).toMatchObject({ tasksDone: 2, habitsDone: 1, eventsToday: 1, total: 4, closedAt: '18:42' });
  });

  it("ne compte comme « à venir » que les rendez-vous PAS ENCORE terminés", () => {
    // Sans cette distinction la journée ne se bouclerait jamais un jour où
    // l'agenda contient quoi que ce soit : un rendez-vous ne se coche pas.
    const passe = { ...event('passe', iso(10)), end: at(11).toISOString() };
    const aVenir = { ...event('a-venir', iso(21)), end: at(22).toISOString() };
    expect(
      todayCompletionReport({ tasks: [], habits: [], events: [passe, aVenir], now: at(20) }).upcomingEvents,
    ).toBe(1);
    expect(
      todayCompletionReport({ tasks: [], habits: [], events: [passe], now: at(20) }).upcomingEvents,
    ).toBe(0);
  });

  it("rend closedAt null plutôt que l'heure courante quand aucun horodatage n'existe", () => {
    const r = todayCompletionReport({
      tasks: [doneTask('sans-date', null)],
      habits: [],
      events: [],
      now: at(20),
    });
    expect(r.closedAt).toBeNull();
    // La tâche n'est pas comptée non plus : rien ne prouve qu'elle l'a été aujourd'hui.
    expect(r.tasksDone).toBe(0);
  });

  it('distingue un compte vide d’une journée bouclée', () => {
    expect(todayCompletionReport({ tasks: [], habits: [], events: [], now: at(20) }).total).toBe(0);
  });
});
