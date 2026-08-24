import { describe, it, expect } from 'vitest';
import {
  ORG_PERMISSION_KEYS,
  effectivePermissions,
  effectiveAssignTargets,
  canAssignTo,
  canGrant,
  canEditPermissionsOf,
  type OrgMemberPermissions,
} from './permissions';
import type { OrgMember } from './types';

const member = (userId: string, over: Partial<OrgMember> = {}): OrgMember => ({
  orgId: 'org',
  userId,
  role: 'member',
  joinedAt: '2026-01-01',
  displayName: userId,
  managerId: null,
  ...over,
});

// Pyramide de référence :
//   admin ── boss ── alice
//                 └─ bob        (alice et bob sont pairs)
//   solo (non placé)
const ADMIN = member('admin', { role: 'admin' });
const BOSS = member('boss');
const ALICE = member('alice', { managerId: 'boss' });
const BOB = member('bob', { managerId: 'boss' });
const CARL = member('carl', { managerId: 'alice' });
const SOLO = member('solo');
const MEMBERS = [ADMIN, BOSS, ALICE, BOB, CARL, SOLO];

const overrides = (
  userId: string,
  patch: Partial<OrgMemberPermissions>,
): OrgMemberPermissions => ({
  orgId: 'org',
  userId,
  overrides: {},
  assignTargets: null,
  ...patch,
});

describe('effectivePermissions — les défauts reproduisent l’avant-migration 115', () => {
  it('un membre simple crée/modifie/supprime des tâches, rien d’autre', () => {
    const p = effectivePermissions({ member: CARL, members: MEMBERS });
    expect(p['task.create']).toBe(true);
    expect(p['task.editAny']).toBe(true);
    expect(p['task.deleteAny']).toBe(true);
    expect(p['project.create']).toBe(false);
    expect(p['okr.create']).toBe(false);
    expect(p['category.manage']).toBe(false);
    expect(p['team.create']).toBe(false);
    expect(p['member.invite']).toBe(false);
  });

  it('un manager (≥ 1 subordonné) a tout, comme is_org_manager()', () => {
    const p = effectivePermissions({ member: ALICE, members: MEMBERS });
    for (const key of ORG_PERMISSION_KEYS) expect(p[key]).toBe(true);
  });

  it('un membre non placé n’est pas manager', () => {
    expect(effectivePermissions({ member: SOLO, members: MEMBERS })['project.create']).toBe(false);
  });
});

describe('effectivePermissions — surcharges', () => {
  it('accorde un droit de manager à un membre simple', () => {
    const p = effectivePermissions({
      member: CARL,
      members: MEMBERS,
      overrides: overrides('carl', { overrides: { 'project.create': true } }),
    });
    expect(p['project.create']).toBe(true);
    expect(p['okr.create']).toBe(false);
  });

  it('retire un droit à un manager', () => {
    const p = effectivePermissions({
      member: ALICE,
      members: MEMBERS,
      overrides: overrides('alice', { overrides: { 'project.delete': false } }),
    });
    expect(p['project.delete']).toBe(false);
    expect(p['project.create']).toBe(true);
  });

  it('null = pas de décision, on retombe sur le défaut', () => {
    const p = effectivePermissions({
      member: CARL,
      members: MEMBERS,
      overrides: overrides('carl', { overrides: { 'project.create': null } }),
    });
    expect(p['project.create']).toBe(false);
  });

  it('un admin garde TOUT même surchargé à false — sinon l’org se bloque', () => {
    const p = effectivePermissions({
      member: ADMIN,
      members: MEMBERS,
      overrides: overrides('admin', {
        overrides: { 'project.create': false, 'task.create': false },
      }),
    });
    for (const key of ORG_PERMISSION_KEYS) expect(p[key]).toBe(true);
  });
});

describe('effectiveAssignTargets', () => {
  it('sans surcharge : tout le monde (comportement historique)', () => {
    expect(effectiveAssignTargets({ member: CARL })).toEqual(['everyone']);
  });

  it('un tableau vide est une décision — « personne »', () => {
    expect(
      effectiveAssignTargets({ member: CARL, overrides: overrides('carl', { assignTargets: [] }) }),
    ).toEqual([]);
  });

  it('un admin n’est jamais restreint', () => {
    expect(
      effectiveAssignTargets({ member: ADMIN, overrides: overrides('admin', { assignTargets: [] }) }),
    ).toEqual(['everyone']);
  });
});

