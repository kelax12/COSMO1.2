import { describe, it, expect } from 'vitest';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam, OrgTeamMember } from '@/modules/org-teams';
import {
  canManageTeam,
  canUseBulkActions,
  managerDestinations,
  manageableTeams,
  partitionForManager,
  partitionForTeam,
} from './member-bulk.helpers';

const mk = (userId: string, over: Partial<OrgMember> = {}): OrgMember => ({
  orgId: 'o', userId, role: 'member', joinedAt: '2026-01-01T00:00:00Z', displayName: userId, managerId: null, ...over,
});

// admin ─ boss ─ ann ─ kid ; bob sous admin (pair de boss) ; zoe non placée
const MEMBERS = [
  mk('admin', { role: 'admin' }),
  mk('boss', { managerId: 'admin' }),
  mk('ann', { managerId: 'boss' }),
  mk('kid', { managerId: 'ann' }),
  mk('bob', { managerId: 'admin' }),
  mk('zoe'),
];
const byId = (id: string) => MEMBERS.find((m) => m.userId === id) as OrgMember;
const sel = (...ids: string[]) => ids.map(byId);
const uids = (list: OrgMember[]) => list.map((m) => m.userId);

const team = (id: string, createdBy: string | null = 'admin'): OrgTeam => ({
  id, orgId: 'o', name: id, color: '#000', createdBy, createdAt: '2026-01-01T00:00:00Z',
});
const MEMBERSHIPS: OrgTeamMember[] = [
  { teamId: 'led', orgId: 'o', userId: 'boss', isLead: true },
  { teamId: 'led', orgId: 'o', userId: 'ann', isLead: false },
];

const ADMIN = { currentUserId: 'admin', isAdmin: true };
const BOSS = { currentUserId: 'boss', isAdmin: false };
const ZOE = { currentUserId: 'zoe', isAdmin: false };

describe('canManageTeam · miroir de can_manage_team', () => {
  it('admin, créateur, responsable ; personne d autre', () => {
    expect(canManageTeam(team('x'), [], ADMIN)).toBe(true);
    expect(canManageTeam(team('x', 'boss'), [], BOSS)).toBe(true);
    expect(canManageTeam(team('led'), MEMBERSHIPS, BOSS)).toBe(true);
    expect(canManageTeam(team('x'), MEMBERSHIPS, BOSS)).toBe(false);
    expect(manageableTeams([team('x'), team('led')], MEMBERSHIPS, BOSS).map((t) => t.id)).toEqual(['led']);
  });
});

describe('partitionForTeam · miroir de org_team_members_insert', () => {
  it('admin : tout le monde sauf ceux déjà dedans', () => {
    const p = partitionForTeam(sel('ann', 'bob', 'zoe'), team('led'), MEMBERSHIPS, MEMBERS, ADMIN);
    expect(uids(p.eligible)).toEqual(['bob', 'zoe']);
    expect(uids(p.unchanged)).toEqual(['ann']);
    expect(p.outOfScope).toEqual([]);
  });

  it('responsable non admin : soi et son sous-arbre, jamais un pair', () => {
    const p = partitionForTeam(sel('boss', 'kid', 'bob', 'zoe'), team('led'), MEMBERSHIPS, MEMBERS, BOSS);
    expect(uids(p.unchanged)).toEqual(['boss']);
    expect(uids(p.eligible)).toEqual(['kid']);
    expect(uids(p.outOfScope)).toEqual(['bob', 'zoe']);
  });

  it('une équipe que l on ne gère pas : personne n est éligible', () => {
    const p = partitionForTeam(sel('kid'), team('x'), MEMBERSHIPS, MEMBERS, BOSS);
    expect(uids(p.outOfScope)).toEqual(['kid']);
  });
});

describe('partitionForManager · miroir de set_member_manager', () => {
  it('manager : ne déplace que son sous-arbre, et jamais sous un de ses descendants', () => {
    const p = partitionForManager(sel('ann', 'kid', 'bob', 'boss'), 'boss', MEMBERS, BOSS);
    expect(uids(p.unchanged)).toEqual(['ann']);
    expect(uids(p.eligible)).toEqual(['kid']);
    // bob : hors sous-arbre ; boss : lui-même.
    expect(uids(p.outOfScope)).toEqual(['bob', 'boss']);
  });

  it('cycle refusé : ann ne passe pas sous kid, son propre subordonné', () => {
    expect(uids(partitionForManager(sel('ann'), 'kid', MEMBERS, ADMIN).outOfScope)).toEqual(['ann']);
  });

  it('détacher (null) : admin seulement, et un non placé est déjà « inchangé »', () => {
    const p = partitionForManager(sel('bob', 'zoe'), null, MEMBERS, ADMIN);
    expect(uids(p.eligible)).toEqual(['bob']);
    expect(uids(p.unchanged)).toEqual(['zoe']);
    expect(uids(partitionForManager(sel('kid'), null, MEMBERS, BOSS).outOfScope)).toEqual(['kid']);
  });

  it('un manager ne rattache pas sous quelqu un hors de son périmètre', () => {
    expect(uids(partitionForManager(sel('kid'), 'bob', MEMBERS, BOSS).outOfScope)).toEqual(['kid']);
  });
});

describe('managerDestinations et canUseBulkActions', () => {
  it('admin : tout le monde ; manager : lui et son sous-arbre', () => {
    expect(managerDestinations(MEMBERS, ADMIN)).toHaveLength(MEMBERS.length);
    expect(uids(managerDestinations(MEMBERS, BOSS))).toEqual(['boss', 'ann', 'kid']);
  });

  it('un membre sans subordonné ni équipe gérée n a pas de mode sélection', () => {
    expect(canUseBulkActions(MEMBERS, [], [], ZOE)).toBe(false);
    expect(canUseBulkActions(MEMBERS, [team('z', 'zoe')], [], ZOE)).toBe(true);
    expect(canUseBulkActions(MEMBERS, [], [], BOSS)).toBe(true);
    expect(canUseBulkActions(MEMBERS, [], [], ADMIN)).toBe(true);
  });
});
