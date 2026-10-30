// @vitest-environment jsdom
// Rôles personnalisés en démo (mig. 219) : les règles de la base qui se
// voient à l'écran, rejouées sur localStorage.
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageOrgRolesRepository, assignDefaultRoleOnJoin } from './roles.local.repository';
import { ORG_CONFIG_STORAGE_KEYS } from '@/modules/org-config/constants';
import { DEMO_ORG_ID } from './local.repository';
import type { SaveCustomRoleInput } from './roles.types';

const input = (name: string, over: Partial<SaveCustomRoleInput> = {}): SaveCustomRoleInput => ({
  name, color: '#6366f1', grantedKeys: ['okr.create', 'okr.create'], assignTargets: ['self'], ...over,
});

describe('LocalStorageOrgRolesRepository', () => {
  beforeEach(() => localStorage.clear());

  it('sème deux rôles de démonstration, dont un attribué', async () => {
    const repo = new LocalStorageOrgRolesRepository();
    expect((await repo.getRoles(DEMO_ORG_ID)).length).toBe(2);
    expect((await repo.getAssignments(DEMO_ORG_ID)).length).toBeGreaterThan(0);
  });

  it('crée un rôle (nom nettoyé, clés dédoublonnées), refuse un nom en double', async () => {
    const repo = new LocalStorageOrgRolesRepository();
    const created = await repo.createRole(DEMO_ORG_ID, input('  Support  '));
    expect(created.name).toBe('Support');
    expect(created.grantedKeys).toEqual(['okr.create']);
    await expect(repo.createRole(DEMO_ORG_ID, input('support'))).rejects.toMatchObject({ code: '23505' });
  });

  it('rôle par défaut (mig. 230) : posé à l’arrivée, sans limite ; rien si absent ou supprimé', async () => {
    const repo = new LocalStorageOrgRolesRepository();
    const role = await repo.createRole(DEMO_ORG_ID, input('Arrivée'));
    assignDefaultRoleOnJoin(DEMO_ORG_ID, 'newbie');
    expect((await repo.getAssignments(DEMO_ORG_ID)).some((a) => a.userId === 'newbie')).toBe(false);

    localStorage.setItem(ORG_CONFIG_STORAGE_KEYS.settings, JSON.stringify([{ orgId: DEMO_ORG_ID, defaultRoleId: role.id }]));
    assignDefaultRoleOnJoin(DEMO_ORG_ID, 'newbie');
    assignDefaultRoleOnJoin(DEMO_ORG_ID, 'newbie');
    const mine = (await repo.getAssignments(DEMO_ORG_ID)).filter((a) => a.userId === 'newbie');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ roleId: role.id, endsAt: null });

    await repo.deleteRole(role.id);
    assignDefaultRoleOnJoin(DEMO_ORG_ID, 'other');
    expect((await repo.getAssignments(DEMO_ORG_ID)).some((a) => a.userId === 'other')).toBe(false);
  });

  it('attribuer deux fois le même rôle prolonge la même ligne', async () => {
    const repo = new LocalStorageOrgRolesRepository();
    const role = await repo.createRole(DEMO_ORG_ID, input('Support'));
    await repo.assignRole({ orgId: DEMO_ORG_ID, roleId: role.id, userId: 'user-camille', endsAt: '2030-01-01T00:00:00.000Z' });
    await repo.assignRole({ orgId: DEMO_ORG_ID, roleId: role.id, userId: 'user-camille', endsAt: null });
    const mine = (await repo.getAssignments(DEMO_ORG_ID)).filter((a) => a.roleId === role.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].endsAt).toBeNull();
  });

  it('refuse d’attribuer un rôle à un admin', async () => {
    const repo = new LocalStorageOrgRolesRepository();
    const role = await repo.createRole(DEMO_ORG_ID, input('Support'));
    await expect(
      repo.assignRole({ orgId: DEMO_ORG_ID, roleId: role.id, userId: 'demo-user', endsAt: null }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('supprimer un rôle emporte ses attributions', async () => {
    const repo = new LocalStorageOrgRolesRepository();
    const role = await repo.createRole(DEMO_ORG_ID, input('Support'));
    await repo.assignRole({ orgId: DEMO_ORG_ID, roleId: role.id, userId: 'user-camille', endsAt: null });
    await repo.deleteRole(role.id);
    expect((await repo.getAssignments(DEMO_ORG_ID)).some((a) => a.roleId === role.id)).toBe(false);
  });
});
