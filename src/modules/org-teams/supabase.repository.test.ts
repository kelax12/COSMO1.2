import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseOrgTeamsRepository } from './supabase.repository';

const repo = new SupabaseOrgTeamsRepository();

const teamRow = {
  id: 't1', org_id: 'org1', name: 'Design', color: 'purple',
  created_by: 'u1', created_at: '2026-07-01T10:00:00.000Z',
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseOrgTeamsRepository', () => {
  it('getTeams: filtre par org_id, ordonne par created_at asc, cap 200, mappe en camelCase', async () => {
    supabaseMock.queueTable('org_teams', { data: [teamRow] });
    const result = await repo.getTeams('org1');

    expect(supabaseMock.argsOf('org_teams', 'select')).toEqual(['*']);
    expect(supabaseMock.argsOf('org_teams', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('org_teams', 'order')).toEqual(['created_at', { ascending: true }]);
    expect(supabaseMock.argsOf('org_teams', 'limit')).toEqual([200]);
    expect(result).toEqual([{
      id: 't1', orgId: 'org1', name: 'Design', color: 'purple',
      createdBy: 'u1', createdAt: teamRow.created_at,
    }]);
  });

  it('getTeams: data null → tableau vide', async () => {
    supabaseMock.queueTable('org_teams', { data: null });
    expect(await repo.getTeams('org1')).toEqual([]);
  });

  it('getTeams: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_teams', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getTeams('org1')).rejects.toBeTruthy();
  });

  it('getTeamMembers: select colonnes explicites, filtre org_id, cap 2000, mappe en camelCase', async () => {
    supabaseMock.queueTable('org_team_members', {
      data: [{ team_id: 't1', org_id: 'org1', user_id: 'u2' }],
    });
    const result = await repo.getTeamMembers('org1');

    expect(supabaseMock.argsOf('org_team_members', 'select')).toEqual(['team_id, org_id, user_id']);
    expect(supabaseMock.argsOf('org_team_members', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('org_team_members', 'limit')).toEqual([2000]);
    expect(result).toEqual([{ teamId: 't1', orgId: 'org1', userId: 'u2' }]);
  });

  it('getTeamMembers: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_team_members', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.getTeamMembers('org1')).rejects.toBeTruthy();
  });

  it('createTeam: created_by vient de auth.getUser(), org_id du paramètre — jamais de l\'input (anti-mass-assignment)', async () => {
    supabaseMock.queueTable('org_teams', { data: { ...teamRow, created_by: supabaseMock.user?.id } });
    await repo.createTeam('org1', { name: 'Design', color: 'purple' });

    const inserted = supabaseMock.argsOf('org_teams', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({
      org_id: 'org1', created_by: supabaseMock.user?.id, name: 'Design', color: 'purple',
    });
  });

  it('createTeam: couleur par défaut "blue" quand absente', async () => {
    supabaseMock.queueTable('org_teams', { data: teamRow });
    await repo.createTeam('org1', { name: 'Design' });

    const inserted = supabaseMock.argsOf('org_teams', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted.color).toBe('blue');
  });

  it('createTeam: rejette si non authentifié, sans INSERT', async () => {
    supabaseMock.user = null;
    await expect(repo.createTeam('org1', { name: 'X' })).rejects.toThrow('Not authenticated');
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('createTeam: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_teams', { data: null, error: { message: 'dup', code: '23505' } });
    await expect(repo.createTeam('org1', { name: 'X' })).rejects.toBeTruthy();
  });

  it('deleteTeam: delete ciblé par id', async () => {
    supabaseMock.queueTable('org_teams', { data: null });
    await repo.deleteTeam('t1');

    const calls = supabaseMock.callsFor('org_teams');
    expect(calls.map((c) => c.method)).toEqual(['delete', 'eq']);
    expect(supabaseMock.argsOf('org_teams', 'eq')).toEqual(['id', 't1']);
  });

  it('deleteTeam: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_teams', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.deleteTeam('t1')).rejects.toBeTruthy();
  });

  it('addTeamMember: insert avec les 3 clés explicites uniquement', async () => {
    supabaseMock.queueTable('org_team_members', { data: null });
    await repo.addTeamMember('t1', 'org1', 'u2');

    const inserted = supabaseMock.argsOf('org_team_members', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({ team_id: 't1', org_id: 'org1', user_id: 'u2' });
  });

  it('addTeamMember: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_team_members', { data: null, error: { message: 'dup', code: '23505' } });
    await expect(repo.addTeamMember('t1', 'org1', 'u2')).rejects.toBeTruthy();
  });

  it('removeTeamMember: delete ciblé par team_id ET user_id', async () => {
    supabaseMock.queueTable('org_team_members', { data: null });
    await repo.removeTeamMember('t1', 'u2');

    const calls = supabaseMock.callsFor('org_team_members');
    expect(calls.filter((c) => c.method === 'eq').map((c) => c.args)).toEqual([
      ['team_id', 't1'], ['user_id', 'u2'],
    ]);
  });

  it('removeTeamMember: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_team_members', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.removeTeamMember('t1', 'u2')).rejects.toBeTruthy();
  });
});
