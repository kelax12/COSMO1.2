import { describe, it, expect } from 'vitest';
import { buildOrgEvents, placeOrgEvents, type OrgEvent } from './org-events.helpers';
import type { TeamTask } from '@/modules/team-projects';
import type { TeamOKR } from '@/modules/team-okrs';

const NOW = new Date(2026, 7, 27, 14, 30); // 27 août 2026, 14 h 30 (heure locale)

const task = (over: Partial<TeamTask>): TeamTask => ({
  id: 't1',
  orgId: 'o1',
  projectId: 'p1',
  name: 'Tâche',
  completed: false,
  assigneeIds: [],
  createdBy: 'u1',
  createdAt: '2026-08-01',
  ...over,
} as TeamTask);

const okr = (over: Partial<TeamOKR>): TeamOKR => ({
  id: 'k1',
  orgId: 'o1',
  title: 'Objectif',
  createdBy: 'u1',
  createdAt: '2026-08-01',
  teamIds: [],
  keyResults: [],
  ...over,
} as TeamOKR);

const active = new Set(['p1']);
const names = new Map([['p1', 'Refonte site']]);

describe('buildOrgEvents', () => {
  it('retient les tâches ouvertes datées à venir, avec leur projet', () => {
    const events = buildOrgEvents([task({ deadline: '2026-08-29' })], [], active, names, NOW);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: 'task-t1', name: 'Tâche', kind: 'task', projectName: 'Refonte site', daysLeft: 2 });
  });

  it("compte aujourd'hui comme à venir, et ignore hier", () => {
    const events = buildOrgEvents(
      [task({ id: 'today', deadline: '2026-08-27' }), task({ id: 'past', deadline: '2026-08-26' })],
      [], active, names, NOW,
    );
    expect(events.map((e) => e.id)).toEqual(['task-today']);
    expect(events[0].daysLeft).toBe(0);
  });

  it('écarte les tâches terminées, sans échéance ou hors projet actif', () => {
    const events = buildOrgEvents(
      [
        task({ id: 'done', deadline: '2026-09-01', completed: true }),
        task({ id: 'undated' }),
        task({ id: 'archived', deadline: '2026-09-01', projectId: 'p-archive' }),
      ],
      [], active, names, NOW,
    );
    expect(events).toEqual([]);
  });

  it('mélange les OKR datés et trie par date, borné à `max`', () => {
    const events = buildOrgEvents(
      [task({ id: 'a', deadline: '2026-09-10' }), task({ id: 'b', deadline: '2026-08-30' })],
      [okr({ id: 'o', endDate: '2026-09-05' }), okr({ id: 'nodate' })],
      active, names, NOW,
    );
    expect(events.map((e) => e.id)).toEqual(['task-b', 'okr-o', 'task-a']);
    expect(events[1].kind).toBe('okr');
    expect(buildOrgEvents(
      [task({ id: 'a', deadline: '2026-09-10' }), task({ id: 'b', deadline: '2026-08-30' })],
      [], active, names, NOW, 1,
    )).toHaveLength(1);
  });

  it('classe l\'urgence par distance à aujourd\'hui', () => {
    const events = buildOrgEvents(
      [
        task({ id: 'now', deadline: '2026-08-29' }),
        task({ id: 'soon', deadline: '2026-09-03' }),
        task({ id: 'later', deadline: '2026-09-20' }),
      ],
      [], active, names, NOW,
    );
    expect(events.map((e) => e.urgency)).toEqual(['now', 'soon', 'later']);
  });
});

const ev = (daysLeft: number, id = `e${daysLeft}`): OrgEvent => ({
  id, date: new Date(2026, 7, 27 + daysLeft), name: id, kind: 'task', daysLeft, urgency: 'later',
});

describe('placeOrgEvents', () => {
  it('ne place rien quand il n\'y a rien', () => {
    expect(placeOrgEvents([])).toEqual([]);
  });

  it('centre un événement unique', () => {
    expect(placeOrgEvents([ev(4)])[0].percent).toBe(50);
  });

  it('rend une abscisse proportionnelle au temps', () => {
    const placed = placeOrgEvents([ev(0), ev(10), ev(20)]);
    expect(placed.map((p) => p.percent)).toEqual([0, 50, 100]);
  });

  it('alterne les rangées pour que deux libellés voisins ne se chevauchent pas', () => {
    expect(placeOrgEvents([ev(0), ev(5), ev(10)]).map((p) => p.row)).toEqual(['bottom', 'top', 'bottom']);
  });

  it('écarte deux échéances du même jour sans jamais déborder du cadre', () => {
    const placed = placeOrgEvents([ev(0, 'a'), ev(0, 'b'), ev(0, 'c'), ev(30, 'd')]);
    expect(placed[0].percent).toBe(0);
    expect(placed[placed.length - 1].percent).toBe(100);
    placed.forEach((p, i) => {
      expect(p.percent).toBeGreaterThanOrEqual(0);
      expect(p.percent).toBeLessThanOrEqual(100);
      if (i > 0) expect(p.percent).toBeGreaterThan(placed[i - 1].percent);
    });
  });

  it('centre le paquet quand tous les événements tombent le même jour', () => {
    const placed = placeOrgEvents([ev(3, 'a'), ev(3, 'b'), ev(3, 'c')]);
    expect(placed.map((p) => p.percent)).toEqual([41, 50, 59]);
  });
});
