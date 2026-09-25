// La barre d'actions groupées d'une liste de tâches, branchée sur
// `useTeamTasksBulk`. Chargée à la demande AVEC le catalogue `portfolio`
// (cf. `team-tasks-bulk.lazy.ts`) : seul qui entre en sélection la paie.

import type { OrgMember } from '@/modules/organizations';
import type { TeamProject } from '@/modules/team-projects';
import BulkActionsBar from './BulkActionsBar';
import type { TeamTasksBulk } from './use-team-tasks-bulk';

interface TeamTasksBulkLayerProps {
  bulk: TeamTasksBulk;
  members: OrgMember[];
  /** Projets actifs, cibles d'un déplacement groupé. */
  projects: TeamProject[];
  placement?: 'floating' | 'inline';
}

const TeamTasksBulkLayer = ({ bulk, members, projects, placement }: TeamTasksBulkLayerProps) => (
  <BulkActionsBar
    count={bulk.selectedTasks.length}
    hasOpen={bulk.selectedTasks.some((t) => !t.completed)}
    hasCompleted={bulk.selectedTasks.some((t) => t.completed)}
    onComplete={() => bulk.bulkSetCompleted(true)}
    onReopen={() => bulk.bulkSetCompleted(false)}
    onDelete={bulk.bulkDelete}
    onExit={bulk.exitSelectMode}
    assignableMembers={members.filter((m) => bulk.canAssign(m.userId))}
    onAssign={bulk.bulkAssign}
    projects={projects.filter((p) => !p.archivedAt)}
    onMove={bulk.bulkMove}
    onSetStatus={bulk.bulkSetStatus}
    placement={placement}
  />
);

export default TeamTasksBulkLayer;
