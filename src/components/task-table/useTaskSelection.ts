// ═══════════════════════════════════════════════════════════════════
// Le mode SÉLECTION, et ce qu'on fait d'une sélection
//
// FRONTIÈRE : ce hook porte la sélection (quelles tâches sont cochées, comment
// on entre et sort du mode) ET les cinq actions groupées qui s'appliquent à
// elle. Il ne rend rien, n'ouvre aucune fiche, ne trie aucune liste.
//
// 🔴 La règle qui ne doit pas se perdre en chemin : une tâche REÇUE ne
// s'efface pas, on quitte son partage. On n'en est pas propriétaire, la RLS
// refuse le DELETE, et ce départ-là n'est PAS réversible — c'est pourquoi le
// toast « Annuler » ne couvre que les tâches possédées.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { showUndoToast } from '@/lib/undo-toast';
import type { Task } from '@/modules/tasks';
import type { TaskList } from '@/modules/lists';
import { useT } from '@/i18n/useT';

interface Params {
  tasks: Task[];
  lists: TaskList[];
  /** Identité du compte : sert à distinguer une tâche reçue d'une tâche à soi. */
  userId?: string;
  isDemo: boolean;
  toggleComplete: (taskId: string) => void;
  addTaskToList: (taskId: string, listId: string) => void;
  updateTask: (taskId: string, updates: { category?: string; deadline?: string }) => void;
  deleteTask: (taskId: string) => void;
  restoreTask: (task: Task) => void;
  unshareTask: (taskId: string, friendId: string) => void;
}

export function useTaskSelection({
  tasks,
  lists,
  userId,
  isDemo,
  toggleComplete,
  addTaskToList,
  updateTask,
  deleteTask,
  restoreTask,
  unshareTask,
}: Params) {
  const { tp } = useT('tasks');

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Modal d'ajout groupé à une liste (#23) — remplace l'ancien DropdownMenu
  // (désactivé quand aucune liste manuelle → bouton « Liste » sans réaction).
  const [showBulkListModal, setShowBulkListModal] = useState(false);
  // Modal de confirmation bloquant pour la suppression groupée (#10).
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  // Nombre de tâches figé à l'ouverture du modal : `bulkAddToList` vide la
  // sélection, on évite un « 0 tâche » qui clignoterait pendant la fermeture.
  const [bulkModalCount, setBulkModalCount] = useState(0);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  // ⚠️ Aucun `setBulkMenuOpen(false)` ici : l'état du menu « ⋯ » vit dans
  // `TaskBulkActionsBar`, qui se ferme lui-même et disparaît avec le mode
  // sélection. Cinq gestionnaires métier n'ont plus à connaître un menu.
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };

  const openBulkListModal = () => { setBulkModalCount(selectedIds.length); setShowBulkListModal(true); };

  const bulkComplete = () => {
    const toComplete = tasks.filter((t) => selectedIds.includes(t.id) && !t.completed);
    toComplete.forEach((t) => toggleComplete(t.id));
    toast.success(tp('toast.completedCount', toComplete.length));
    exitSelectMode();
  };

  const bulkAddToList = (listId: string) => {
    selectedIds.forEach((taskId) => addTaskToList(taskId, listId));
    const listName = lists.find((l) => l.id === listId)?.name ?? 'la liste';
    toast.success(tp('toast.addedToList', selectedIds.length, { list: listName }));
    exitSelectMode();
  };

  const confirmBulkDelete = () => {
    const selected = tasks.filter((t) => selectedIds.includes(t.id));

    // Tâches REÇUES (prod) : on n'en est pas propriétaire, la RLS bloque le
    // DELETE. On quitte plutôt le partage (unshare) — non restaurable via undo.
    const received = selected.filter((t) => !isDemo && !!t.userId && !!userId && t.userId !== userId);
    // Tout le reste (perso + collaboratives dont on est propriétaire) : DELETE
    // classique, réversible via le toast « Annuler ».
    const ownedSnapshots = selected.filter((t) => !received.includes(t));

    received.forEach((t) => {
      if (userId) unshareTask(t.id, userId);
    });
    ownedSnapshots.forEach((t) => deleteTask(t.id));

    if (ownedSnapshots.length > 0) {
      showUndoToast(tp('toast.deletedCount', ownedSnapshots.length), () => {
        ownedSnapshots.forEach((s) => restoreTask(s));
      });
    } else if (received.length > 0) {
      toast.success(tp('toast.leftSharedCount', received.length));
    }

    setShowBulkDeleteConfirm(false);
    exitSelectMode();
  };

  // Menu « ⋯ » : modification groupée de la catégorie / deadline.
  // `task.category` stocke l'ID de la catégorie (cf. seed démo `cat-1`..`cat-5`
  // + useCategoryLookup, qui indexe par id) — jamais le nom affiché.
  const bulkSetCategory = (categoryId: string, categoryName: string) => {
    selectedIds.forEach((id) => updateTask(id, { category: categoryId }));
    toast.success(tp('toast.movedToCategory', selectedIds.length, { category: categoryName }));
    exitSelectMode();
  };

  const bulkSetDeadline = (deadline: string) => {
    selectedIds.forEach((id) => updateTask(id, { deadline }));
    toast.success(tp('toast.deadlineUpdated', selectedIds.length));
    exitSelectMode();
  };

  return {
    selectMode,
    setSelectMode,
    selectedIds,
    toggleSelected,
    exitSelectMode,
    showBulkListModal,
    setShowBulkListModal,
    openBulkListModal,
    bulkModalCount,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    bulkComplete,
    bulkAddToList,
    confirmBulkDelete,
    bulkSetCategory,
    bulkSetDeadline,
  };
}
