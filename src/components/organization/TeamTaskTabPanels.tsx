// Onglets Sous-tâches, Dépendances et Historique de la fiche de tâche d'équipe
// (audit des popups, 2026-09-25), chargés à la PREMIÈRE ouverture d'un de ces
// onglets : la fiche s'ouvre sur « Détails », et ces trois panneaux faisaient
// passer le chunk `TeamTaskModal` de 14,4 à 20 ko (plafond 14,5).

import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import TeamSubtasksSection from './TeamSubtasksSection';
import TeamTaskDependenciesSection from './TeamTaskDependenciesSection';
import TeamTaskHistoryPanel from './TeamTaskHistoryPanel';
import { DraftSubtasksEditor, DraftDependenciesEditor } from './TeamTaskDraftSections';

export type TeamTaskPanelTab = 'subtasks' | 'dependencies' | 'history';

interface TeamTaskTabPanelsProps {
  tab: TeamTaskPanelTab;
  orgId: string;
  /** La tâche enregistrée ; absente en création, on édite alors un brouillon. */
  liveTask: TeamTask | null | undefined;
  isManager: boolean;
  projectId: string;
  members: OrgMember[];
  projects: TeamProject[];
  draftSubtasks: string[];
  onDraftSubtasksChange: (next: string[]) => void;
  draftBlockedBy: string[];
  onDraftBlockedByChange: (next: string[]) => void;
}

const TeamTaskTabPanels = ({
  tab, orgId, liveTask, isManager, projectId, members, projects,
  draftSubtasks, onDraftSubtasksChange, draftBlockedBy, onDraftBlockedByChange,
}: TeamTaskTabPanelsProps) => {
  if (tab === 'subtasks') {
    return liveTask
      ? <TeamSubtasksSection taskId={liveTask.id} />
      : <DraftSubtasksEditor value={draftSubtasks} onChange={onDraftSubtasksChange} />;
  }
  if (tab === 'dependencies') {
    return liveTask
      ? <TeamTaskDependenciesSection task={liveTask} isManager={isManager} defaultOpen />
      : <DraftDependenciesEditor orgId={orgId} projectId={projectId} value={draftBlockedBy} onChange={onDraftBlockedByChange} canEdit={isManager} />;
  }
  return liveTask ? <TeamTaskHistoryPanel taskId={liveTask.id} members={members} projects={projects} /> : null;
};

export default TeamTaskTabPanels;
