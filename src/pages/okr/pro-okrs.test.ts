import { describe, it, expect } from 'vitest';
import type { TeamOKR, TeamKeyResult } from '@/modules/team-okrs';
import { myProOkrs, isMyTeamKR } from './pro-okrs';

const kr = (over: Partial<TeamKeyResult>): TeamKeyResult => ({
  id: 'k', okrId: 'o', orgId: 'org', title: 'KR', currentValue: 0, targetValue: 10, completed: false, ...over,
});
const okr = (id: string, keyResults: TeamKeyResult[]): TeamOKR => ({
  id, orgId: 'org', title: id, createdBy: 'x', createdAt: '', teamIds: [], keyResults,
});

describe('myProOkrs', () => {
  it('garde un OKR dont je suis responsable ou contributeur d un KR', () => {
    const list = [
      okr('a', [kr({ assigneeId: 'me' })]),
      okr('b', [kr({ assigneeId: 'other', contributorIds: ['me'] })]),
      okr('c', [kr({ assigneeId: 'other' })]),
    ];
    expect(myProOkrs(list, 'me').map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('écarte un OKR entièrement atteint', () => {
    expect(myProOkrs([okr('a', [kr({ assigneeId: 'me', completed: true })])], 'me')).toEqual([]);
  });

  it('ne rend rien sans utilisateur', () => {
    expect(myProOkrs([okr('a', [kr({ assigneeId: 'me' })])], undefined)).toEqual([]);
  });

  it('isMyTeamKR tolère contributorIds absent', () => {
    expect(isMyTeamKR(kr({ assigneeId: null }), 'me')).toBe(false);
  });
});
