import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useLazyMount } from '@/hooks/use-lazy-mount';
import { BulkAddToListModal, TaskToEventModal } from './task-table/lazy-dialogs';
import { useBilling } from '@/modules/billing/billing.context';
import TaskModal from './TaskModal';
import AddToListModal from './AddToListModal';
import { VirtualizedTaskList } from './task-table/list';
import { useUnifiedTaskRows } from './task-table/useUnifiedTaskRows';
import { useTeamTasksInList } from './task-table/useTeamTasksInList';
import TaskTableDesktop from './task-table/TaskTableDesktop';
import ConfirmDeleteSheet from './task-table/ConfirmDeleteSheet';
import TaskListPlaceholders from './task-table/TaskListPlaceholders';
import { useTaskSelection } from './task-table/useTaskSelection';
import { useTaskDeletion } from './task-table/useTaskDeletion';
import TaskQuickFilters from './task-table/TaskQuickFilters';
import { useQuickFilter } from './task-table/quick-filter.store';
import OverdueBanner from './task-table/OverdueBanner';
import SwipeHintBanner from './task-table/SwipeHintBanner';
import TaskBulkActionsBar from './task-table/TaskBulkActionsBar';
import { ArchiveFeedMore, ArchiveCaption } from './task-table/ArchiveLoadMore';
import { useArchiveView, endOfListVisible, type ArchiveFeed } from './task-table/useArchiveView';
import { SeeCompletedButton } from './task-table/SeeCompletedButton';
import TeamTaskModal from './organization/TeamTaskModal';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';

// Module tasks - Hooks indépendants
import { toast } from '@/lib/toast';
import {
  useTasks,
  useDeleteTask,
  useCreateTask,
  useRestoreTask,
  useUpdateTask,
  useToggleTaskComplete,
  useToggleTaskBookmark,
  useKnownTask,
  Task,
  type TaskQuery,
} from '@/modules/tasks';

import { usePriorityRange } from '@/modules/ui-states';
import { getSnoozeOptions } from '@/modules/tasks/snooze';
import { isTaskOverdue } from './task-table/helpers';
import { useLists, useAddTaskToList, useRemoveTaskFromList } from '@/modules/lists';
import { useCategories } from '@/modules/categories';
import { useFriends, useCollaboratorsByTask, usePendingCollaboratorTaskIds, useUnshareTask } from '@/modules/friends';
import { useAuth } from '@/modules/auth/AuthContext';
import { useIsDemo } from '@/lib/app-mode.store';
import { useT } from '@/i18n/useT';

type TaskTableProps = {
  tasks?: Task[];
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSortDirectionChange?: (direction: 'asc' | 'desc') => void;
  showCompleted?: boolean;
  selectedTaskId?: string | null;
  onTaskModalClose?: () => void;
  addToListMode?: boolean;
  selectedForListIds?: string[];
  onToggleTaskForList?: (taskId: string) => void;
  showQuickFilters?: boolean;
  /** Terme de recherche de la page — filtre aussi les tâches d'équipe fusionnées. */
  searchTerm?: string;
  /** Bascule « voir les terminées », proposée par le marqueur de fin de liste. */
  onShowCompletedChange?: (value: boolean) => void;
  /** Une liste perso filtre la page : aucune tâche d'équipe n'en fait jamais partie. */
  listFilterActive?: boolean;
  /** Liste, catégorie(s) OU recherche active — gate « Voir les terminées ». */
  hasActiveFilter?: boolean;
  /** Filtres actifs de la page, rendus au bout de la rangée des pastilles. */
  quickFiltersTrailing?: React.ReactNode;
  /**
   * V14.1 (PER-01) : l'archive « Terminées », en pages serveur. Fournie, elle
   * REMPLACE les tâches perso dès que la vue terminées est active (bascule
   * ou pastille) : le jeu de travail ne garde que 35 jours de terminées.
   */
  archive?: ArchiveFeed;
  /**
   * Requête serveur des terminées masquées par la vue courante (« Voir les N
   * terminées ») ; `null` : aucune ne peut répondre. Absente : décompte en
   * mémoire (le jeu de travail ne garde que 35 jours de terminées).
   */
  completedQuery?: TaskQuery | null;
};

export type { ArchiveFeed };

