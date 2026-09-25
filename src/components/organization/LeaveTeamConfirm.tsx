import { useMemo } from 'react';
import { useTeamTaskSlice, type TeamProject } from '@/modules/team-projects';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useT } from '@/i18n/useT';

interface LeaveTeamConfirmProps {
  orgId: string;
  memberName: string;
  userId: string;
  teamName: string;
  /** Projets que la personne ne verra plus (`projectsLostOnTeamLeave`). */
  lostProjects: TeamProject[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Retrait d'une équipe qui fait PERDRE la vue sur des projets (audit du
 * 2026-09-24). Le retrait lui-même se rattrape (« Annuler » ensuite) ; ce qui
 * ne se voyait pas, c'est ce qu'il coupe. On nomme les projets, et on compte
 * les tâches OUVERTES de la personne dedans : elle ne les verra plus non plus.
 */
const LeaveTeamConfirm = ({ orgId, memberName, userId, teamName, lostProjects, onConfirm, onCancel }: LeaveTeamConfirmProps) => {
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const filters = useMemo(() => ({ assigneeId: userId, completed: false }), [userId]);
  const { data: openTasks = [] } = useTeamTaskSlice(orgId, filters);
  const lostIds = new Set(lostProjects.map((p) => p.id));
  const ownTasks = openTasks.filter((task) => lostIds.has(task.projectId)).length;

  const impact = [
    ...lostProjects.slice(0, 6).map((p) => ta('teamLeave.project', { name: p.name })),
    ...(lostProjects.length > 6 ? [tpa('teamLeave.moreProjects', lostProjects.length - 6)] : []),
    ...(ownTasks > 0 ? [tpa('teamLeave.ownTasks', ownTasks)] : []),
  ];

  return (
    <OrgConfirmDialog
      title={ta('teamLeave.title', { member: memberName, team: teamName })}
      description={tpa('teamLeave.body', lostProjects.length, { member: memberName })}
      impact={impact}
      confirmLabel={ta('teamLeave.confirm')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

export default LeaveTeamConfirm;
