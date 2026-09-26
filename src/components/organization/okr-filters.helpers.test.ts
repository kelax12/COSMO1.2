import { describe, it, expect } from 'vitest';
import type { TeamKeyResult, TeamOKR } from '@/modules/team-okrs';
import { filterOkrs, okrState, okrCarriers, EMPTY_OKR_FILTERS } from './okr-filters.helpers';

const kr = (over: Partial<TeamKeyResult> = {}): TeamKeyResult => ({
  id: Math.random().toString(36).slice(2), okrId: 'o', orgId: 'org', title: 'kr',
  currentValue: 0, targetValue: 10, completed: false, ...over,
});
const okr = (id: string, keyResults: TeamKeyResult[], teamIds: string[] = []): TeamOKR => ({
  id, orgId: 'org', title: id, createdBy: 'u', createdAt: '', teamIds, keyResults,
});
const none = new Map();

describe('okrState', () => {
  it('le pire état déclaré des KR ouverts l emporte', () => {
    expect(okrState(okr('a', [kr({ health: 'on_track' }), kr({ health: 'off_track' })]), [], none)).toBe('off_track');
    expect(okrState(okr('b', [kr({ health: 'at_risk' }), kr({ health: 'on_track' })]), [], none)).toBe('at_risk');
  });
  it('aucune déclaration : « sans point d étape », jamais « en bonne voie » par défaut', () => {
    expect(okrState(okr('c', [kr()]), [], none)).toBe('no_checkin');
  });
  it('un objectif à 100 % est atteint, même avec un vieux « à risque »', () => {
    expect(okrState(okr('d', [kr({ currentValue: 10, health: 'at_risk' })]), [], none)).toBe('done');
  });
});

describe('filterOkrs', () => {
  const list = [
    okr('ent', [kr({ assigneeId: 'u1' })]),
    okr('prod', [kr({ contributorIds: ['u2'], health: 'at_risk' })], ['t1']),
  ];
  it('équipe : « org » = objectifs sans équipe', () => {
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, team: 'org' }, [], none).map((o) => o.id)).toEqual(['ent']);
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, team: 't1' }, [], none).map((o) => o.id)).toEqual(['prod']);
  });
  it('porteur : responsable OU contributeur d un KR', () => {
    expect(okrCarriers(list[1])).toEqual(new Set(['u2']));
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, person: 'u2' }, [], none).map((o) => o.id)).toEqual(['prod']);
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, person: 'u1' }, [], none).map((o) => o.id)).toEqual(['ent']);
  });
  it('état', () => {
    expect(filterOkrs(list, { ...EMPTY_OKR_FILTERS, state: 'at_risk' }, [], none).map((o) => o.id)).toEqual(['prod']);
  });
});
