// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Rôles personnalisés — Supabase (mig. 219)
// ═══════════════════════════════════════════════════════════════════
//
// Tables lues en direct : deux petites tables par organisation, policies sur
// `org_id` comme `org_member_permissions`. Les colonnes écrites sont
// énumérées ici, et seulement ici : c'est la whitelist d'écriture.
// `granted_by`, `created_by`, `org_id` d'une ligne existante sont posés ou
// figés par trigger, jamais par ce client.

import { supabase } from '@/lib/supabase';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { getCurrentUser } from '@/lib/auth-user';
import type { IOrgRolesRepository } from './roles.repository';
import type { OrgAssignTarget, OrgPermissionKey } from './permissions';
import type { AssignRoleInput, MyOrgRoleAssignment, OrgCustomRole, OrgRoleAssignment, SaveCustomRoleInput } from './roles.types';

const db = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

interface RoleRow {
  id: string;
  org_id: string;
  name: string;
  color: string;
  granted_keys: string[] | null;
  assign_targets: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AssignmentRow {
  id: string;
  org_id: string;
  role_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string | null;
  granted_by: string | null;
  created_at: string;
}

const ROLE_COLUMNS = 'id, org_id, name, color, granted_keys, assign_targets, created_by, created_at, updated_at';
const ASSIGNMENT_COLUMNS = 'id, org_id, role_id, user_id, starts_at, ends_at, granted_by, created_at';

const toRole = (r: RoleRow): OrgCustomRole => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  color: r.color,
  grantedKeys: (r.granted_keys ?? []) as OrgPermissionKey[],
  assignTargets: (r.assign_targets ?? []) as OrgAssignTarget[],
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toAssignment = (r: AssignmentRow): OrgRoleAssignment => ({
  id: r.id,
  orgId: r.org_id,
  roleId: r.role_id,
  userId: r.user_id,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  grantedBy: r.granted_by,
  createdAt: r.created_at,
});

const toRoleWrite = (input: SaveCustomRoleInput) => ({
  name: input.name.trim(),
  color: input.color,
  granted_keys: [...input.grantedKeys],
  assign_targets: [...input.assignTargets],
});

export class SupabaseOrgRolesRepository implements IOrgRolesRepository {
  async getRoles(orgId: string): Promise<OrgCustomRole[]> {
    const { data, error } = await db().from('org_roles').select(ROLE_COLUMNS).eq('org_id', orgId).order('name');
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as RoleRow[]).map(toRole);
  }

  async getAssignments(orgId: string): Promise<OrgRoleAssignment[]> {
    const { data, error } = await db().from('org_member_roles').select(ASSIGNMENT_COLUMNS).eq('org_id', orgId);
    if (error) throw normalizeApiError(error);
    return ((data ?? []) as AssignmentRow[]).map(toAssignment);
  }

  async getMyAssignments(): Promise<MyOrgRoleAssignment[]> {
    const user = await getCurrentUser();
    if (!user) throw makeApiError('not_authenticated');
    // 🔴 `.eq('user_id', …)` n'est pas une optimisation : la policy SELECT est
    // `is_org_member(org_id)`, elle rend les attributions de TOUS les membres.
    // Sans ce filtre, l'export d'une personne livrerait les rôles de ses collègues.
    const { data, error } = await db().from('org_member_roles').select(ASSIGNMENT_COLUMNS).eq('user_id', user.id);
    if (error) throw normalizeApiError(error);
    const assignments = ((data ?? []) as AssignmentRow[]).map(toAssignment);
    if (assignments.length === 0) return [];

    const roleIds = [...new Set(assignments.map((a) => a.roleId))];
    const { data: roles, error: rolesError } = await db()
      .from('org_roles')
      .select('id, name, granted_keys')
      .in('id', roleIds);
    if (rolesError) throw normalizeApiError(rolesError);
    const byId = new Map(
      ((roles ?? []) as Pick<RoleRow, 'id' | 'name' | 'granted_keys'>[]).map((r) => [r.id, r]),
    );
    return assignments.map((a) => ({
      ...a,
      roleName: byId.get(a.roleId)?.name ?? '',
      grantedKeys: (byId.get(a.roleId)?.granted_keys ?? []) as OrgPermissionKey[],
    }));
  }

  async createRole(orgId: string, input: SaveCustomRoleInput): Promise<OrgCustomRole> {
    const { data, error } = await db()
      .from('org_roles')
      .insert({ org_id: orgId, ...toRoleWrite(input) })
      .select(ROLE_COLUMNS)
      .single();
    if (error) throw normalizeApiError(error);
    return toRole(data as RoleRow);
  }

  async updateRole(roleId: string, input: SaveCustomRoleInput): Promise<void> {
    const { error } = await db().from('org_roles').update(toRoleWrite(input)).eq('id', roleId);
    if (error) throw normalizeApiError(error);
  }

  async deleteRole(roleId: string): Promise<void> {
    const { error } = await db().from('org_roles').delete().eq('id', roleId);
    if (error) throw normalizeApiError(error);
  }

  async assignRole(input: AssignRoleInput): Promise<void> {
    // Réattribuer = repartir de maintenant : un rôle échu redevient actif, un
    // rôle en cours voit sa fin déplacée (le trigger remet la notification à zéro).
    const { error } = await db()
      .from('org_member_roles')
      .upsert(
        {
          org_id: input.orgId,
          role_id: input.roleId,
          user_id: input.userId,
          starts_at: new Date().toISOString(),
          ends_at: input.endsAt,
        },
        { onConflict: 'role_id,user_id' },
      );
    if (error) throw normalizeApiError(error);
  }

  async revokeAssignment(assignmentId: string): Promise<void> {
    const { error } = await db().from('org_member_roles').delete().eq('id', assignmentId);
    if (error) throw normalizeApiError(error);
  }
}
