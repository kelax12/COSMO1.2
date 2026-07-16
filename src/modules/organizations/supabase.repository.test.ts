import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { SupabaseOrganizationsRepository } from './supabase.repository';

const repo = new SupabaseOrganizationsRepository();

const orgRow = {
  id: 'org1', name: 'ACME', join_code: 'ABC123', owner_id: 'u1',
  created_at: '2026-07-01T10:00:00.000Z', description: 'desc', industry: 'tech',
};

const memberRow = {
  org_id: 'org1', user_id: 'u2', role: 'member',
  joined_at: '2026-07-02T10:00:00.000Z', manager_id: 'u1',
};

const profileRow = {
  id: 'u2', email: 'bob@test.dev', display_name: 'Bob', avatar_url: 'https://a.io/b.png',
};

const inviteRow = {
  id: 'l1', org_id: 'org1', manager_id: 'u1', created_by: 'u1',
  created_at: '2026-07-01T10:00:00.000Z', expires_at: '2026-08-01T10:00:00.000Z', claimed_at: null,
};

beforeEach(() => supabaseMock.reset());

describe('SupabaseOrganizationsRepository — lecture', () => {
  it('getMyOrganizations: memberships (scopés user_id) puis orgs par in(id), avec myRole', async () => {
    supabaseMock.queueTable('organization_members', { data: [{ org_id: 'org1', role: 'admin' }] });
    supabaseMock.queueTable('organizations', { data: [orgRow] });

    const result = await repo.getMyOrganizations();

    expect(supabaseMock.argsOf('organization_members', 'select')).toEqual(['org_id, role']);
    expect(supabaseMock.argsOf('organization_members', 'eq')).toEqual(['user_id', supabaseMock.user?.id]);
    expect(supabaseMock.argsOf('organization_members', 'limit')).toEqual([50]);
    expect(supabaseMock.argsOf('organizations', 'in')).toEqual(['id', ['org1']]);
    expect(result).toEqual([{
      id: 'org1', name: 'ACME', joinCode: 'ABC123', ownerId: 'u1',
      createdAt: orgRow.created_at, description: 'desc', industry: 'tech', myRole: 'admin',
    }]);
  });

  it('getMyOrganizations: rôle inconnu → fallback "member" ; description/industry null → undefined', async () => {
    supabaseMock.queueTable('organization_members', { data: [{ org_id: 'org1', role: 'member' }] });
    supabaseMock.queueTable('organizations', { data: [{ ...orgRow, id: 'org1', description: null, industry: null }] });
    const [org] = await repo.getMyOrganizations();
    expect(org.myRole).toBe('member');
    expect(org.description).toBeUndefined();
    expect(org.industry).toBeUndefined();
  });

  it('getMyOrganizations: [] sans requête orgs si aucun membership ; [] si non authentifié', async () => {
    supabaseMock.queueTable('organization_members', { data: [] });
    expect(await repo.getMyOrganizations()).toEqual([]);
    expect(supabaseMock.queries.filter((q) => q.table === 'organizations')).toHaveLength(0);

    supabaseMock.reset();
    supabaseMock.user = null;
    expect(await repo.getMyOrganizations()).toEqual([]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('getMyOrganizations: normalise les erreurs DB (memberships et orgs)', async () => {
    supabaseMock.queueTable('organization_members', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getMyOrganizations()).rejects.toBeTruthy();

    supabaseMock.reset();
    supabaseMock.queueTable('organization_members', { data: [{ org_id: 'org1', role: 'member' }] });
    supabaseMock.queueTable('organizations', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getMyOrganizations()).rejects.toBeTruthy();
  });

  it('getMembers: enrichit depuis profiles (colonnes explicites, jamais raw metadata)', async () => {
    supabaseMock.queueTable('organization_members', { data: [memberRow] });
    supabaseMock.queueTable('profiles', { data: [profileRow] });

    const result = await repo.getMembers('org1');

    expect(supabaseMock.argsOf('organization_members', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('organization_members', 'order')).toEqual(['joined_at', { ascending: true }]);
    expect(supabaseMock.argsOf('organization_members', 'limit')).toEqual([500]);
    expect(supabaseMock.argsOf('profiles', 'select')).toEqual(['id, email, display_name, avatar_url']);
    expect(supabaseMock.argsOf('profiles', 'in')).toEqual(['id', ['u2']]);
    expect(result).toEqual([{
      orgId: 'org1', userId: 'u2', role: 'member', joinedAt: memberRow.joined_at,
      managerId: 'u1', displayName: 'Bob', email: 'bob@test.dev', avatar: 'https://a.io/b.png',
    }]);
  });

  it('getMembers: fallbacks displayName — préfixe email sans display_name, "Membre" sans profil', async () => {
    supabaseMock.queueTable('organization_members', {
      data: [memberRow, { ...memberRow, user_id: 'u3' }],
    });
    supabaseMock.queueTable('profiles', { data: [{ ...profileRow, display_name: null }] });

    const [withEmail, noProfile] = await repo.getMembers('org1');
    expect(withEmail.displayName).toBe('bob');
    expect(noProfile.displayName).toBe('Membre');
    expect(noProfile.email).toBeUndefined();
    expect(noProfile.avatar).toBeUndefined();
  });

  it('getMembers: [] sans requête profiles si aucun membre ; erreur DB → rejet', async () => {
    supabaseMock.queueTable('organization_members', { data: [] });
    expect(await repo.getMembers('org1')).toEqual([]);
    expect(supabaseMock.queries.filter((q) => q.table === 'profiles')).toHaveLength(0);

    supabaseMock.queueTable('organization_members', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.getMembers('org1')).rejects.toBeTruthy();
  });

  it('getPendingJoinRequests: filtre pending (accepted_at/rejected_at null) + enrichissement profil', async () => {
    supabaseMock.queueTable('organization_join_requests', {
      data: [{ id: 'r1', org_id: 'org1', user_id: 'u2', requested_at: '2026-07-03T10:00:00.000Z' }],
    });
    supabaseMock.queueTable('profiles', { data: [profileRow] });

    const result = await repo.getPendingJoinRequests('org1');

    const calls = supabaseMock.callsFor('organization_join_requests');
    expect(calls.filter((c) => c.method === 'is').map((c) => c.args)).toEqual([
      ['accepted_at', null], ['rejected_at', null],
    ]);
    expect(supabaseMock.argsOf('organization_join_requests', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('organization_join_requests', 'limit')).toEqual([200]);
    expect(result).toEqual([{
      id: 'r1', orgId: 'org1', userId: 'u2', requestedAt: '2026-07-03T10:00:00.000Z',
      status: 'pending', requesterName: 'Bob', requesterEmail: 'bob@test.dev',
      requesterAvatar: 'https://a.io/b.png',
    }]);
  });

  it('getPendingJoinRequests: [] si aucune demande ; erreur DB → rejet', async () => {
    supabaseMock.queueTable('organization_join_requests', { data: [] });
    expect(await repo.getPendingJoinRequests('org1')).toEqual([]);

    supabaseMock.queueTable('organization_join_requests', { data: null, error: { message: 'boom', code: '42P01' } });
    await expect(repo.getPendingJoinRequests('org1')).rejects.toBeTruthy();
  });

  it('getMySentJoinRequest: scopé sur mon user_id, pending, la plus récente (maybeSingle)', async () => {
    supabaseMock.queueTable('organization_join_requests', {
      data: { id: 'r1', org_id: 'org1', user_id: supabaseMock.user?.id, requested_at: '2026-07-03T10:00:00.000Z' },
    });

    const result = await repo.getMySentJoinRequest();

    expect(supabaseMock.argsOf('organization_join_requests', 'eq')).toEqual(['user_id', supabaseMock.user?.id]);
    expect(supabaseMock.argsOf('organization_join_requests', 'order')).toEqual(['requested_at', { ascending: false }]);
    expect(supabaseMock.argsOf('organization_join_requests', 'limit')).toEqual([1]);
    expect(result).toEqual({
      id: 'r1', orgId: 'org1', userId: supabaseMock.user?.id,
      requestedAt: '2026-07-03T10:00:00.000Z', status: 'pending',
    });
  });

  it('getMySentJoinRequest: null si aucune demande ; null sans requête si non authentifié', async () => {
    supabaseMock.queueTable('organization_join_requests', { data: null });
    expect(await repo.getMySentJoinRequest()).toBeNull();

    supabaseMock.reset();
    supabaseMock.user = null;
    expect(await repo.getMySentJoinRequest()).toBeNull();
    expect(supabaseMock.queries).toHaveLength(0);
  });
});

describe('SupabaseOrganizationsRepository — écritures (RPC only)', () => {
  it('createOrganization: passe par la RPC create_organization (code généré serveur)', async () => {
    supabaseMock.queueRpc('create_organization', { data: [orgRow] });
    const result = await repo.createOrganization('ACME');

    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'create_organization', args: { p_name: 'ACME' } }]);
    expect(supabaseMock.queries).toHaveLength(0); // aucune écriture directe table
    expect(result.joinCode).toBe('ABC123');
    expect(result.ownerId).toBe('u1');
  });

  it('createOrganization: accepte aussi une ligne non-tableau ; erreur RPC → rejet', async () => {
    supabaseMock.queueRpc('create_organization', { data: orgRow });
    expect((await repo.createOrganization('ACME')).id).toBe('org1');

    supabaseMock.queueRpc('create_organization', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.createOrganization('ACME')).rejects.toBeTruthy();
  });

  it('requestJoin: RPC request_join_organization, renvoie orgName ("" si null)', async () => {
    supabaseMock.queueRpc('request_join_organization', { data: [{ org_name: 'ACME' }] });
    expect(await repo.requestJoin('ABC123')).toEqual({ orgName: 'ACME' });
    expect(supabaseMock.rpcCalls[0]).toEqual({ fn: 'request_join_organization', args: { p_code: 'ABC123' } });

    supabaseMock.queueRpc('request_join_organization', { data: null });
    expect(await repo.requestJoin('XXX')).toEqual({ orgName: '' });
  });

  it('respondJoinRequest: RPC atomique accept/refuse ; erreur → rejet', async () => {
    supabaseMock.queueRpc('respond_join_request', { data: null });
    await repo.respondJoinRequest('r1', true);
    expect(supabaseMock.rpcCalls[0]).toEqual({
      fn: 'respond_join_request', args: { p_request_id: 'r1', p_accept: true },
    });

    supabaseMock.queueRpc('respond_join_request', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.respondJoinRequest('r1', false)).rejects.toBeTruthy();
  });

  it('cancelJoinRequest: delete scopé id + user_id (defense-in-depth V15)', async () => {
    supabaseMock.queueTable('organization_join_requests', { data: null });
    await repo.cancelJoinRequest('r1');

    const calls = supabaseMock.callsFor('organization_join_requests');
    expect(calls.filter((c) => c.method === 'eq').map((c) => c.args)).toEqual([
      ['id', 'r1'], ['user_id', supabaseMock.user?.id],
    ]);
  });

  it('updateOrganization: patch whitelisté — joinCode/ownerId forgés jamais transmis', async () => {
    supabaseMock.queueTable('organizations', { data: orgRow });
    await repo.updateOrganization('org1', {
      name: 'ACME 2', description: '', industry: 'retail',
      joinCode: 'HACK', ownerId: 'attacker-uid', // forgés : ignorés par la whitelist
    } as never);

    const patch = supabaseMock.argsOf('organizations', 'update')?.[0] as Record<string, unknown>;
    expect(patch).toEqual({ name: 'ACME 2', description: null, industry: 'retail' });
    expect(supabaseMock.argsOf('organizations', 'eq')).toEqual(['id', 'org1']);
  });

  it('updateOrganization: normalise les erreurs DB', async () => {
    supabaseMock.queueTable('organizations', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.updateOrganization('org1', { name: 'X' })).rejects.toBeTruthy();
  });
});

describe('SupabaseOrganizationsRepository — administration (RPC only)', () => {
  it('setMemberRole / removeMember / leaveOrganization / setMemberManager passent par leurs RPC', async () => {
    supabaseMock.queueRpc('set_member_role', { data: null });
    supabaseMock.queueRpc('remove_member', { data: null });
    supabaseMock.queueRpc('leave_organization', { data: null });
    supabaseMock.queueRpc('set_member_manager', { data: null });

    await repo.setMemberRole('org1', 'u2', 'admin');
    await repo.removeMember('org1', 'u2');
    await repo.leaveOrganization('org1');
    await repo.setMemberManager('org1', 'u2', null);

    expect(supabaseMock.rpcCalls).toEqual([
      { fn: 'set_member_role', args: { p_org: 'org1', p_user: 'u2', p_role: 'admin' } },
      { fn: 'remove_member', args: { p_org: 'org1', p_user: 'u2' } },
      { fn: 'leave_organization', args: { p_org: 'org1' } },
      { fn: 'set_member_manager', args: { p_org: 'org1', p_user: 'u2', p_manager: null } },
    ]);
    expect(supabaseMock.queries).toHaveLength(0); // aucune écriture directe table
  });

  it('setMemberRole: erreur RPC → rejet normalisé', async () => {
    supabaseMock.queueRpc('set_member_role', { data: null, error: { message: 'denied', code: '42501' } });
    await expect(repo.setMemberRole('org1', 'u2', 'admin')).rejects.toBeTruthy();
  });
});

describe('SupabaseOrganizationsRepository — invitations placées', () => {
  it('createInviteLink: created_by = auth.uid, token jamais fourni par le client', async () => {
    supabaseMock.queueTable('org_invite_links', { data: { ...inviteRow, created_by: supabaseMock.user?.id } });
    const result = await repo.createInviteLink('org1', 'u1');

    const inserted = supabaseMock.argsOf('org_invite_links', 'insert')?.[0] as Record<string, unknown>;
    expect(inserted).toEqual({ org_id: 'org1', manager_id: 'u1', created_by: supabaseMock.user?.id });
    expect(result).toEqual({
      id: 'l1', orgId: 'org1', managerId: 'u1', createdBy: supabaseMock.user?.id,
      createdAt: inviteRow.created_at, expiresAt: inviteRow.expires_at, claimedAt: null,
    });
  });

  it('createInviteLink: rejette si non authentifié, sans INSERT', async () => {
    supabaseMock.user = null;
    await expect(repo.createInviteLink('org1', null)).rejects.toThrow('Not authenticated');
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('getInviteLinks: uniquement non réclamés et non expirés, cap 100', async () => {
    supabaseMock.queueTable('org_invite_links', { data: [inviteRow] });
    const result = await repo.getInviteLinks('org1');

    expect(supabaseMock.argsOf('org_invite_links', 'eq')).toEqual(['org_id', 'org1']);
    expect(supabaseMock.argsOf('org_invite_links', 'is')).toEqual(['claimed_at', null]);
    const gt = supabaseMock.argsOf('org_invite_links', 'gt');
    expect(gt?.[0]).toBe('expires_at');
    expect(supabaseMock.argsOf('org_invite_links', 'limit')).toEqual([100]);
    expect(result).toHaveLength(1);
  });

  it('revokeInviteLink: delete ciblé par id', async () => {
    supabaseMock.queueTable('org_invite_links', { data: null });
    await repo.revokeInviteLink('l1');
    expect(supabaseMock.callsFor('org_invite_links').map((c) => c.method)).toEqual(['delete', 'eq']);
    expect(supabaseMock.argsOf('org_invite_links', 'eq')).toEqual(['id', 'l1']);
  });

  it('claimInviteLink: RPC claim_org_invite ; data null → "invalid_link"', async () => {
    supabaseMock.queueRpc('claim_org_invite', { data: [{ org_id: 'org1', org_name: 'ACME' }] });
    expect(await repo.claimInviteLink('tok')).toEqual({ orgId: 'org1', orgName: 'ACME' });
    expect(supabaseMock.rpcCalls[0]).toEqual({ fn: 'claim_org_invite', args: { p_token: 'tok' } });

    supabaseMock.queueRpc('claim_org_invite', { data: null });
    await expect(repo.claimInviteLink('bad')).rejects.toThrow('invalid_link');
  });

  it('regenerateJoinCode: RPC regenerate_join_code renvoie le nouveau code', async () => {
    supabaseMock.queueRpc('regenerate_join_code', { data: 'NEW999' });
    expect(await repo.regenerateJoinCode('org1')).toBe('NEW999');
    expect(supabaseMock.rpcCalls[0]).toEqual({ fn: 'regenerate_join_code', args: { p_org: 'org1' } });
  });
});
