import { describe, it, expect } from 'vitest';
import type { OrgMember } from '@/modules/organizations';
import { visibilityOf } from './visibility.helpers';

const m = (userId: string, over: Partial<OrgMember> = {}): OrgMember =>
  ({ userId, orgId: 'o', displayName: userId, role: 'member', joinedAt: '', managerId: null, ...over }) as OrgMember;

// boss ← lead ← dev ; admin à part ; ext hors de tout
const members = [
  m('boss'), m('lead', { managerId: 'boss' }), m('dev', { managerId: 'lead' }),
  m('admin', { role: 'admin' }), m('ext'), m('gone', { suspendedAt: '2026-09-01' }),
];
const memberships = [{ teamId: 't1', userId: 'dev' }, { teamId: 't1', userId: 'gone' }];

describe('visibilityOf', () => {
  it('sans équipe : tout membre ACTIF', () => {
    const v = visibilityOf({ members, teamIds: [], memberships });
    expect(v.wholeOrg).toBe(true);
    expect(v.viewers.size).toBe(5);
    expect(v.viewers.has('gone')).toBe(false);
  });

  it('avec une équipe : membres, hiérarchie, admins, chacun avec sa raison', () => {
    const v = visibilityOf({ members, teamIds: ['t1'], memberships });
    expect(Object.fromEntries(v.viewers)).toEqual({ dev: 'team', lead: 'hierarchy', boss: 'hierarchy', admin: 'admin' });
  });

  it('un membre direct de projet voit, un membre hors équipe non', () => {
    const v = visibilityOf({ members, teamIds: ['t1'], memberships, directIds: ['ext'] });
    expect(v.viewers.get('ext')).toBe('direct');
    expect(visibilityOf({ members, teamIds: ['t1'], memberships }).viewers.has('ext')).toBe(false);
  });

  it('un manager suspendu ne coupe pas la chaîne au-dessus de lui', () => {
    const chain = [m('top'), m('mid', { managerId: 'top', suspendedAt: 'x' }), m('dev', { managerId: 'mid' })];
    const v = visibilityOf({ members: chain, teamIds: ['t1'], memberships: [{ teamId: 't1', userId: 'dev' }] });
    expect(v.viewers.has('mid')).toBe(false);
    expect(v.viewers.get('top')).toBe('hierarchy');
  });
  // Mig. 205 : « Personnaliser » et OKR fermés.
  it('OKR fermé sans aucun lien : jamais toute l’entreprise, les admins seuls', () => {
    const v = visibilityOf({ members, teamIds: [], memberships, closed: true });
    expect(v.wholeOrg).toBe(false);
    expect(Object.fromEntries(v.viewers)).toEqual({ admin: 'admin' });
  });

  it('personne nommée : elle et sa hiérarchie voient, pas les autres', () => {
    const v = visibilityOf({ members, teamIds: [], memberships, closed: true, namedIds: ['dev'] });
    expect(Object.fromEntries(v.viewers)).toEqual({ dev: 'direct', lead: 'hierarchy', boss: 'hierarchy', admin: 'admin' });
    expect(v.viewers.has('ext')).toBe(false);
  });

  it('une personne nommée mais suspendue ne voit pas', () => {
    const v = visibilityOf({ members, teamIds: [], memberships, closed: true, namedIds: ['gone'] });
    expect(v.viewers.has('gone')).toBe(false);
  });
});
