// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Rôles personnalisés — interface démo / production (mig. 219)
// ═══════════════════════════════════════════════════════════════════

import type { AssignRoleInput, MyOrgRoleAssignment, OrgCustomRole, OrgRoleAssignment, SaveCustomRoleInput } from './roles.types';

export interface IOrgRolesRepository {
  getRoles(orgId: string): Promise<OrgCustomRole[]>;
  /** TOUTES les attributions de l'organisation, échues comprises (l'écran trie). */
  getAssignments(orgId: string): Promise<OrgRoleAssignment[]>;
  /**
   * Les attributions de la PERSONNE CONNECTÉE, toutes organisations, échues
   * comprises, jointes à leur rôle. Sert l'export de portabilité (RGPD art. 20).
   * ⚠️ La RLS laisse lire celles de toute l'organisation : le filtre sur
   * `user_id` est ICI, pas en base.
   */
  getMyAssignments(): Promise<MyOrgRoleAssignment[]>;

  createRole(orgId: string, input: SaveCustomRoleInput): Promise<OrgCustomRole>;
  updateRole(roleId: string, input: SaveCustomRoleInput): Promise<void>;
  /** Emporte ses attributions (ON DELETE CASCADE). */
  deleteRole(roleId: string): Promise<void>;

  /** Attribue, ou prolonge si le membre a déjà eu ce rôle (une ligne par paire). */
  assignRole(input: AssignRoleInput): Promise<void>;
  revokeAssignment(assignmentId: string): Promise<void>;
}
