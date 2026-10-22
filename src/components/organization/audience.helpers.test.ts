import { describe, it, expect } from 'vitest';
import type { OrgMember } from '@/modules/organizations';
import { projectAudience, memberReach } from './audience.helpers';

const m = (userId: string, managerId: string | null, role: 'admin' | 'member' = 'member') =>
  ({ userId, managerId, role, orgId: 'o', displayName: userId }) as unknown as OrgMember;

// admin → boss → lead → dev1, dev2 ; outsider sous admin, hors équipe.
const members = [m('admin', null, 'admin'), m('boss', 'admin'), m('lead', 'boss'), m('dev1', 'lead'), m('dev2', 'lead'), m('outsider', 'admin')];

describe('projectAudience', () => {
  it('sans équipe : toute l organisation', () => {
    expect(projectAudience(members, null)).toEqual({ count: 6, wholeOrg: true });
  });

  it('avec équipe : membres, hiérarchie au-dessus, admins, et personne d autre', () => {
    // dev1 + lead + boss + admin = 4 ; dev2 et outsider n y sont pas.
    expect(projectAudience(members, ['dev1'])).toEqual({ count: 4, wholeOrg: false });
  });

  it('ne compte pas deux fois une chaîne partagée', () => {
    expect(projectAudience(members, ['dev1', 'dev2']).count).toBe(5);
  });

  it('une équipe vide reste lisible par les admins', () => {
    expect(projectAudience(members, []).count).toBe(1);
  });

  it('un cycle dans les données ne boucle pas', () => {
    const cyclic = [m('a', 'b'), m('b', 'a')];
    expect(projectAudience(cyclic, ['a']).count).toBe(2);
  });
});

describe('memberReach', () => {
  const memberships = [{ teamId: 'tA', userId: 'dev1' }, { teamId: 'tB', userId: 'outsider' }];
  const projects = [
    { teamId: null, archivedAt: null },
    { teamId: 'tA', archivedAt: null },
    { teamId: 'tB', archivedAt: null },
    { teamId: null, archivedAt: '2026-01-01' },
  ];
  const okrs = [{ teamIds: [] }, { teamIds: ['tA'] }, { teamIds: ['tB'] }];

  it('compte ce que la personne voit, archives exclues', () => {
    // dev2 : ni dans tA ni au-dessus de dev1, ni dans tB → projets d entreprise seulement.
    expect(memberReach({ member: members[4], members, memberships, projects, okrs })).toEqual({ projects: 1, okrs: 1 });
  });

  it('la hiérarchie au-dessus voit les projets de l équipe', () => {
    // boss est au-dessus de dev1 (tA), pas de outsider (tB).
    expect(memberReach({ member: members[1], members, memberships, projects, okrs })).toEqual({ projects: 2, okrs: 2 });
  });

  it('un admin voit tout', () => {
    expect(memberReach({ member: members[0], members, memberships, projects, okrs })).toEqual({ projects: 3, okrs: 3 });
  });
});
