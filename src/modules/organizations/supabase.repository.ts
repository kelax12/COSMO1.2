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
import { getCurrentUserId } from '@/lib/auth-user';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { IOrganizationsRepository } from './repository';
import { MyOrganization, Organization, OrgMember, OrgJoinRequest, OrgRole, UpdateOrganizationInput, OrgInviteLink, OrgInvitation, OrgRemovalNotice } from './types';
import {
  ORG_PERMISSION_KEYS,
  type OrgAssignTarget,
  type OrgMemberPermissions,
  type OrgPermissionKey,
  type SetOrgPermissionsInput,
} from './permissions';

interface OrgRow {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
  created_at: string;
  description: string | null;
  industry: string | null;
  avatar_url: string | null;
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
      avatarUrl: row.avatar_url ?? undefined,
    };
  }

  // ─── Read ──────────────────────────────────────────────────────────

  async getMyOrganizations(): Promise<MyOrganization[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
    if (!uid) return [];

    // Mes memberships donnent orgs + rôles (RLS : je ne vois que mes orgs).
    //
    // ⚠️ UNE seule requête, via la jointure PostgREST sur la clé étrangère
    // `organization_members.org_id -> organizations.id`. La version d'avant
    // lisait les memberships, PUIS les organisations avec un `in(...)` bâti sur
    // le premier résultat : deux allers-retours SÉQUENTIELS, le second ne
    // pouvant même pas partir avant que le premier soit revenu. Ce hook est
    // monté par `Layout`, donc sur toutes les pages protégées.
    //
    // La RLS ne change pas : la ligne `organizations` embarquée est filtrée par
    // sa propre policy, exactement comme quand elle était lue à part. Une org
    // illisible revient à `null` et est écartée ci-dessous, ce qui reproduit le
    // comportement précédent (elle était simplement absente du second lot).
    const { data: memberships, error: mErr } = await supabase
      .from('organization_members')
      .select('role, organizations(*)')
      .eq('user_id', uid)
      .limit(50);
    if (mErr) throw normalizeApiError(mErr);

    type JoinedRow = { role: OrgRole; organizations: OrgRow | null };
    return ((memberships ?? []) as unknown as JoinedRow[])
      .filter((r): r is JoinedRow & { organizations: OrgRow } => r.organizations != null)
      .map((r) => ({ ...this.mapOrg(r.organizations), myRole: r.role ?? 'member' }))
      // Le tri portait sur `organizations.created_at` : un `order` sur une
      // table embarquée trierait les lignes DANS chaque parent (il y en a une),
      // pas la liste. Il se fait donc ici, sur au plus 50 éléments.
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
    const uid = await getCurrentUserId();
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

  // --- Invitations nominatives d un ami (mig. 105) ------------------

  async inviteFriendToOrg(orgId: string, friendUserId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase.rpc("invite_friend_to_org", {
      p_org: orgId,
      p_invitee: friendUserId,
    });
    if (error) throw normalizeApiError(error);
  }

  async getPendingSentInvitationIds(orgId: string): Promise<string[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
    if (!uid) return [];
    const { data, error } = await supabase
      .from('org_invitations')
      .select('invitee_id')
      .eq('org_id', orgId)
      .eq('inviter_id', uid)
      .is('accepted_at', null)
      .is('declined_at', null);
    if (error) throw normalizeApiError(error);
    return (data as { invitee_id: string }[]).map((r) => r.invitee_id);
  }

  async getMyOrgInvitations(): Promise<OrgInvitation[]> {
    if (!supabase) throw new Error("Supabase not configured");
    // RPC SECURITY DEFINER : le nom d une organisation n est PAS lisible par
    // un non-membre (organizations_select = is_org_member). Sans elle, on
    // afficherait une invitation sans pouvoir nommer l entreprise.
    const { data, error } = await supabase.rpc("get_my_org_invitations");
    if (error) throw normalizeApiError(error);
    const rows = (data ?? []) as Array<{
      id: string; org_id: string; org_name: string;
      inviter_id: string; inviter_name: string | null; created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      orgName: r.org_name,
      inviterId: r.inviter_id,
      inviterName: r.inviter_name ?? "Un collaborateur",
      createdAt: r.created_at,
    }));
  }

  async respondOrgInvitation(invitationId: string, accept: boolean): Promise<void> {
    if (!supabase) throw new Error("Supabase not configured");
    const { error } = await supabase.rpc("respond_org_invitation", {
      p_invitation: invitationId,
      p_accept: accept,
    });
    if (error) throw normalizeApiError(error);
  }

  async getMyOrgRemovalNotices(): Promise<OrgRemovalNotice[]> {
    if (!supabase) throw new Error('Supabase not configured');
    // RPC SECURITY DEFINER : un ex-membre ne peut plus lire `organizations`,
    // donc pas moyen de nommer l'entreprise par une lecture directe.
    const { data, error } = await supabase.rpc('get_my_org_removal_notices');
    if (error) throw normalizeApiError(error);
    const rows = (data ?? []) as Array<{
      id: string; org_id: string; org_name: string;
      actor_name: string | null; created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      orgName: r.org_name,
      actorName: r.actor_name,
      createdAt: r.created_at,
    }));
  }

  async dismissOrgRemovalNotice(noticeId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const uid = await getCurrentUserId();
    // DELETE direct : la policy `org_notifications_delete` autorise deja
    // `user_id = auth.uid()`. Pas de RPC a ecrire pour ca.
    const { error } = await supabase
      .from('org_notifications')
      .delete()
      .eq('id', noticeId)
      .eq('user_id', uid ?? ''); // defense-in-depth
    if (error) throw normalizeApiError(error);
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
    const uid = await getCurrentUserId();
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
    if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl || null;
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

  async deleteOrganization(orgId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    // RPC SECURITY DEFINER (mig. 075) — admin only, cascade totale.
    const { error } = await supabase.rpc('delete_organization', { p_org: orgId });
    if (error) throw normalizeApiError(error);
  }

  async transferOwnership(orgId: string, newOwnerId: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    // RPC SECURITY DEFINER (mig. 081) — owner actuel uniquement.
    const { error } = await supabase.rpc('transfer_org_ownership', {
      p_org: orgId,
      p_new_owner: newOwnerId,
    });
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
    const uid = await getCurrentUserId();
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

  // ─── Permissions par membre (mig. 115) ─────────────────────────────
  //
  // Colonnes NULLables : `null` = « suit le défaut dérivé », jamais « refusé ».
  // La correspondance clé ↔ colonne est explicite dans les deux sens — c'est
  // aussi la whitelist d'écriture : rien d'autre ne part vers la base.

  private static readonly PERMISSION_COLUMNS: Record<OrgPermissionKey, string> = {
    'task.create': 'can_create_task',
    'task.editAny': 'can_edit_any_task',
    'task.deleteAny': 'can_delete_task',
    'project.create': 'can_create_project',
    'project.delete': 'can_delete_project',
    'okr.create': 'can_create_okr',
    'okr.delete': 'can_delete_okr',
    'category.manage': 'can_manage_category',
    'team.create': 'can_create_team',
    'member.invite': 'can_invite_member',
  };

  private mapPermissions(row: Record<string, unknown>): OrgMemberPermissions {
    const overrides: Partial<Record<OrgPermissionKey, boolean | null>> = {};
    for (const key of ORG_PERMISSION_KEYS) {
      const value = row[SupabaseOrganizationsRepository.PERMISSION_COLUMNS[key]];
      overrides[key] = typeof value === 'boolean' ? value : null;
    }
    const targets = row.assign_targets;
    return {
      orgId: row.org_id as string,
      userId: row.user_id as string,
      overrides,
      assignTargets: Array.isArray(targets) ? (targets as OrgAssignTarget[]) : null,
    };
  }

  async getMemberPermissions(orgId: string): Promise<OrgMemberPermissions[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('org_member_permissions')
      .select('*')
      .eq('org_id', orgId);
    if (error) throw normalizeApiError(error);
    return (data ?? []).map((r) => this.mapPermissions(r as Record<string, unknown>));
  }

  async setMemberPermissions(
    orgId: string,
    userId: string,
    input: SetOrgPermissionsInput,
  ): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    // Whitelist stricte : on part des dix clés connues, jamais de l'objet reçu.
    const row: Record<string, unknown> = { org_id: orgId, user_id: userId };
    for (const key of ORG_PERMISSION_KEYS) {
      row[SupabaseOrganizationsRepository.PERMISSION_COLUMNS[key]] = input.overrides[key] ?? null;
    }
    row.assign_targets = input.assignTargets;
    const { error } = await supabase
      .from('org_member_permissions')
      .upsert(row, { onConflict: 'org_id,user_id' });
    if (error) throw normalizeApiError(error);
  }
}
