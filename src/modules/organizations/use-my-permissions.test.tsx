// @vitest-environment jsdom
// `useMyOrgPermissions` : le SEUL point d'entrée des composants pour « ai-je
// le droit de… ». Il compose quatre lectures (annuaire, surcharges, rôles,
// attributions) et lit l'identité par `useAuth`. Ordre de résolution, non
// admin : rôles actifs > fiche individuelle > défaut dérivé.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const orgRepo = { getMembers: vi.fn(), getMemberPermissions: vi.fn() };
const rolesRepo = { getRoles: vi.fn(), getAssignments: vi.fn() };
const auth = vi.hoisted(() => ({ user: { id: 'me' } as { id: string } | null }));

vi.mock('@/lib/repository.factory', () => ({
  getOrganizationsRepository: () => orgRepo,
  getOrgRolesRepository: () => rolesRepo,
}));
vi.mock('@/modules/auth/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

import { useMyOrgPermissions } from './use-my-permissions';
import { ORG_PERMISSION_KEYS } from './permissions';
import type { OrgMemberPermissions } from './permissions';
import type { OrgMember } from './types';
import type { OrgCustomRole, OrgRoleAssignment } from './roles.types';

const ORG = 'org1';
const mk = (userId: string, over: Partial<OrgMember> = {}): OrgMember => ({
  orgId: ORG, userId, role: 'member', joinedAt: '', displayName: userId, managerId: null, ...over,
});
// admin ─ boss ─┬─ me ─ sub
//               └─ peer
// outsider : non placé
const MEMBERS = [
  mk('admin', { role: 'admin' }),
  mk('boss', { managerId: 'admin' }),
  mk('me', { managerId: 'boss' }),
  mk('peer', { managerId: 'boss' }),
  mk('sub', { managerId: 'me' }),
  mk('outsider'),
];
const override = (over: Partial<OrgMemberPermissions> = {}): OrgMemberPermissions => ({
  orgId: ORG, userId: 'me', overrides: {}, assignTargets: null, ...over,
});
const role = (id: string, over: Partial<OrgCustomRole> = {}): OrgCustomRole => ({
  id, orgId: ORG, name: id, color: '#6366f1', grantedKeys: [], assignTargets: [],
  createdBy: 'admin', createdAt: '', updatedAt: '', ...over,
});
const assign = (roleId: string, over: Partial<OrgRoleAssignment> = {}): OrgRoleAssignment => ({
  id: `a-${roleId}`, orgId: ORG, roleId, userId: 'me', startsAt: '2000-01-01T00:00:00Z', endsAt: null,
  grantedBy: 'admin', createdAt: '', ...over,
});

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

async function renderLoaded(orgId: string | undefined) {
  const { wrapper } = makeWrapper();
  const hook = renderHook(() => useMyOrgPermissions(orgId), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook.result;
}

beforeEach(() => {
  [...Object.values(orgRepo), ...Object.values(rolesRepo)].forEach((fn) => fn.mockReset());
  auth.user = { id: 'me' };
  orgRepo.getMembers.mockResolvedValue(MEMBERS);
  orgRepo.getMemberPermissions.mockResolvedValue([]);
  rolesRepo.getRoles.mockResolvedValue([]);
  rolesRepo.getAssignments.mockResolvedValue([]);
});

describe('useMyOrgPermissions · chargement et identité', () => {
  it('pendant le chargement : tout est permis, isLoading vrai', () => {
    orgRepo.getMembers.mockReturnValue(new Promise(() => {}));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyOrgPermissions(ORG), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(ORG_PERMISSION_KEYS.every((k) => result.current.can[k])).toBe(true);
    expect(result.current.canAssign('anyone')).toBe(true);
    expect(result.current.activeRoles).toEqual([]);
  });

  it('lit les quatre sources pour l organisation demandée', async () => {
    await renderLoaded(ORG);
    expect(orgRepo.getMembers).toHaveBeenCalledWith(ORG);
    expect(orgRepo.getMemberPermissions).toHaveBeenCalledWith(ORG);
    expect(rolesRepo.getRoles).toHaveBeenCalledWith(ORG);
    expect(rolesRepo.getAssignments).toHaveBeenCalledWith(ORG);
  });

  it('sans organisation : aucune lecture', async () => {
    await renderLoaded(undefined);
    expect(orgRepo.getMembers).not.toHaveBeenCalled();
    expect(rolesRepo.getRoles).not.toHaveBeenCalled();
  });

  it('identité absente de l annuaire, ou pas connecté : rien n est contraint (le serveur tranche)', async () => {
    auth.user = { id: 'stranger' };
    let result = await renderLoaded(ORG);
    expect(ORG_PERMISSION_KEYS.every((k) => result.current.can[k])).toBe(true);
    expect(result.current.assignableMembers).toEqual(MEMBERS);

    auth.user = null;
    result = await renderLoaded(ORG);
    expect(result.current.can['role.manage']).toBe(true);
  });
});

describe('useMyOrgPermissions · résolution', () => {
  it('membre sans fiche qui encadre sub : défauts de membre seulement (mig. 229)', async () => {
    const result = await renderLoaded(ORG);
    const { can } = result.current;
    expect(can['task.create']).toBe(true);
    expect(can['task.editAny']).toBe(true);
    // Encadrer quelqu'un n'ouvre plus aucun droit.
    expect(can['project.create']).toBe(false);
    expect(can['member.invite']).toBe(false);
    expect(can['report.org']).toBe(false);
    expect(can['role.manage']).toBe(false);
    expect(result.current.assignTargets).toEqual(['everyone']);
  });

  it('membre sans subordonné : mêmes défauts', async () => {
    auth.user = { id: 'peer' };
    const { can } = (await renderLoaded(ORG)).current;
    expect(can['task.create']).toBe(true);
    expect(can['project.create']).toBe(false);
    expect(can['task.deleteAny']).toBe(false);
  });

  it('admin : tout, même avec une fiche ou un rôle restrictif', async () => {
    auth.user = { id: 'admin' };
    orgRepo.getMemberPermissions.mockResolvedValue([override({ userId: 'admin', overrides: { 'task.create': false } })]);
    rolesRepo.getRoles.mockResolvedValue([role('r1')]);
    rolesRepo.getAssignments.mockResolvedValue([assign('r1', { userId: 'admin' })]);
    const result = await renderLoaded(ORG);
    expect(ORG_PERMISSION_KEYS.every((k) => result.current.can[k])).toBe(true);
    expect(result.current.assignTargets).toEqual(['everyone']);
  });

  it('fiche individuelle : ses décisions priment sur le défaut ; seule MA ligne est lue', async () => {
    orgRepo.getMemberPermissions.mockResolvedValue([
      override({ userId: 'peer', overrides: { 'task.create': false } }),
      override({ overrides: { 'project.create': true, 'report.org': true }, assignTargets: ['self'] }),
    ]);
    const result = await renderLoaded(ORG);
    expect(result.current.can['task.create']).toBe(true);
    expect(result.current.can['project.create']).toBe(true);
    expect(result.current.can['report.org']).toBe(true);
    expect(result.current.assignTargets).toEqual(['self']);
  });

  it('rôle actif : écrase fiche et défaut, une clé absente est refusée', async () => {
    orgRepo.getMemberPermissions.mockResolvedValue([override({ overrides: { 'task.create': true } })]);
    rolesRepo.getRoles.mockResolvedValue([role('r1', { grantedKeys: ['okr.create'], assignTargets: ['self'] })]);
    rolesRepo.getAssignments.mockResolvedValue([assign('r1')]);
    const result = await renderLoaded(ORG);
    expect(result.current.activeRoles.map((r) => r.id)).toEqual(['r1']);
    expect(result.current.can['okr.create']).toBe(true);
    expect(result.current.can['task.create']).toBe(false);
    expect(result.current.assignTargets).toEqual(['self']);
  });

  it('rôle échu, futur, ou attribué à un autre : ignoré', async () => {
    rolesRepo.getRoles.mockResolvedValue([role('r1'), role('r2'), role('r3')]);
    rolesRepo.getAssignments.mockResolvedValue([
      assign('r1', { endsAt: '2001-01-01T00:00:00Z' }),
      assign('r2', { startsAt: '2999-01-01T00:00:00Z' }),
      assign('r3', { userId: 'peer' }),
    ]);
    const result = await renderLoaded(ORG);
    expect(result.current.activeRoles).toEqual([]);
    expect(result.current.can['task.create']).toBe(true);
  });

  it('lecture des rôles en échec (mig. 219 absente) : retombe sur fiche et défaut', async () => {
    rolesRepo.getRoles.mockRejectedValue(new Error('relation "org_roles" does not exist'));
    rolesRepo.getAssignments.mockRejectedValue(new Error('relation "org_member_roles" does not exist'));
    const result = await renderLoaded(ORG);
    expect(result.current.activeRoles).toEqual([]);
    expect(result.current.can['task.create']).toBe(true);
    expect(result.current.can['role.manage']).toBe(false);
  });
});

describe('useMyOrgPermissions · assignation et tâches', () => {
  it('portée self : canAssign et assignableMembers concordent, le subordonné n’est pas une cible (mig. 229)', async () => {
    orgRepo.getMemberPermissions.mockResolvedValue([override({ assignTargets: ['self'] })]);
    const result = await renderLoaded(ORG);
    expect(result.current.canAssign('me')).toBe(true);
    expect(result.current.canAssign('sub')).toBe(false);
    expect(result.current.canAssign('boss')).toBe(false);
    expect(result.current.assignableMembers.map((m) => m.userId)).toEqual(['me']);
  });

  it('portée [] (personne) : personne, pas même soi', async () => {
    orgRepo.getMemberPermissions.mockResolvedValue([override({ assignTargets: [] })]);
    const result = await renderLoaded(ORG);
    expect(result.current.canAssign('me')).toBe(false);
    expect(result.current.assignableMembers).toEqual([]);
  });

  it('cible inconnue de l annuaire : refusée, même avec « everyone »', async () => {
    const result = await renderLoaded(ORG);
    expect(result.current.canAssign('ghost')).toBe(false);
  });

  it('canEditTask / canDeleteTask : créateur ou assigné, sinon le droit « Any »', async () => {
    orgRepo.getMemberPermissions.mockResolvedValue([
      override({ overrides: { 'task.editAny': false, 'task.deleteAny': false } }),
    ]);
    const result = await renderLoaded(ORG);
    const mine = { createdBy: 'me', assigneeIds: [] };
    const assigned = { createdBy: 'boss', assigneeIds: ['me'] };
    const other = { createdBy: 'boss', assigneeIds: ['peer'] };
    expect(result.current.canEditTask(mine)).toBe(true);
    expect(result.current.canEditTask(assigned)).toBe(true);
    expect(result.current.canEditTask(other)).toBe(false);
    expect(result.current.canDeleteTask(mine)).toBe(true);
    expect(result.current.canDeleteTask(assigned)).toBe(false);
    expect(result.current.canDeleteTask(other)).toBe(false);
  });
});
