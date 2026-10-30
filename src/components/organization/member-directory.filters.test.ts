import { describe, it, expect } from 'vitest';
import type { OrgMember } from '@/modules/organizations';
import {
  EMPTY_DIRECTORY_FILTERS,
  activeFilterCount,
  applyDirectoryFilters,
  directoryRoleOf,
  joinedWithin,
  readDirectoryFilters,
  writeDirectoryFilters,
  type DirectoryFilters,
} from './member-directory.filters';

const NOW = Date.parse('2026-09-24T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

const mk = (userId: string, over: Partial<OrgMember> = {}): OrgMember => ({
  orgId: 'o', userId, role: 'member', joinedAt: daysAgo(10), displayName: userId, email: `${userId}@acme.io`, managerId: null, ...over,
});

// owner (admin) ─ boss ─ ann, bob ; zoe non placée ; carl admin non placé.
// La pyramide est dormante depuis la mig. 229 : elle ne doit plus rien changer.
const MEMBERS: OrgMember[] = [
  mk('owner', { role: 'admin', joinedAt: daysAgo(800) }),
  mk('boss', { managerId: 'owner', joinedAt: daysAgo(200) }),
  mk('ann', { managerId: 'boss', joinedAt: daysAgo(3) }),
  mk('bob', { managerId: 'boss', joinedAt: daysAgo(45), displayName: 'Bob Éric' }),
  mk('zoe', { joinedAt: daysAgo(20) }),
  mk('carl', { role: 'admin', joinedAt: daysAgo(400) }),
];

const CTX = {
  teamIds: new Set(['t1', 't-empty']),
  teamIdsByUser: new Map([['ann', new Set(['t1'])], ['zoe', new Set(['t1'])]]),
  now: NOW,
};

const ids = (f: Partial<DirectoryFilters>) =>
  applyDirectoryFilters(MEMBERS, { ...EMPTY_DIRECTORY_FILTERS, ...f }, CTX).map((m) => m.userId);

describe('readDirectoryFilters · une URL est une entrée non fiable', () => {
  it('lit un filtre complet', () => {
    const p = new URLSearchParams('dirQ=bob&dirTeam=t1&dirRole=admin&dirJoined=30d');
    expect(readDirectoryFilters(p)).toEqual({ query: 'bob', teamId: 't1', role: 'admin', joined: '30d' });
  });

  it('un ancien lien « manager direct » / « non placé » / rôle manager est ignoré (mig. 229)', () => {
    const p = new URLSearchParams('dirRole=manager&dirManager=boss&dirUnplaced=1');
    expect(readDirectoryFilters(p)).toEqual(EMPTY_DIRECTORY_FILTERS);
  });

  it('ignore toute valeur hors vocabulaire ou hors alphabet', () => {
    const p = new URLSearchParams('dirTeam=<script>&dirRole=owner&dirJoined=2y');
    expect(readDirectoryFilters(p)).toEqual(EMPTY_DIRECTORY_FILTERS);
  });

  it('borne la recherche à 100 caractères', () => {
    expect(readDirectoryFilters(new URLSearchParams(`dirQ=${'x'.repeat(500)}`)).query).toHaveLength(100);
  });
});

describe('writeDirectoryFilters', () => {
  it('aller-retour sans perte, et garde les paramètres étrangers', () => {
    const f: DirectoryFilters = { query: 'bob', teamId: 't1', role: 'admin', joined: '1y' };
    const out = writeDirectoryFilters(new URLSearchParams('member=ann'), f);
    expect(out.get('member')).toBe('ann');
    expect(readDirectoryFilters(out)).toEqual(f);
  });

  it('un filtre vidé RETIRE son paramètre (le lien reste propre)', () => {
    const out = writeDirectoryFilters(new URLSearchParams('dirRole=admin&dirQ=x'), EMPTY_DIRECTORY_FILTERS);
    expect(out.toString()).toBe('');
  });
});

describe('applyDirectoryFilters', () => {
  it('sans filtre : tout le monde, dans l ordre', () => {
    expect(ids({})).toEqual(MEMBERS.map((m) => m.userId));
  });

  it('grade : admin stocké, membre sinon ; encadrer quelqu’un ne fait pas un grade (mig. 229)', () => {
    expect(ids({ role: 'admin' })).toEqual(['owner', 'carl']);
    expect(ids({ role: 'member' })).toEqual(['boss', 'ann', 'bob', 'zoe']);
  });

  it('équipe, et une équipe VIDE vide la liste au lieu d être ignorée', () => {
    expect(ids({ teamId: 't1' })).toEqual(['ann', 'zoe']);
    expect(ids({ teamId: 't-empty' })).toEqual([]);
  });

  it('un id d équipe inconnu est ignoré, pas appliqué', () => {
    expect(ids({ teamId: 'ghost' })).toHaveLength(MEMBERS.length);
  });

  it('période d arrivée', () => {
    expect(ids({ joined: '7d' })).toEqual(['ann']);
    expect(ids({ joined: '30d' })).toEqual(['ann', 'zoe']);
    expect(ids({ joined: 'older' })).toEqual(['owner', 'carl']);
  });

  it('filtres ET recherche se combinent (recherche sans accents)', () => {
    expect(ids({ role: 'member', query: 'eric' })).toEqual(['bob']);
    expect(ids({ teamId: 't1', role: 'member', joined: '7d' })).toEqual(['ann']);
  });
});

describe('petits utilitaires', () => {
  it('activeFilterCount ne compte pas la recherche', () => {
    expect(activeFilterCount({ ...EMPTY_DIRECTORY_FILTERS, query: 'x' })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_DIRECTORY_FILTERS, role: 'admin', teamId: 't1', joined: '7d' })).toBe(3);
  });

  it('joinedWithin refuse une date illisible au lieu de la classer', () => {
    expect(joinedWithin('pas une date', '7d', NOW)).toBe(false);
    expect(joinedWithin('pas une date', 'older', NOW)).toBe(false);
  });

  it('directoryRoleOf : un encadrant reste « membre »', () => {
    expect(directoryRoleOf(MEMBERS[1])).toBe('member');
    expect(directoryRoleOf(MEMBERS[0])).toBe('admin');
  });
});
