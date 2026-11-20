import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showUndoToast } from '@/lib/undo-toast';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';
import { taskKeys, type Task, type useDeleteTask, type useRestoreTask } from '@/modules/tasks';
import type { useUnshareTask } from '@/modules/friends';

interface UseTaskDeletionArgs {
  tasks: Task[];
  isDemo: boolean;
  userId: string | undefined;
  deleteMutation: ReturnType<typeof useDeleteTask>;
  restoreMutation: ReturnType<typeof useRestoreTask>;
  unshareTaskMutation: ReturnType<typeof useUnshareTask>;
}

/**
 * Suppression d'une tâche depuis la liste (extrait de `TaskTable`, déplacement
 * pur) : suppression directe réversible, ou confirmation pour une tâche
 * collaborative / reçue, qui ne se supprime pas mais se quitte.
 */
export function useTaskDeletion({
  tasks,
  isDemo,
  userId,
  deleteMutation,
  restoreMutation,
  unshareTaskMutation,
}: UseTaskDeletionArgs) {
  const { t } = useT('tasks');
  const queryClient = useQueryClient();
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const deleteTaskById = (taskId: string) => {
    // Snapshot la tâche AVANT suppression pour permettre l'undo
    const taskSnapshot = tasks.find(t => t.id === taskId);

    // Tâche collaborative REÇUE (prod) : on n'en est pas propriétaire, la RLS
    // bloque le DELETE (qui échouait en silence → la tâche réapparaissait). On
    // retire plutôt notre accès (quitter la tâche) en supprimant la grant.
    const isReceivedProd =
      !isDemo && !!taskSnapshot?.userId && !!userId && taskSnapshot.userId !== userId;
    if (isReceivedProd && userId) {
      unshareTaskMutation.mutate(
        { taskId, friendId: userId },
        {
          onSuccess: () => {
            setTaskToDelete(null);
            queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
            toast.success(t('toast.leftShared'));
          },
          onError: (err) => console.error('Leave shared task failed', err),
        }
      );
      return;
    }

    deleteMutation.mutate(taskId, {
      onSuccess: () => {
        setTaskToDelete(null);
        if (taskSnapshot) {
          showUndoToast(t('toast.deleted'), () => {
            restoreMutation.mutate(taskSnapshot);
          });
        }
      },
      onError: (err) => console.error('Delete failed', err),
    });
  };

  const confirmDelete = () => {
    if (taskToDelete) deleteTaskById(taskToDelete);
  };

  // Tâche perso : suppression directe, réversible via le toast « Annuler ».
  // La popup de confirmation n'est gardée que pour les tâches collaboratives
  // ou reçues (impact sur d'autres personnes, partages non restaurés).
  const handleDeleteRequest = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const isReceivedProd =
      !isDemo && !!task?.userId && !!userId && task.userId !== userId;
    if (task?.isCollaborative || isReceivedProd) {
      setTaskToDelete(taskId);
    } else {
      deleteTaskById(taskId);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    `deleteTaskById` est redefini a chaque rendu ; le mettre en dependance
       annulerait la memoisation que ce `useCallback` existe pour obtenir. Les
       trois valeurs LUES pour decider (`tasks`, `isDemo`, `userId`) y sont,
       donc la confirmation ne peut pas se decider sur une donnee perimee. */
  }, [tasks, isDemo, userId]);

  return { taskToDelete, setTaskToDelete, confirmDelete, handleDeleteRequest };
}
