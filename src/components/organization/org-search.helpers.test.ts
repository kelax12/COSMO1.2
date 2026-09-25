import { describe, expect, it } from 'vitest';
import type { OrgSearchResult } from '@/modules/organizations/governance.types';
import { groupOrgResults, isDayKey, isProjectDetail, isTaskDetail, orgSearchLink } from './org-search.helpers';

const r = (kind: OrgSearchResult['kind'], over: Partial<OrgSearchResult> = {}): OrgSearchResult => ({
  kind, id: `${kind}-1`, label: kind, detail: null, parentId: null, ...over,
});

describe('org-search.helpers', () => {
  it('regroupe par type en gardant l’ordre du serveur', () => {
    const groups = groupOrgResults([r('task', { id: 't1' }), r('project'), r('task', { id: 't2' })]);
    expect(groups.get('task')?.map((x) => x.id)).toEqual(['t1', 't2']);
    expect(groups.get('project')).toHaveLength(1);
    expect(groups.has('member')).toBe(false);
  });

  it('un jalon ouvre SON projet, un KR SON objectif', () => {
    expect(orgSearchLink(r('milestone', { parentId: 'p9' }))).toBe('/entreprise/projects?project=p9');
    expect(orgSearchLink(r('kr', { parentId: 'o9' }))).toBe('/entreprise/okr?okr=o9');
  });

  it('chaque type mène à sa page', () => {
    expect(orgSearchLink(r('project', { id: 'p1' }))).toBe('/entreprise/projects?project=p1');
    expect(orgSearchLink(r('task', { id: 't1' }))).toBe('/entreprise/projects?task=t1');
    expect(orgSearchLink(r('okr', { id: 'o1' }))).toBe('/entreprise/okr?okr=o1');
    expect(orgSearchLink(r('member', { id: 'u1' }))).toBe('/entreprise/members?member=u1');
    expect(orgSearchLink(r('team', { id: 'tm1' }))).toBe('/entreprise/teams/tm1');
  });

  it('un détail serveur inconnu n’est jamais pris pour un statut', () => {
    expect(isProjectDetail('archived')).toBe(true);
    expect(isProjectDetail('<script>')).toBe(false);
    expect(isTaskDetail('review')).toBe(true);
    expect(isTaskDetail('in_review')).toBe(false);
    expect(isDayKey('2026-09-25')).toBe(true);
    expect(isDayKey('2026-09-25T10:00')).toBe(false);
    expect(isDayKey(null)).toBe(false);
  });
});
