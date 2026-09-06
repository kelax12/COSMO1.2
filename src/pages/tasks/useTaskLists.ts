// ═══════════════════════════════════════════════════════════════════
// Les LISTES de la page Tâches
//
// Lesquelles existent, dans quel ordre, laquelle filtre la page, comment on
// les crée, les renomme, les réordonne, les supprime, et comment on y verse
// des tâches en lot.
//
// FRONTIÈRE : ce hook ne connaît ni le tri des tâches, ni la recherche, ni
// les catégories, ni les modales de la page. Il porte exactement l'état que
// `TaskListsBar` consomme — c'est ce qui rend la barre entièrement pilotée
// par des props, sans état propre.
//
// 🔴 Deux règles qui ne se devinent pas :
//
//   • Le réordonnancement écrit DEUX FOIS, à deux moments distincts. Framer
//     Motion appelle `onReorder` en continu pendant le glisser, à chaque
//     survol d'un voisin ; on n'y touche donc que l'état local (optimiste,
//     pas de retour en arrière visuel), et la persistance est différée au
//     relâchement (`commitReorderLists`). Sans cette séparation, un seul
//     geste déclenche une rafale de mutations concurrentes sur les mêmes
//     lignes — d'où le faux « ressource introuvable » alors que l'ordre
//     final était pourtant bon.
//   • « Aujourd'hui » n'est PAS une liste en base (`VIRTUAL_TODAY_ID`). Y
//     verser une tâche pose son échéance au jour même, via l'unique chemin
//     d'écriture des échéances (`@/lib/deadline`), jamais un `new Date()`.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import {
  useLists,
  useCreateList,
  useUpdateList,
  useAddTaskToList,
  useDeleteListWithUndo,
  SMART_PRESETS,
  type SmartRulePreset,
  type TaskList,
} from '@/modules/lists';
import { deadlineFromDayKey } from '@/lib/deadline';
import { todayKeyInTz } from '@/lib/timezone';
import { VIRTUAL_TODAY_ID } from './task-page-filter';
import type { Translator } from '@/i18n/useT';

/** Visibilité de la chip virtuelle « Aujourd'hui », persistée par appareil. */
const TODAY_HIDDEN_KEY = 'cosmo_lists_today_hidden';

interface Params {
  /** Repose une échéance quand on verse dans la liste virtuelle « Aujourd'hui ». */
  updateTaskDeadline: (taskId: string, deadline: string) => void;
  t: Translator<'tasks'>['t'];
}

