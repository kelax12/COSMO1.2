import type { TeamProject, TeamProjectMember } from '@/modules/team-projects';

/** Les deux fonctions affichées dans un projet : `lead` = responsable, `contributor` = membre. */
export type ProjectFunction = 'lead' | 'contributor';

/** Responsable : propriétaire du projet ou membre `lead`. Toute autre personne qui le voit est membre. */
export const projectFunctionOf = (
  userId: string | null | undefined, project: TeamProject, projectMembers: TeamProjectMember[],
): ProjectFunction =>
  userId && (userId === project.ownerId || projectMembers.some((m) => m.userId === userId && m.role === 'lead'))
    ? 'lead' : 'contributor';