/** Données et mutations que la liste lit (tâches, listes, catégories, amis, partages). */
function useTaskTableSources() {
  const { data: moduleTasks = [], isLoading: isLoadingTasks } = useTasks();
  const deleteMutation = useDeleteTask();
  const createMutation = useCreateTask();
  // « Annuler » : rend la tache sous SON identifiant (R-08, C-37).
  const restoreMutation = useRestoreTask();
  const updateMutation = useUpdateTask();
  const toggleCompleteMutation = useToggleTaskComplete();
  const toggleBookmarkMutation = useToggleTaskBookmark();
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const { data: friends = [] } = useFriends();
  const collaboratorsByTask = useCollaboratorsByTask(user?.id);
  const pendingCollaboratorTaskIds = usePendingCollaboratorTaskIds(user?.id);
  const unshareTaskMutation = useUnshareTask();
  const { data: allLists = [] } = useLists();
  const { data: categories = [] } = useCategories();
  const addTaskToListMutation = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  return {
    moduleTasks, isLoadingTasks, deleteMutation, createMutation, restoreMutation, updateMutation,
    toggleCompleteMutation, toggleBookmarkMutation, unshareTaskMutation, addTaskToListMutation, removeTaskFromListMutation,
    userId: user?.id, isDemo, friends, collaboratorsByTask, pendingCollaboratorTaskIds, allLists, categories,
  };
}

/**
 * Le mode sélection (#10) réutilise le rendu checkbox du mode addToList…
 * 🔴 …mais PAS son libellé (C-55). Les deux modes montrent la même case et ne
 * font pas la même chose : l'un range dans une liste, l'autre sélectionne pour
 * une action groupée. Une case annoncée « Ajouter à la liste » pendant qu'on
 * sélectionne ment sur ce qu'elle fait (WCAG 4.1.2). Le rendu reste partagé,
 * le NOM ne l'est plus.
 */
function selectionView(o: {
  selectMode: boolean;
  selectedIds: string[];
  toggleSelected: (taskId: string) => void;
  addToListMode: boolean;
  selectedForListIds: string[];
  onToggleTaskForList?: (taskId: string) => void;
}) {
  return {
    effectiveAddToListMode: o.addToListMode || o.selectMode,
    selectionKind: (o.selectMode ? 'select' : 'list') as 'list' | 'select',
    effectiveSelectedForListIds: o.selectMode ? o.selectedIds : o.selectedForListIds,
    effectiveToggleForList: o.selectMode ? o.toggleSelected : o.onToggleTaskForList,
  };
}

/**
 * Vue « Collaborateurs » d'une tâche : réutilise celle de TaskModal (étape 2
 * de création) au lieu d'un second popup dédié — une seule UI de partage.
 * Sans premium, renvoie vers /premium.
 */
function useCollaboratorView(tasks: Task[]) {
  const { isPremium } = useBilling();
  const navigate = useNavigate();
  const [taskId, setTaskId] = useState<string | null>(null);
  const handleOpenCollaborator = useCallback((id: string) => {
    if (!isPremium()) {
      navigate('/premium');
      return;
    }
    setTaskId(id);
  }, [isPremium, navigate]);
  const closeCollaborators = useCallback(() => setTaskId(null), []);
  return { task: tasks.find((task) => task.id === taskId), handleOpenCollaborator, closeCollaborators };
}

