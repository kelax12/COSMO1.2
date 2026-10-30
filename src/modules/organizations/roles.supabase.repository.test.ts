// Rôles personnalisés (mig. 219) : colonnes lues, whitelist d'écriture,
// filtre `user_id` de l'export (la RLS rend les attributions de TOUS les
// membres), propagation d'erreur, mapping snake → camel.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import { SupabaseOrgRolesRepository } from './roles.supabase.repository';
import type { SaveCustomRoleInput } from './roles.types';

const repo = new SupabaseOrgRolesRepository();
const ME = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-10-24T08:00:00.000Z';
const DB_ERROR = { message: 'permission denied', code: '42501' };
const ROLE_COLUMNS = 'id, org_id, name, color, granted_keys, assign_targets, created_by, created_at, updated_at';
const ASSIGNMENT_COLUMNS = 'id, org_id, role_id, user_id, starts_at, ends_at, granted_by, created_at';

const roleRow = (over: Record<string, unknown> = {}) => ({
  id: 'r1', org_id: 'org1', name: 'Pilote', color: '#6366f1',
  granted_keys: ['task.create'], assign_targets: ['self'],
  created_by: 'admin', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z', ...over,
});
const assignmentRow = (over: Record<string, unknown> = {}) => ({
  id: 'a1', org_id: 'org1', role_id: 'r1', user_id: ME,
  starts_at: '2026-10-01T00:00:00Z', ends_at: null, granted_by: 'admin', created_at: '2026-10-01T00:00:00Z', ...over,
});
const input: SaveCustomRoleInput = {
  name: '  Pilote  ', color: '#3b82f6', grantedKeys: ['task.create', 'okr.create'], assignTargets: ['self'],
};

beforeEach(() => supabaseMock.reset());
afterEach(() => vi.useRealTimers());

