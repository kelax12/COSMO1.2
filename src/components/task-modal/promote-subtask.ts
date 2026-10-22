// ═══════════════════════════════════════════════════════════════════
// Transformer une sous-tâche en tâche : la logique pure
//
// Une sous-tâche n'a qu'un nom et une case. La tâche qui en naît hérite de ce
// qui CLASSE (catégorie, priorité) et de rien de ce qui ENGAGE : ni échéance
// (elle n'était pas celle de la sous-tâche), ni favori, ni récurrence, ni
// lien OKR, ni État. Elle naît « À faire ».
//
// Seule une sous-tâche NON cochée se convertit : une sous-tâche faite n'a
// rien à devenir.
// ═══════════════════════════════════════════════════════════════════
import type { CreateTaskInput, Subtask, Task } from '@/modules/tasks';

export interface Promotion {
  input: CreateTaskInput;
  /** Sous-tâches de la parente APRÈS retrait. */
  remaining: Subtask[];
  /** La sous-tâche retirée, telle quelle, pour l'« Annuler ». */
  subtask: Subtask;
  /** Sa position d'origine dans la checklist. */
  index: number;
}

export function buildPromotion(parent: Task, subtaskId: string): Promotion | null {
  const list = parent.subtasks ?? [];
  const index = list.findIndex((s) => s.id === subtaskId);
  if (index === -1) return null;
  const subtask = list[index];
  if (subtask.completed) return null;
  return {
    input: {
      name: subtask.name,
      priority: parent.priority,
      category: parent.category,
      deadline: '',
      estimatedTime: 0,
      bookmarked: false,
      completed: false,
      status: 'todo',
    },
    remaining: list.filter((s) => s.id !== subtaskId),
    subtask,
    index,
  };
}

/** Remet une sous-tâche à sa position d'origine, bornée à la liste actuelle. */
export function restoreSubtask(list: readonly Subtask[], subtask: Subtask, index: number): Subtask[] {
  if (list.some((s) => s.id === subtask.id)) return [...list];
  const at = Math.min(Math.max(index, 0), list.length);
  return [...list.slice(0, at), subtask, ...list.slice(at)];
}
