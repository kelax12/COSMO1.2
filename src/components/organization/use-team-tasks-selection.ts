// ═══════════════════════════════════════════════════════════════════
// Sélection multiple + actions groupées de l'onglet Projets
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de `TeamProjectsTab` : un bloc autonome (un mode, un ensemble d'ids,
// deux actions de lot) qui n'a besoin de rien du reste de l'onglet sinon la
// liste visible et les mutations. Le sortir garde l'onglet lisible et rend ce
// comportement testable sans monter tout l'écran.

import { useMemo, useState } from 'react';
import { showUndoToast } from '@/lib/undo-toast';
import type { TeamTask } from '@/modules/team-projects';

interface Options {
  /** Tâches actuellement affichées — une sélection ne survit pas au filtre. */
  visibleTasks: TeamTask[];
  setCompleted: (task: TeamTask, completed: boolean) => void;
  deleteTask: (taskId: string) => void;
  /** Recrée une tâche supprimée (annulation du lot). */
  restoreTask: (task: TeamTask) => void;
  /** Libellé de l'annulation groupée, déjà pluralisé par l'appelant. */
  deletedLabel: (count: number) => string;
}

export const useTeamTasksSelection = ({
  visibleTasks, setCompleted, deleteTask, restoreTask, deletedLabel,
}: Options) => {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleSelect = (task: TeamTask) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const exitSelectMode = () => {
    setSelectMode(false);
    clearSelection();
  };

  /** Tâches sélectionnées ENCORE visibles — une sélection ne survit pas au filtre. */
  const selectedTasks = useMemo(
    () => visibleTasks.filter((t) => selectedIds.has(t.id)),
    [visibleTasks, selectedIds],
  );

  const bulkSetCompleted = (completed: boolean) => {
    for (const task of selectedTasks) {
      if (task.completed === completed) continue;
      setCompleted(task, completed);
    }
    clearSelection();
  };

  // Suppression groupée : une seule ligne d'annulation qui recrée TOUT le lot,
  // plutôt qu'un toast par tâche qui noierait l'écran.
  const bulkDelete = () => {
    const doomed = [...selectedTasks];
    if (doomed.length === 0) return;
    clearSelection();
    for (const task of doomed) deleteTask(task.id);
    showUndoToast(deletedLabel(doomed.length), () => {
      for (const task of doomed) restoreTask(task);
    });
  };

  return {
    selectMode,
    setSelectMode,
    selectedIds,
    selectedTasks,
    toggleSelect,
    clearSelection,
    exitSelectMode,
    bulkSetCompleted,
    bulkDelete,
  };
};
