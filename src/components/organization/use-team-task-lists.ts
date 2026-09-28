// ═══════════════════════════════════════════════════════════════════
// Les LISTES de l'onglet Tâches du mode entreprise (mig. 203)
//
// Pendant exact de `pages/tasks/useTaskLists` : il porte l'état que
// `TaskListsBar` consomme, pour que l'onglet réutilise LA barre personnelle
// (puces, glisser pour réordonner, édition en ligne, listes intelligentes,
// « Aujourd'hui », appui long sur mobile) au lieu d'en copier une.
//
// Trois écarts, tous voulus :
//   • l'épingle « par défaut » vit sur l'appareil (`default-pin.ts`) : une
//     liste d'entreprise est partagée, l'épingle est un choix personnel ;
//   • pas de partage : toute l'organisation voit déjà la liste ;
//   • « ajouter des tâches » passe par le mode sélection du tableau (les
//     cases à cocher existent déjà), et non par un second mécanisme.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SMART_PRESETS, tasksInList, tasksDueToday, type SmartRulePreset, type TaskList } from '@/modules/lists';
import {
  useTeamLists, useCreateTeamList, useUpdateTeamList, useAddTaskToTeamList, useRemoveTaskFromTeamList, useDeleteTeamListWithUndo,
  readDefaultTeamListId, writeDefaultTeamListId, type TeamList,
} from '@/modules/team-lists';
import type { TeamTask } from '@/modules/team-projects';
import { todayKeyInTz } from '@/lib/timezone';
import { VIRTUAL_TODAY_ID } from '@/pages/tasks/task-page-filter';
import type { Translator } from '@/i18n/useT';

const todayHiddenKey = (orgId: string) => `cosmo_team_lists_today_hidden:${orgId}`;

interface Params {
  orgId: string;
  /** Toutes les tâches chargées (compteurs et filtre). */
  tasks: TeamTask[];
  /** Pose l'échéance du jour quand on verse dans « Aujourd'hui ». */
  setDeadline: (taskId: string, deadline: string) => void;
  t: Translator<'tasks'>['t'];
}

