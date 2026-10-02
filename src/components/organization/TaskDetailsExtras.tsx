import type { TeamTask } from '@/modules/team-projects';
import FollowTaskToggle from './FollowTaskToggle';

interface Props {
  orgId: string;
  task: TeamTask;
}

/**
 * Bas de l'onglet Détails d'une tâche EXISTANTE : « Suivre » (mig. 162, M14).
 * Chargé paresseusement : la fiche de tâche a un cliquet de poids (`check:bundle`).
 * Les champs personnalisés (mig. 197) ont été retirés le 2026-10-01 (mig. 211).
 */
const TaskDetailsExtras = ({ orgId, task }: Props) => (
  <div className="mt-4 space-y-4">
    <FollowTaskToggle orgId={orgId} taskId={task.id} />
  </div>
);

export default TaskDetailsExtras;
