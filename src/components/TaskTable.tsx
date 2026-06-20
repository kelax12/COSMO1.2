import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, CheckCircle2, AlertTriangle, Users, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useBilling } from '@/modules/billing/billing.context';
import TaskModal from './TaskModal';
import ScheduleEventModal from './ScheduleEventModal';
import AddToListModal from './AddToListModal';
import { VirtualizedTaskList, TaskRow } from './task-table/list';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { showUndoToast } from '@/lib/undo-toast';
import {
  useTasks,
  useDeleteTask,
  useCreateTask,
  useToggleTaskComplete,
  useToggleTaskBookmark,
  Task
} from '@/modules/tasks';

import { usePriorityRange } from '@/modules/ui-states';
import { filterAndSortTasks } from '@/modules/tasks/task-filtering';
import { useFriends, useCollaboratorsByTask } from '@/modules/friends';
import { useAuth } from '@/modules/auth/AuthContext';

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
  const toggleCompleteMutation = useToggleTaskComplete();
  const toggleBookmarkMutation = useToggleTaskBookmark();

  const { priorityRange } = usePriorityRange();
  const { isPremium } = useBilling();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: friends = [] } = useFriends();
  const collaboratorsByTask = useCollaboratorsByTask(user?.id);

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

  const confirmDelete = () => {
    if (!taskToDelete) return;
    // Snapshot la tâche AVANT suppression pour permettre l'undo
    const taskSnapshot = tasks.find(t => t.id === taskToDelete);
    deleteMutation.mutate(taskToDelete, {
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

  const handleSelectTask = useCallback((id: string) => {
    setSelectedTaskForCollaborators(null);
    setSelectedTask(id);
  }, []);



  return (
    <>
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
        </div>
      </div>

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
                addToListMode={addToListMode}
                selectedForListIds={selectedForListIds}
                activeQuickFilter={activeQuickFilter}
                showCompleted={showCompleted}
                onSelectTask={handleSelectTask}
                onToggleTaskForList={onToggleTaskForList}
                onToggleComplete={handleToggleComplete}
                onToggleBookmark={handleToggleBookmark}
                onScheduleTask={setTaskToEventModal}
                onAddToList={setAddToListTask}
                onOpenCollaborator={handleOpenCollaborator}
                onDuplicate={handleDuplicate}
                onDeleteTask={setTaskToDelete}
                collaboratorsByTask={collaboratorsByTask}
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
          addToListMode={addToListMode}
          selectedForListIds={selectedForListIds}
          onToggleTaskForList={onToggleTaskForList}
          onToggleComplete={handleToggleComplete}
          onToggleBookmark={handleToggleBookmark}
          onOpenCollaborator={handleOpenCollaborator}
          onSelectTask={handleSelectTask}
          onAddToList={setAddToListTask}
          onDeleteTask={setTaskToDelete}
          onScheduleTask={setTaskToEventModal}
          onDuplicate={handleDuplicate}
          collaboratorsByTask={collaboratorsByTask}
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
        </div>
      )}

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
