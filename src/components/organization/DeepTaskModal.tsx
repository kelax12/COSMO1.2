// Tâche ouverte par `?task=`, depuis n'importe quelle section (`OrgDeepLinkHost`).
// Chargée à la demande : seul qui suit un lien de tâche la paie.

import { useEffect } from 'react';
import { showUndoToast } from '@/lib/undo-toast';
import type { OrgMember } from '@/modules/organizations';
import {
  useTeamProjects, useTeamTasks, useUpdateTeamTask, useDeleteTeamTask, useRestoreTeamTask,
  type TeamTask, type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import TeamTaskModal from './TeamTaskModal';

interface DeepTaskModalProps {
  orgId: string;
  taskId: string;
  members: OrgMember[];
  isManager: boolean;
  onClose: () => void;
}

/**
 * La tâche nommée par `?task=`. Tant que la liste n'est pas arrivée, rien ne
 * s'affiche ; une tâche introuvable (supprimée, hors de mon périmètre) ne
 * laisse pas un modal vide : le paramètre est retiré.
 */
const DeepTaskModal = ({ orgId, taskId, members, isManager, onClose }: DeepTaskModalProps) => {
  const { t } = useT('org');
  const { data: tasks, isFetched } = useTeamTasks(orgId, undefined, { background: true });
  const { data: projects = [] } = useTeamProjects(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);
  const restoreTask = useRestoreTeamTask(orgId);
  const task = tasks?.find((x) => x.id === taskId);
  const missing = isFetched && !task;
  useEffect(() => {
    if (missing) onClose();
  }, [missing, onClose]);

  if (!task) return null;

  // Même filet que partout ailleurs : supprimer une tâche est RÉVERSIBLE.
  const remove = (target: TeamTask) =>
    deleteTask.mutate(target.id, {
      onSuccess: () => showUndoToast(t('projects.taskDeleted'), () => restoreTask.mutate(target.id)),
    });

  return (
    <TeamTaskModal
      task={task}
      projects={projects.filter((p) => !p.archivedAt || p.id === task.projectId)}
      members={members}
      onUpdate={(id: string, input: UpdateTeamTaskInput) => updateTask.mutateAsync({ taskId: id, input })}
      onDelete={remove}
      isManager={isManager}
      onClose={onClose}
    />
  );
};


export default DeepTaskModal;
