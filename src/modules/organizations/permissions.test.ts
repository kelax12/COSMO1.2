import { describe, it, expect } from 'vitest';
import {
  ORG_PERMISSION_KEYS,
  effectivePermissions,
  effectiveAssignTargets,
  canAssignTo,
  canGrant,
  canEditPermissionsOf,
  canEditTeamTask,
  canDeleteTeamTask,
  type EffectiveOrgPermissions,
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

// Pyramide de référence (dormante depuis la mig. 229 : elle n'ouvre plus rien,
// les tests prouvent justement qu'encadrer quelqu'un ne change aucun droit) :
//   admin ── boss ── alice
//                 └─ bob
//   solo (non placé)
const ADMIN = member('admin', { role: 'admin' });
const BOSS = member('boss');
const ALICE = member('alice', { managerId: 'boss' });
const BOB = member('bob', { managerId: 'boss' });
const CARL = member('carl', { managerId: 'alice' });
const SOLO = member('solo');

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

describe('effectivePermissions — les défauts (mig. 115, puis 152)', () => {
  it('un membre simple crée et modifie des tâches, ne supprime que les siennes (M4)', () => {
    const p = effectivePermissions({ member: CARL });
    expect(p['task.create']).toBe(true);
    expect(p['task.editAny']).toBe(true);
    // mig. 152 : supprimer la tâche d'un autre n'est pas un droit par défaut.
    expect(p['task.deleteAny']).toBe(false);
    expect(p['project.create']).toBe(false);
    // Mig. 153 : modifier un projet est un droit à part, refusé par défaut.
    expect(p['project.edit']).toBe(false);
    expect(p['okr.create']).toBe(false);
    expect(p['category.manage']).toBe(false);
    expect(p['team.create']).toBe(false);
    expect(p['member.invite']).toBe(false);
  });

  it('encadrer quelqu’un ne donne plus rien (mig. 229) : mêmes droits qu’un membre simple', () => {
    expect(effectivePermissions({ member: BOSS })).toEqual(effectivePermissions({ member: CARL }));
    expect(effectivePermissions({ member: ALICE })['project.create']).toBe(false);
  });

  it('rapports (mig. 202) : défaut admin seulement, réglables par surcharge', () => {
    expect(effectivePermissions({ member: CARL })['report.org']).toBe(false);
    expect(effectivePermissions({ member: ALICE })['report.allTeams']).toBe(false);
    const p = effectivePermissions({
      member: CARL,
      overrides: overrides('carl', { overrides: { 'report.allTeams': true } }),
    });
    expect(p['report.allTeams']).toBe(true);
    expect(p['report.org']).toBe(false);
  });

  it('un membre non placé a les mêmes défauts', () => {
    expect(effectivePermissions({ member: SOLO })['project.create']).toBe(false);
  });
});

describe('project.edit (mig. 153)', () => {
  it('se règle indépendamment de project.create', () => {
    const p = effectivePermissions({
      member: CARL,
      overrides: overrides('carl', { overrides: { 'project.edit': true } }),
    });
    expect(p['project.edit']).toBe(true);
    expect(p['project.create']).toBe(false);
  });
});

describe('effectivePermissions — surcharges', () => {
  it('accorde un droit au-delà des défauts à un membre simple', () => {
    const p = effectivePermissions({
      member: CARL,
      overrides: overrides('carl', { overrides: { 'project.create': true } }),
    });
    expect(p['project.create']).toBe(true);
    expect(p['okr.create']).toBe(false);
  });

  it('retire un droit par défaut à un membre', () => {
    const p = effectivePermissions({
      member: ALICE,
      overrides: overrides('alice', { overrides: { 'task.editAny': false, 'project.create': true } }),
    });
    expect(p['task.editAny']).toBe(false);
    expect(p['project.create']).toBe(true);
  });

  it('null = pas de décision, on retombe sur le défaut', () => {
    const p = effectivePermissions({
      member: CARL,
      overrides: overrides('carl', { overrides: { 'project.create': null } }),
    });
    expect(p['project.create']).toBe(false);
  });

  it('un admin garde TOUT même surchargé à false — sinon l’org se bloque', () => {
    const p = effectivePermissions({
      member: ADMIN,
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
    canAssignTo({ actor, target, targets });

  it('« personne » ne laisse passer personne, pas même soi', () => {
    expect(assign(ALICE, ALICE, [])).toBe(false);
    expect(assign(ALICE, BOB, [])).toBe(false);
  });

  it('« soi » n’autorise que soi-même', () => {
    expect(assign(ALICE, ALICE, ['self'])).toBe(true);
    expect(assign(ALICE, BOB, ['self'])).toBe(false);
  });

  it('« tout le monde » court-circuite le reste', () => {
    expect(assign(CARL, BOSS, ['everyone'])).toBe(true);
  });

  it('le supérieur direct n’est pas une cible à part (mig. 229)', () => {
    expect(assign(CARL, ALICE, ['self'])).toBe(false);
    expect(assign(CARL, ALICE, ['self', 'everyone'])).toBe(true);
  });
});

describe('canGrant — plafond du délégant', () => {
  it('un non-admin n’accorde pas un droit qu’il n’a pas', () => {
    const carlPerms = effectivePermissions({ member: CARL });
    expect(canGrant(carlPerms, false, 'project.create')).toBe(false);
    expect(canGrant(carlPerms, false, 'task.create')).toBe(true);
  });

  it('un admin n’est plafonné par rien', () => {
    const carlPerms = effectivePermissions({ member: CARL });
    expect(canGrant(carlPerms, true, 'project.create')).toBe(true);
  });
});

describe('canEditPermissionsOf', () => {
  it('un admin édite n’importe quel non-admin', () => {
    expect(canEditPermissionsOf({ actorId: 'admin', actorIsAdmin: true, target: SOLO })).toBe(true);
  });

  it('personne n’édite un admin — il détient tout par construction', () => {
    expect(canEditPermissionsOf({ actorId: 'boss', actorIsAdmin: true, target: ADMIN })).toBe(false);
  });

  it('un supérieur hiérarchique n’édite plus la fiche de son sous-arbre (mig. 229)', () => {
    expect(canEditPermissionsOf({ actorId: 'boss', actorIsAdmin: false, target: CARL })).toBe(false);
    expect(canEditPermissionsOf({ actorId: 'boss', actorIsAdmin: false, target: BOB })).toBe(false);
  });

  it('jamais sur soi-même', () => {
    expect(canEditPermissionsOf({ actorId: 'boss', actorIsAdmin: true, target: BOSS })).toBe(false);
  });
});

// ─── Droits sur UNE tâche (cohérence globale, 2026-09-25) ─────────────
// Miroirs de `team_tasks_update` (mig. 115) et `delete_team_task` (mig. 152) :
// sans eux, l'interface proposait des gestes que le serveur refusait après coup.
describe('canEditTeamTask / canDeleteTeamTask', () => {
  const none = Object.fromEntries(ORG_PERMISSION_KEYS.map((k) => [k, false])) as EffectiveOrgPermissions;
  const task = { createdBy: 'author', assigneeIds: ['doer'] };

  it('modifier : créateur, assigné, ou task.editAny ; personne d autre', () => {
    expect(canEditTeamTask(none, 'author', task)).toBe(true);
    expect(canEditTeamTask(none, 'doer', task)).toBe(true);
    expect(canEditTeamTask(none, 'stranger', task)).toBe(false);
    expect(canEditTeamTask({ ...none, 'task.editAny': true }, 'stranger', task)).toBe(true);
    expect(canEditTeamTask(none, undefined, task)).toBe(false);
  });

  it('supprimer : créateur ou task.deleteAny — un assigné NE supprime PAS', () => {
    expect(canDeleteTeamTask(none, 'author', task)).toBe(true);
    expect(canDeleteTeamTask(none, 'doer', task)).toBe(false);
    expect(canDeleteTeamTask({ ...none, 'task.deleteAny': true }, 'doer', task)).toBe(true);
  });
});

describe('rôles personnalisés (mig. 219) : le rôle écrase tout, les rôles s’additionnent', () => {
  const STAGIAIRE = { grantedKeys: ['okr.create'] as const, assignTargets: ['self'] as const };
  const CHEF = { grantedKeys: ['project.create', 'report.org'] as const, assignTargets: ['everyone'] as const };

  it('role.manage : défaut admin seulement, réglable par surcharge', () => {
    expect(effectivePermissions({ member: BOSS })['role.manage']).toBe(false);
    expect(effectivePermissions({ member: ADMIN })['role.manage']).toBe(true);
    const granted = effectivePermissions({
      member: CARL, overrides: overrides('carl', { overrides: { 'role.manage': true } }),
    });
    expect(granted['role.manage']).toBe(true);
  });

  it('un rôle actif retire même un droit par défaut de membre', () => {
    const p = effectivePermissions({ member: CARL, roles: [STAGIAIRE] });
    expect(p['task.create']).toBe(false);
    expect(p['task.editAny']).toBe(false);
    expect(p['okr.create']).toBe(true);
  });

  it('un rôle actif prime sur la surcharge individuelle', () => {
    const p = effectivePermissions({
      member: CARL,
      overrides: overrides('carl', { overrides: { 'project.create': true } }),
      roles: [STAGIAIRE],
    });
    expect(p['project.create']).toBe(false);
  });

  it('deux rôles : un droit accordé par l’un suffit', () => {
    const p = effectivePermissions({ member: CARL, roles: [STAGIAIRE, CHEF] });
    expect(p['okr.create']).toBe(true);
    expect(p['project.create']).toBe(true);
    expect(p['report.org']).toBe(true);
    expect(p['report.allTeams']).toBe(false);
  });

  it('sans rôle actif, rien ne change (liste vide)', () => {
    expect(effectivePermissions({ member: CARL, roles: [] }))
      .toEqual(effectivePermissions({ member: CARL }));
  });

  it('un admin reste insensible à un rôle', () => {
    const p = effectivePermissions({ member: ADMIN, roles: [STAGIAIRE] });
    for (const key of ORG_PERMISSION_KEYS) expect(p[key]).toBe(true);
    expect(effectiveAssignTargets({ member: ADMIN, roles: [STAGIAIRE] })).toEqual(['everyone']);
  });

  it('portée : union des rôles actifs, prioritaire sur la surcharge', () => {
    expect(effectiveAssignTargets({
      member: CARL,
      overrides: overrides('carl', { assignTargets: [] }),
      roles: [STAGIAIRE, CHEF],
    })).toEqual(['self', 'everyone']);
  });

  it('un rôle à la portée vide ne laisse assigner à personne', () => {
    expect(effectiveAssignTargets({ member: CARL, roles: [{ grantedKeys: [], assignTargets: [] }] })).toEqual([]);
  });
});
