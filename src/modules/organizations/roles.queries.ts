// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Rôles personnalisés — LECTURES React Query (mig. 219)
// ═══════════════════════════════════════════════════════════════════
//
// Séparées des mutations (`roles.hooks.ts`) le 2026-10-15 : `useMyOrgPermissions`
// ne lit que ces deux requêtes, et il est monté par tous les écrans entreprise.
// Le laisser importer les mutations faisait voyager leurs toasts et leurs
// traductions dans chaque chunk qui demande « ai-je le droit de… » (budget de
// `TeamTaskModal` et d'`OrganizationPage`).

import { useQuery } from '@tanstack/react-query';
import { getOrgRolesRepository } from '@/lib/repository.factory';

const useRepo = () => getOrgRolesRepository();

export const rolesKeys = {
  all: ['org-roles'] as const,
  roles: (orgId: string) => [...rolesKeys.all, 'roles', orgId] as const,
  assignments: (orgId: string) => [...rolesKeys.all, 'assignments', orgId] as const,
  /** Sous `all` : toute attribution qui change invalide aussi l'export. */
  mine: () => [...rolesKeys.all, 'mine'] as const,
};

export const useOrgRoles = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: rolesKeys.roles(orgId ?? ''),
    queryFn: () => repository.getRoles(orgId as string),
    enabled: !!orgId,
  });
};

export const useOrgRoleAssignments = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: rolesKeys.assignments(orgId ?? ''),
    queryFn: () => repository.getAssignments(orgId as string),
    enabled: !!orgId,
  });
};

/**
 * Les rôles reçus par la personne connectée, toutes organisations : l'export de
 * portabilité (« Mes données »). Hors mode entreprise, la liste est vide.
 */
export const useMyOrgRoleAssignments = () => {
  const repository = useRepo();
  return useQuery({
    queryKey: rolesKeys.mine(),
    queryFn: () => repository.getMyAssignments(),
  });
};
