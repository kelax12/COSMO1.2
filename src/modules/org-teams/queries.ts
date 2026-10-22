// ═══════════════════════════════════════════════════════════════════
// ORG-TEAMS MODULE - LECTURES React Query
// ═══════════════════════════════════════════════════════════════════
//
// Séparées des mutations (`hooks.ts`) le 2026-10-15 : la modale de tâche
// d'équipe ne fait que lire les équipes, et importer `hooks.ts` faisait
// voyager toutes les mutations (toasts, traductions, clés de trois modules)
// dans son chunk (budget de `TeamTaskModal`).

import { useQuery } from '@tanstack/react-query';
import { getOrgTeamsRepository } from '@/lib/repository.factory';
import { orgTeamKeys } from './constants';

const useRepo = () => getOrgTeamsRepository();

export const useOrgTeams = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: orgTeamKeys.teams(orgId ?? ''),
    queryFn: () => repository.getTeams(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useOrgTeamMembers = (orgId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: orgTeamKeys.members(orgId ?? ''),
    queryFn: () => repository.getTeamMembers(orgId as string),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};
