import { useCreateOrgTeam, useAddTeamMember, useSetTeamLead, type OrgTeam } from '@/modules/org-teams';

/** Ce que rend `CreateTeamModal` : l'équipe, ses membres, son responsable. */
export interface CreateTeamFullInput {
  name: string;
  color: string;
  memberIds: string[];
  /** Responsable d'équipe (mig. 107) : gère ses membres et ses projets. */
  leadId: string | null;
}

/**
 * Créer une équipe PUIS y ajouter ses membres, puis nommer son responsable.
 *
 * Trois écrans rejouaient la même boucle (Pyramide, section Équipes, onglet
 * Projets). Audit des popups du 2026-09-25 : le responsable ne se nommait
 * qu'après coup, depuis la section Équipes, ce qu'on ne faisait pas.
 * Le responsable est ajouté aux membres s'il n'y figurait pas : un
 * responsable hors de son équipe n'aurait aucun sens pour la RLS (mig. 107).
 */
export function useCreateTeamFull(orgId: string) {
  const createTeam = useCreateOrgTeam(orgId);
  const addTeamMember = useAddTeamMember(orgId);
  const setTeamLead = useSetTeamLead(orgId);

  return async ({ name, color, memberIds, leadId }: CreateTeamFullInput): Promise<OrgTeam> => {
    const team = await createTeam.mutateAsync({ name, color });
    const ids = leadId && !memberIds.includes(leadId) ? [...memberIds, leadId] : memberIds;
    for (const userId of ids) {
      await addTeamMember.mutateAsync({ teamId: team.id, userId });
    }
    if (leadId) await setTeamLead.mutateAsync({ teamId: team.id, userId: leadId, isLead: true });
    return team;
  };
}
