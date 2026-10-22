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
  it('getTeams: filtre par org_id, lit les 200 plus récentes (created_at desc), mappe en camelCase', async () => {
    supabaseMock.queueTable('org_teams', { data: [teamRow] });
    const result = await repo.getTeams('org1');

    expect(supabaseMock.argsOf('org_teams', 'select')).toEqual(['*']);
    expect(supabaseMock.argsOf('org_teams', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('org_teams', 'order')).toEqual(['created_at', { ascending: false }]);
    expect(supabaseMock.argsOf('org_teams', 'limit')).toEqual([200]);
    expect(result).toEqual([{
      id: 't1', orgId: 'org1', name: 'Design', color: 'purple',
      // Mig. 163 : absente d'une réponse antérieure, rendue `null`.
      description: null,
      createdBy: 'u1', createdAt: teamRow.created_at,
    }]);
  });

  // Témoin du défaut du 2026-09-24 : trié croissant sous `limit(200)`, la
  // 201e équipe créée n'apparaissait nulle part. Le serveur rend désormais les
  // plus récentes d'abord ; l'écran, lui, doit rester chronologique.
  it("getTeams: rend l'ordre chronologique alors que le serveur lit les plus récentes", async () => {
    const newer = { ...teamRow, id: 't2', name: 'Produit', created_at: '2026-08-01T10:00:00.000Z' };
    supabaseMock.queueTable('org_teams', { data: [newer, teamRow] });
    const result = await repo.getTeams('org1');
    expect(result.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('updateTeam: whitelist nom/couleur/description, jamais org_id ni created_by', async () => {
    supabaseMock.queueTable('org_teams', { data: [{ id: 't1' }] });
    await repo.updateTeam('t1', { name: '  Produit ', color: '#14b8a6', description: '  ' });
    expect(supabaseMock.argsOf('org_teams', 'update')).toEqual([
      { name: 'Produit', color: '#14b8a6', description: null },
    ]);
    expect(supabaseMock.argsOf('org_teams', 'eq')).toEqual(['id', 't1']);
  });

  // Une policy UPDATE qui refuse ne lève rien : elle ne modifie aucune ligne.
  // Sans ce contrôle, l'écran annoncerait « enregistré » pour rien.
  it('updateTeam: aucune ligne modifiée → erreur, pas un faux succès', async () => {
    supabaseMock.queueTable('org_teams', { data: [] });
    await expect(repo.updateTeam('t1', { description: 'x' })).rejects.toBeTruthy();
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
      data: [{ team_id: 't1', org_id: 'org1', user_id: 'u2', is_lead: true }],
    });
    const result = await repo.getTeamMembers('org1');

    expect(supabaseMock.argsOf('org_team_members', 'select')).toEqual([
      'team_id, org_id, user_id, is_lead',
    ]);
    expect(supabaseMock.argsOf('org_team_members', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('org_team_members', 'limit')).toEqual([2000]);
    expect(result).toEqual([{ teamId: 't1', orgId: 'org1', userId: 'u2', isLead: true }]);
  });

  it("getTeamMembers: is_lead absent vaut false, jamais undefined", async () => {
    // Réponse d'une base où la mig. 107 n'est pas encore appliquée : le front
    // doit dégrader vers « pas responsable », pas produire un booléen absent.
    supabaseMock.queueTable('org_team_members', {
      data: [{ team_id: 't1', org_id: 'org1', user_id: 'u2' }],
    });
    expect(await repo.getTeamMembers('org1')).toEqual([
      { teamId: 't1', orgId: 'org1', userId: 'u2', isLead: false },
    ]);
  });

  it('setTeamLead: whitelist is_lead, cible la paire (team, user)', async () => {
    supabaseMock.queueTable('org_team_members', { data: null, error: null });
    await repo.setTeamLead('t1', 'u2', true);

    // `is_lead` est la SEULE colonne émise : l'identité de l'appartenance est
    // immuable côté base (trigger mig. 107), on ne tente même pas de l'écrire.
    expect(supabaseMock.argsOf('org_team_members', 'update')).toEqual([{ is_lead: true }]);
  });

  it('setTeamLead: normalise les erreurs DB (refus RLS)', async () => {
    supabaseMock.queueTable('org_team_members', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.setTeamLead('t1', 'u2', true)).rejects.toBeTruthy();
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
    await expect(repo.createTeam('org1', { name: 'X' })).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('createTeam: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('org_teams', { data: null, error: { message: 'dup', code: '23505' } });
    await expect(repo.createTeam('org1', { name: 'X' })).rejects.toBeTruthy();
  });

  // M5 (mig. 151) : la suppression passe par une RPC atomique qui déplace
  // projets et OKR avant de supprimer. Plus jamais de DELETE direct, qui
  // laissait `ON DELETE SET NULL` rendre les projets visibles par toute l'org.
  it('deleteTeam: passe par delete_team_with_transfer, jamais par un DELETE direct', async () => {
    supabaseMock.queueRpc('delete_team_with_transfer', { data: null });
    await repo.deleteTeam({ teamId: 't1', targetTeamId: 't2', archiveProjects: true });

    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'delete_team_with_transfer', args: { p_team: 't1', p_target: 't2', p_archive_projects: true } },
    ]);
    expect(supabaseMock.callsFor('org_teams')).toHaveLength(0);
  });

  it('deleteTeam: un refus de clé étrangère devient team_has_dependents', async () => {
    supabaseMock.queueRpc('delete_team_with_transfer', { data: null, error: { message: 'fk', code: '23503' } });
    await expect(
      repo.deleteTeam({ teamId: 't1', targetTeamId: null, archiveProjects: false }),
    ).rejects.toMatchObject({ code: 'team_has_dependents' });
  });

  it('deleteTeam: normalise les autres erreurs DB', async () => {
    supabaseMock.queueRpc('delete_team_with_transfer', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(
      repo.deleteTeam({ teamId: 't1', targetTeamId: 't2', archiveProjects: false }),
    ).rejects.toBeTruthy();
  });

  it('getDeletionImpact: mappe la ligne de la RPC', async () => {
    supabaseMock.queueRpc('get_team_deletion_impact', {
      data: [{ active_projects: 3, archived_projects: 1, sole_okrs: 2, shared_okrs: 4 }],
    });
    await expect(repo.getDeletionImpact('t1')).resolves.toEqual({
      activeProjects: 3, archivedProjects: 1, soleOkrs: 2, sharedOkrs: 4,
    });
    expect(supabaseMock.rpcCalls[0]).toEqual({ fn: 'get_team_deletion_impact', args: { p_team: 't1' } });
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
