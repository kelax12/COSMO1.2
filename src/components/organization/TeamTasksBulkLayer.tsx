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
  /** Organisation des listes (mig. 203) : « Liste » ouvre la popup d'ajout groupé. */
  listsOrgId?: string;
}

const TeamTasksBulkLayer = ({ bulk, members, projects, placement, listsOrgId }: TeamTasksBulkLayerProps) => (
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
    onSetPriority={bulk.bulkSetPriority}
    onSetDeadline={bulk.bulkSetDeadline}
    placement={placement}
    listsOrgId={listsOrgId}
    selectedTaskIds={bulk.selectedTasks.map((t) => t.id)}
  />
);

export default TeamTasksBulkLayer;