describe('getRoles', () => {
  it('colonnes énumérées, filtre org_id, tri par nom ; mapping snake → camel', async () => {
    supabaseMock.queueTable('org_roles', { data: [roleRow()] });
    expect(await repo.getRoles('org1')).toEqual([{
      id: 'r1', orgId: 'org1', name: 'Pilote', color: '#6366f1',
      grantedKeys: ['task.create'], assignTargets: ['self'],
      createdBy: 'admin', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z',
    }]);
    expect(supabaseMock.callsFor('org_roles')).toEqual([
      { method: 'select', args: [ROLE_COLUMNS] },
      { method: 'eq', args: ['org_id', 'org1'] },
      { method: 'order', args: ['name'] },
    ]);
  });

  it('granted_keys / assign_targets NULL → [] (jamais null côté domaine)', async () => {
    supabaseMock.queueTable('org_roles', { data: [roleRow({ granted_keys: null, assign_targets: null })] });
    const [role] = await repo.getRoles('org1');
    expect(role.grantedKeys).toEqual([]);
    expect(role.assignTargets).toEqual([]);
  });

  it('data null → [] ; erreur normalisée', async () => {
    supabaseMock.queueTable('org_roles', { data: null });
    expect(await repo.getRoles('org1')).toEqual([]);
    supabaseMock.queueTable('org_roles', { error: DB_ERROR });
    await expect(repo.getRoles('org1')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('getAssignments', () => {
  it('colonnes énumérées, filtre org_id ; mapping snake → camel', async () => {
    supabaseMock.queueTable('org_member_roles', { data: [assignmentRow({ ends_at: '2026-11-01T00:00:00Z' })] });
    expect(await repo.getAssignments('org1')).toEqual([{
      id: 'a1', orgId: 'org1', roleId: 'r1', userId: ME,
      startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z',
      grantedBy: 'admin', createdAt: '2026-10-01T00:00:00Z',
    }]);
    expect(supabaseMock.callsFor('org_member_roles')).toEqual([
      { method: 'select', args: [ASSIGNMENT_COLUMNS] },
      { method: 'eq', args: ['org_id', 'org1'] },
    ]);
  });

  it('data null → [] ; erreur normalisée', async () => {
    supabaseMock.queueTable('org_member_roles', { data: null });
    expect(await repo.getAssignments('org1')).toEqual([]);
    supabaseMock.queueTable('org_member_roles', { error: DB_ERROR });
    await expect(repo.getAssignments('org1')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('getMyAssignments (export RGPD art. 20)', () => {
  it('🔴 filtre sur MON user_id, puis lit les rôles par id dédoublonnés', async () => {
    supabaseMock.queueTable('org_member_roles', {
      data: [assignmentRow(), assignmentRow({ id: 'a2', org_id: 'org2', role_id: 'r2' }), assignmentRow({ id: 'a3' })],
    });
    supabaseMock.queueTable('org_roles', {
      data: [{ id: 'r1', name: 'Pilote', granted_keys: ['task.create'] }, { id: 'r2', name: 'Relais', granted_keys: null }],
    });
    const mine = await repo.getMyAssignments();
    expect(supabaseMock.callsFor('org_member_roles')).toEqual([
      { method: 'select', args: [ASSIGNMENT_COLUMNS] },
      { method: 'eq', args: ['user_id', ME] },
    ]);
    expect(supabaseMock.callsFor('org_roles')).toEqual([
      { method: 'select', args: ['id, name, granted_keys'] },
      { method: 'in', args: ['id', ['r1', 'r2']] },
    ]);
    expect(mine.map((a) => [a.id, a.orgId, a.roleName, a.grantedKeys])).toEqual([
      ['a1', 'org1', 'Pilote', ['task.create']],
      ['a2', 'org2', 'Relais', []],
      ['a3', 'org1', 'Pilote', ['task.create']],
    ]);
  });

  it('aucune attribution → [] sans lire org_roles', async () => {
    supabaseMock.queueTable('org_member_roles', { data: [] });
    expect(await repo.getMyAssignments()).toEqual([]);
    expect(supabaseMock.callsFor('org_roles')).toEqual([]);
  });

  it('rôle introuvable (supprimé entre deux lectures) → nom vide, aucun droit', async () => {
    supabaseMock.queueTable('org_member_roles', { data: [assignmentRow()] });
    supabaseMock.queueTable('org_roles', { data: null });
    const [a] = await repo.getMyAssignments();
    expect(a).toMatchObject({ roleId: 'r1', roleName: '', grantedKeys: [] });
  });

  it('non authentifié → erreur, aucune requête', async () => {
    supabaseMock.user = null;
    await expect(repo.getMyAssignments()).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(supabaseMock.queries).toEqual([]);
  });

  it('erreur sur l une ou l autre lecture → normalisée', async () => {
    supabaseMock.queueTable('org_member_roles', { error: DB_ERROR });
    await expect(repo.getMyAssignments()).rejects.toMatchObject({ code: '42501' });

    supabaseMock.queueTable('org_member_roles', { data: [assignmentRow()] });
    supabaseMock.queueTable('org_roles', { error: { message: 'x', code: '42P01' } });
    await expect(repo.getMyAssignments()).rejects.toMatchObject({ code: '42P01' });
  });
});

describe('createRole / updateRole / deleteRole', () => {
  it('createRole : whitelist (org_id + 4 colonnes), nom trimé, relit les colonnes énumérées', async () => {
    supabaseMock.queueTable('org_roles', { data: roleRow({ name: 'Pilote', color: '#3b82f6' }) });
    const role = await repo.createRole('org1', input);
    expect(supabaseMock.callsFor('org_roles')).toEqual([
      {
        method: 'insert',
        args: [{
          org_id: 'org1', name: 'Pilote', color: '#3b82f6',
          granted_keys: ['task.create', 'okr.create'], assign_targets: ['self'],
        }],
      },
      { method: 'select', args: [ROLE_COLUMNS] },
      { method: 'single', args: [] },
    ]);
    expect(role).toMatchObject({ id: 'r1', orgId: 'org1', color: '#3b82f6' });
  });

  it('createRole : un champ en trop dans l entrée ne part pas (created_by, org_id posés serveur)', async () => {
    supabaseMock.queueTable('org_roles', { data: roleRow() });
    await repo.createRole('org1', { ...input, created_by: 'pirate', org_id: 'autre' } as unknown as SaveCustomRoleInput);
    const [row] = supabaseMock.argsOf('org_roles', 'insert') as [Record<string, unknown>];
    expect(Object.keys(row).sort()).toEqual(['assign_targets', 'color', 'granted_keys', 'name', 'org_id']);
    expect(row.org_id).toBe('org1');
  });

  it('createRole : copie des tableaux, jamais la référence de l appelant', async () => {
    supabaseMock.queueTable('org_roles', { data: roleRow() });
    await repo.createRole('org1', input);
    const [row] = supabaseMock.argsOf('org_roles', 'insert') as [Record<string, unknown>];
    expect(row.granted_keys).not.toBe(input.grantedKeys);
    expect(row.assign_targets).not.toBe(input.assignTargets);
  });

  it('updateRole : sans org_id (figé par trigger), filtre sur id', async () => {
    await repo.updateRole('r1', input);
    expect(supabaseMock.callsFor('org_roles')).toEqual([
      { method: 'update', args: [{ name: 'Pilote', color: '#3b82f6', granted_keys: ['task.create', 'okr.create'], assign_targets: ['self'] }] },
      { method: 'eq', args: ['id', 'r1'] },
    ]);
  });

  it('deleteRole : delete filtré sur id', async () => {
    await repo.deleteRole('r1');
    expect(supabaseMock.callsFor('org_roles')).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['id', 'r1'] },
    ]);
  });

  it('erreurs normalisées', async () => {
    supabaseMock.queueTable('org_roles', { error: { message: 'dup', code: '23505' } });
    await expect(repo.createRole('org1', input)).rejects.toMatchObject({ code: '23505' });
    supabaseMock.queueTable('org_roles', { error: DB_ERROR });
    await expect(repo.updateRole('r1', input)).rejects.toMatchObject({ code: '42501' });
    supabaseMock.queueTable('org_roles', { error: DB_ERROR });
    await expect(repo.deleteRole('r1')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('assignRole / revokeAssignment', () => {
  it('assignRole : upsert sur (role_id, user_id), repart de maintenant, sans granted_by', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    await repo.assignRole({ orgId: 'org1', roleId: 'r1', userId: 'u2', endsAt: '2026-11-01T00:00:00Z' });
    expect(supabaseMock.callsFor('org_member_roles')).toEqual([{
      method: 'upsert',
      args: [
        { org_id: 'org1', role_id: 'r1', user_id: 'u2', starts_at: NOW, ends_at: '2026-11-01T00:00:00Z' },
        { onConflict: 'role_id,user_id' },
      ],
    }]);
  });

  it('assignRole : endsAt null (sans limite) transmis tel quel', async () => {
    await repo.assignRole({ orgId: 'org1', roleId: 'r1', userId: 'u2', endsAt: null });
    const [row] = supabaseMock.argsOf('org_member_roles', 'upsert') as [Record<string, unknown>];
    expect(row.ends_at).toBeNull();
  });

  it('revokeAssignment : delete filtré sur id', async () => {
    await repo.revokeAssignment('a1');
    expect(supabaseMock.callsFor('org_member_roles')).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['id', 'a1'] },
    ]);
  });

  it('erreurs normalisées', async () => {
    supabaseMock.queueTable('org_member_roles', { error: { message: 'admin', code: 'P0001' } });
    await expect(repo.assignRole({ orgId: 'o', roleId: 'r', userId: 'u', endsAt: null })).rejects.toBeInstanceOf(Error);
    supabaseMock.queueTable('org_member_roles', { error: DB_ERROR });
    await expect(repo.revokeAssignment('a1')).rejects.toMatchObject({ code: '42501' });
  });
});