describe('canAssignTo', () => {
  const assign = (actor: OrgMember, target: OrgMember, targets: Parameters<typeof canAssignTo>[0]['targets']) =>
    canAssignTo({ actor, target, members: MEMBERS, targets });

  it('« personne » ne laisse passer personne, pas même soi', () => {
    expect(assign(ALICE, ALICE, [])).toBe(false);
    expect(assign(ALICE, BOB, [])).toBe(false);
  });

  it('« soi » n’autorise que soi-même', () => {
    expect(assign(ALICE, ALICE, ['self'])).toBe(true);
    expect(assign(ALICE, BOB, ['self'])).toBe(false);
  });

  it('« même niveau » = même supérieur direct, jamais soi-même', () => {
    expect(assign(ALICE, BOB, ['peers'])).toBe(true);
    expect(assign(ALICE, ALICE, ['peers'])).toBe(false);
    expect(assign(ALICE, BOSS, ['peers'])).toBe(false);
  });

  it('deux membres non placés ne sont PAS des pairs', () => {
    expect(assign(SOLO, BOSS, ['peers'])).toBe(false);
  });

  it('« manager direct » ne remonte que d’un cran', () => {
    expect(assign(CARL, ALICE, ['manager'])).toBe(true);
    expect(assign(CARL, BOSS, ['manager'])).toBe(false);
  });

  it('« subordonnés » couvre tout le sous-arbre, pas seulement les directs', () => {
    expect(assign(BOSS, ALICE, ['subordinates'])).toBe(true);
    expect(assign(BOSS, CARL, ['subordinates'])).toBe(true);
    expect(assign(ALICE, BOSS, ['subordinates'])).toBe(false);
  });

  it('« tout le monde » court-circuite le reste', () => {
    expect(assign(CARL, BOSS, ['everyone'])).toBe(true);
  });

  it('les cibles se cumulent', () => {
    expect(assign(CARL, CARL, ['self', 'manager'])).toBe(true);
    expect(assign(CARL, ALICE, ['self', 'manager'])).toBe(true);
    expect(assign(CARL, BOB, ['self', 'manager'])).toBe(false);
  });
});

describe('canGrant — plafond du délégant', () => {
  it('un manager n’accorde pas un droit qu’il n’a pas', () => {
    const carlPerms = effectivePermissions({ member: CARL, members: MEMBERS });
    expect(canGrant(carlPerms, false, 'project.create')).toBe(false);
    expect(canGrant(carlPerms, false, 'task.create')).toBe(true);
  });

  it('un admin n’est plafonné par rien', () => {
    const carlPerms = effectivePermissions({ member: CARL, members: MEMBERS });
    expect(canGrant(carlPerms, true, 'project.create')).toBe(true);
  });
});

describe('canEditPermissionsOf', () => {
  it('un admin édite n’importe quel non-admin', () => {
    expect(canEditPermissionsOf({ actorId: 'admin', actorIsAdmin: true, target: SOLO, members: MEMBERS })).toBe(true);
  });

  it('personne n’édite un admin — il détient tout par construction', () => {
    expect(canEditPermissionsOf({ actorId: 'boss', actorIsAdmin: true, target: ADMIN, members: MEMBERS })).toBe(false);
  });

  it('un manager édite son sous-arbre, pas au-delà', () => {
    expect(canEditPermissionsOf({ actorId: 'boss', actorIsAdmin: false, target: CARL, members: MEMBERS })).toBe(true);
    expect(canEditPermissionsOf({ actorId: 'alice', actorIsAdmin: false, target: BOB, members: MEMBERS })).toBe(false);
  });

  it('jamais sur soi-même', () => {
    expect(canEditPermissionsOf({ actorId: 'boss', actorIsAdmin: true, target: BOSS, members: MEMBERS })).toBe(false);
  });
});
