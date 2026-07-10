// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Supabase Repository
// ═══════════════════════════════════════════════════════════════════
//
// Toutes les écritures passent par des RPC SECURITY DEFINER (migration 060) :
//   • create_organization        — code généré serveur, membership admin
//   • request_join_organization  — lookup par code, erreur générique
//   • respond_join_request       — admin accepte/refuse (atomique)
// Aucune écriture directe client sur organizations / organization_members
// (pas d'auto-promotion admin, pas d'accepted_at forgé).

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IOrganizationsRepository } from './repository';
import { MyOrganization, Organization, OrgMember, OrgJoinRequest, OrgRole, UpdateOrganizationInput, OrgInviteLink } from './types';

interface OrgRow {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
  created_at: string;
  description: string | null;
  industry: string | null;
}

interface MemberRow {
  org_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
  manager_id: string | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export class SupabaseOrganizationsRepository implements IOrganizationsRepository {
  private mapOrg(row: OrgRow): Organization {
    return {
      id: row.id,
      name: row.name,
      joinCode: row.join_code,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      description: row.description ?? undefined,
      industry: row.industry ?? undefined,
    };
  }

  // ─── Read ──────────────────────────────────────────────────────────

  async getMyOrganizations(): Promise<MyOrganization[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return [];

    // Mes memberships donnent orgs + rôles (RLS : je ne vois que mes orgs).
    const { data: memberships, error: mErr } = await supabase
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', uid)
      .limit(50);
    if (mErr) throw normalizeApiError(mErr);
    const rows = (memberships ?? []) as { org_id: string; role: OrgRole }[];
    if (rows.length === 0) return [];

    const { data: orgRows, error: oErr } = await supabase
      .from('organizations')
      .select('*')
      .in('id', rows.map((r) => r.org_id))
      .order('created_at', { ascending: true });
    if (oErr) throw normalizeApiError(oErr);

    const roleByOrg = new Map(rows.map((r) => [r.org_id, r.role]));
    return ((orgRows ?? []) as OrgRow[]).map((row) => ({
      ...this.mapOrg(row),
      myRole: roleByOrg.get(row.id) ?? 'member',
    }));
  }

  async getMembers(orgId: string): Promise<OrgMember[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: rows, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('org_id', orgId)
      .order('joined_at', { ascending: true })
      .limit(500);
    if (error) throw normalizeApiError(error);
    const members = (rows ?? []) as MemberRow[];
    if (members.length === 0) return [];

    // Enrichir depuis profiles (nom/avatar sanitizés — jamais raw metadata).
    const ids = members.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url')
      .in('id', ids);
    const byId = new Map(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    );

    return members.map((m) => {
      const p = byId.get(m.user_id);
      return {
        orgId: m.org_id,
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
        managerId: m.manager_id,
        displayName: p?.display_name ?? p?.email?.split('@')[0] ?? 'Membre',
        email: p?.email ?? undefined,
        avatar: p?.avatar_url ?? undefined,
      };
    });
  }

  async getPendingJoinRequests(orgId: string): Promise<OrgJoinRequest[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: rows, error } = await supabase
      .from('organization_join_requests')
      .select('*')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .is('rejected_at', null)
      .order('requested_at', { ascending: true })
      .limit(200);
    if (error) throw normalizeApiError(error);
    const requests = (rows ?? []) as { id: string; org_id: string; user_id: string; requested_at: string }[];
    if (requests.length === 0) return [];

    const ids = requests.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url')
      .in('id', ids);
    const byId = new Map(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    );

    return requests.map((r) => {
      const p = byId.get(r.user_id);
      return {
        id: r.id,
        orgId: r.org_id,
        userId: r.user_id,
        requestedAt: r.requested_at,
        status: 'pending' as const,
        requesterName: p?.display_name ?? p?.email?.split('@')[0] ?? 'Utilisateur',
        requesterEmail: p?.email ?? undefined,
        requesterAvatar: p?.avatar_url ?? undefined,
      };
    });
  }

  async getMySentJoinRequest(): Promise<OrgJoinRequest | null> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return null;

    const { data: row, error } = await supabase
      .from('organization_join_requests')
      .select('*')
      .eq('user_id', uid)
      .is('accepted_at', null)
      .is('rejected_at', null)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw normalizeApiError(error);
    if (!row) return null;

