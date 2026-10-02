import type { TeamOKR, TeamKeyResult } from '@/modules/team-okrs';

/** Je porte ce KR : responsable OU contributeur (mig. 160). */
export const isMyTeamKR = (kr: TeamKeyResult, userId: string): boolean =>
  kr.assigneeId === userId || (kr.contributorIds ?? []).includes(userId);

/**
 * OKR d'entreprise à montrer dans le mode perso : ceux dont au moins un KR me
 * nomme. Un OKR dont tous les KR sont atteints n'a plus rien à me demander,
 * il reste dans l'espace entreprise.
 */
export function myProOkrs(okrs: TeamOKR[], userId: string | undefined): TeamOKR[] {
  if (!userId) return [];
  return okrs.filter(
    (okr) =>
      okr.keyResults.some((kr) => isMyTeamKR(kr, userId)) &&
      !okr.keyResults.every((kr) => kr.completed),
  );
}