/** Tri local : suit le tri imposé par la page, un clic sur l'en-tête courant inverse le sens. */
function useLocalSort(propSortField: string | undefined, sortDirection: 'asc' | 'desc', onSortDirectionChange?: (d: 'asc' | 'desc') => void) {
  const [localSortField, setLocalSortField] = useState<string | undefined>(propSortField);
  useEffect(() => {
    if (propSortField) {
      setLocalSortField(propSortField);
    }
  }, [propSortField]);
  const handleSort = (field: string) => {
    if (localSortField === field) {
      onSortDirectionChange?.(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLocalSortField(field);
      onSortDirectionChange?.('asc');
    }
  };
  return { localSortField, handleSort };
}

/** Tâche ouverte dans sa fiche : celle que la page impose (lien), ou celle qu'on ouvre. */
function useOpenedTask(externalSelectedTaskId: string | null | undefined, onTaskModalClose?: () => void) {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  useEffect(() => {
    if (externalSelectedTaskId) {
      setSelectedTask(externalSelectedTaskId);
    }
  }, [externalSelectedTaskId]);
  const handleCloseTaskModal = () => {
    setSelectedTask(null);
    if (onTaskModalClose) {
      onTaskModalClose();
    }
  };
  return { selectedTask, setSelectedTask, handleCloseTaskModal };
}

/** Gestes d'une ligne (desktop et mobile) : valider, favori, dupliquer, reporter. */
function useTaskRowActions({ tasks, toggleCompleteMutation, toggleBookmarkMutation, createMutation, updateMutation }: {
  tasks: Task[];
  toggleCompleteMutation: ReturnType<typeof useToggleTaskComplete>;
  toggleBookmarkMutation: ReturnType<typeof useToggleTaskBookmark>;
  createMutation: ReturnType<typeof useCreateTask>;
  updateMutation: ReturnType<typeof useUpdateTask>;
}) {
  const { t, tp } = useT('tasks');
  // Handlers avec mutations - MÉMOÏSÉS pour performance
  const handleToggleComplete = useCallback((taskId: string) => {
    toggleCompleteMutation.mutate(taskId);
  }, [toggleCompleteMutation]);

  const handleToggleBookmark = useCallback((taskId: string) => {
    toggleBookmarkMutation.mutate(taskId);
  }, [toggleBookmarkMutation]);

  // Duplique une tâche : nouvelle tâche pré-remplie « (copie) », non complétée.
  const handleDuplicate = useCallback((taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    createMutation.mutate({
      name: `${t.name} (copie)`,
      priority: t.priority,
      category: t.category,
      deadline: t.deadline,
      estimatedTime: t.estimatedTime,
      bookmarked: t.bookmarked,
      completed: false,
    });
  }, [tasks, createMutation]);

  // Snooze (#8) : reporte la deadline (mutation optimiste → effet immédiat).
  const handleSnooze = useCallback((taskId: string, deadline: string) => {
    updateMutation.mutate({ id: taskId, updates: { deadline } });
    toast.success(t('toast.postponed'));
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
    `updateMutation.mutate` est stable (React Query) et `t` est fige au
       montage — la locale est portee par le `basename` du routeur, en changer
       recharge la page. Ni l un ni l autre ne peut perimer. */
  }, []);

  // Section « En retard » (#9) : tâches non complétées à deadline dépassée.
  const overdueTasks = useMemo(
    () => tasks.filter(t => isTaskOverdue(t.deadline, t.completed)),
    [tasks]
  );

  const handleSnoozeAllOverdue = (deadline: string) => {
    overdueTasks.forEach(t => updateMutation.mutate({ id: t.id, updates: { deadline } }));
    toast.success(tp('toast.rescheduled', overdueTasks.length));
  };

  return { handleToggleComplete, handleToggleBookmark, handleDuplicate, handleSnooze, overdueTasks, handleSnoozeAllOverdue };
}

/**
 * Maquette 50 : « La fin de la liste se dit ». Sans marqueur, on ne sait
 * jamais si l'on a tout vu ou si le chargement continue (liste virtualisée
 * au-delà de 50 items). Une ligne suffit, et elle porte le seul ailleurs qui
 * existe : les tâches terminées.
 */
function EndOfList({ count, showCompleted, onShowCompleted, completedQuery, hiddenCompletedCount }: {
  count: number;
  showCompleted: boolean;
  onShowCompleted?: () => void;
  completedQuery?: TaskQuery | null;
  hiddenCompletedCount: number;
}) {
  const { tp } = useT('tasks');
  return (
    <div className="pt-4 pb-2 text-center">
      <p className="text-caption text-[rgb(var(--color-text-muted))]">
        {showCompleted
          ? tp('table.endOfListCompleted', count)
          : tp('table.endOfList', count)}
      </p>
      {onShowCompleted && <SeeCompletedButton query={completedQuery} fallbackCount={hiddenCompletedCount} onShow={onShowCompleted} />}
    </div>
  );
}

/**
 * Bandeau « En retard » (#9) : visible dès qu'une tâche a dépassé sa deadline,
 * replanification groupée en un clic. Desktop uniquement : sur mobile, chaque
 * tâche en retard porte déjà sa propre solution de report
 * (`OverdueQuickActions` sur la carte), le bandeau global disparaît.
 */
function DesktopOverdueBanner({ count, onSnoozeAll }: { count: number; onSnoozeAll: (deadline: string) => void }) {
  if (count === 0) return null;
  return (
    <div className="hidden md:block">
      <OverdueBanner
        count={count}
        options={getSnoozeOptions()}
        onSnoozeAll={onSnoozeAll}
      />
    </div>
  );
}

/** Vue mobile : cartes virtualisées, suite de l'archive, fin de liste. */
function MobileTaskView({ rows, rowProps, addToListMode, archiveView, showCompleted, onShowCompleted, completedQuery, hiddenCompletedCount }: {
  rows: ReturnType<typeof useUnifiedTaskRows>['unifiedRows'];
  rowProps: Omit<React.ComponentProps<typeof VirtualizedTaskList>, 'rows'>;
  addToListMode: boolean;
  archiveView: ReturnType<typeof useArchiveView>;
  showCompleted: boolean;
  onShowCompleted?: () => void;
  completedQuery?: TaskQuery | null;
  hiddenCompletedCount: number;
}) {
  return (
    <div className="md:hidden">
      <SwipeHintBanner addToListMode={addToListMode} rowCount={rows.length} />
      <VirtualizedTaskList
        rows={rows}
        {...rowProps}
      />

      <ArchiveFeedMore feed={archiveView.feed} />

      {/* Maquette 50 : « La fin de la liste se dit » (cf. `EndOfList`). */}
      {endOfListVisible(rows.length, addToListMode, archiveView) && (
        <EndOfList
          count={rows.length}
          showCompleted={showCompleted}
          onShowCompleted={onShowCompleted}
          completedQuery={completedQuery}
          hiddenCompletedCount={hiddenCompletedCount}
        />
      )}
    </div>
  );
}

interface ConfirmSheetState {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  sheet: ReturnType<typeof useBottomSheet>;
}

/** Les surfaces ouvertes depuis la liste : fiches, ajout à une liste, planification, confirmations. */
function TaskTableDialogs({
  bulk, showCreateFromEmpty, setShowCreateFromEmpty, selectedTaskData, selectedTaskOpen, onCloseTaskModal,
  collaboratorsTask, onCloseCollaborators, taskToEventModal, setTaskToEventModal, deletion, bulkDeletion,
  addToListTask, setAddToListTask, team,
}: {
  bulk: {
    mounted: boolean; open: boolean; setOpen: (open: boolean) => void; count: number; selectedIds: string[];
    onAdd: ReturnType<typeof useTaskSelection>['bulkAddToList'];
    onRemove: ReturnType<typeof useTaskSelection>['bulkRemoveFromList'];
  };
  showCreateFromEmpty: boolean;
  setShowCreateFromEmpty: (open: boolean) => void;
  selectedTaskData: Task | null | undefined;
  selectedTaskOpen: boolean;
  onCloseTaskModal: () => void;
  collaboratorsTask: Task | undefined;
  onCloseCollaborators: () => void;
  taskToEventModal: Task | null;
  setTaskToEventModal: (task: Task | null) => void;
  deletion: ConfirmSheetState;
  bulkDeletion: ConfirmSheetState;
  addToListTask: string | null;
  setAddToListTask: (taskId: string | null) => void;
  team: Pick<ReturnType<typeof useTeamTasksInList>, 'editingTeamTask' | 'setEditingTeamTask' | 'teamProjects' | 'orgMembers' | 'updateFromModal'>;
}) {
  const { t, tp } = useT('tasks');
  return (
    <>
      {/* Modal d'ajout groupé à une liste (#23) */}
      {bulk.mounted && <React.Suspense fallback={null}><BulkAddToListModal
        isOpen={bulk.open}
        onClose={() => bulk.setOpen(false)}
        count={bulk.count}
        selectedIds={bulk.selectedIds}
        onAddToList={bulk.onAdd}
        onRemoveFromList={bulk.onRemove}
      /></React.Suspense>}

      {/* Création directe depuis l'état vide (#45) */}
      <TaskModal
        isOpen={showCreateFromEmpty}
        onClose={() => setShowCreateFromEmpty(false)}
        isCreating={true}
      />

      {selectedTaskData && (
        <TaskModal
          task={selectedTaskData}
          isOpen={selectedTaskOpen}
          onClose={onCloseTaskModal}
        />
      )}

      {collaboratorsTask && (
        <TaskModal
          task={collaboratorsTask}
          isOpen={!!collaboratorsTask}
          onClose={onCloseCollaborators}
          showCollaborators={true}
        />
      )}

      {taskToEventModal && (
        <React.Suspense fallback={null}><TaskToEventModal
          task={taskToEventModal}
          onClose={() => setTaskToEventModal(null)}
        /></React.Suspense>
      )}

        <ConfirmDeleteSheet
          open={deletion.open}
          title={t('table.deleteTitle')}
          body={t('table.deleteBody')}
          onCancel={deletion.onCancel}
          onConfirm={deletion.onConfirm}
          sheet={deletion.sheet}
        />

        {/* Confirmation bloquante de la suppression groupée (#10) */}
        <ConfirmDeleteSheet
          open={bulkDeletion.open}
          title={tp('bulk.deleteCount', bulk.selectedIds.length)}
          body={tp('table.bulkDeleteBody', bulk.selectedIds.length)}
          onCancel={bulkDeletion.onCancel}
          onConfirm={bulkDeletion.onConfirm}
          sheet={bulkDeletion.sheet}
        />

        {addToListTask && (
          <AddToListModal
            isOpen={true}
            onClose={() => setAddToListTask(null)}
            taskId={addToListTask}
          />
        )}

        {team.editingTeamTask && (
          <TeamTaskModal
            task={team.editingTeamTask}
            projects={team.teamProjects.filter((p) => !p.archivedAt)}
            members={team.orgMembers}
            onUpdate={team.updateFromModal}
            onClose={() => team.setEditingTeamTask(null)}
          />
        )}
    </>
  );
}

const TaskTable: React.FC<TaskTableProps> = ({
  tasks: propTasks,
  sortField: propSortField,
  sortDirection = 'asc',
  onSortDirectionChange,
  showCompleted = false,
  selectedTaskId: externalSelectedTaskId,
  onTaskModalClose,
  addToListMode = false,
  selectedForListIds = [],
  onToggleTaskForList,
  showQuickFilters = true,
  searchTerm = '',
  onShowCompletedChange,
  listFilterActive = false,
  hasActiveFilter = false,
  quickFiltersTrailing,
  archive, completedQuery,
}) => {

  const {
    moduleTasks, isLoadingTasks, deleteMutation, createMutation, restoreMutation, updateMutation,
    toggleCompleteMutation, toggleBookmarkMutation, unshareTaskMutation, addTaskToListMutation, removeTaskFromListMutation,
    userId, isDemo, friends, collaboratorsByTask, pendingCollaboratorTaskIds, allLists, categories,
  } = useTaskTableSources();
  const { priorityRange } = usePriorityRange();

  // Tâches d'équipe assignées à moi, fusionnées dans la liste perso
  // (cf. `task-table/useTeamTasksInList`).
  const team = useTeamTasksInList();
  const { orgId, teamProjects, allTeamTasks, orgMembers, teamProjectsById, editingTeamTask, setEditingTeamTask } = team;
  const [scopeFilter, setScopeFilter] = useState<'all' | 'perso' | 'entreprise'>('all');

  const { activeQuickFilter, toggleQuickFilter } = useQuickFilter();
  // Utiliser propTasks si fourni, sinon les tasks du module. En vue terminées,
  // l'archive paginée (V14.1, `useArchiveView`).
  const archiveView = useArchiveView({ archive, showCompleted, quickFilter: activeQuickFilter, fallbackTasks: propTasks || moduleTasks, fallbackLoading: isLoadingTasks });
  const tasks = archiveView.tasks;

  const { localSortField, handleSort } = useLocalSort(propSortField, sortDirection, onSortDirectionChange);

  const { selectedTask, setSelectedTask, handleCloseTaskModal } = useOpenedTask(externalSelectedTaskId, onTaskModalClose);
  const [addToListTask, setAddToListTask] = useState<string | null>(null);
  const [taskToEventModal, setTaskToEventModal] = useState<Task | null>(null);
  const [showCreateFromEmpty, setShowCreateFromEmpty] = useState(false);


  // Sélection multiple (#10) : réutilise le rendu checkbox du mode
  // « ajout à une liste » (addToListMode) pour un mode générique avec barre
  // d'actions groupées (compléter / ajouter à une liste / supprimer).
  const {
    selectMode, setSelectMode, selectedIds, toggleSelected, exitSelectMode,
    showBulkListModal, setShowBulkListModal, openBulkListModal, bulkModalCount,
    showBulkDeleteConfirm, setShowBulkDeleteConfirm, bulkComplete, bulkAddToList, bulkRemoveFromList,
    confirmBulkDelete, bulkSetCategory, bulkSetDeadline, bulkSetHealth,
  } = useTaskSelection({
    tasks,
    lists: allLists,
    userId,
    isDemo,
    toggleComplete: (taskId) => toggleCompleteMutation.mutate(taskId),
    addTaskToList: (taskId, listId) => addTaskToListMutation.mutate({ taskId, listId }),
    removeTaskFromList: (taskId, listId) => removeTaskFromListMutation.mutate({ taskId, listId }),
    updateTask: (id, updates) => updateMutation.mutate({ id, updates }),
    deleteTask: (id) => deleteMutation.mutate(id),
    restoreTask: (task) => restoreMutation.mutate(task),
    unshareTask: (taskId, friendId) => unshareTaskMutation.mutate({ taskId, friendId }),
  });
  const bulkListModalMounted = useLazyMount(showBulkListModal);

  // Les deux feuilles de confirmation ci-dessous affichaient une poignee de
  // glissement qui ne declenchait rien. Un helper
  // par feuille : `useBottomSheet` ne sait fermer qu'une seule surface.
  const bulkDeleteSheet = useBottomSheet(useCallback(() => setShowBulkDeleteConfirm(false), [setShowBulkDeleteConfirm]));
  // Filtre rapide : store externe, et non `useState` local. La barre de
  // recherche mobile (`MobileTaskSearch`, ancree hors de cet arbre) le pilote
  // ET le lit pour marquer la suggestion active. Cf. `quick-filter.store.ts`.

  // Quelles lignes cette liste montre, et dans quel ordre — dérivation pure,
  // les deux gisements (perso, équipe) filtrés par les mêmes règles.
  const { unifiedRows, hiddenCompletedCount } = useUnifiedTaskRows({
    tasks,
    allTeamTasks,
    teamProjectsById,
    userId,
    quickFilter: activeQuickFilter,
    scopeFilter,
    showCompleted,
    priorityRange,
    sortField: localSortField,
    sortDirection,
    searchTerm,
    listFilterActive,
    serverOrdered: archiveView.active,
  });

  // Une tâche ouverte par lien (`openTaskId`) peut n'être ni dans la vue ni
  // dans le jeu de travail (terminée il y a longtemps) : relue par son id.
  const selectedTaskData = useKnownTask(selectedTask);
  const collaboratorView = useCollaboratorView(tasks);
  const { handleOpenCollaborator, closeCollaborators } = collaboratorView;

  const { taskToDelete, setTaskToDelete, confirmDelete, handleDeleteRequest } = useTaskDeletion({
    tasks, isDemo, userId, deleteMutation, restoreMutation, unshareTaskMutation,
  });
  const deleteSheet = useBottomSheet(useCallback(() => setTaskToDelete(null), [setTaskToDelete]));

  const handleSelectTask = useCallback((id: string) => {
    closeCollaborators();
    setSelectedTask(id);
  }, [closeCollaborators, setSelectedTask]);

  const rowActions = useTaskRowActions({ tasks, toggleCompleteMutation, toggleBookmarkMutation, createMutation, updateMutation });
  const { handleToggleComplete, handleToggleBookmark, handleDuplicate, handleSnooze, overdueTasks, handleSnoozeAllOverdue } = rowActions;

  // Mode sélection (#10) : même case que le mode « liste », pas le même nom (C-55, cf. `selectionView`).
  const { effectiveAddToListMode, selectionKind, effectiveSelectedForListIds, effectiveToggleForList } =
    selectionView({ selectMode, selectedIds, toggleSelected, addToListMode, selectedForListIds, onToggleTaskForList });

  // Ce que les deux vues (table desktop, cartes mobiles) reçoivent à l'identique.
  const rowProps = {
    addToListMode: effectiveAddToListMode,
    selectionKind,
    selectedForListIds: effectiveSelectedForListIds,
    onToggleTaskForList: effectiveToggleForList,
    onSelectTask: handleSelectTask,
    onToggleComplete: handleToggleComplete,
    onToggleBookmark: handleToggleBookmark,
    onScheduleTask: setTaskToEventModal,
    onAddToList: setAddToListTask,
    onOpenCollaborator: handleOpenCollaborator,
    onDeleteTask: handleDeleteRequest,
    onSnooze: handleSnooze,
    collaboratorsByTask,
    pendingCollaboratorTaskIds,
    friends,
    onToggleTeamComplete: team.toggleComplete,
    onEditTeamTask: setEditingTeamTask,
  };

  return (
    <>
      {/* Tâches/listes partagées en attente : plus de bandeaux inline ici,
          regroupées dans TasksInboxMenu (en-tête, mobile ET desktop) — pour
          laisser toute la largeur au tableau. */}
      <TaskQuickFilters
        visible={showQuickFilters}
        active={activeQuickFilter}
        onToggle={toggleQuickFilter}
        addToListMode={addToListMode}
        selectMode={selectMode}
        onToggleSelectMode={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        orgId={orgId}
        scope={scopeFilter}
        onScope={setScopeFilter}
        trailing={quickFiltersTrailing}
      />

      {!addToListMode && !showCompleted && activeQuickFilter === 'none' && (
        <DesktopOverdueBanner count={overdueTasks.length} onSnoozeAll={handleSnoozeAllOverdue} />
      )}

      <ArchiveCaption feed={archiveView.feed} />

      {/* Desktop View (Table) */}
      <TaskTableDesktop
        rows={unifiedRows}
        sortField={localSortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        sortDisabled={archiveView.active}
        {...rowProps}
        activeQuickFilter={activeQuickFilter}
        showCompleted={showCompleted}
        onDuplicate={handleDuplicate}
        onSetTeamHealth={team.setHealth}
        teamEditReason={team.editReason}
      />

      <div className="hidden md:block"><ArchiveFeedMore feed={archiveView.feed} /></div>

      {/* Mobile View (Cards) — virtualisé au-delà de 50 items */}
      <MobileTaskView
        rows={unifiedRows}
        rowProps={rowProps}
        addToListMode={addToListMode}
        archiveView={archiveView}
        showCompleted={showCompleted}
        onShowCompleted={hasActiveFilter && onShowCompletedChange ? () => onShowCompletedChange(true) : undefined}
        completedQuery={completedQuery}
        hiddenCompletedCount={hiddenCompletedCount}
      />

      <TaskListPlaceholders
        rowCount={unifiedRows.length}
        isLoading={archiveView.isLoading}
        showCompleted={showCompleted}
        addToListMode={addToListMode}
        onCreateTask={() => setShowCreateFromEmpty(true)}
      />

      <TaskBulkActionsBar
        open={selectMode}
        count={selectedIds.length}
        categories={categories}
        onComplete={bulkComplete}
        onAddToList={openBulkListModal}
        onDelete={() => setShowBulkDeleteConfirm(true)}
        onSetCategory={bulkSetCategory}
        onSetDeadline={bulkSetDeadline}
        onSetHealth={bulkSetHealth}
        onExit={exitSelectMode}
      />

      <TaskTableDialogs
        bulk={{ mounted: bulkListModalMounted, open: showBulkListModal, setOpen: setShowBulkListModal, count: bulkModalCount, selectedIds, onAdd: bulkAddToList, onRemove: bulkRemoveFromList }}
        showCreateFromEmpty={showCreateFromEmpty}
        setShowCreateFromEmpty={setShowCreateFromEmpty}
        selectedTaskData={selectedTaskData}
        selectedTaskOpen={!!selectedTask}
        onCloseTaskModal={handleCloseTaskModal}
        collaboratorsTask={collaboratorView.task}
        onCloseCollaborators={closeCollaborators}
        taskToEventModal={taskToEventModal}
        setTaskToEventModal={setTaskToEventModal}
        deletion={{ open: !!taskToDelete, onCancel: () => setTaskToDelete(null), onConfirm: confirmDelete, sheet: deleteSheet }}
        bulkDeletion={{ open: showBulkDeleteConfirm, onCancel: () => setShowBulkDeleteConfirm(false), onConfirm: confirmBulkDelete, sheet: bulkDeleteSheet }}
        addToListTask={addToListTask}
        setAddToListTask={setAddToListTask}
        team={{ editingTeamTask, setEditingTeamTask, teamProjects, orgMembers, updateFromModal: team.updateFromModal }}
      />
    </>
  );
};

export default TaskTable;
