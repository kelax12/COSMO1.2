import { toast } from 'sonner';
import type {
  useCreateTask,
  useUpdateTask,
  CreateTaskInput,
  UpdateTaskInput,
  Task,
} from '@/modules/tasks';
import type { useAddTaskToList, useRemoveTaskFromList, useLists } from '@/modules/lists';
import type { useFriends, useShareTask, useUnshareTask } from '@/modules/friends';

interface TaskSaveFormData {
  name: string;
  description: string;
  priority: number;
  category: string;
  deadline: string;
  estimatedTime: number;
  completed: boolean;
  bookmarked: boolean;
  isFromOKR: boolean;
}

export interface TaskSaveDeps {
  isCreating: boolean;
  task?: Task;
  formData: TaskSaveFormData;
  collaborators: string[];
  pendingInvitesLocal: string[];
  friends: NonNullable<ReturnType<typeof useFriends>['data']>;
  lists: NonNullable<ReturnType<typeof useLists>['data']>;
  selectedListIds: string[];
  isTaskOwner: boolean;
  existingShareIds: string[];
  createTaskMutation: ReturnType<typeof useCreateTask>;
  updateTaskMutation: ReturnType<typeof useUpdateTask>;
  addTaskToListMutation: ReturnType<typeof useAddTaskToList>;
  removeTaskFromListMutation: ReturnType<typeof useRemoveTaskFromList>;
  shareTaskMutation: ReturnType<typeof useShareTask>;
  unshareTaskMutation: ReturnType<typeof useUnshareTask>;
  computeValidationErrors: () => { [key: string]: string };
  setErrors: (errors: { [key: string]: string }) => void;
  onClose: () => void;
}

// Orchestration création / mise à jour d'une tâche + synchro listes + partages
// shared_tasks. Logique extraite verbatim de TaskModal (handleSave).
export async function runTaskSave(deps: TaskSaveDeps) {
  const {
    isCreating, task, formData, collaborators, pendingInvitesLocal, friends,
    lists, selectedListIds, isTaskOwner, existingShareIds,
    createTaskMutation, updateTaskMutation, addTaskToListMutation,
    removeTaskFromListMutation, shareTaskMutation, unshareTaskMutation,
    computeValidationErrors, setErrors, onClose,
  } = deps;

  const validationErrors = computeValidationErrors();
  setErrors(validationErrors);
  if (Object.keys(validationErrors).length > 0) {
    // Affiche le premier message d'erreur en toast — sinon l'utilisateur
    // peut ne pas voir l'erreur inline cachée plus haut dans le modal.
    toast.error(Object.values(validationErrors)[0]);
    return;
  }
  if (!isCreating && !task) return;

  if (isCreating) {
    // Use createTaskMutation for new tasks
    const createData: CreateTaskInput = {
      name: formData.name,
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      category: formData.category,
      deadline: formData.deadline ? new Date(formData.deadline).toISOString() : '',
      estimatedTime: Number(formData.estimatedTime),
      completed: formData.completed,
      bookmarked: formData.bookmarked,
      isCollaborative: collaborators.length > 0,
      pendingInvites: pendingInvitesLocal,
    };

    createTaskMutation.mutate(createData, {
      onSuccess: (newTask) => {
        // Le partage réel passe par shared_tasks (plus de colonne
        // `collaborators`). On ignore les invitations email en attente —
        // elles vivent dans pendingInvites jusqu'à acceptation.
        if (newTask) {
          collaborators.forEach((userId) => {
            if (pendingInvitesLocal.includes(userId)) return;
            const friend = friends.find(
              f => (f.userId ?? f.id) === userId || f.id === userId
            );
            shareTaskMutation.mutate({
              taskId: newTask.id,
              friendId: userId,
              friendEmail: friend?.email,
              role: 'editor'
            });
          });
        }
        onClose();
      },
      onError: (err) => {
        console.error('Error creating task:', err);
        setErrors({ general: 'Erreur lors de la création. Veuillez réessayer.' });
      }
    });
  } else if (task) {
    const taskData: UpdateTaskInput = {
      name: formData.name,
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      category: formData.category,
      deadline: formData.deadline ? new Date(formData.deadline).toISOString() : '',
      estimatedTime: Number(formData.estimatedTime),
      completed: formData.completed,
      bookmarked: formData.bookmarked,
      isCollaborative: collaborators.length > 0,
      pendingInvites: pendingInvitesLocal,
    };

    updateTaskMutation.mutate(
      { id: task.id, updates: taskData },
      {
        onSuccess: () => {
          // Sync lists
          const currentListIds = lists.filter(l => l.taskIds.includes(task.id)).map(l => l.id);

          // Add to new lists
          selectedListIds.forEach(listId => {
            if (!currentListIds.includes(listId)) {
              addTaskToListMutation.mutate({ taskId: task.id, listId });
            }
          });

          // Remove from deselected lists
          currentListIds.forEach(listId => {
            if (!selectedListIds.includes(listId)) {
              removeTaskFromListMutation.mutate({ taskId: task.id, listId });
            }
          });

          // Seul le propriétaire gère les partages (RLS le rejetterait pour un
          // destinataire de toute façon). On saute toute écriture shared_tasks
          // quand l'utilisateur n'est pas propriétaire.
          if (isTaskOwner) {
            // Additions: nouveaux collaborateurs sélectionnés non encore
            // partagés (et qui ne sont pas des invitations email en attente).
            collaborators.forEach(userId => {
              if (pendingInvitesLocal.includes(userId)) return;
              if (!existingShareIds.includes(userId)) {
                // Find the friend's email so shareTask can resolve the
                // canonical auth.uid via profiles, even when userId is
                // actually a friends-table row id (no profile lookup yet).
                const friend = friends.find(
                  f => (f.userId ?? f.id) === userId || f.id === userId
                );
                shareTaskMutation.mutate({
                  taskId: task.id,
                  friendId: userId,
                  friendEmail: friend?.email,
                  role: 'editor'
                });
              }
            });

            // Removals: grants shared_tasks dé-sélectionnés → on retire le
            // partage (pas de gate premium pour retirer).
            existingShareIds.forEach(shareId => {
              if (!collaborators.includes(shareId)) {
                unshareTaskMutation.mutate({ taskId: task.id, friendId: shareId });
              }
            });
          }

          onClose();
        },
        onError: (err) => {
          console.error('Error saving task:', err);
          setErrors({ general: 'Erreur lors de la sauvegarde. Veuillez réessayer.' });
        }
      }
    );
  }
}
