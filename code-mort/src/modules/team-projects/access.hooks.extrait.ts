// Extrait de src/modules/team-projects/access.hooks.ts le 2026-11-25 : hooks sans ecran (orphan-hooks.guard).
// Non compile : les imports d'origine sont dans src/modules/team-projects/access.hooks.ts.

/** Charge de chaque membre (tâches ouvertes, en retard, à 7 jours), comptée par le serveur. */
export const useTeamMemberWorkload = (orgId: string | undefined) => {
  const repository = useRepo();
  const today = todayKeyInTz();
  return useQuery({
    queryKey: [...teamProjectKeys.tasks(orgId ?? ''), 'member-workload', today],
    queryFn: () => repository.getMemberWorkload(orgId as string, today),
    enabled: !!orgId,
    staleTime: 1000 * 30,
  });
};
