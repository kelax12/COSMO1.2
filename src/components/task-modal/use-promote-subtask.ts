// ═══════════════════════════════════════════════════════════════════
// Transformer une sous-tâche en tâche : les écritures
//
// Ordre non négociable : CRÉER d'abord, retirer ensuite. Si la création
// échoue (réseau, validation), la sous-tâche reste où elle était : rien n'est
// perdu, et le hook de création affiche déjà l'erreur.
//
// Un seul « Annuler » défait les deux écritures : la tâche créée est
// supprimée, la sous-tâche revient à sa place (même id, même position), dans
// la checklist relue au moment de l'annulation, pas dans celle du clic.
// ═══════════════════════════════════════════════════════════════════
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  taskKeys, useCreateTask, useDeleteTask, useTasks, useUpdateTask,
  type Subtask, type Task,
} from '@/modules/tasks';
import { showUndoToast } from '@/lib/undo-toast';
import { useT } from '@/i18n/useT';
import { buildPromotion, restoreSubtask } from './promote-subtask';

/**
 * @param taskId tâche parente
 * @returns `promote(subtaskId, items, apply)` : `items` est la checklist
 *   affichée, `apply` met à jour l'affichage local de la checklist.
 */
export function usePromoteSubtask(taskId: string | undefined) {
  const { t } = useT('tasks');
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useTasks();
  const { mutateAsync: createTask } = useCreateTask();
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: deleteTask } = useDeleteTask();

  return useCallback(async (subtaskId: string, items: Subtask[], apply: (next: Subtask[]) => void) => {
    const parent = tasks.find((x) => x.id === taskId);
    if (!parent || !taskId) return;
    const promotion = buildPromotion({ ...parent, subtasks: items }, subtaskId);
    if (!promotion) return;

    let created: Task;
    try {
      created = await createTask(promotion.input);
    } catch {
      return; // `useCreateTask` a déjà affiché l'erreur ; la sous-tâche reste.
    }

    apply(promotion.remaining);
    updateTask({ id: taskId, updates: { subtasks: promotion.remaining } });

    showUndoToast(t('subtasks.promoted'), () => {
      deleteTask(created.id);
      const latest = queryClient.getQueryData<Task[]>(taskKeys.lists())
        ?.find((x) => x.id === taskId)?.subtasks ?? promotion.remaining;
      const restored = restoreSubtask(latest, promotion.subtask, promotion.index);
      updateTask({ id: taskId, updates: { subtasks: restored } });
      apply(restored);
    });
  }, [tasks, taskId, createTask, updateTask, deleteTask, queryClient, t]);
}