    const r = row as { id: string; org_id: string; user_id: string; requested_at: string };
    return {
      id: r.id,
      orgId: r.org_id,
      userId: r.user_id,
      requestedAt: r.requested_at,
      status: 'pending',
    };
  }

  // ─── Write (RPC only) ──────────────────────────────────────────────

  async createOrganization(name: string): Promise<Organization> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('create_organization', { p_name: name });
    if (error) throw normalizeApiError(error);
    // La RPC renvoie la ligne organizations (RETURNS organizations).
    const row = (Array.isArray(data) ? data[0] : data) as OrgRow;
    return this.mapOrg(row);
  }

  async requestJoin(code: string): Promise<{ orgName: string }> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('request_join_organization', { p_code: code });
    if (error) throw normalizeApiError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { org_name: string } | null;
    return { orgName: row?.org_name ?? '' };
  }

  async respondJoinRequest(requestId: string, accept: boolean): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.rpc('respond_join_request', {
      p_request_id: requestId,
      p_accept: accept,
    });
    if (error) throw normalizeApiError(error);
  }

  async cancelJoinRequest(requestId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const { error } = await supabase
      .from('organization_join_requests')
      .delete()
      .eq('id', requestId)
      .eq('user_id', uid ?? ''); // defense-in-depth (RLS scope déjà, faille V15)
    if (error) throw normalizeApiError(error);
  }

  async updateOrganization(orgId: string, input: UpdateOrganizationInput): Promise<Organization> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist explicite — jamais joinCode/ownerId (trigger d'immutabilité
    // en défense-en-profondeur côté DB).
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.industry !== undefined) patch.industry = input.industry || null;
    const { data, error } = await supabase
      .from('organizations')
      .update(patch)
      .eq('id', orgId)
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return this.mapOrg(data as OrgRow);
  }

  // ─── Administration (RPC only, mig. 061) ───────────────────────────

  async setMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.rpc('set_member_role', {
      p_org: orgId,
      p_user: userId,
      p_role: role,
    });
    if (error) throw normalizeApiError(error);
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.rpc('remove_member', {
      p_org: orgId,
      p_user: userId,
    });
    if (error) throw normalizeApiError(error);
  }

  async leaveOrganization(orgId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.rpc('leave_organization', { p_org: orgId });
    if (error) throw normalizeApiError(error);
  }

  async setMemberManager(orgId: string, userId: string, managerId: string | null): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.rpc('set_member_manager', {
      p_org: orgId,
      p_user: userId,
      p_manager: managerId,
    });
    if (error) throw normalizeApiError(error);
  }

  // ─── Invitations placées (v2, lot 1c) ──────────────────────────────

  private mapInviteLink(row: {
    id: string; org_id: string; manager_id: string | null; created_by: string;
    created_at: string; expires_at: string; claimed_at: string | null;
  }): OrgInviteLink {
    return {
      id: row.id,
      orgId: row.org_id,
      managerId: row.manager_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      claimedAt: row.claimed_at,
    };
  }

  async createInviteLink(orgId: string, managerId: string | null): Promise<OrgInviteLink> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('org_invite_links')
      .insert({ org_id: orgId, manager_id: managerId, created_by: uid })
      .select('*')
      .single();
    if (error) throw normalizeApiError(error);
    return this.mapInviteLink(data);
  }

  async getInviteLinks(orgId: string): Promise<OrgInviteLink[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('org_invite_links')
      .select('*')
      .eq('org_id', orgId)
      .is('claimed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw normalizeApiError(error);
    return (data ?? []).map((r) => this.mapInviteLink(r));
  }

  async revokeInviteLink(linkId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.from('org_invite_links').delete().eq('id', linkId);
    if (error) throw normalizeApiError(error);
  }

  async claimInviteLink(token: string): Promise<{ orgId: string; orgName: string }> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('claim_org_invite', { p_token: token });
    if (error) throw normalizeApiError(error);
    const row = (Array.isArray(data) ? data[0] : data) as { org_id: string; org_name: string } | null;
    if (!row) throw new Error('invalid_link');
    return { orgId: row.org_id, orgName: row.org_name };
  }

  async regenerateJoinCode(orgId: string): Promise<string> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('regenerate_join_code', { p_org: orgId });
    if (error) throw normalizeApiError(error);
    return data as string;
  }
}
