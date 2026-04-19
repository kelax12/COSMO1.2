import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bookmark, Calendar, MoreHorizontal, Trash2, BookmarkCheck, UserPlus, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useBilling } from '@/modules/billing/billing.context';
import TaskCategoryIndicator from './TaskCategoryIndicator';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import CollaboratorModal from './CollaboratorModal';
import AddToListModal from './AddToListModal';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { 
  useTasks, 
  useDeleteTask, 
  useToggleTaskComplete, 
  useToggleTaskBookmark,
  Task 
} from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module events - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCreateEvent, CreateEventInput } from '@/modules/events';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories } from '@/modules/categories';

import { usePriorityRange } from '@/modules/ui-states';

type TaskTableProps = {
  tasks?: Task[];
  sortField?: string;
  showCompleted?: boolean;
  selectedTaskId?: string | null;
  onTaskModalClose?: () => void;
  addToListMode?: boolean;
  selectedForListIds?: string[];
  onToggleTaskForList?: (taskId: string) => void;
};

const TaskTable: React.FC<TaskTableProps> = ({
  tasks: propTasks,
  sortField: propSortField,
  showCompleted = false,
  selectedTaskId: externalSelectedTaskId,
  onTaskModalClose,
  addToListMode = false,
  selectedForListIds = [],
  onToggleTaskForList,
}) => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: moduleTasks = [], isLoading: isLoadingTasks } = useTasks();
  const deleteMutation = useDeleteTask();
  const toggleCompleteMutation = useToggleTaskComplete();
  const toggleBookmarkMutation = useToggleTaskBookmark();

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS - Depuis le module events (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const createEventMutation = useCreateEvent();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();

  const { priorityRange } = usePriorityRange();
  const { isPremium } = useBilling();
  const navigate = useNavigate();

  // Utiliser propTasks si fourni, sinon les tasks du module
  const tasks = propTasks || moduleTasks;

  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [localSortField, setLocalSortField] = useState<string | undefined>(propSortField);

  useEffect(() => {
    if (propSortField) {
      setLocalSortField(propSortField);
    }
  }, [propSortField]);

  useEffect(() => {
    setSortDirection('asc');
  }, [localSortField]);

  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedTaskForCollaborators, setSelectedTaskForCollaborators] = useState<string | null>(null);
  const [addToListTask, setAddToListTask] = useState<string | null>(null);
  const [collaboratorModalTask, setCollaboratorModalTask] = useState<string | null>(null);
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
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLocalSortField(field);
      setSortDirection('asc');
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

  const handleDeleteTask = useCallback((taskId: string) => {
    deleteMutation.mutate(taskId);
    setTaskToDelete(null);
  }, [deleteMutation]);

  // Filtrage et tri mémoïsés
  const filteredAndSortedTasks = useMemo(() => {
    const now = new Date();
    let filteredTasksForView: Task[];

    switch (activeQuickFilter) {
      case 'favoris':
        filteredTasksForView = tasks.filter(task => task.bookmarked && !task.completed);
        break;
      case 'terminées':
        filteredTasksForView = tasks.filter(task => task.completed);
        break;
      case 'retard':
        filteredTasksForView = tasks.filter(task => !task.completed && new Date(task.deadline) < now);
        break;
      case 'collaboration':
        filteredTasksForView = tasks.filter(task => task.isCollaborative && !task.completed);
        break;
      default:
        filteredTasksForView = showCompleted 
          ? tasks.filter(task => task.completed)
          : tasks.filter(task => !task.completed);
    }

    const filteredTasks = filteredTasksForView.filter(task => 
      task.priority >= priorityRange[0] && task.priority <= priorityRange[1]
    );

    const sorted = [...filteredTasks].sort((a, b) => {
      if (localSortField) {
        let comparison = 0;
        if (localSortField === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (localSortField === 'priority') {
          comparison = a.priority - b.priority;
        } else if (localSortField === 'deadline') {
          comparison = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        } else if (localSortField === 'estimatedTime') {
          comparison = a.estimatedTime - b.estimatedTime;
        } else if (localSortField === 'createdAt') {
          comparison = new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime();
        } else if (localSortField === 'category') {
          comparison = a.category.localeCompare(b.category);
        } else if (localSortField === 'completedAt' && showCompleted) {
          const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          comparison = aDate - bDate;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (a.bookmarked && !b.bookmarked) return -1;
      if (!a.bookmarked && b.bookmarked) return 1;

      return 0;
    });

    return sorted;
  }, [tasks, activeQuickFilter, showCompleted, priorityRange, localSortField, sortDirection]);

  const sortedTasks = filteredAndSortedTasks;

  const selectedTaskData = tasks.find(task => task.id === selectedTask);
  const selectedTaskForCollaboratorsData = tasks.find(task => task.id === selectedTaskForCollaborators);

  const handleCreateEventFromTask = (eventData: CreateEventInput) => {
    if (taskToEventModal) {
      createEventMutation.mutate({
        ...eventData,
        taskId: taskToEventModal.id
      });
    }
    setTaskToEventModal(null);
  };

  const handleOpenCollaborator = useCallback((taskId: string) => {
    if (!isPremium()) {
      navigate('/premium');
      return;
    }
    setCollaboratorModalTask(taskId);
  }, [isPremium, navigate]);

  const confirmDelete = () => {
    if (!taskToDelete) return;
    deleteMutation.mutate(taskToDelete, {
      onSuccess: () => setTaskToDelete(null),
      onError: (err) => console.error('Delete failed', err),
    });
  };

  const formatDate = (dateString: string | undefined) => {
    try {
      if (!dateString) return 'N/A';
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: fr });
    } catch {
      return 'N/A';
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Loading State
  // ═══════════════════════════════════════════════════════════════════
  if (isLoadingTasks && !propTasks) {
    return (
      <div className="animate-pulse">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 w-24 bg-[rgb(var(--color-border))] rounded-lg"></div>
          ))}
        </div>
        <div className="hidden md:block">
          <div className="h-12 bg-[rgb(var(--color-border))] rounded-t-lg mb-1"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-[rgb(var(--color-border)/0.5)] mb-1 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const TaskCard = React.memo(({ task }: { task: Task }) => {
    const [isHovered, setIsHovered] = useState(false);
    const category = categories.find(c => c.id === task.category);
    const categoryColor = category?.color || '#3B82F6';
    
    return (
      <div
        className={`p-4 rounded-xl border mb-3 transition-all ${addToListMode ? 'cursor-default' : 'cursor-pointer'} ${task.completed && !addToListMode ? 'opacity-75' : ''}`}
        onClick={() => { if (!addToListMode) { setSelectedTaskForCollaborators(null); setSelectedTask(task.id); } }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          backgroundColor: addToListMode
            ? (selectedForListIds.includes(task.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent')
            : (activeQuickFilter === 'retard'
                ? (isHovered ? 'rgb(var(--color-error) / 0.25)' : 'rgb(var(--color-error) / 0.15)')
                : (task.bookmarked
                    ? (isHovered ? 'rgba(234, 179, 8, 0.25)' : 'rgba(234, 179, 8, 0.15)')
                    : (isHovered ? `${categoryColor}25` : `${categoryColor}10`))),
          borderColor: addToListMode
            ? (selectedForListIds.includes(task.id) ? '#3B82F6' : 'rgb(var(--color-border))')
            : (activeQuickFilter === 'retard'
                ? (isHovered ? 'rgb(var(--color-error))' : 'rgb(var(--color-error) / 0.7)')
                : (task.bookmarked
                    ? (isHovered ? '#EAB308' : 'rgba(234, 179, 8, 0.6)')
                    : (isHovered ? categoryColor : 'rgb(var(--color-border))'))),
          borderLeftWidth: '4px',
          borderLeftColor: activeQuickFilter === 'retard' ? 'rgb(var(--color-error))' : (task.bookmarked ? '#EAB308' : categoryColor)
        }}
      >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {addToListMode ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTaskForList?.(task.id); }}
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                selectedForListIds.includes(task.id)
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
              }`}
            >
              {selectedForListIds.includes(task.id) && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleComplete(task.id);
              }}
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                task.completed
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-400 hover:border-blue-500'
              }`}
            >
              {task.completed && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )}
          <TaskCategoryIndicator category={task.category} />
        </div>
        <div className="flex items-center gap-1">
          <span className={`inline-flex justify-center items-center w-7 h-7 rounded-full task-priority-${task.priority} text-xs font-bold`}>
            {task.priority}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <h4 className={`font-semibold text-lg ${task.completed ? 'line-through' : ''}`} style={{ color: 'rgb(var(--color-text-primary))' }}>
          {task.name}
        </h4>
        {task.isCollaborative && (
          <span className="text-xs bg-[rgb(var(--color-accent))] text-white px-2 py-0.5 rounded-full shrink-0">Collaboratif</span>
        )}
      </div>
      
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[rgb(var(--color-text-secondary))] mb-3">
        <div className="flex items-center gap-1">
          <Calendar size={14} />
          <span>{formatDate(task.deadline)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium">{task.estimatedTime}h</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center pt-2 border-t border-[rgb(var(--color-border))]">
        <div className="flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); handleToggleBookmark(task.id); }} 
            className={`p-2 rounded ${task.bookmarked ? 'text-amber-500' : 'text-slate-400'}`}
          >
            <Bookmark size={18} fill={task.bookmarked ? 'currentColor' : 'none'} />
          </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleOpenCollaborator(task.id); }}
              className="p-2 text-slate-400"
            >
              <UserPlus size={18} />
            </button>
            {!task.completed && (
              <button 
                onClick={(e) => { e.stopPropagation(); setTaskToEventModal(task); }}
                className="p-2 text-slate-400"
              >
                <Calendar size={18} />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedTaskForCollaborators(null); setSelectedTask(task.id); }}
              className="p-2 text-slate-400"
            >
              <MoreHorizontal size={18} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setTaskToDelete(task.id); }} 
              className="p-2 text-red-400"
            >
              <Trash2 size={18} />
            </button>
          </div>
      </div>
    </div>
    );
  }, (prevProps, nextProps) => {
    // Comparaison optimisée pour éviter les re-renders inutiles
    return (
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.name === nextProps.task.name &&
      prevProps.task.completed === nextProps.task.completed &&
      prevProps.task.bookmarked === nextProps.task.bookmarked &&
      prevProps.task.priority === nextProps.task.priority &&
      prevProps.task.deadline === nextProps.task.deadline &&
      prevProps.task.estimatedTime === nextProps.task.estimatedTime &&
      prevProps.task.category === nextProps.task.category
    );
  });

  return (
    <>
      <div className="flex flex-col gap-4 mb-6">
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
              <th className="px-2 py-3 monochrome:border-neutral-700" style={{ width: '40px' }}></th>
              <th className="px-1 py-3 monochrome:border-neutral-700" style={{ width: '30px' }}></th>
              <th 
                className="cursor-pointer px-2 py-3 monochrome:border-neutral-700 monochrome:hover:bg-neutral-800"
                onClick={() => handleSort('name')}
              >
                Nom de la tache
                {localSortField === 'name' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
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
                  TEMPS (min)
                  {localSortField === 'estimatedTime' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th className="text-center px-1 py-3" style={{ width: '220px' }}>Actions</th>
              <th 
                className="cursor-pointer px-2 py-3"
                onClick={() => handleSort(showCompleted ? 'completedAt' : 'createdAt')}
                style={{ width: '90px' }}
              >
                {showCompleted ? 'Réalisé' : 'Créé'}
                {localSortField === (showCompleted ? 'completedAt' : 'createdAt') && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedTasks.map((task) => (
              <tr
                key={task.id}
                className={`animate-fade-in transition-colors ${addToListMode ? 'cursor-default' : 'cursor-pointer'} ${task.completed && !addToListMode ? 'opacity-75' : ''}`}
                onClick={() => { if (!addToListMode) { setSelectedTaskForCollaborators(null); setSelectedTask(task.id); } }}
                style={{
                  backgroundColor: addToListMode
                    ? (selectedForListIds.includes(task.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent')
                    : (activeQuickFilter === 'retard'
                        ? 'rgb(var(--color-error) / 0.3)'
                        : (task.bookmarked ? 'rgba(234, 179, 8, 0.2)' : 'transparent')),
                  borderLeft: addToListMode
                    ? (selectedForListIds.includes(task.id) ? '4px solid #3B82F6' : '3px solid transparent')
                    : (activeQuickFilter === 'retard'
                        ? '4px solid rgb(var(--color-error))'
                        : (task.bookmarked ? '4px solid #EAB308' : '3px solid transparent'))
                }}
              >
                <td className="px-2 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-5">
                    {addToListMode && (
                      <motion.button
                        onClick={() => onToggleTaskForList?.(task.id)}
                        initial={{ scale: 0, opacity: 0, x: -8 }}
                        animate={{
                          scale: 1, opacity: 1, x: 0,
                          boxShadow: selectedForListIds.includes(task.id)
                            ? '0 0 0 3px rgba(59,130,246,0.3)'
                            : '0 0 0 0px rgba(59,130,246,0)',
                        }}
                        exit={{ scale: 0, opacity: 0, x: -8 }}
                        whileHover={{ scale: 1.15, borderColor: '#3B82F6' }}
                        whileTap={{ scale: 0.88 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center shrink-0 ${
                          selectedForListIds.includes(task.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        <motion.svg
                          key={selectedForListIds.includes(task.id) ? 'checked' : 'unchecked'}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: selectedForListIds.includes(task.id) ? 1 : 0, opacity: selectedForListIds.includes(task.id) ? 1 : 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className="w-3.5 h-3.5 text-white"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </motion.svg>
                      </motion.button>
                    )}
                    <button
                      onClick={() => handleToggleComplete(task.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                        task.completed
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-400 hover:border-blue-500'
                      }`}
                    >
                      {task.completed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                </td>
                <td className="px-1 py-4 whitespace-nowrap">
                  <TaskCategoryIndicator category={task.category} />
                </td>
                <td className={`font-medium ${addToListMode ? 'px-1' : 'px-2'} py-4 text-base ${task.completed ? 'line-through' : ''}`}
                    style={{ color: task.completed ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-text-primary))' }}>
                  <div className="flex items-center gap-2">
                    <span className="truncate" title={task.name}>{task.name}</span>
                    {task.isCollaborative && (
                      <span className="text-xs bg-[rgb(var(--color-accent))] text-white px-2 py-0.5 rounded-full shrink-0">Collaboratif</span>
                    )}
                  </div>
                </td>
                <td className={`text-center ${addToListMode ? 'px-0' : 'px-1'} py-4 whitespace-nowrap`}>
                  <span className={`inline-flex justify-center items-center w-8 h-8 rounded-full task-priority-${task.priority} text-base font-bold`}>
                    {task.priority}
                  </span>
                </td>
                <td className={`${addToListMode ? 'px-0' : 'px-2'} py-4 whitespace-nowrap text-base font-medium`}>
                  {activeQuickFilter === 'terminées'
                    ? (task.completedAt ? formatDate(task.completedAt) : '—')
                    : formatDate(task.deadline)}
                </td>
                <td className="text-center px-1 py-4 whitespace-nowrap text-base font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{task.estimatedTime}</td>
                <td onClick={e => e.stopPropagation()} className="px-2 py-4 whitespace-nowrap">
                  <div className="flex justify-center items-center gap-1">
                      <button 
                        onClick={() => handleToggleBookmark(task.id)} 
                        className={`p-2 rounded transition-colors ${task.bookmarked ? 'favorite-icon filled' : ''}`}
                        style={{ 
                          color: task.bookmarked ? '#EAB308' : 'rgb(var(--color-text-muted))'
                        }}
                      >
                        {task.bookmarked ? <BookmarkCheck size={16} fill="#EAB308" /> : <Bookmark size={16} />}
                      </button>
                    {!task.completed && (
                      <button 
                        onClick={() => setTaskToEventModal(task)}
                        className="p-2 rounded transition-colors"
                        style={{ color: 'rgb(var(--color-text-muted))' }}
                      >
                        <Calendar size={16} />
                      </button>
                    )}
                      <button 
                          onClick={() => setAddToListTask(task.id)}
                          className="p-2 rounded transition-colors"
                          style={{ color: 'rgb(var(--color-text-muted))' }}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      <button 
                        onClick={() => handleOpenCollaborator(task.id)}
                        className="p-2 rounded transition-colors"
                        style={{ color: 'rgb(var(--color-text-muted))' }}
                      >
                        <UserPlus size={16} />
                      </button>
                        <button 
                          onClick={() => setTaskToDelete(task.id)} 
                          className="p-2 rounded transition-colors"
                          style={{ color: 'rgb(var(--color-text-muted))' }}
                        >
                          <Trash2 size={16} />
                        </button>
                  </div>
                </td>
                <td className="px-2 py-4 whitespace-nowrap text-base" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {showCompleted && task.completedAt 
                    ? formatDate(task.completedAt) 
                    : formatDate(task.createdAt)
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View (Cards) */}
      <div className="md:hidden">
        {sortedTasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      {sortedTasks.length === 0 && (
        <div className="text-center py-12" style={{ color: 'rgb(var(--color-text-muted))' }}>
          <div className="text-6xl mb-4">📝</div>
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

      {collaboratorModalTask && (
        <CollaboratorModal
          isOpen={!!collaboratorModalTask}
          onClose={() => setCollaboratorModalTask(null)}
          taskId={collaboratorModalTask}
        />
      )}

      {taskToEventModal && (
        <EventModal
          mode="convert"
          isOpen={true}
          onClose={() => setTaskToEventModal(null)}
          task={taskToEventModal}
          onConvert={handleCreateEventFromTask}
        />
      )}

        {taskToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 monochrome:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 monochrome:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 monochrome:border-neutral-700"
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 monochrome:bg-neutral-800 flex items-center justify-center mb-4">
                  <Trash2 className="text-red-600 dark:text-red-400 monochrome:text-neutral-300" size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer la tâche</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                  Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTaskToDelete(null)}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 monochrome:border-neutral-600 hover:bg-slate-50 dark:hover:bg-slate-700 monochrome:hover:bg-neutral-800 transition-all duration-200"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 monochrome:bg-white monochrome:text-black monochrome:hover:bg-neutral-200 transition-all duration-200 shadow-md shadow-red-500/20 monochrome:shadow-white/10"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
          )}

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
