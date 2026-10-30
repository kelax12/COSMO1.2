// Les deux formulaires de création du mode entreprise, derrière
// `org-create.context` : chargés au premier « Nouveau projet / Nouvelle équipe ».
//
// Le RÉSULTAT est le même d'où qu'on vienne : un projet avec son responsable,
// sa couleur choisie, ses tâches et jalons en une transaction ; une équipe avec
// ses membres. Et un seul message de réussite.

import { toast } from '@/lib/toast';
import { useAuth } from '@/modules/auth/AuthContext';
import { useActiveOrganization, useMyOrgPermissions, useOrgMembers } from '@/modules/organizations';
import { useCreateTeamWithMembers, useOrgTeams, type CreateTeamFullInput } from '@/modules/org-teams';
import {
  useCreateTeamProjectWithTasks,
  useSetProjectMember,
  type CreateTeamProjectInput,
} from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import ProjectEditDialog from './ProjectEditDialog';
import CreateTeamModal from './CreateTeamModal';
import type { OrgCreateRequest } from './org-create.context';

interface OrgCreateFormsProps {
  orgId: string;
  request: OrgCreateRequest;
  onClose: () => void;
}

const OrgCreateForms = ({ orgId, request, onClose }: OrgCreateFormsProps) => {
  const { t: tErrors } = useT('errors');
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const { can } = useMyOrgPermissions(orgId);
  const { data: members = [] } = useOrgMembers(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const createProject = useCreateTeamProjectWithTasks(orgId);
  const setProjectMember = useSetProjectMember(orgId);
  const createTeamWithMembers = useCreateTeamWithMembers(orgId);
  const isAdmin = activeOrg?.id === orgId && activeOrg.myRole === 'admin';

  if (request.kind === 'project') {
    // Le serveur refuserait : le bouton qui ouvre ce formulaire est grisé
    // avec son explication (cf. `PermissionHint`), on ne l'ouvre pas pour rien.
    if (!can['project.create']) return null;
    // Modale unique de projet (2026-10-30) : plus de modèle ni de tâches initiales.
    const submit = async (input: CreateTeamProjectInput, coLeadIds: string[], memberIds: string[]) => {
      const projectId = await createProject.mutateAsync({ input, tasks: [] });
      // Les autres responsables co-pilotent le projet (rôle `lead`, mig. 190).
      // Le projet existe déjà : un échec ici est notifié par le hook, pas rejeté.
      await Promise.allSettled(
        [
          ...coLeadIds.map((userId) => setProjectMember.mutateAsync({ projectId, userId, role: 'lead' })),
          ...memberIds.map((userId) => setProjectMember.mutateAsync({ projectId, userId, role: 'contributor' })),
        ],
      );
      toast.success(tErrors('success.projectCreated'));
      request.options.onCreated?.(projectId);
    };
    return (
      <ProjectEditDialog
        orgId={orgId}
        teams={teams}
        members={members}
        canChangeOwner
        currentUserId={user?.id}
        defaultTeamId={request.options.defaultTeamId ?? ''}
        onCreate={submit}
        onClose={onClose}
      />
    );
  }

  if (!can['team.create']) return null;
  // Le succès est déjà annoncé par `useCreateOrgTeam`.
  const submitTeam = async (input: CreateTeamFullInput) => {
    const team = await createTeamWithMembers(input);
    request.options.onCreated?.(team.id);
  };
  return (
    <CreateTeamModal
      members={members}
      currentUserId={user?.id}
      isAdmin={isAdmin}
      initialMemberIds={request.options.initialMemberIds}
      initialName={request.options.initialName}
      onSubmit={submitTeam}
      onClose={onClose}
    />
  );
};

export default OrgCreateForms;
