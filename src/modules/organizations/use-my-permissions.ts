// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS MODULE - Mes droits dans l'organisation courante
// ═══════════════════════════════════════════════════════════════════
//
// Le SEUL point d'entrée des composants pour savoir « ai-je le droit de… ».
// Fichier séparé de `hooks.ts` parce qu'il compose deux requêtes (annuaire +
// surcharges) au lieu d'en exposer une : y mêler les deux rendait l'ordre
// d'invalidation illisible.

import { useMemo } from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useOrgMemberPermissions } from './hooks';
import { useOrgMembers } from './hooks';
import { useOrgRoleAssignments, useOrgRoles } from './roles.queries';
import { activeRolesOf } from './roles.helpers';
import type { OrgCustomRole } from './roles.types';
import {
  DEFAULT_ASSIGN_TARGETS,
  ORG_PERMISSION_KEYS,
  canAssignTo,
  canDeleteTeamTask,
  canEditTeamTask,
  type TaskOwnership,
  effectiveAssignTargets,
  effectivePermissions,
  type EffectiveOrgPermissions,
  type OrgAssignTarget,
} from './permissions';
import type { OrgMember } from './types';

export interface MyOrgPermissions {
  /** Les dix droits, résolus pour l'utilisateur courant. */
  can: EffectiveOrgPermissions;
  /** Ses cibles d'assignation effectives. */
  assignTargets: OrgAssignTarget[];
  /** Peut-il assigner une tâche à ce membre ? */
  canAssign: (targetUserId: string) => boolean;
  /** Les membres à qui il peut assigner une tâche (annuaire filtré). */
  assignableMembers: OrgMember[];
  /** Puis-je modifier cette tâche ? (miroir de `team_tasks_update`) */
  canEditTask: (task: TaskOwnership) => boolean;
  /** Puis-je supprimer cette tâche ? (miroir de `delete_team_task`) */
  canDeleteTask: (task: TaskOwnership) => boolean;
  /** Mes rôles personnalisés ACTIFS (mig. 219), qui priment sur ma fiche. */
  activeRoles: OrgCustomRole[];
  /** `true` tant que l'annuaire, les surcharges ou les rôles ne sont pas chargés. */
  isLoading: boolean;
}

/**
 * Droits de l'utilisateur courant dans `orgId`.
 *
 * L'identité vient d'`useAuth`, jamais d'une prop : faire descendre un
 * `currentUserId` de composant en composant finit toujours par un oubli, et un
 * oubli ici ouvre silencieusement TOUS les droits (l'utilisateur devient
 * introuvable dans l'annuaire, donc non contraint).
 *
 * PENDANT LE CHARGEMENT, tout est autorisé (`isLoading: true`) : afficher une
 * interface amputée puis la voir se remplir est pire qu'un bouton qui échoue —
 * et le serveur reste la seule vraie barrière de toute façon. Les surfaces qui
 * veulent éviter le clignotement lisent `isLoading`.
 */
export const useMyOrgPermissions = (orgId: string | undefined): MyOrgPermissions => {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const { data: members = [], isLoading: membersLoading } = useOrgMembers(orgId);
  const { data: overrides = [], isLoading: permsLoading } = useOrgMemberPermissions(orgId);
  // Mig. 219. Une lecture en ÉCHEC (migration pas encore appliquée) rend une
  // liste vide : les droits retombent sur la fiche et le défaut, comme avant.
  const { data: roles = [], isLoading: rolesLoading } = useOrgRoles(orgId);
  const { data: roleAssignments = [], isLoading: assignmentsLoading } = useOrgRoleAssignments(orgId);

  const isLoading = membersLoading || permsLoading || rolesLoading || assignmentsLoading;

  return useMemo(() => {
    const me = currentUserId ? members.find((m) => m.userId === currentUserId) : undefined;

    if (!me || isLoading) {
      const all = {} as EffectiveOrgPermissions;
      for (const key of ORG_PERMISSION_KEYS) all[key] = true;
      return {
        can: all,
        assignTargets: [...DEFAULT_ASSIGN_TARGETS],
        canAssign: () => true,
        assignableMembers: members,
        canEditTask: () => true,
        canDeleteTask: () => true,
        activeRoles: [],
        isLoading,
      };
    }

    const mine = overrides.find((o) => o.userId === me.userId) ?? null;
    // « Actif » est jugé au rendu : un rôle qui finit pendant la visite tombe
    // au prochain rendu. Le serveur, lui, le refuse à la seconde.
    const activeRoles = activeRolesOf(roles, roleAssignments, me.userId, new Date());
    const can = effectivePermissions({ member: me, overrides: mine, roles: activeRoles });
    const assignTargets = effectiveAssignTargets({ member: me, overrides: mine, roles: activeRoles });

    const canAssign = (targetUserId: string) => {
      const target = members.find((m) => m.userId === targetUserId);
      if (!target) return false;
      return canAssignTo({ actor: me, target, targets: assignTargets });
    };

    return {
      can,
      assignTargets,
      canAssign,
      assignableMembers: members.filter((m) =>
        canAssignTo({ actor: me, target: m, targets: assignTargets }),
      ),
      canEditTask: (task: TaskOwnership) => canEditTeamTask(can, me.userId, task),
      canDeleteTask: (task: TaskOwnership) => canDeleteTeamTask(can, me.userId, task),
      activeRoles,
      isLoading,
    };
  }, [members, overrides, roles, roleAssignments, currentUserId, isLoading]);
};
