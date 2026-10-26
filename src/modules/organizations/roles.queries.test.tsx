// @vitest-environment jsdom
// Lectures des rôles personnalisés (mig. 219) : clés, arguments transmis au
// repository, et aucune lecture tant que l'organisation n'est pas connue.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const fakeRepo = {
  getRoles: vi.fn(),
  getAssignments: vi.fn(),
  getMyAssignments: vi.fn(),
};

vi.mock('@/lib/repository.factory', () => ({ getOrgRolesRepository: () => fakeRepo }));

import { rolesKeys, useOrgRoles, useOrgRoleAssignments, useMyOrgRoleAssignments } from './roles.queries';
import type { OrgCustomRole, OrgRoleAssignment } from './roles.types';

const role: OrgCustomRole = {
  id: 'r1', orgId: 'org1', name: 'Pilote', color: '#6366f1', grantedKeys: ['task.create'],
  assignTargets: ['self'], createdBy: 'admin', createdAt: 'c', updatedAt: 'u',
};
const assignment: OrgRoleAssignment = {
  id: 'a1', orgId: 'org1', roleId: 'r1', userId: 'u1', startsAt: 's', endsAt: null, grantedBy: 'admin', createdAt: 'c',
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => {
  Object.values(fakeRepo).forEach((fn) => fn.mockReset());
});

describe('rolesKeys', () => {
  it('toutes les clés vivent sous `all`, l export compris', () => {
    expect(rolesKeys.roles('o')).toEqual(['org-roles', 'roles', 'o']);
    expect(rolesKeys.assignments('o')).toEqual(['org-roles', 'assignments', 'o']);
    expect(rolesKeys.mine()).toEqual(['org-roles', 'mine']);
    for (const key of [rolesKeys.roles('o'), rolesKeys.assignments('o'), rolesKeys.mine()]) {
      expect(key.slice(0, rolesKeys.all.length)).toEqual([...rolesKeys.all]);
    }
  });
});

describe('useOrgRoles', () => {
  it('lit les rôles de l organisation, sous sa clé', async () => {
    fakeRepo.getRoles.mockResolvedValue([role]);
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgRoles('org1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fakeRepo.getRoles).toHaveBeenCalledWith('org1');
    expect(qc.getQueryData(rolesKeys.roles('org1'))).toEqual([role]);
  });

  it('sans organisation : aucune lecture', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgRoles(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fakeRepo.getRoles).not.toHaveBeenCalled();
  });

  it('remonte l erreur', async () => {
    fakeRepo.getRoles.mockRejectedValue(new Error('relation "org_roles" does not exist'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgRoles('org1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useOrgRoleAssignments', () => {
  it('lit les attributions de l organisation, sous sa clé', async () => {
    fakeRepo.getAssignments.mockResolvedValue([assignment]);
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgRoleAssignments('org1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fakeRepo.getAssignments).toHaveBeenCalledWith('org1');
    expect(qc.getQueryData(rolesKeys.assignments('org1'))).toEqual([assignment]);
  });

  it('sans organisation : aucune lecture', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgRoleAssignments(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fakeRepo.getAssignments).not.toHaveBeenCalled();
  });
});

describe('useMyOrgRoleAssignments', () => {
  it('lit mes attributions sans argument, sous rolesKeys.mine()', async () => {
    const mine = [{ ...assignment, roleName: 'Pilote', grantedKeys: ['task.create'] }];
    fakeRepo.getMyAssignments.mockResolvedValue(mine);
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyOrgRoleAssignments(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fakeRepo.getMyAssignments).toHaveBeenCalledWith();
    expect(qc.getQueryData(rolesKeys.mine())).toEqual(mine);
  });

  it('invalider `all` invalide aussi l export', async () => {
    fakeRepo.getMyAssignments.mockResolvedValue([]);
    const { qc, wrapper } = makeWrapper();
    const { result } = renderHook(() => useMyOrgRoleAssignments(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await qc.invalidateQueries({ queryKey: rolesKeys.all });
    await waitFor(() => expect(fakeRepo.getMyAssignments).toHaveBeenCalledTimes(2));
  });
});
