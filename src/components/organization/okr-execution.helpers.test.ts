import { describe, expect, it } from 'vitest';
import type { TeamKeyResult, TeamOKR } from '@/modules/team-okrs';
import type { TeamProjectTaskStats } from '@/modules/team-projects';
import {
  currentCycle, effectiveKrRatio, filterOkrsByCycle, krTaskProgress, okrRatioPercent, parentCandidates,
} from './okr-execution.helpers';

const kr = (over: Partial<TeamKeyResult> = {}): TeamKeyResult => ({
  id: 'kr1', okrId: 'o1', orgId: 'org', title: 'KR', currentValue: 5, targetValue: 10,
  completed: false, weight: 1, progressMode: 'manual', ...over,
});

const stats = (projectId: string, completed: number, total: number): TeamProjectTaskStats => ({
  projectId, total, completed, overdue: 0, inReview: 0, nextDeadline: null,
});

const okr = (id: string, over: Partial<TeamOKR> = {}): TeamOKR => ({
  id, orgId: 'org', title: id, createdBy: 'u', createdAt: '2026-01-01', teamIds: [], keyResults: [], ...over,
});

describe('okr-execution.helpers', () => {
  const statsById = new Map([
    ['p1', stats('p1', 3, 4)],
    ['p2', stats('p2', 1, 6)],
  ]);
  const links = [{ krId: 'kr1', projectId: 'p1' }, { krId: 'kr1', projectId: 'p2' }];

  it('additionne les tâches des projets reliés, et eux seuls', () => {
    expect(krTaskProgress('kr1', links, statsById)).toEqual({ done: 4, total: 10, projectCount: 2 });
    expect(krTaskProgress('autre', links, statsById)).toEqual({ done: 0, total: 0, projectCount: 0 });
  });

  it('mode tâches : l’avancement se MESURE, la valeur saisie est ignorée', () => {
    expect(effectiveKrRatio(kr({ progressMode: 'tasks', currentValue: 10 }), links, statsById)).toBeCloseTo(0.4);
  });

  it('mode tâches SANS projet relié : retombe sur la valeur saisie', () => {
    expect(effectiveKrRatio(kr({ progressMode: 'tasks' }), [], statsById)).toBeCloseTo(0.5);
  });

  it('valeur saisie clampée, KR terminé = 1', () => {
    expect(effectiveKrRatio(kr({ currentValue: 50 }), [], statsById)).toBe(1);
    expect(effectiveKrRatio(kr({ currentValue: -3 }), [], statsById)).toBe(0);
    expect(effectiveKrRatio(kr({ completed: true, currentValue: 0 }), [], statsById)).toBe(1);
  });

  it('progression d’un OKR pondérée par le coefficient', () => {
    const krs = [kr({ id: 'a', currentValue: 10, weight: 3 }), kr({ id: 'b', currentValue: 0, weight: 1 })];
    expect(okrRatioPercent(krs, [], statsById)).toBe(75);
    expect(okrRatioPercent([], [], statsById)).toBe(0);
  });

  it('filtre de cycle : tous, sans cycle, un cycle', () => {
    const okrs = [okr('a', { cycleId: 'c1' }), okr('b'), okr('c', { cycleId: 'c2' })];
    expect(filterOkrsByCycle(okrs, '').map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(filterOkrsByCycle(okrs, 'none').map((o) => o.id)).toEqual(['b']);
    expect(filterOkrsByCycle(okrs, 'c2').map((o) => o.id)).toEqual(['c']);
  });

  it('cycle courant : celui qui contient aujourd’hui, le plus récent en cas de chevauchement', () => {
    const cycles = [
      { id: 'y', orgId: 'org', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31' },
      { id: 'q', orgId: 'org', name: 'T3', startDate: '2026-07-01', endDate: '2026-09-30' },
    ];
    expect(currentCycle(cycles, '2026-08-15')?.id).toBe('q');
    expect(currentCycle(cycles, '2026-11-02')?.id).toBe('y');
    expect(currentCycle(cycles, '2027-01-01')).toBeNull();
  });

  it('un objectif ne peut contribuer ni à lui-même ni à un descendant', () => {
    const okrs = [okr('root'), okr('child', { parentOkrId: 'root' }), okr('grand', { parentOkrId: 'child' }), okr('other')];
    expect(parentCandidates(okrs, 'root').map((o) => o.id)).toEqual(['other']);
    expect(parentCandidates(okrs, 'grand').map((o) => o.id)).toEqual(['root', 'child', 'other']);
    expect(parentCandidates(okrs, undefined)).toHaveLength(4);
  });
});
