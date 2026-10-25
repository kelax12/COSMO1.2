// Surcharges de permissions par membre (mig. 115). La table de
// correspondance clé ↔ colonne est AUSSI la whitelist d'écriture : ces tests
// échouent si une clé inconnue de l'objet reçu part vers la base, ou si une
// colonne absente se lit comme un refus au lieu de « suit le défaut ».
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

const state = vi.hoisted(() => ({ configured: true }));

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return {
    get supabase() {
      return state.configured ? mock.client : null;
    },
  };
});

import { getMemberPermissions, setMemberPermissions } from './permissions.supabase.repository';
import { ORG_PERMISSION_KEYS, type OrgPermissionKey, type SetOrgPermissionsInput } from './permissions';

const COLUMNS: Record<OrgPermissionKey, string> = {
  'task.create': 'can_create_task',
  'task.editAny': 'can_edit_any_task',
  'task.deleteAny': 'can_delete_task',
  'project.create': 'can_create_project',
  'project.edit': 'can_edit_project',
  'project.delete': 'can_delete_project',
  'okr.create': 'can_create_okr',
  'okr.delete': 'can_delete_okr',
  'category.manage': 'can_manage_category',
  'team.create': 'can_create_team',
  'member.invite': 'can_invite_member',
  'report.org': 'can_view_org_report',
  'report.allTeams': 'can_view_all_team_reports',
  'role.manage': 'can_manage_roles',
};

const allNull = (): Record<OrgPermissionKey, null> =>
  Object.fromEntries(ORG_PERMISSION_KEYS.map((k) => [k, null])) as Record<OrgPermissionKey, null>;

const DB_ERROR = { message: 'permission denied', code: '42501' };

beforeEach(() => {
  supabaseMock.reset();
  state.configured = true;
});

describe('getMemberPermissions', () => {
  it('lit org_member_permissions filtrée par org_id', async () => {
    supabaseMock.queueTable('org_member_permissions', { data: [] });
    expect(await getMemberPermissions('org1')).toEqual([]);
    expect(supabaseMock.callsFor('org_member_permissions')).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['org_id', 'org1'] },
    ]);
  });

  it('mappe chaque colonne vers sa clé ; booléen gardé, tout le reste → null', async () => {
    supabaseMock.queueTable('org_member_permissions', {
      data: [{
        org_id: 'org1', user_id: 'u1',
        can_create_task: false, can_edit_project: true,
        // Valeur non booléenne : jamais lue comme une décision.
        can_delete_task: 'false',
        // Colonne absente (mig. 219 pas appliquée) : can_manage_roles.
        assign_targets: ['self', 'peers'],
      }],
    });
    const [row] = await getMemberPermissions('org1');
    expect(row).toEqual({
      orgId: 'org1',
      userId: 'u1',
      overrides: { ...allNull(), 'task.create': false, 'project.edit': true },
      assignTargets: ['self', 'peers'],
    });
  });

  it('chaque clé lit SA colonne', async () => {
    for (const key of ORG_PERMISSION_KEYS) {
      supabaseMock.queueTable('org_member_permissions', {
        data: [{ org_id: 'o', user_id: 'u', [COLUMNS[key]]: true }],
      });
      const [row] = await getMemberPermissions('o');
      expect(row.overrides).toEqual({ ...allNull(), [key]: true });
    }
  });

  it('assign_targets : NULL (aucune décision) et {} (personne) restent distincts', async () => {
    supabaseMock.queueTable('org_member_permissions', {
      data: [
        { org_id: 'o', user_id: 'a', assign_targets: null },
        { org_id: 'o', user_id: 'b', assign_targets: [] },
      ],
    });
    const rows = await getMemberPermissions('o');
    expect(rows.map((r) => r.assignTargets)).toEqual([null, []]);
  });

  it('data null → liste vide ; erreur normalisée ; sans Supabase → throw', async () => {
    supabaseMock.queueTable('org_member_permissions', { data: null });
    expect(await getMemberPermissions('o')).toEqual([]);

    supabaseMock.queueTable('org_member_permissions', { error: DB_ERROR });
    await expect(getMemberPermissions('o')).rejects.toMatchObject({ code: '42501' });

    state.configured = false;
    await expect(getMemberPermissions('o')).rejects.toThrow('Supabase not configured');
  });
});

describe('setMemberPermissions', () => {
  it('upsert de la ligne COMPLÈTE sur (org_id, user_id) : clés absentes → null', async () => {
    await setMemberPermissions('org1', 'u1', {
      overrides: { 'task.create': false, 'role.manage': true },
      assignTargets: ['subordinates'],
    });
    const upsert = supabaseMock.argsOf('org_member_permissions', 'upsert');
    const expected: Record<string, unknown> = { org_id: 'org1', user_id: 'u1', assign_targets: ['subordinates'] };
    for (const key of ORG_PERMISSION_KEYS) expected[COLUMNS[key]] = null;
    expected.can_create_task = false;
    expected.can_manage_roles = true;
    expect(upsert).toEqual([expected, { onConflict: 'org_id,user_id' }]);
  });

  it('whitelist : une clé inconnue de l objet reçu ne part jamais vers la base', async () => {
    const input = {
      overrides: { 'task.create': true, is_admin: true, org_id: 'autre' },
      assignTargets: null,
      user_id: 'pirate',
    } as unknown as SetOrgPermissionsInput;
    await setMemberPermissions('org1', 'u1', input);
    const [row] = supabaseMock.argsOf('org_member_permissions', 'upsert') as [Record<string, unknown>];
    expect(Object.keys(row).sort()).toEqual(
      ['org_id', 'user_id', 'assign_targets', ...Object.values(COLUMNS)].sort(),
    );
    expect(row.org_id).toBe('org1');
    expect(row.user_id).toBe('u1');
    expect(row.assign_targets).toBeNull();
  });

  it('assign_targets [] (personne) est écrit tel quel, pas confondu avec null', async () => {
    await setMemberPermissions('org1', 'u1', { overrides: {}, assignTargets: [] });
    const [row] = supabaseMock.argsOf('org_member_permissions', 'upsert') as [Record<string, unknown>];
    expect(row.assign_targets).toEqual([]);
  });

  it('erreur normalisée ; sans Supabase → throw', async () => {
    supabaseMock.queueTable('org_member_permissions', { error: { message: 'ceiling', code: 'P0001' } });
    await expect(setMemberPermissions('o', 'u', { overrides: {}, assignTargets: null })).rejects.toBeInstanceOf(Error);

    state.configured = false;
    await expect(setMemberPermissions('o', 'u', { overrides: {}, assignTargets: null })).rejects.toThrow('Supabase not configured');
  });
});
