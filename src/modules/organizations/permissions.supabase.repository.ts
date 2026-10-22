// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Permissions par membre — Supabase (mig. 115)
// ═══════════════════════════════════════════════════════════════════
//
// Sorti de `supabase.repository.ts` le 2026-10-15 (602 lignes pour un budget
// de 600, `architecture.guard`). `SupabaseOrganizationsRepository` délègue ici,
// son contrat ne change pas.
//
// Colonnes NULLables : `null` = « suit le défaut dérivé », jamais « refusé ».
// La correspondance clé ↔ colonne est explicite dans les deux sens — c'est
// aussi la whitelist d'écriture : rien d'autre ne part vers la base.

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import {
  ORG_PERMISSION_KEYS,
  type OrgAssignTarget,
  type OrgMemberPermissions,
  type OrgPermissionKey,
  type SetOrgPermissionsInput,
} from './permissions';

const PERMISSION_COLUMNS: Record<OrgPermissionKey, string> = {
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
  // Mig. 219 : absente avant son application.
  'role.manage': 'can_manage_roles',
};

function mapPermissions(row: Record<string, unknown>): OrgMemberPermissions {
  const overrides: Partial<Record<OrgPermissionKey, boolean | null>> = {};
  for (const key of ORG_PERMISSION_KEYS) {
    const value = row[PERMISSION_COLUMNS[key]];
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

export async function getMemberPermissions(orgId: string): Promise<OrgMemberPermissions[]> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('org_member_permissions')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw normalizeApiError(error);
  return (data ?? []).map((r) => mapPermissions(r as Record<string, unknown>));
}

export async function setMemberPermissions(
  orgId: string,
  userId: string,
  input: SetOrgPermissionsInput,
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  // Whitelist stricte : on part des clés connues, jamais de l'objet reçu.
  const row: Record<string, unknown> = { org_id: orgId, user_id: userId };
  for (const key of ORG_PERMISSION_KEYS) {
    row[PERMISSION_COLUMNS[key]] = input.overrides[key] ?? null;
  }
  row.assign_targets = input.assignTargets;
  const { error } = await supabase
    .from('org_member_permissions')
    .upsert(row, { onConflict: 'org_id,user_id' });
  if (error) throw normalizeApiError(error);
}
