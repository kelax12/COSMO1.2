// ═══════════════════════════════════════════════════════════════════
// Sélection multiple + actions groupées de l'onglet Projets
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de `TeamProjectsTab` : un bloc autonome (un mode, un ensemble d'ids,
// des actions de lot) qui n'a besoin de rien du reste de l'onglet sinon la
// liste visible et les mutations. Le sortir garde l'onglet lisible et rend ce
// comportement testable sans monter tout l'écran.
//
// Depuis le 2026-09-24, la sélection vaut pour TOUTES les vues (liste, tableau,
// planning) et le lot sait réassigner, déplacer et changer de statut, chaque
// geste avec son « Annuler » : c'est le même filet que la suppression.

import { useMemo, useState } from 'react';
import { showUndoToast } from '@/lib/undo-toast';
import { useT } from '@/i18n/useT';
import type { TeamTask, TeamTaskStatus, UpdateTeamTaskInput } from '@/modules/team-projects';

interface Options {
  /** Tâches actuellement affichées — une sélection ne survit pas au filtre. */
  visibleTasks: TeamTask[];
  setCompleted: (task: TeamTask, completed: boolean) => void;
  deleteTask: (taskId: string) => void;
  /** Recrée une tâche supprimée (annulation du lot). */
  restoreTask: (task: TeamTask) => void;
  /** Libellé de l'annulation groupée, déjà pluralisé par l'appelant. */
  deletedLabel: (count: number) => string;
  /** Patch d'une tâche — réassigner, déplacer, changer de statut. */
  updateTask?: (task: TeamTask, input: UpdateTeamTaskInput) => void;
  /** Libellés d'annulation des trois gestes de lot, déjà pluralisés. */
  labels?: {
    reassigned: (count: number) => string;
    moved: (count: number) => string;
    statusChanged: (count: number) => string;
  };
  /**
   * Portée d'assignation (mig. 115) : un ajout hors portée est ignoré plutôt
   * que d'échouer tâche par tâche sur la RLS.
   */
  canAssign?: (userId: string) => boolean;
}

/**
 * Nouvelle liste d'assignés d'une tâche pour un geste de lot. `null` retire
 * tout le monde ; sinon on AJOUTE la personne (une réassignation de lot ne
 * doit pas retirer silencieusement les co-assignés d'une tâche partagée).
 */
export const nextAssignees = (current: string[], userId: string | null): string[] =>
  userId === null ? [] : current.includes(userId) ? current : [...current, userId];

export const useTeamTasksSelection = ({
  visibleTasks, setCompleted, deleteTask, restoreTask, deletedLabel, updateTask, labels, canAssign,
}: Options) => {
  const { tp: tpa } = useT('orgAdmin');
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

  /**
   * Applique un patch à chaque tâche du lot qui CHANGE réellement, puis
   * propose d'annuler en réécrivant l'état d'avant, tâche par tâche.
   */
  const applyWithUndo = (
    patchOf: (task: TeamTask) => UpdateTeamTaskInput | null,
    undoOf: (task: TeamTask) => UpdateTeamTaskInput,
    label: ((count: number) => string) | undefined,
  ) => {
    if (!updateTask) return;
    const changed: TeamTask[] = [];
    for (const task of selectedTasks) {
      const patch = patchOf(task);
      if (!patch) continue;
      updateTask(task, patch);
      changed.push(task);
    }
    clearSelection();
    if (changed.length > 0 && label) {
      showUndoToast(label(changed.length), () => {
        for (const task of changed) updateTask(task, undoOf(task));
      });
    }
  };

  const bulkAssign = (userId: string | null) => {
    if (userId !== null && canAssign && !canAssign(userId)) return;
    applyWithUndo(
      (task) => {
        const next = nextAssignees(task.assigneeIds, userId);
        return next.length === task.assigneeIds.length && next.every((id) => task.assigneeIds.includes(id))
          ? null
          : { assigneeIds: next };
      },
      (task) => ({ assigneeIds: task.assigneeIds }),
      labels?.reassigned,
    );
  };

  const bulkMove = (projectId: string) =>
    applyWithUndo(
      (task) => (task.projectId === projectId ? null : { projectId }),
      (task) => ({ projectId: task.projectId }),
      labels?.moved,
    );

  // `status` seul : le serveur synchronise `completed` (trigger mig. 091).
  const bulkSetStatus = (status: TeamTaskStatus) =>
    applyWithUndo(
      (task) => (task.status === status ? null : { status }),
      (task) => ({ status: task.status }),
      labels?.statusChanged,
    );

  // Priorité et échéance en lot (audit du 2026-09-24 : « trois actions
  // seulement »). Même filet que les autres gestes : un « Annuler » qui réécrit
  // la valeur d'avant, tâche par tâche.
  const bulkSetPriority = (priority: number) =>
    applyWithUndo(
      (task) => (task.priority === priority ? null : { priority }),
      (task) => ({ priority: task.priority }),
      (count) => tpa('bulk.priorityChanged', count),
    );

  /** `''` retire l'échéance. Une date de début postérieure est ramenée à l'échéance (CHECK mig. 153). */
  const bulkSetDeadline = (deadline: string) =>
    applyWithUndo(
      (task) => {
        if ((task.deadline ?? '') === deadline) return null;
        const clampStart = !!deadline && !!task.startDate && task.startDate > deadline;
        return clampStart ? { deadline, startDate: deadline } : { deadline };
      },
      (task) => ({ deadline: task.deadline ?? '', startDate: task.startDate ?? '' }),
      (count) => tpa('bulk.deadlineChanged', count),
    );

  /** Tout ce que `BulkActionsBar` consomme, d'un seul tenant. */
  const bulkBarProps = {
    count: selectedTasks.length,
    hasOpen: selectedTasks.some((t) => !t.completed),
    hasCompleted: selectedTasks.some((t) => t.completed),
    onComplete: () => bulkSetCompleted(true),
    onReopen: () => bulkSetCompleted(false),
    onDelete: bulkDelete,
    onExit: exitSelectMode,
    onAssign: bulkAssign,
    onMove: bulkMove,
    onSetStatus: bulkSetStatus,
    onSetPriority: bulkSetPriority,
    onSetDeadline: bulkSetDeadline,
  };

  return {
    bulkBarProps,
    bulkSetPriority,
    bulkSetDeadline,
    selectMode,
    setSelectMode,
    selectedIds,
    selectedTasks,
    toggleSelect,
    clearSelection,
    exitSelectMode,
    bulkSetCompleted,
    bulkDelete,
    bulkAssign,
    bulkMove,
    bulkSetStatus,
  };
};
