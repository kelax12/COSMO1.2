// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Rôles personnalisés à durée limitée (mig. 219)
// ═══════════════════════════════════════════════════════════════════
//
// Un rôle est un paquet nommé de droits ; il DÉFINIT tout : une clé absente
// de `grantedKeys` est refusée, même un droit qu'un membre a par défaut.
// Plusieurs rôles actifs s'additionnent. Un admin n'est jamais concerné.
// Résolution : `permissions.ts` (miroir de `my_org_perm`).

import type { OrgAssignTarget, OrgPermissionKey } from './permissions';

/**
 * ⚠️ `OrgRole` existe déjà (`'admin' | 'member'`, la position dans
 * l'organisation) : un rôle PERSONNALISÉ s'appelle `OrgCustomRole` partout.
 */
export interface OrgCustomRole {
  id: string;
  orgId: string;
  name: string;
  /** `#rrggbb`, une des {@link ROLE_COLORS}. */
  color: string;
  grantedKeys: OrgPermissionKey[];
  /** Jamais `null` : un rôle décide toujours de la portée. `[]` = personne. */
  assignTargets: OrgAssignTarget[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Une attribution d'un rôle à un membre. Une seule par (rôle, membre). */
export interface OrgRoleAssignment {
  id: string;
  orgId: string;
  roleId: string;
  userId: string;
  startsAt: string;
  /** `null` = sans limite. */
  endsAt: string | null;
  grantedBy: string | null;
  createdAt: string;
}

/** Ce qu'enregistre l'éditeur de rôle. Remplacement TOTAL du contenu. */
export interface SaveCustomRoleInput {
  name: string;
  color: string;
  grantedKeys: OrgPermissionKey[];
  assignTargets: OrgAssignTarget[];
}

/**
 * Attribuer, ou prolonger : réattribuer un rôle déjà détenu met à jour la
 * ligne existante (contrainte d'unicité `(role_id, user_id)`).
 */
export interface AssignRoleInput {
  orgId: string;
  roleId: string;
  userId: string;
  /** ISO, ou `null` = sans limite. */
  endsAt: string | null;
}

export const ROLE_DURATIONS = ['week', 'month', 'quarter', 'until', 'unlimited'] as const;
export type RoleDuration = (typeof ROLE_DURATIONS)[number];

/** Même palette que les équipes (`CreateTeamModal`). */
export const ROLE_COLORS = [
  '#6366f1', '#3b82f6', '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6',
] as const;

/** Longueur maximale d'un nom, miroir du `CHECK` SQL. */
export const ROLE_NAME_MAX = 40;
