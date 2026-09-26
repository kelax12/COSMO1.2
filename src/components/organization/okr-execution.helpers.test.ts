import { describe, it, expect } from 'vitest';
import type { TeamKeyResult, TeamOKR } from '@/modules/team-okrs';
import {
  buildOkrTree,
  currentCycle,
  EMPTY_OKR_FILTERS,
  filterOkrs,
  krProgress,
  okrHealth,
  okrProgress,
  parentCandidates,
} from './okr-execution.helpers';

const kr = (over: Partial<TeamKeyResult> = {}): TeamKeyResult => ({
  id: 'kr1', okrId: 'o1', orgId: 'org', title: 'KR', currentValue: 0, targetValue: 10,
  completed: false, weight: 1, ...over,
});

const okr = (over: Partial<TeamOKR> = {}): TeamOKR => ({
  id: 'o1', orgId: 'org', title: 'O', createdBy: 'u1', createdAt: '2026-01-01',
  teamIds: [], keyResults: [kr()], ...over,
});

describe('krProgress', () => {
  it('mode manuel : valeur saisie sur cible, bornée', () => {
    expect(krProgress(kr({ currentValue: 5 }))).toBe(0.5);
    expect(krProgress(kr({ currentValue: 50 }))).toBe(1);
    expect(krProgress(kr({ targetValue: 0 }))).toBe(0);
  });

  it('mode tâches : terminées sur totales des SEULS projets reliés', () => {
    const ctx = {
      links: [{ krId: 'kr1', projectId: 'p1' }, { krId: 'kr1', projectId: 'p2' }, { krId: 'krX', projectId: 'p3' }],
      progress: [
        { projectId: 'p1', total: 4, done: 1 },
        { projectId: 'p2', total: 6, done: 4 },
        { projectId: 'p3', total: 10, done: 10 },
      ],
    };
    expect(krProgress(kr({ progressMode: 'tasks' }), ctx)).toBe(0.5);
  });

  it('mode tâches sans projet relié : 0, jamais un chiffre inventé', () => {
    expect(krProgress(kr({ progressMode: 'tasks', currentValue: 9 }), { links: [], progress: [] })).toBe(0);
  });

  it('un KR terminé vaut 1 quel que soit son mode', () => {
    expect(krProgress(kr({ completed: true, progressMode: 'tasks' }), { links: [], progress: [] })).toBe(1);
  });
});

describe('okrProgress / okrHealth', () => {
  it('pondère par le coefficient', () => {
    expect(okrProgress([kr({ currentValue: 10, weight: 3 }), kr({ id: 'k2', currentValue: 0, weight: 1 })])).toBe(75);
  });

  it('prend le PIRE état déclaré', () => {
    expect(okrHealth([kr({ health: 'on_track' }), kr({ health: 'at_risk' })])).toBe('at_risk');
    expect(okrHealth([kr({ health: 'off_track' }), kr({ health: 'on_track' })])).toBe('off_track');
    expect(okrHealth([kr()])).toBe('none');
  });
});

describe('filterOkrs', () => {
  const list = [
    okr({ id: 'a', cycleId: 'c1', teamIds: ['t1'] }),
    okr({ id: 'b', cycleId: 'c2', teamIds: [], createdBy: 'me' }),
    okr({ id: 'c', cycleId: 'c1', teamIds: [], keyResults: [kr({ health: 'off_track' })] }),
  ];

  it('par cycle, équipe, objectifs d entreprise', () => {
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, cycleId: 'c1' }).map((o) => o.id)).toEqual(['a', 'c']);
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, teamId: 't1' }).map((o) => o.id)).toEqual(['a']);
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, teamId: 'org' }).map((o) => o.id)).toEqual(['b', 'c']);
  });

  it('par état et « les miens »', () => {
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, health: 'off_track' }).map((o) => o.id)).toEqual(['c']);
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, mine: true }, 'me').map((o) => o.id)).toEqual(['b']);
  });
});

describe('alignement', () => {
  const list = [
    okr({ id: 'root' }),
    okr({ id: 'child', parentOkrId: 'root' }),
    okr({ id: 'grand', parentOkrId: 'child' }),
    okr({ id: 'orphan', parentOkrId: 'invisible' }),
  ];

  it('range chaque objectif sous son parent, un parent invisible laisse l enfant à la racine', () => {
    const tree = buildOkrTree(list);
    expect(tree.map((n) => n.okr.id)).toEqual(['root', 'orphan']);
    expect(tree[0].children[0].okr.id).toBe('child');
    expect(tree[0].children[0].children[0].okr.id).toBe('grand');
  });

  it('ne propose jamais soi-même ni un descendant comme parent', () => {
    expect(parentCandidates(list, 'root').map((o) => o.id)).toEqual(['orphan']);
  });

  it('survit à un cycle en base sans boucler', () => {
    const cyclic = [okr({ id: 'x', parentOkrId: 'y' }), okr({ id: 'y', parentOkrId: 'x' })];
    const ids: string[] = [];
    const walk = (n: { okr: { id: string }; children: unknown[] }) => {
      ids.push(n.okr.id);
      (n.children as typeof n[]).forEach(walk);
    };
    buildOkrTree(cyclic).forEach(walk);
    // Les deux restent affichés, chacun une seule fois.
    expect(ids.sort()).toEqual(['x', 'y']);
  });
});

describe('currentCycle', () => {
  it('rend le cycle qui contient la date', () => {
    const cycles = [
      { id: 'q1', orgId: 'o', name: 'T1', startDate: '2026-01-01', endDate: '2026-03-31' },
      { id: 'q3', orgId: 'o', name: 'T3', startDate: '2026-07-01', endDate: '2026-09-30' },
    ];
    expect(currentCycle(cycles, '2026-09-24')?.id).toBe('q3');
    expect(currentCycle(cycles, '2026-05-01')).toBeNull();
  });
});
