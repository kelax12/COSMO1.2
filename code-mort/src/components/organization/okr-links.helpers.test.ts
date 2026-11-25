import { describe, it, expect } from 'vitest';
import type { TeamOKR } from '@/modules/team-okrs';
import { parentCandidates } from './okr-links.helpers';

const okr = (id: string, parentOkrId: string | null = null) => ({ id, parentOkrId }) as unknown as TeamOKR;

describe('parentCandidates', () => {
  // company ← teamA ← squad ; other à part.
  const okrs = [okr('company'), okr('teamA', 'company'), okr('squad', 'teamA'), okr('other')];

  it('en création, tout objectif peut être parent', () => {
    expect(parentCandidates(okrs, undefined).map((o) => o.id)).toEqual(['company', 'teamA', 'squad', 'other']);
  });

  it('exclut soi-même et TOUS ses descendants (le trigger refuserait le cycle)', () => {
    expect(parentCandidates(okrs, 'company').map((o) => o.id)).toEqual(['other']);
    expect(parentCandidates(okrs, 'teamA').map((o) => o.id)).toEqual(['company', 'other']);
  });
});
