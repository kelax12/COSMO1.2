// Les deux formulaires de création du mode entreprise, derrière
// `org-create.context` : chargés au premier « Nouveau projet / Nouvelle équipe ».
//
// Le RÉSULTAT est le même d'où qu'on vienne : un projet avec son responsable,
// sa couleur choisie, ses tâches et jalons en une transaction ; une équipe avec
// ses membres. Et un seul message de réussite.

import { toast } from '@/lib/toast';
import { useAuth } from '@/modules/auth/AuthContext';
import { useActiveOrganization, useMyOrgPermissions, useOrgMembers } from '@/modules/organizations';
import { useCreateTeamWithMembers, useOrgTeams } from '@/modules/org-teams';
import {
  useCreateTeamProjectWithTasks, useTeamProjectTemplates,
  type CreateTeamProjectInput, type DraftProjectMilestone, type DraftProjectTask,
} from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import NewTeamProjectModal from './NewTeamProjectModal';
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
  const { data: templates = [] } = useTeamProjectTemplates(request.kind === 'project' ? orgId : undefined);
  const createProject = useCreateTeamProjectWithTasks(orgId);
  const createTeamWithMembers = useCreateTeamWithMembers(orgId);
  const isAdmin = activeOrg?.id === orgId && activeOrg.myRole === 'admin';

  if (request.kind === 'project') {
    // Le serveur refuserait : le bouton qui ouvre ce formulaire est grisé
    // avec son explication (cf. `PermissionHint`), on ne l'ouvre pas pour rien.
    if (!can['project.create']) return null;
    const submit = async (
      input: CreateTeamProjectInput,
      tasks: DraftProjectTask[],
      milestones: DraftProjectMilestone[],
    ) => {
      const projectId = await createProject.mutateAsync({ input, tasks, milestones });
      toast.success(tErrors('success.projectCreated'));
      request.options.onCreated?.(projectId);
    };
    return (
      <NewTeamProjectModal
        orgId={orgId}
        teams={teams}
        members={members}
        currentUserId={user?.id}
        defaultTeamId={request.options.defaultTeamId ?? ''}
        templates={templates}
        initialTemplateId={request.options.templateId}
        onSubmit={submit}
        onClose={onClose}
      />
    );
  }

  if (!can['team.create']) return null;
  // Le succès est déjà annoncé par `useCreateOrgTeam`.
  const submitTeam = async (input: { name: string; color: string }, memberIds: string[]) => {
    const team = await createTeamWithMembers(input, memberIds);
    request.options.onCreated?.(team.id);
  };
  return (
    <CreateTeamModal
      members={members}
      currentUserId={user?.id}
      isAdmin={isAdmin}
      onSubmit={submitTeam}
      onClose={onClose}
    />
  );
};

export default OrgCreateForms;
