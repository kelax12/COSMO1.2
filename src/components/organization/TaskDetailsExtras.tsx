import type { TeamTask } from '@/modules/team-projects';
import FollowTaskToggle from './FollowTaskToggle';
import TaskCustomFieldsSection from './config/TaskCustomFieldsSection';

interface Props {
  orgId: string;
  task: TeamTask;
  canEdit: boolean;
}

/**
 * Bas de l'onglet Détails d'une tâche EXISTANTE : ses champs personnalisés
 * (mig. 197) et « Suivre » (mig. 162, M14). Un seul chargement paresseux pour
 * les deux : la fiche de tâche a un cliquet de poids (`check:bundle`).
 */
const TaskDetailsExtras = ({ orgId, task, canEdit }: Props) => (
  <div className="mt-4 space-y-4">
    <TaskCustomFieldsSection orgId={orgId} taskId={task.id} projectId={task.projectId} canEdit={canEdit} />
    <FollowTaskToggle orgId={orgId} taskId={task.id} />
  </div>
);

export default TaskDetailsExtras;