export function useTaskLists({ updateTaskDeadline, t }: Params) {
  const { data: lists = [] } = useLists();
  const createListMutation = useCreateList();
  const updateListMutation = useUpdateList();
  const addTaskToListMutation = useAddTaskToList();

  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('blue');
  const [hoveredListId, setHoveredListId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState('');
  const [editListColor, setEditListColor] = useState('blue');
  const [selectingTasksForListId, setSelectingTasksForListId] = useState<string | null>(null);
  const [selectedTasksForList, setSelectedTasksForList] = useState<string[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const [todayHidden, setTodayHiddenState] = useState<boolean>(() => {
    try { return localStorage.getItem(TODAY_HIDDEN_KEY) === '1'; } catch { return false; }
  });
  const setTodayHidden = (hidden: boolean) => {
    setTodayHiddenState(hidden);
    try {
      if (hidden) localStorage.setItem(TODAY_HIDDEN_KEY, '1');
      else        localStorage.removeItem(TODAY_HIDDEN_KEY);
    } catch { /* ignore */ }
    // Si on masque alors qu'elle est sélectionnée comme filtre, on désélectionne
    if (hidden && selectedListId === VIRTUAL_TODAY_ID) setSelectedListId(null);
  };

  // Ordre local des listes — source de vérité pour le rendu Reorder.Group.
  // Sync depuis `lists` (React Query) quand la composition change (ajout,
  // suppression, ou première charge). Pendant un drag, le user voit son
  // mouvement immédiatement sans attendre l'aller-retour Supabase.
  // Sans cet état local, Reorder.Group snap-back parce que `lists` reste
  // dans son ancien ordre tant que la mutation n'a pas refetch.
  const [orderedLists, setOrderedLists] = useState<TaskList[]>(lists);
  useEffect(() => {
    const localIds = orderedLists.map((l) => l.id).sort().join(',');
    const incomingIds = lists.map((l) => l.id).sort().join(',');
    if (localIds !== incomingIds) {
      // Composition différente (ajout / suppression) → reset complet
      setOrderedLists(lists);
    } else {
      // Même composition → merger les changements de contenu (nom, couleur…)
      // en préservant l'ordre local (drag-to-reorder).
      setOrderedLists((prev) => prev.map((l) => lists.find((nl) => nl.id === l.id) ?? l));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists]);

  const handleListSelect = (listId: string) => {
    setSelectedListId(selectedListId === listId ? null : listId);
  };

  const clearListFilter = () => setSelectedListId(null);

  const startEditList = (list: { id: string; name: string; color: string }) => {
    setEditingListId(list.id);
    setEditListName(list.name);
    setEditListColor(list.color);
    setHoveredListId(null);
  };

  const cancelEditList = () => {
    setEditingListId(null);
    setEditListName('');
    setEditListColor('blue');
  };

  const submitEditList = () => {
    if (!editingListId || !editListName.trim()) return;
    updateListMutation.mutate({ id: editingListId, updates: { name: editListName.trim(), color: editListColor } });
    cancelEditList(); // Fermeture immédiate + mise à jour optimiste du hook
  };

  // Suppression directe sans popup : réversible via le toast « Annuler »
  // (recrée la liste puis restaure ses taskIds — create force taskIds à []).
  // Flux partagé avec les deux modales « Ajouter a une liste » (C-41) : le
  // meme geste doit offrir la meme garantie, quel que soit l'ecran.
  const { deleteList } = useDeleteListWithUndo((listId) => {
    if (selectedListId === listId) setSelectedListId(null);
  });
  const deleteListById = (listId: string) => {
    const snapshot = lists.find((l) => l.id === listId);
    if (snapshot) deleteList(snapshot);
  };

  const startSelectingTasks = (listId: string) => {
    setSelectingTasksForListId(listId);
    setSelectedTasksForList([]);
    setHoveredListId(null);
  };

  const toggleTaskForList = (taskId: string) => {
    setSelectedTasksForList((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const confirmAddTasksToList = () => {
    if (!selectingTasksForListId || selectedTasksForList.length === 0) {
      setSelectingTasksForListId(null);
      setSelectedTasksForList([]);
      return;
    }
    // Cas spécial : la liste virtuelle "Aujourd'hui" n'est pas en base.
    // Ajouter une tâche = poser sa deadline à aujourd'hui (00:00 local).
    if (selectingTasksForListId === VIRTUAL_TODAY_ID) {
      // Un seul chemin d'écriture pour toutes les échéances (@/lib/deadline).
      const todayISO = deadlineFromDayKey(todayKeyInTz());
      selectedTasksForList.forEach((taskId) => updateTaskDeadline(taskId, todayISO));
    } else {
      // Liste manuelle classique
      selectedTasksForList.forEach((taskId) => {
        addTaskToListMutation.mutate({ taskId, listId: selectingTasksForListId });
      });
    }
    setSelectingTasksForListId(null);
    setSelectedTasksForList([]);
  };

  const cancelSelectingTasks = () => {
    setSelectingTasksForListId(null);
    setSelectedTasksForList([]);
  };

  // Toggle un preset smart : crée la liste à partir du preset choisi.
  const handleCreateSmartList = (presetKey: SmartRulePreset) => {
    const preset = SMART_PRESETS.find((p) => p.preset === presetKey);
    if (!preset) return;
    // Évite les doublons : si une smart list avec ce preset existe déjà, on la sélectionne.
    const existing = lists.find((l) => l.type === 'smart' && l.smartRule === presetKey);
    if (existing) {
      setSelectedListId(existing.id);
      return;
    }
    createListMutation.mutate({
      // Le nom est PERSISTÉ : on écrit celui de la langue courante. La liste
      // reste renommable.
      name: t(preset.labelKey),
      color: preset.color,
      type: 'smart',
      smartRule: presetKey,
    });
  };

  /** Pendant le glisser : état local seulement (cf. en-tête). */
  const handleReorderLists = (newOrder: TaskList[]) => setOrderedLists(newOrder);

  /** Au relâchement : une seule salve d'écritures, pour les positions qui bougent. */
  const commitReorderLists = () => {
    orderedLists.forEach((list, idx) => {
      if (list.position !== idx) {
        updateListMutation.mutate({ id: list.id, updates: { position: idx } });
      }
    });
  };

  // Toggle la liste par défaut (un seul à la fois).
  const handleToggleDefault = (list: TaskList) => {
    if (list.isDefault) {
      updateListMutation.mutate({ id: list.id, updates: { isDefault: false } });
    } else {
      const previousDefault = lists.find((l) => l.isDefault);
      if (previousDefault) {
        updateListMutation.mutate({ id: previousDefault.id, updates: { isDefault: false } });
      }
      updateListMutation.mutate({ id: list.id, updates: { isDefault: true } });
    }
  };

  return {
    lists,
    orderedLists,
    createListMutation,
    updateListMutation,
    showCreateList, setShowCreateList,
    newListName, setNewListName,
    newListColor, setNewListColor,
    hoveredListId, setHoveredListId,
    editingListId, editListName, setEditListName, editListColor, setEditListColor,
    selectingTasksForListId, selectedTasksForList,
    selectedListId, setSelectedListId,
    todayHidden, setTodayHidden,
    handleListSelect,
    clearListFilter,
    startEditList,
    cancelEditList,
    submitEditList,
    deleteListById,
    startSelectingTasks,
    toggleTaskForList,
    confirmAddTasksToList,
    cancelSelectingTasks,
    handleCreateSmartList,
    handleReorderLists,
    commitReorderLists,
    handleToggleDefault,
  };
}
