// Extrait de src/modules/team-okrs/execution.hooks.ts le 2026-11-25 : hooks sans ecran (orphan-hooks.guard).
// Non compile : les imports d'origine sont dans src/modules/team-okrs/execution.hooks.ts.

export const useKRCheckins = (krId: string | undefined) => {
  const repository = useRepo();
  return useQuery({
    queryKey: keys.checkins(krId ?? ''),
    queryFn: () => repository.getCheckins(krId as string),
    enabled: !!krId,
    staleTime: 1000 * 60,
  });
};
