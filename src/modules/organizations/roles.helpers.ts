// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Rôles personnalisés — fonctions pures (mig. 219)
// ═══════════════════════════════════════════════════════════════════
//
// « Actif » se juge comme côté SQL : `starts_at <= now() < ends_at`. Le
// serveur reste seul juge d'un droit ; ces fonctions ne servent qu'à ne pas
// afficher un bouton qui échouerait, et à peindre les écrans.

import { addDays, addMonths, addWeeks, parseISO } from 'date-fns';
import type { OrgCustomRole, OrgRoleAssignment, RoleDuration } from './roles.types';

export const isAssignmentActive = (a: OrgRoleAssignment, now: Date): boolean => {
  const t = now.getTime();
  if (new Date(a.startsAt).getTime() > t) return false;
  return a.endsAt === null || new Date(a.endsAt).getTime() > t;
};

export const activeAssignmentsOf = (
  assignments: readonly OrgRoleAssignment[],
  userId: string,
  now: Date,
): OrgRoleAssignment[] => assignments.filter((a) => a.userId === userId && isAssignmentActive(a, now));

/** Les rôles actifs d'un membre, dans l'ordre de la liste des rôles. */
export const activeRolesOf = (
  roles: readonly OrgCustomRole[],
  assignments: readonly OrgRoleAssignment[],
  userId: string,
  now: Date,
): OrgCustomRole[] => {
  const held = new Set(activeAssignmentsOf(assignments, userId, now).map((a) => a.roleId));
  return roles.filter((r) => held.has(r.id));
};

/**
 * Date de fin d'une attribution qui commence à `from`.
 *
 * - `until` : fin de la journée choisie, donc début du lendemain dans le fuseau
 *   de celui qui attribue (`YYYY-MM-DD` lu en heure locale). `undefined` si la
 *   date manque ou n'est pas dans le futur : l'écran ne doit pas enregistrer.
 * - `unlimited` : `null`.
 */
export const computeEndsAt = (duration: RoleDuration, from: Date, until?: string): string | null | undefined => {
  switch (duration) {
    case 'week': return addWeeks(from, 1).toISOString();
    case 'month': return addMonths(from, 1).toISOString();
    case 'quarter': return addMonths(from, 3).toISOString();
    case 'unlimited': return null;
    case 'until': {
      if (!until) return undefined;
      const end = addDays(parseISO(until), 1);
      return end.getTime() > from.getTime() ? end.toISOString() : undefined;
    }
  }
};

/** Nombre de membres qui détiennent ce rôle MAINTENANT. */
export const holdersCount = (roleId: string, assignments: readonly OrgRoleAssignment[], now: Date): number =>
  assignments.filter((a) => a.roleId === roleId && isAssignmentActive(a, now)).length;

/** Attributions actives de ce rôle qui finissent dans les `days` prochains jours. */
export const expiringSoonCount = (
  roleId: string,
  assignments: readonly OrgRoleAssignment[],
  now: Date,
  days = 7,
): number => {
  const limit = addDays(now, days).getTime();
  return assignments.filter(
    (a) => a.roleId === roleId && isAssignmentActive(a, now) && a.endsAt !== null && new Date(a.endsAt).getTime() <= limit,
  ).length;
};
