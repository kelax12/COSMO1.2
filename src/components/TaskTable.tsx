import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Lightbulb, X } from 'lucide-react';
import { useBilling } from '@/modules/billing/billing.context';
import TaskModal from './TaskModal';
import BulkAddToListModal from './add-to-list/BulkAddToListModal';
import ScheduleEventModal from './ScheduleEventModal';
import AddToListModal from './AddToListModal';
import { VirtualizedTaskList } from './task-table/list';
import { useUnifiedTaskRows } from './task-table/useUnifiedTaskRows';
import TaskTableDesktop from './task-table/TaskTableDesktop';
import ConfirmDeleteSheet from './task-table/ConfirmDeleteSheet';
import TaskListPlaceholders from './task-table/TaskListPlaceholders';
import { useTaskSelection } from './task-table/useTaskSelection';
import TaskQuickFilters from './task-table/TaskQuickFilters';
import OverdueBanner from './task-table/OverdueBanner';
import TaskBulkActionsBar from './task-table/TaskBulkActionsBar';
import TeamTaskModal from './organization/TeamTaskModal';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { showUndoToast } from '@/lib/undo-toast';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  useTasks,
  useDeleteTask,
  useCreateTask,
  useRestoreTask,
  useUpdateTask,
  useToggleTaskComplete,
  useToggleTaskBookmark,
  taskKeys,
  Task
} from '@/modules/tasks';

