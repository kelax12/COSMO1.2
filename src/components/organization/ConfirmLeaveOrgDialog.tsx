import { useMemo } from 'react';
import type { OrgMember } from '@/modules/organizations';
import { useOrgTeamMembers } from '@/modules/org-teams';
import { useTeamProjects, useTeamTaskSlice } from '@/modules/team-projects';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useT } from '@/i18n/useT';

interface ConfirmLeaveOrgDialogProps {
  orgId: string;
  orgName: string;
  currentUserId?: string;
  members: OrgMember[];
  /** Admin : peut passer par l'assistant de départ pour tout transmettre AVANT. */
  canOrganize: boolean;
  pending?: boolean;
  onOrganize: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation avant de quitter l'entreprise (audit du 2026-09-24, étape 3).
 *
 * Le dialogue ne disait rien de ce qu'on laisse derrière soi. Il compte
 * désormais, avec ce que la personne VOIT : ses tâches ouvertes (qui seront
 * désassignées, mig. 164), ses subordonnés (remontés d'un cran), ses rôles de
 * responsable d'équipe (perdus) et ses projets portés (sans responsable).
 * Un admin peut passer par l'assistant de départ pour tout transmettre avant.
 */
const ConfirmLeaveOrgDialog = ({
  orgId, orgName, currentUserId, members, canOrganize, pending, onOrganize, onConfirm, onCancel,
}: ConfirmLeaveOrgDialogProps) => {
  const { t, tp } = useT('org');
  // Filtres STABLES : ils entrent dans la clé de cache.
  const filters = useMemo(() => ({ assigneeId: currentUserId, completed: false }), [currentUserId]);
  const { data: myTasks = [] } = useTeamTaskSlice(orgId, filters, { enabled: !!currentUserId });
  const { data: teamMembers = [] } = useOrgTeamMembers(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);

  const impact = useMemo(() => {
    if (!currentUserId) return [];
    const reports = members.filter((m) => m.managerId === currentUserId).length;
    const leads = teamMembers.filter((m) => m.userId === currentUserId && m.isLead).length;
    const owned = projects.filter((p) => p.ownerId === currentUserId && !p.archivedAt).length;
    return [
      ...(myTasks.length > 0 ? [tp('leaveDialog.impactTasks', myTasks.length)] : []),
      ...(reports > 0 ? [tp('leaveDialog.impactReports', reports)] : []),
      ...(leads > 0 ? [tp('leaveDialog.impactLeads', leads)] : []),
      ...(owned > 0 ? [tp('leaveDialog.impactProjects', owned)] : []),
    ];
  }, [currentUserId, members, teamMembers, projects, myTasks, tp]);

  return (
    <OrgConfirmDialog
      title={t('leaveDialog.title', { org: orgName })}
      description={t('leaveDialog.body')}
      impact={impact}
      impactTitle={t('leaveDialog.impactTitle')}
      confirmLabel={t('leaveDialog.confirm')}
      pendingLabel={t('leaveDialog.pending')}
      pending={pending}
      secondaryAction={canOrganize && impact.length > 0 ? { label: t('leaveDialog.organize'), onClick: onOrganize } : undefined}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

export default ConfirmLeaveOrgDialog;
