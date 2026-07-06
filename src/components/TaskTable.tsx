import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, CheckCircle2, CheckSquare, AlertTriangle, Users, X, Trash2, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useBilling } from '@/modules/billing/billing.context';
import TaskModal from './TaskModal';
import BulkAddToListModal from './add-to-list/BulkAddToListModal';
import ScheduleEventModal from './ScheduleEventModal';
import AddToListModal from './AddToListModal';
import { VirtualizedTaskList, TaskRow } from './task-table/list';
import PendingSharedTasks from './task-table/PendingSharedTasks';

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
  useUpdateTask,
  useToggleTaskComplete,
  useToggleTaskBookmark,
  taskKeys,
  Task
} from '@/modules/tasks';

import { usePriorityRange } from '@/modules/ui-states';
import { filterAndSortTasks } from '@/modules/tasks/task-filtering';
import { getSnoozeOptions } from '@/modules/tasks/snooze';
import { isTaskOverdue } from './task-table/helpers';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useLists, useAddTaskToList } from '@/modules/lists';
import { useFriends, useCollaboratorsByTask, usePendingCollaboratorTaskIds, useUnshareTask } from '@/modules/friends';
import { useAuth } from '@/modules/auth/AuthContext';
import { useIsDemo } from '@/lib/app-mode.store';

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
}) => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: moduleTasks = [], isLoading: isLoadingTasks } = useTasks();
  const deleteMutation = useDeleteTask();
  const createMutation = useCreateTask();
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

  // Sélection multiple (#10) : réutilise le rendu checkbox du mode
  // « ajout à une liste » (addToListMode) pour un mode générique avec barre
  // d'actions groupées (compléter / ajouter à une liste / supprimer).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Modal d'ajout groupé à une liste (#23) — remplace l'ancien DropdownMenu
  // (désactivé quand aucune liste manuelle → bouton « Liste » sans réaction).
  const [showBulkListModal, setShowBulkListModal] = useState(false);
  // Nombre de tâches figé à l'ouverture du modal : bulkAddToList vide la
  // sélection, on évite un « 0 tâche » qui clignoterait pendant la fermeture.
  const [bulkModalCount, setBulkModalCount] = useState(0);
  const { data: allLists = [] } = useLists();
  const addTaskToListMutation = useAddTaskToList();

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };
  const [activeQuickFilter, setActiveQuickFilter] = useState<'none' | 'favoris' | 'terminées' | 'retard' | 'collaboration'>('none');

  const toggleQuickFilter = (filter: 'favoris' | 'terminées' | 'retard' | 'collaboration') => {
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

  // Filtrage et tri mémoïsés — logique pure extraite (task-filtering.ts, testée).
  const filteredAndSortedTasks = useMemo(
    () => filterAndSortTasks({
      tasks,
      quickFilter: activeQuickFilter,
      showCompleted,
      priorityRange,
      sortField: localSortField,
      sortDirection,
    }),
    [tasks, activeQuickFilter, showCompleted, priorityRange, localSortField, sortDirection],
  );

  const sortedTasks = filteredAndSortedTasks;

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
            toast.success('Vous avez quitté la tâche partagée');
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
          showUndoToast('Tâche supprimée', () => {
            // Recrée la tâche avec les mêmes champs (nouvel id généré côté repo)
            const { id: _id, createdAt: _ca, ...rest } = taskSnapshot;
            createMutation.mutate(rest);
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
    toast.success('Tâche reportée');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Section « En retard » (#9) : tâches non complétées à deadline dépassée.
  const overdueTasks = useMemo(
    () => tasks.filter(t => isTaskOverdue(t.deadline, t.completed)),
    [tasks]
  );

  const handleSnoozeAllOverdue = (deadline: string) => {
    overdueTasks.forEach(t => updateMutation.mutate({ id: t.id, updates: { deadline } }));
    toast.success(`${overdueTasks.length} tâche${overdueTasks.length > 1 ? 's' : ''} replanifiée${overdueTasks.length > 1 ? 's' : ''}`);
  };

  // « Choisir une date… » : input date natif hors du menu (le menu Radix se
  // ferme au clic, l'input doit donc survivre à la fermeture).
  const snoozeDateInputRef = useRef<HTMLInputElement>(null);
  const openSnoozeDatePicker = () => {
    const input = snoozeDateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); return; } catch { /* fallback below */ }
    }
    input.click();
  };

  // ── Actions groupées du mode sélection (#10) ──
  const bulkComplete = () => {
    const toComplete = tasks.filter(t => selectedIds.includes(t.id) && !t.completed);
    toComplete.forEach(t => toggleCompleteMutation.mutate(t.id));
    toast.success(`${toComplete.length} tâche${toComplete.length > 1 ? 's' : ''} complétée${toComplete.length > 1 ? 's' : ''}`);
    exitSelectMode();
  };

  const bulkAddToList = (listId: string) => {
    selectedIds.forEach(taskId => addTaskToListMutation.mutate({ taskId, listId }));
    const listName = allLists.find(l => l.id === listId)?.name ?? 'la liste';
    toast.success(`${selectedIds.length} tâche${selectedIds.length > 1 ? 's' : ''} ajoutée${selectedIds.length > 1 ? 's' : ''} à ${listName}`);
    exitSelectMode();
  };

  const bulkDelete = () => {
    // On ne supprime en lot que les tâches perso (les collaboratives/reçues
    // gardent leur flux individuel avec confirmation).
    const snapshots = tasks.filter(t =>
      selectedIds.includes(t.id) &&
      !t.isCollaborative &&
      !(!isDemo && !!t.userId && !!user?.id && t.userId !== user.id)
    );
    snapshots.forEach(t => deleteMutation.mutate(t.id));
    if (snapshots.length > 0) {
      showUndoToast(`${snapshots.length} tâche${snapshots.length > 1 ? 's' : ''} supprimée${snapshots.length > 1 ? 's' : ''}`, () => {
        snapshots.forEach(s => {
          const { id: _id, createdAt: _ca, ...rest } = s;
          createMutation.mutate(rest);
        });
      });
    }
    const skipped = selectedIds.length - snapshots.length;
    if (skipped > 0) {
      toast.info(`${skipped} tâche${skipped > 1 ? 's' : ''} collaborative${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''} — suppression individuelle requise`);
    }
    exitSelectMode();
  };



  // Le mode sélection (#10) réutilise le rendu checkbox du mode addToList.
  const effectiveAddToListMode = addToListMode || selectMode;
  const effectiveSelectedForListIds = selectMode ? selectedIds : selectedForListIds;
  const effectiveToggleForList = selectMode ? toggleSelected : onToggleTaskForList;

  return (
    <>
      {!addToListMode && <PendingSharedTasks />}
      <div className={`${showQuickFilters ? 'flex' : 'hidden'} md:flex flex-col gap-4 mb-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => toggleQuickFilter('favoris')}
            className={`flex items-center gap-2 ${activeQuickFilter === 'favoris' ? '!bg-blue-600 hover:!bg-blue-700 !text-white !border-blue-600' : ''}`}
          >
            {activeQuickFilter === 'favoris' ? <BookmarkCheck size={20} data-icon="inline-start" /> : <Bookmark size={20} data-icon="inline-start" />}
            <span className="hidden sm:inline">{activeQuickFilter === 'favoris' ? 'Tous' : 'Favoris'}</span>
            <span className="sm:hidden">Favoris</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => toggleQuickFilter('terminées')}
            className={`flex items-center gap-2 ${activeQuickFilter === 'terminées' ? '!bg-blue-600 hover:!bg-blue-700 !text-white !border-blue-600' : ''}`}
          >
            <CheckCircle2 size={20} data-icon="inline-start" />
            <span className="hidden sm:inline">Terminées</span>
            <span className="sm:hidden">Fait</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => toggleQuickFilter('retard')}
            className={`flex items-center gap-2 ${activeQuickFilter === 'retard' ? '!bg-blue-600 hover:!bg-blue-700 !text-white !border-blue-600' : ''}`}
          >
            <AlertTriangle size={20} data-icon="inline-start" />
            <span className="hidden sm:inline">Retard</span>
            <span className="sm:hidden">Retard</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => toggleQuickFilter('collaboration')}
            className={`flex items-center gap-2 ${activeQuickFilter === 'collaboration' ? '!bg-blue-600 hover:!bg-blue-700 !text-white !border-blue-600' : ''}`}
          >
            <Users size={20} data-icon="inline-start" />
            <span className="hidden sm:inline">Collaboration</span>
            <span className="sm:hidden">Collab</span>
          </Button>

          {!addToListMode && (
            <Button
              variant="outline"
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className={`flex items-center gap-2 ${selectMode ? '!bg-blue-600 hover:!bg-blue-700 !text-white !border-blue-600' : ''}`}
            >
              <CheckSquare size={20} data-icon="inline-start" />
              <span>{selectMode ? 'Annuler' : 'Sélectionner'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bandeau « En retard » (#9) : visible dès qu'une tâche a dépassé sa
          deadline — replanification groupée en un clic. */}
      {!addToListMode && !showCompleted && activeQuickFilter === 'none' && overdueTasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
          <AlertTriangle size={18} className="text-red-500 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-sm font-medium text-red-700 dark:text-red-300">
            {overdueTasks.length} tâche{overdueTasks.length > 1 ? 's' : ''} en retard
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Tout replanifier
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {getSnoozeOptions().map((opt) => (
                <DropdownMenuItem key={opt.id} onClick={() => handleSnoozeAllOverdue(opt.deadline)}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={openSnoozeDatePicker}>
                Choisir une date…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={snoozeDateInputRef}
            type="date"
            min={new Date().toLocaleDateString('en-CA')}
            onChange={(e) => {
              if (!e.target.value) return;
              handleSnoozeAllOverdue(e.target.value);
              e.target.value = '';
            }}
            aria-label="Replanifier toutes les tâches en retard à une date précise"
            tabIndex={-1}
            className="absolute w-px h-px p-0 opacity-0 pointer-events-none"
          />
        </div>
      )}

      {/* Desktop View (Table) */}
      <div className="hidden md:block table-container shadow-sm overflow-x-auto">
        <table className="data-table w-full" style={{ minWidth: '1000px' }}>
          <thead>
            <tr className="monochrome:bg-neutral-900 monochrome:text-neutral-200">
              {/* A11y: empty <th> need a label for screen readers. */}
              <th className="px-2 py-3 monochrome:border-neutral-700" style={{ width: '40px' }}><span className="sr-only">Compléter</span></th>
              <th className="px-2 py-3 monochrome:border-neutral-700" style={{ width: '48px' }}><span className="sr-only">Catégorie (couleur)</span></th>
              <th
                className="cursor-pointer px-2 py-3 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800"
                onClick={() => handleSort('name')}
              >
                Nom de la tache
                {localSortField === 'name' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th className="px-2 py-3 monochrome:border-neutral-700" style={{ width: '150px' }}>Catégorie</th>
              <th 
                className="cursor-pointer text-center px-1 py-3"
                onClick={() => handleSort('priority')}
                style={{ width: '70px' }}
              >
                Priorité
                {localSortField === 'priority' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="cursor-pointer px-2 py-3"
                onClick={() => handleSort('deadline')}
                style={{ width: '100px' }}
              >
                {activeQuickFilter === 'terminées' ? 'Date de validation' : 'Dead line'}
                {localSortField === 'deadline' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
                <th 
                  className="cursor-pointer text-center px-1 py-3"
                  onClick={() => handleSort('estimatedTime')}
                  style={{ width: '70px' }}
                >
                  Durée
                  {localSortField === 'estimatedTime' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th className="text-center px-1 py-3" style={{ width: '70px' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
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
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View (Cards) — virtualisé au-delà de 50 items */}
      <div className="md:hidden">
        {/* Hint de découvrabilité des gestes (affiché une fois) */}
        {!swipeHintDismissed && !addToListMode && sortedTasks.length > 0 && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: 'rgb(var(--color-hover))', color: 'rgb(var(--color-text-secondary))' }}
          >
            <span className="flex-1">
              💡 Glissez à droite pour valider · maintenez (ou « ⋯ ») pour les options
            </span>
            <button
              type="button"
              onClick={dismissSwipeHint}
              aria-label="Masquer l'astuce"
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md hover:bg-[rgb(var(--color-surface))]"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <VirtualizedTaskList
          tasks={sortedTasks}
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
          onDuplicate={handleDuplicate}
          onSnooze={handleSnooze}
          collaboratorsByTask={collaboratorsByTask}
          pendingCollaboratorTaskIds={pendingCollaboratorTaskIds}
          friends={friends}
        />
      </div>

      {sortedTasks.length === 0 && isLoadingTasks && (
        <div className="space-y-2 p-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      )}

      {sortedTasks.length === 0 && !isLoadingTasks && (
        <div className="text-center py-12" style={{ color: 'rgb(var(--color-text-muted))' }}>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {showCompleted ? 'Aucune tâche complétée' : 'Aucune tâche'}
          </h3>
          <p className="text-sm">
            {showCompleted ? 'Complétez des tâches pour les voir ici' : 'Créez votre première tâche pour commencer'}
          </p>
          {!showCompleted && !addToListMode && (
            <button
              type="button"
              onClick={() => setShowCreateFromEmpty(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              Créer une tâche
            </button>
          )}
        </div>
      )}

      {/* Barre d'actions groupées du mode sélection (#10) */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl border shadow-2xl"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 84px)',
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
            }}
          >
            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''}
            </span>
            <Button size="sm" onClick={bulkComplete} disabled={selectedIds.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
              <CheckCircle2 size={16} data-icon="inline-start" />
              <span className="hidden sm:inline">Compléter</span>
            </Button>
            {/* Ouvre le modal d'ajout à une liste (#23) — toujours cliquable,
                même sans liste manuelle (le modal permet d'en créer une). */}
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.length === 0}
              onClick={() => { setBulkModalCount(selectedIds.length); setShowBulkListModal(true); }}
            >
              <ListPlus size={16} data-icon="inline-start" />
              <span className="hidden sm:inline">Liste</span>
            </Button>
            <Button size="sm" variant="outline" onClick={bulkDelete} disabled={selectedIds.length === 0} className="!text-red-500 hover:!bg-red-500/10">
              <Trash2 size={16} data-icon="inline-start" />
              <span className="hidden sm:inline">Supprimer</span>
            </Button>
            <button
              type="button"
              onClick={exitSelectMode}
              aria-label="Quitter la sélection"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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

        <AnimatePresence>
        {taskToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] sm:p-4"
            onClick={() => setTaskToDelete(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 monochrome:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border border-slate-200 dark:border-slate-700 monochrome:border-neutral-700"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="sm:hidden flex justify-center pt-4 pb-3">
                <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
              </div>
              <div className="p-5 sm:p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 monochrome:bg-neutral-800 flex items-center justify-center mb-4">
                  <Trash2 className="text-red-600 dark:text-red-400 monochrome:text-neutral-300" size={24} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer la tâche</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                  Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => setTaskToDelete(null)}
                    className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 monochrome:border-neutral-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 monochrome:bg-white monochrome:text-black transition-all shadow-md shadow-red-500/20 monochrome:shadow-white/10"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {addToListTask && (
          <AddToListModal
            isOpen={true}
            onClose={() => setAddToListTask(null)}
            taskId={addToListTask}
          />
        )}
    </>
  );
};

export default TaskTable;
