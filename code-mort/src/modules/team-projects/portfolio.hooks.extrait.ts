// Extrait de src/modules/team-projects/portfolio.hooks.ts le 2026-11-25 : hooks sans ecran (orphan-hooks.guard).
// Non compile : les imports d'origine sont dans src/modules/team-projects/portfolio.hooks.ts.

/** Le refus le plus courant est un CYCLE : il se dit avec son identifiant (mig. 137). */
const projectDependencyError = (error: Error) => {
  const code = dependencyErrorCode(error);
  toast.error(code
    ? translator('errors').t(`api.${code}` as never)
    : translator('org').t('projects.dependencyFailed', { message: error.message }));
};

export const useAddProjectDependency = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ projectId, dependsOnId }: { projectId: string; dependsOnId: string }) =>
      repository.addProjectDependency(projectId, dependsOnId, orgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectDependencies(orgId) }),
    onError: projectDependencyError,
  });
};

export const useRemoveProjectDependency = (orgId: string) => {
  const queryClient = useQueryClient();
  const repository = useRepo();
  return useMutation({
    mutationFn: ({ projectId, dependsOnId }: { projectId: string; dependsOnId: string }) =>
      repository.removeProjectDependency(projectId, dependsOnId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamProjectKeys.projectDependencies(orgId) }),
    onError: projectDependencyError,
  });
};
