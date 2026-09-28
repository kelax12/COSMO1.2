import TaskListsBar from '@/pages/tasks/TaskListsBar';
import ListActionsSheet from '@/components/ListActionsSheet';
import { colorOptions, resolveListColor } from '@/pages/tasks/list-colors';
import { useChipLongPress } from '@/pages/tasks/useChipLongPress';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import type { TeamTaskListsController } from './use-team-task-lists';

interface TeamTaskListsBarProps {
  controller: TeamTaskListsController;
  /** Mode sélection du tableau : ses cases servent à « ajouter des tâches » à une liste. */
  selection: {
    selectedIds: ReadonlySet<string>;
    setSelectMode: (on: boolean) => void;
    exitSelectMode: () => void;
  };
}

/**
 * Accès rapide aux LISTES de l'onglet Tâches du mode entreprise (mig. 203).
 *
 * Remplace l'accès rapide aux projets (2026-09-28, demande d'Axel) : c'est
 * la barre de la page Tâches personnelle, à l'identique, pilotée par les
 * listes de l'organisation. Les projets restent filtrables par la barre de
 * filtres, qui garde sa pastille « Projet ».
 */
const TeamTaskListsBar = ({ controller: c, selection }: TeamTaskListsBarProps) => {
  const isMobile = useIsMobile();
  const { actionSheetListId, setActionSheetListId, chipLongPressFired, startChipLongPress, cancelChipLongPress } =
    useChipLongPress(isMobile);

  const selectedTasksForList = Array.from(selection.selectedIds);

  return (
    <>
      <TaskListsBar
        lists={c.lists}
        orderedLists={c.orderedLists}
        tasksCountByListId={c.tasksCountByListId}
        isMobile={isMobile}
        colorOptions={colorOptions}
        resolveListColor={resolveListColor}
        chipLongPressFired={chipLongPressFired}
        selectedListId={c.selectedListId}
        setSelectedListId={c.setSelectedListId}
        hoveredListId={c.hoveredListId}
        setHoveredListId={c.setHoveredListId}
        todayHidden={c.todayHidden}
        setTodayHidden={c.setTodayHidden}
        showCreateList={c.showCreateList}
        setShowCreateList={c.setShowCreateList}
        newListName={c.newListName}
        setNewListName={c.setNewListName}
        newListColor={c.newListColor}
        setNewListColor={c.setNewListColor}
        editingListId={c.editingListId}
        editListName={c.editListName}
        setEditListName={c.setEditListName}
        editListColor={c.editListColor}
        setEditListColor={c.setEditListColor}
        selectingTasksForListId={c.selectingTasksForListId}
        selectedTasksForList={selectedTasksForList}
        setListToDeleteId={c.deleteListById}
        createListMutation={c.createListMutation}
        deleteListMutation={c.deleteListMutation}
        clearListFilter={c.clearListFilter}
        handleListSelect={c.handleListSelect}
        startSelectingTasks={(listId) => { c.startSelectingTasks(listId); selection.setSelectMode(true); }}
        confirmAddTasksToList={() => { c.confirmAddTasksToList(selectedTasksForList); selection.exitSelectMode(); }}
        cancelSelectingTasks={() => { c.cancelSelectingTasks(); selection.exitSelectMode(); }}
        startEditList={c.startEditList}
        cancelEditList={c.cancelEditList}
        submitEditList={c.submitEditList}
        handleToggleDefault={c.handleToggleDefault}
        handleReorderLists={c.handleReorderLists}
        commitReorderLists={c.commitReorderLists}
        handleCreateSmartList={c.handleCreateSmartList}
        startChipLongPress={startChipLongPress}
        cancelChipLongPress={cancelChipLongPress}
      />
      <ListActionsSheet
        list={c.lists.find((l) => l.id === actionSheetListId) ?? null}
        colorOptions={colorOptions}
        resolveListColor={resolveListColor}
        onClose={() => setActionSheetListId(null)}
        onRename={(list) => c.startEditList(list)}
        onToggleDefault={c.handleToggleDefault}
        onDelete={(list) => c.deleteListById(list.id)}
        onPickColor={(list, color) => c.updateListMutation.mutate({ id: list.id, updates: { color } })}
      />
    </>
  );
};

export default TeamTaskListsBar;