import { usePriorityRange } from '@/modules/ui-states';
import { getSnoozeOptions } from '@/modules/tasks/snooze';
import { isTaskOverdue } from './task-table/helpers';
import { useLists, useAddTaskToList } from '@/modules/lists';
import { useCategories } from '@/modules/categories';
import { useFriends, useCollaboratorsByTask, usePendingCollaboratorTaskIds, useUnshareTask } from '@/modules/friends';
import { useAuth } from '@/modules/auth/AuthContext';
import { useIsDemo } from '@/lib/app-mode.store';
import { useT } from '@/i18n/useT';
import { useActiveOrganization, useOrgMembers } from '@/modules/organizations';
import { useTeamProjects, useTeamTasks, useUpdateTeamTask, type TeamTask, type UpdateTeamTaskInput } from '@/modules/team-projects';

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
};


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
}) => {
  const { t, tp } = useT('tasks');

  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: moduleTasks = [], isLoading: isLoadingTasks } = useTasks();
  const deleteMutation = useDeleteTask();
  const createMutation = useCreateTask();
  // « Annuler » : rend la tache sous SON identifiant (R-08, C-37).
  const restoreMutation = useRestoreTask();
  const updateMutation = useUpdateTask();
  const toggleCompleteMutation = useToggleTaskComplete();
  const toggleBookmarkMutation = useToggleTaskBookmark();

  const { priorityRange } = usePriorityRange();
  const { isPremium } = useBilling();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const queryClient = useQueryClient();
  const { data: friends = [] } = useFriends();
  const collaboratorsByTask = useCollaboratorsByTask(user?.id);
  const pendingCollaboratorTaskIds = usePendingCollaboratorTaskIds(user?.id);
  const unshareTaskMutation = useUnshareTask();

  // ═══════════════════════════════════════════════════════════════════
  // Fusion tâches d'équipe (mode entreprise) — assignées à moi, injectées
  // dans la même liste que les tâches perso avec une distinction visuelle
  // forte (fond indigo) et un jeu d'actions restreint (cf. TeamTaskRowLite).
  // ═══════════════════════════════════════════════════════════════════
  const { activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;
  const { data: teamProjects = [] } = useTeamProjects(orgId);
  const { data: allTeamTasks = [] } = useTeamTasks(orgId);
  const { data: orgMembers = [] } = useOrgMembers(orgId);
  const updateTeamTaskMutation = useUpdateTeamTask(orgId ?? '');
  const [editingTeamTask, setEditingTeamTask] = useState<TeamTask | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'perso' | 'entreprise'>('all');

  const teamProjectsById = useMemo(
    () => new Map(teamProjects.map((p) => [p.id, p])),
    [teamProjects],
  );

  const handleToggleTeamComplete = useCallback((task: TeamTask) => {
    updateTeamTaskMutation.mutate({ taskId: task.id, input: { completed: !task.completed } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const modalUpdateTeamTask = (taskId: string, input: UpdateTeamTaskInput) =>
    updateTeamTaskMutation.mutateAsync({ taskId, input });

  // Utiliser propTasks si fourni, sinon les tasks du module
  const tasks = propTasks || moduleTasks;

  const [localSortField, setLocalSortField] = useState<string | undefined>(propSortField);

  useEffect(() => {
    if (propSortField) {
      setLocalSortField(propSortField);
    }
  }, [propSortField]);

  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedTaskForCollaborators, setSelectedTaskForCollaborators] = useState<string | null>(null);
  const [addToListTask, setAddToListTask] = useState<string | null>(null);
  const [taskToEventModal, setTaskToEventModal] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [showCreateFromEmpty, setShowCreateFromEmpty] = useState(false);

  const { data: allLists = [] } = useLists();
  const { data: categories = [] } = useCategories();
  const addTaskToListMutation = useAddTaskToList();

  // Sélection multiple (#10) : réutilise le rendu checkbox du mode
  // « ajout à une liste » (addToListMode) pour un mode générique avec barre
  // d'actions groupées (compléter / ajouter à une liste / supprimer).
  const {
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
  } = useTaskSelection({
    tasks,
    lists: allLists,
    userId: user?.id,
    isDemo,
    toggleComplete: (taskId) => toggleCompleteMutation.mutate(taskId),
    addTaskToList: (taskId, listId) => addTaskToListMutation.mutate({ taskId, listId }),
    updateTask: (id, updates) => updateMutation.mutate({ id, updates }),
    deleteTask: (id) => deleteMutation.mutate(id),
    restoreTask: (task) => restoreMutation.mutate(task),
    unshareTask: (taskId, friendId) => unshareTaskMutation.mutate({ taskId, friendId }),
  });

  // Les deux feuilles de confirmation ci-dessous affichaient une poignee de
  // glissement qui ne declenchait rien (audit mobile 2026-08-14). Un helper
  // par feuille : `useBottomSheet` ne sait fermer qu'une seule surface.
  const deleteSheet = useBottomSheet(useCallback(() => setTaskToDelete(null), []));
  const bulkDeleteSheet = useBottomSheet(useCallback(() => setShowBulkDeleteConfirm(false), [setShowBulkDeleteConfirm]));
  const [activeQuickFilter, setActiveQuickFilter] = useState<'none' | 'bookmarked' | 'completed' | 'overdue' | 'collaboration'>('none');

  const toggleQuickFilter = (filter: 'bookmarked' | 'completed' | 'overdue' | 'collaboration') => {
    setActiveQuickFilter(prev => prev === filter ? 'none' : filter);
  };

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

  const handleSort = (field: string) => {
    if (localSortField === field) {
      onSortDirectionChange?.(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLocalSortField(field);
      onSortDirectionChange?.('asc');
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Handlers avec mutations (MIGRÉ) - MÉMOÏSÉS pour performance
  // ═══════════════════════════════════════════════════════════════════
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

  // Hint de découvrabilité des gestes (mobile) — affiché une fois, dismissable.
  const [swipeHintDismissed, setSwipeHintDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem('cosmo_swipe_hint_dismissed') === '1'; } catch { return false; }
  });
  const dismissSwipeHint = () => {
    setSwipeHintDismissed(true);
    try { localStorage.setItem('cosmo_swipe_hint_dismissed', '1'); } catch { /* ignore */ }
  };

  // Quelles lignes cette liste montre, et dans quel ordre — dérivation pure,
  // les deux gisements (perso, équipe) filtrés par les mêmes règles.
  const { unifiedRows, hiddenCompletedCount } = useUnifiedTaskRows({
    tasks,
    allTeamTasks,
    teamProjectsById,
    userId: user?.id,
    quickFilter: activeQuickFilter,
    scopeFilter,
    showCompleted,
    priorityRange,
    sortField: localSortField,
    sortDirection,
    searchTerm,
  });

  const selectedTaskData = tasks.find(task => task.id === selectedTask);
  const selectedTaskForCollaboratorsData = tasks.find(task => task.id === selectedTaskForCollaborators);

  const handleOpenCollaborator = useCallback((taskId: string) => {
    if (!isPremium()) {
      navigate('/premium');
      return;
    }
    // Réutilise la vue « Collaborateurs » de TaskModal (étape 2 de création)
    // au lieu d'un second popup dédié — une seule UI de partage.
    setSelectedTaskForCollaborators(taskId);
  }, [isPremium, navigate]);

  const deleteTaskById = (taskId: string) => {
    // Snapshot la tâche AVANT suppression pour permettre l'undo
    const taskSnapshot = tasks.find(t => t.id === taskId);

    // Tâche collaborative REÇUE (prod) : on n'en est pas propriétaire, la RLS
    // bloque le DELETE (qui échouait en silence → la tâche réapparaissait). On
    // retire plutôt notre accès (quitter la tâche) en supprimant la grant.
    const isReceivedProd =
      !isDemo && !!taskSnapshot?.userId && !!user?.id && taskSnapshot.userId !== user.id;
    if (isReceivedProd && user?.id) {
      unshareTaskMutation.mutate(
        { taskId, friendId: user.id },
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
      !isDemo && !!task?.userId && !!user?.id && task.userId !== user.id;
    if (task?.isCollaborative || isReceivedProd) {
      setTaskToDelete(taskId);
    } else {
      deleteTaskById(taskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, isDemo, user?.id]);

  const handleSelectTask = useCallback((id: string) => {
    setSelectedTaskForCollaborators(null);
    setSelectedTask(id);
  }, []);

  // Snooze (#8) : reporte la deadline (mutation optimiste → effet immédiat).
  const handleSnooze = useCallback((taskId: string, deadline: string) => {
    updateMutation.mutate({ id: taskId, updates: { deadline } });
    toast.success(t('toast.postponed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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


  // Le mode sélection (#10) réutilise le rendu checkbox du mode addToList.
  const effectiveAddToListMode = addToListMode || selectMode;
  const effectiveSelectedForListIds = selectMode ? selectedIds : selectedForListIds;
  const effectiveToggleForList = selectMode ? toggleSelected : onToggleTaskForList;

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
      />

      {/* Bandeau « En retard » (#9) : visible dès qu'une tâche a dépassé sa
          deadline — replanification groupée en un clic.
          Desktop uniquement (redesign mobile 2026-09-07) : sur mobile, chaque
          tâche en retard porte déjà sa propre solution de report
          (`OverdueQuickActions` sur la carte), le bandeau global disparaît. */}
      {!addToListMode && !showCompleted && activeQuickFilter === 'none' && overdueTasks.length > 0 && (
        <div className="hidden md:block">
          <OverdueBanner
            count={overdueTasks.length}
            options={getSnoozeOptions()}
            onSnoozeAll={handleSnoozeAllOverdue}
          />
        </div>
      )}

      {/* Desktop View (Table) */}
      <TaskTableDesktop
        rows={unifiedRows}
        sortField={localSortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        addToListMode={effectiveAddToListMode}
        selectedForListIds={effectiveSelectedForListIds}
        activeQuickFilter={activeQuickFilter}
        showCompleted={showCompleted}
        onSelectTask={handleSelectTask}
        onToggleTaskForList={effectiveToggleForList}
        onToggleComplete={handleToggleComplete}
        onToggleBookmark={handleToggleBookmark}
        onScheduleTask={setTaskToEventModal}
        onAddToList={setAddToListTask}
        onOpenCollaborator={handleOpenCollaborator}
        onDuplicate={handleDuplicate}
        onDeleteTask={handleDeleteRequest}
        onSnooze={handleSnooze}
        collaboratorsByTask={collaboratorsByTask}
        pendingCollaboratorTaskIds={pendingCollaboratorTaskIds}
        friends={friends}
        onToggleTeamComplete={handleToggleTeamComplete}
        onEditTeamTask={setEditingTeamTask}
      />

      {/* Mobile View (Cards) — virtualisé au-delà de 50 items */}
      <div className="md:hidden">
        {/* Hint de découvrabilité des gestes (affiché une fois) */}
        {!swipeHintDismissed && !addToListMode && unifiedRows.length > 0 && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: 'rgb(var(--color-hover))', color: 'rgb(var(--color-text-secondary))' }}
          >
            <span className="flex-1 flex items-center gap-1.5">
              <Lightbulb size={14} className="shrink-0" aria-hidden="true" />
              {t('table.gestureHint')}
            </span>
            <button
              type="button"
              onClick={dismissSwipeHint}
              aria-label="Masquer l'astuce"
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-md hover:bg-[rgb(var(--color-surface))]"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <VirtualizedTaskList
          rows={unifiedRows}
          addToListMode={effectiveAddToListMode}
          selectedForListIds={effectiveSelectedForListIds}
          onToggleTaskForList={effectiveToggleForList}
          onToggleComplete={handleToggleComplete}
          onToggleBookmark={handleToggleBookmark}
          onOpenCollaborator={handleOpenCollaborator}
          onSelectTask={handleSelectTask}
          onAddToList={setAddToListTask}
          onDeleteTask={handleDeleteRequest}
          onScheduleTask={setTaskToEventModal}
          onSnooze={handleSnooze}
          collaboratorsByTask={collaboratorsByTask}
          pendingCollaboratorTaskIds={pendingCollaboratorTaskIds}
          friends={friends}
          onToggleTeamComplete={handleToggleTeamComplete}
          onEditTeamTask={setEditingTeamTask}
        />

        {/* ── Maquette 50 : « La fin de la liste se dit » ──
            Sans marqueur, on ne sait jamais si l'on a tout vu ou si le
            chargement continue — la liste est virtualisée au-delà de 50 items,
            donc le doute est fondé. Une ligne suffit, et elle porte le seul
            ailleurs qui existe : les tâches terminées, qu'aucun écran ne
            proposait d'ouvrir depuis la liste elle-même. */}
        {unifiedRows.length > 0 && !addToListMode && (
          <div className="pt-4 pb-2 text-center">
            <p className="text-caption text-[rgb(var(--color-text-muted))]">
              {showCompleted
                ? tp('table.endOfListCompleted', unifiedRows.length)
                : tp('table.endOfList', unifiedRows.length)}
            </p>
            {hiddenCompletedCount > 0 && onShowCompletedChange && (
              <button
                type="button"
                onClick={() => onShowCompletedChange(true)}
                className="mt-1 min-h-touch px-3 text-label font-semibold text-[rgb(var(--color-accent))]"
              >
                {tp('table.seeCompleted', hiddenCompletedCount)}
              </button>
            )}
          </div>
        )}
      </div>

      <TaskListPlaceholders
        rowCount={unifiedRows.length}
        isLoading={isLoadingTasks}
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
        onExit={exitSelectMode}
      />

      {/* Modal d'ajout groupé à une liste (#23) */}
      <BulkAddToListModal
        isOpen={showBulkListModal}
        onClose={() => setShowBulkListModal(false)}
        count={bulkModalCount}
        onAddToList={bulkAddToList}
      />

      {/* Création directe depuis l'état vide (#45) */}
      <TaskModal
        isOpen={showCreateFromEmpty}
        onClose={() => setShowCreateFromEmpty(false)}
        isCreating={true}
      />

      {selectedTaskData && (
        <TaskModal
          task={selectedTaskData}
          isOpen={!!selectedTask}
          onClose={handleCloseTaskModal}
        />
      )}

      {selectedTaskForCollaboratorsData && (
        <TaskModal
          task={selectedTaskForCollaboratorsData}
          isOpen={!!selectedTaskForCollaborators}
          onClose={() => setSelectedTaskForCollaborators(null)}
          showCollaborators={true}
        />
      )}

      {taskToEventModal && (
        <ScheduleEventModal
          open={true}
          onOpenChange={(o) => { if (!o) setTaskToEventModal(null); }}
          task={taskToEventModal}
        />
      )}

        <ConfirmDeleteSheet
          open={!!taskToDelete}
          title={t('table.deleteTitle')}
          body={t('table.deleteBody')}
          onCancel={() => setTaskToDelete(null)}
          onConfirm={confirmDelete}
          sheet={deleteSheet}
        />

        {/* Confirmation bloquante de la suppression groupée (#10) */}
        <ConfirmDeleteSheet
          open={showBulkDeleteConfirm}
          title={tp('bulk.deleteCount', selectedIds.length)}
          body={tp('table.bulkDeleteBody', selectedIds.length)}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          onConfirm={confirmBulkDelete}
          sheet={bulkDeleteSheet}
        />

        {addToListTask && (
          <AddToListModal
            isOpen={true}
            onClose={() => setAddToListTask(null)}
            taskId={addToListTask}
          />
        )}

        {editingTeamTask && (
          <TeamTaskModal
            task={editingTeamTask}
            projects={teamProjects.filter((p) => !p.archivedAt)}
            members={orgMembers}
            onUpdate={modalUpdateTeamTask}
            onClose={() => setEditingTeamTask(null)}
          />
        )}
    </>
  );
};

export default TaskTable;
