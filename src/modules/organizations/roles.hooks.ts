// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS · Rôles personnalisés — hooks React Query (mig. 219)
// ═══════════════════════════════════════════════════════════════════
//
// Les droits se résolvent dans `useMyOrgPermissions` (miroir de `my_org_perm`),
// jamais ici : ces hooks ne font que lire et écrire les deux tables.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getOrgRolesRepository } from '@/lib/repository.factory';
import { translator } from '@/i18n/useT';
import type { AssignRoleInput, SaveCustomRoleInput } from './roles.types';

const useRepo = () => getOrgRolesRepository();

export const rolesKeys = {
  all: ['org-roles'] as const,
  roles: (orgId: string) => [...rolesKeys.all, 'roles', orgId] as const,
  assignments: (orgId: string) => [...rolesKeys.all, 'assignments', orgId] as const,
};

/** Un rôle ou une attribution qui change touche les droits de tout l'écran. */
const invalidateRoles = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: rolesKeys.all });

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

export const useSaveOrgRole = () => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, roleId, input }: { orgId: string; roleId?: string; input: SaveCustomRoleInput }) => {
      if (roleId) await repository.updateRole(roleId, input);
      else await repository.createRole(orgId, input);
    },
    onSuccess: () => {
      toast.success(translator('errors').t('success.roleSaved'));
      invalidateRoles(queryClient);
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.saveRole', { message: error.message })),
  });
};

export const useDeleteOrgRole = () => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => repository.deleteRole(roleId),
    onSuccess: () => {
      toast.success(translator('errors').t('success.roleDeleted'));
      invalidateRoles(queryClient);
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteRole', { message: error.message })),
  });
};

export const useAssignOrgRole = () => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignRoleInput) => repository.assignRole(input),
    onSuccess: () => {
      toast.success(translator('errors').t('success.roleAssigned'));
      invalidateRoles(queryClient);
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.assignRole', { message: error.message })),
  });
};

export const useRevokeOrgRole = () => {
  const repository = useRepo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => repository.revokeAssignment(assignmentId),
    onSuccess: () => {
      toast.success(translator('errors').t('success.roleRevoked'));
      invalidateRoles(queryClient);
    },
    onError: (error: Error) => toast.error(translator('errors').t('mutation.revokeRole', { message: error.message })),
  });
};