export function useTeamTaskLists({ orgId, tasks, setDeadline, t }: Params) {
  const { data: rawLists = [] } = useTeamLists(orgId);
  const createListMutation = useCreateTeamList(orgId);
  const updateListMutation = useUpdateTeamList(orgId);
  const addTaskToList = useAddTaskToTeamList(orgId);
  const removeTaskFromList = useRemoveTaskFromTeamList(orgId);

  const [defaultListId, setDefaultListId] = useState<string | null>(() => readDefaultTeamListId(orgId));
  const lists: TeamList[] = useMemo(
    () => rawLists.map((l) => ({ ...l, isDefault: l.id === defaultListId })),
    [rawLists, defaultListId],
  );

  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('blue');
  const [hoveredListId, setHoveredListId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState('');
  const [editListColor, setEditListColor] = useState('blue');
  const [selectingTasksForListId, setSelectingTasksForListId] = useState<string | null>(null);
  // La liste épinglée filtre dès l'ouverture, comme en mode personnel.
  const [selectedListId, setSelectedListId] = useState<string | null>(() => readDefaultTeamListId(orgId));

  // Liste épinglée supprimée ailleurs : on ne filtre pas sur un fantôme.
  useEffect(() => {
    if (selectedListId && selectedListId !== VIRTUAL_TODAY_ID && rawLists.length > 0
      && !rawLists.some((l) => l.id === selectedListId)) {
      setSelectedListId(null);
    }
  }, [rawLists, selectedListId]);

  const [todayHidden, setTodayHiddenState] = useState<boolean>(() => {
    try { return localStorage.getItem(todayHiddenKey(orgId)) === '1'; } catch { return false; }
  });
  const setTodayHidden = (hidden: boolean) => {
    setTodayHiddenState(hidden);
    try {
      if (hidden) localStorage.setItem(todayHiddenKey(orgId), '1');
      else localStorage.removeItem(todayHiddenKey(orgId));
    } catch { /* ignore */ }
    if (hidden && selectedListId === VIRTUAL_TODAY_ID) setSelectedListId(null);
  };

  // Ordre local pendant le glisser : mêmes raisons que `useTaskLists` (C-06).
  const [orderedLists, setOrderedLists] = useState<TaskList[]>(lists);
  useEffect(() => {
    const incomingIds = lists.map((l) => l.id).sort().join(',');
    setOrderedLists((prev) => {
      const localIds = prev.map((l) => l.id).sort().join(',');
      if (localIds !== incomingIds) return lists;
      return prev.map((l) => lists.find((nl) => nl.id === l.id) ?? l);
    });
  }, [lists]);

  const handleListSelect = (listId: string) => setSelectedListId(selectedListId === listId ? null : listId);
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
    cancelEditList();
  };

  const { deleteList } = useDeleteTeamListWithUndo(orgId, (listId) => {
    if (selectedListId === listId) setSelectedListId(null);
    if (defaultListId === listId) { setDefaultListId(null); writeDefaultTeamListId(orgId, null); }
  });
  const deleteListById = (listId: string) => {
    const snapshot = rawLists.find((l) => l.id === listId);
    if (snapshot) deleteList(snapshot);
  };
  // Contrat de `TaskListsBar` (révocation d'une liste intelligente).
  const deleteListMutation = { mutate: deleteListById };

  // Les cases à cocher sont celles du mode sélection du tableau : le
  // composant de la barre relie ces trois gestes à `useTeamTasksBulk`.
  const startSelectingTasks = (listId: string) => {
    setSelectingTasksForListId(listId);
    setHoveredListId(null);
  };
  const cancelSelectingTasks = () => setSelectingTasksForListId(null);
  const confirmAddTasksToList = (taskIds: string[]) => {
    if (selectingTasksForListId === VIRTUAL_TODAY_ID) {
      // Échéance d'équipe = date locale 'YYYY-MM-DD' (jamais un instant UTC).
      const today = todayKeyInTz();
      taskIds.forEach((taskId) => setDeadline(taskId, today));
    } else if (selectingTasksForListId) {
      taskIds.forEach((taskId) => addTaskToList.mutate({ listId: selectingTasksForListId, taskId }));
    }
    cancelSelectingTasks();
  };

  const handleCreateSmartList = (presetKey: SmartRulePreset) => {
    const preset = SMART_PRESETS.find((p) => p.preset === presetKey);
    if (!preset) return;
    const existing = lists.find((l) => l.type === 'smart' && l.smartRule === presetKey);
    if (existing) { setSelectedListId(existing.id); return; }
    createListMutation.mutate({ name: t(preset.labelKey), color: preset.color, type: 'smart', smartRule: presetKey });
  };

  const handleReorderLists = (newOrder: TaskList[]) => setOrderedLists(newOrder);
  const commitReorderLists = () => {
    orderedLists.forEach((list, idx) => {
      if (list.position !== idx) updateListMutation.mutate({ id: list.id, updates: { position: idx } });
    });
  };

  const handleToggleDefault = (list: TaskList) => {
    const next = list.isDefault ? null : list.id;
    setDefaultListId(next);
    writeDefaultTeamListId(orgId, next);
  };

  // Compteurs : tâches NON terminées, même convention que les listes perso.
  const tasksCountByListId = useMemo(() => {
    const map = new Map<string, number>();
    map.set(VIRTUAL_TODAY_ID, tasksDueToday(tasks).length);
    for (const list of lists) map.set(list.id, tasksInList(list, tasks).filter((task) => !task.completed).length);
    return map;
  }, [lists, tasks]);

  /** Filtre de la liste active, désactivé pendant qu'on choisit des tâches à y verser. */
  const filterByList = useCallback((input: TeamTask[]): TeamTask[] => {
    if (!selectedListId || selectingTasksForListId) return input;
    if (selectedListId === VIRTUAL_TODAY_ID) {
      const ids = new Set(tasksDueToday(tasks).map((task) => task.id));
      return input.filter((task) => ids.has(task.id));
    }
    const list = lists.find((l) => l.id === selectedListId);
    if (!list) return input;
    const ids = new Set(tasksInList(list, tasks).map((task) => task.id));
    return input.filter((task) => ids.has(task.id));
  }, [selectedListId, selectingTasksForListId, lists, tasks]);

  return {
    lists,
    orderedLists,
    tasksCountByListId,
    createListMutation,
    updateListMutation,
    deleteListMutation,
    showCreateList, setShowCreateList,
    newListName, setNewListName,
    newListColor, setNewListColor,
    hoveredListId, setHoveredListId,
    editingListId, editListName, setEditListName, editListColor, setEditListColor,
    selectingTasksForListId,
    selectedListId, setSelectedListId,
    todayHidden, setTodayHidden,
    handleListSelect,
    clearListFilter,
    startEditList,
    cancelEditList,
    submitEditList,
    deleteListById,
    startSelectingTasks,
    confirmAddTasksToList,
    cancelSelectingTasks,
    handleCreateSmartList,
    handleReorderLists,
    commitReorderLists,
    handleToggleDefault,
    filterByList,
    addTaskToList,
    removeTaskFromList,
  };
}

export type TeamTaskListsController = ReturnType<typeof useTeamTaskLists>;
