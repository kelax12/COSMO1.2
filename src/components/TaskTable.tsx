import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bookmark, Calendar, MoreHorizontal, Trash2, BookmarkCheck, UserPlus, CheckCircle2, AlertTriangle, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useBilling } from '@/modules/billing/billing.context';
import TaskCategoryIndicator from './TaskCategoryIndicator';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import CollaboratorModal from './CollaboratorModal';
import AddToListModal from './AddToListModal';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { toast } from 'sonner';
import {
  useTasks,
  useDeleteTask,
  useCreateTask,
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
import { useCategoryLookup } from '@/modules/categories';

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
  showQuickFilters?: boolean;
};

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════
const formatDate = (dateString: string | undefined) => {
  try {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: fr });
  } catch {
    return 'N/A';
  }
};

// ═══════════════════════════════════════════════════════════════════
// Mobile TaskCard — extracted at module level for stable identity
// (prevents useMotionValue from being re-created on parent renders)
// ═══════════════════════════════════════════════════════════════════
interface TaskCardProps {
  task: Task;
  addToListMode: boolean;
  selectedForListIds: string[];
  onToggleTaskForList?: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onOpenCollaborator: (id: string) => void;
  onSelectTask: (id: string) => void;
  onAddToList: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onScheduleTask: (task: Task) => void;
}

const TaskCard = React.memo(({
  task,
  addToListMode,
  selectedForListIds,
  onToggleTaskForList,
  onToggleComplete,
  onToggleBookmark,
  onOpenCollaborator,
  onSelectTask,
  onAddToList,
  onDeleteTask,
  onScheduleTask,
}: TaskCardProps) => {
  // Lookup catégorie via hook React Query — re-render automatique quand
  // les catégories Supabase finissent de charger (asynchrone en prod).
  const getCategoryById = useCategoryLookup();
  const category = getCategoryById(task.category);
  // Fallback gris neutre (pas bleu = couleur Travail par défaut) pour
  // signaler une catégorie manquante au lieu de la masquer.
  const categoryColor = category?.color || '#94a3b8';

  const [actionsVisible, setActionsVisible] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const isDragging = useRef(false);

  // Swipe gestures — x must be in the SAME style object as other style props
  const x = useMotionValue(0);
  const greenOpacity = useTransform(x, [0, 8, 80], [0, 1, 1]);
  const grayOpacity = useTransform(x, [-80, -8, 0], [1, 1, 0]);
  const greenIconOpacity = useTransform(x, [0, 24, 80], [0, 0.6, 1]);
  const grayIconOpacity = useTransform(x, [-80, -24, 0], [1, 0.6, 0]);

  const startLongPress = (e: React.PointerEvent) => {
    if (addToListMode) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setActionsVisible(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleCardClick = () => {
    if (isDragging.current) {
      isDragging.current = false;
      return;
    }
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    if (addToListMode) return;
    onSelectTask(task.id);
  };

  const isOverdue = !task.completed && new Date(task.deadline) < new Date();

  return (
    <motion.div
      className="relative mb-2"
      layout
      animate={isExiting ? { x: '100%', opacity: 0 } : { x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
    >
    {/* Swipe wrapper — isolates card + reveal layers from the action row below */}
    <div className="relative overflow-hidden rounded-xl">
    {/* Reveal layers BEHIND the card — full size, full color */}
    {!addToListMode && (
      <>
        {/* Right swipe → green bg behind */}
        <motion.div
          style={{ opacity: greenOpacity }}
          animate={isValidating ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="absolute inset-0 bg-green-500 pointer-events-none flex items-center justify-start pl-5 rounded-xl"
        >
          <motion.div
            style={{ opacity: greenIconOpacity }}
            className="flex items-center gap-2 text-white whitespace-nowrap"
          >
            <CheckCircle2 size={22} strokeWidth={2.5} />
            <span className="text-sm font-bold">{task.completed ? 'Annuler' : 'Valider'}</span>
          </motion.div>
        </motion.div>
        {/* Left swipe → gray bg behind */}
        <motion.div
          style={{ opacity: grayOpacity }}
          className="absolute inset-0 bg-slate-500 dark:bg-slate-600 pointer-events-none flex items-center justify-end pr-5 rounded-xl"
        >
          <motion.div
            style={{ opacity: grayIconOpacity }}
            className="flex items-center gap-2 text-white whitespace-nowrap"
          >
            <MoreHorizontal size={22} strokeWidth={2.5} />
            <span className="text-sm font-bold">Options</span>
          </motion.div>
        </motion.div>
      </>
    )}
    {/* Draggable card — x MotionValue merged into the single style object */}
    <motion.div
      drag={addToListMode ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      dragDirectionLock
      onDragStart={() => {
        isDragging.current = true;
        cancelLongPress();
      }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 80) {
          setIsValidating(true);
          setIsExiting(true);
          setTimeout(() => onToggleComplete(task.id), 300);
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        } else if (info.offset.x < -80) {
          setActionsVisible(true);
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        }
        setTimeout(() => { isDragging.current = false; }, 50);
      }}
      whileTap={addToListMode ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.1 }}
      className={`relative flex items-stretch gap-3 p-3 rounded-xl border transition-colors ${addToListMode ? 'cursor-default' : 'cursor-pointer'} ${task.completed && !addToListMode ? 'opacity-60' : ''}`}
      onClick={handleCardClick}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={(e) => { e.preventDefault(); }}
      style={{
        x,
        backgroundColor: addToListMode
          ? (selectedForListIds.includes(task.id) ? 'rgba(59, 130, 246, 0.1)' : 'rgb(var(--color-surface))')
          : 'rgb(var(--color-surface))',
        borderColor: addToListMode && selectedForListIds.includes(task.id)
          ? '#3B82F6'
          : 'rgb(var(--color-border))',
        minHeight: '60px',
        touchAction: 'pan-y',
      }}
    >
      {/* Color bar (left) */}
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: isOverdue ? '#ef4444' : (task.bookmarked ? '#EAB308' : categoryColor) }}
      />

      {/* Checkbox */}
      {addToListMode ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleTaskForList?.(task.id); }}
          className="min-w-11 min-h-11 -my-1 -ml-1 p-2 flex items-center justify-center shrink-0"
          aria-label={selectedForListIds.includes(task.id) ? 'Retirer de la liste' : 'Ajouter à la liste'}
          aria-pressed={selectedForListIds.includes(task.id)}
        >
          <span
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              selectedForListIds.includes(task.id)
                ? 'bg-blue-500 border-blue-500'
                : 'border-slate-400 dark:border-slate-500'
            }`}
          >
            {selectedForListIds.includes(task.id) && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            cancelLongPress();
            onToggleComplete(task.id);
          }}
          onPointerDown={(e) => { e.stopPropagation(); }}
          className="min-w-11 min-h-11 -my-1 -ml-1 p-2 flex items-center justify-center shrink-0"
          aria-label={task.completed ? 'Marquer comme non complétée' : 'Marquer comme complétée'}
          aria-pressed={task.completed}
        >
          <span
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              task.completed
                ? 'bg-blue-500 border-blue-500'
                : 'border-gray-400'
            }`}
          >
            {task.completed && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        </button>
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className={`font-semibold text-sm leading-tight truncate ${task.completed ? 'line-through' : ''}`} style={{ color: 'rgb(var(--color-text-primary))' }}>
          {task.name}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
          <span>{formatDate(task.deadline)}</span>
          <span>·</span>
          <span>{task.estimatedTime}min</span>
          {task.isCollaborative && (task.collaborators?.length ?? 0) > 0 && (
            <>
              <span>·</span>
              <Users size={11} className="opacity-70" />
            </>
          )}
        </div>
      </div>

      {/* Priority badge */}
      <div
        className="self-center shrink-0 px-2 py-0.5 rounded font-bold text-[11px]"
        style={{
          backgroundColor: `${isOverdue ? '#ef4444' : (task.bookmarked ? '#EAB308' : categoryColor)}20`,
          color: isOverdue ? '#ef4444' : (task.bookmarked ? '#EAB308' : categoryColor)
        }}
      >
        Priorité {task.priority}
      </div>

      {task.bookmarked && (
        <Bookmark size={14} className="self-center shrink-0 text-amber-500" fill="currentColor" />
      )}

      {/* Affordance permanente — bouton "…" pour révéler les actions sans devoir swipe/long-press.
          Améliore la découvrabilité tout en gardant l'épuration : icône discrète, taille 44×44. */}
      {!addToListMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            cancelLongPress();
            setActionsVisible(v => !v);
          }}
          onPointerDown={(e) => { e.stopPropagation(); }}
          className="self-center shrink-0 min-w-11 min-h-11 -my-1 -mr-1 p-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={actionsVisible ? 'Masquer les actions' : 'Afficher les actions'}
          aria-expanded={actionsVisible}
        >
          <MoreHorizontal size={18} />
        </button>
      )}
    </motion.div>
    </div>

    {/* Actions row — revealed on long press or left swipe */}
    <AnimatePresence>
      {actionsVisible && !addToListMode && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mt-1 flex items-center justify-around gap-1 p-2 rounded-xl border" style={{
            borderColor: 'rgb(var(--color-border))',
            backgroundColor: 'rgb(var(--color-hover))'
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleBookmark(task.id); setActionsVisible(false); }}
              className={`min-w-11 min-h-11 p-2 rounded-lg flex items-center justify-center transition-colors ${task.bookmarked ? 'text-amber-500 bg-amber-500/10' : 'text-slate-500'}`}
              aria-label={task.bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Bookmark size={18} fill={task.bookmarked ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenCollaborator(task.id); setActionsVisible(false); }}
              className="min-w-11 min-h-11 p-2 rounded-lg text-slate-500 flex items-center justify-center"
              aria-label="Ajouter un collaborateur"
            >
              <UserPlus size={18} />
            </button>
            {!task.completed && (
              <button
                onClick={(e) => { e.stopPropagation(); onScheduleTask(task); setActionsVisible(false); }}
                className="min-w-11 min-h-11 p-2 rounded-lg text-slate-500 flex items-center justify-center"
                aria-label="Planifier dans l'agenda"
              >
                <Calendar size={18} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAddToList(task.id); setActionsVisible(false); }}
              className="min-w-11 min-h-11 p-2 rounded-lg text-slate-500 flex items-center justify-center"
              aria-label="Ajouter à une liste"
            >
              <MoreHorizontal size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); setActionsVisible(false); }}
              className="min-w-11 min-h-11 p-2 rounded-lg text-red-500 flex items-center justify-center"
              aria-label="Supprimer la tâche"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActionsVisible(false); }}
              className="min-w-11 min-h-11 p-2 rounded-lg text-slate-400 dark:text-slate-500 flex items-center justify-center"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.name === nextProps.task.name &&
    prevProps.task.completed === nextProps.task.completed &&
    prevProps.task.bookmarked === nextProps.task.bookmarked &&
    prevProps.task.priority === nextProps.task.priority &&
    prevProps.task.deadline === nextProps.task.deadline &&
    prevProps.task.estimatedTime === nextProps.task.estimatedTime &&
    prevProps.task.category === nextProps.task.category &&
    prevProps.addToListMode === nextProps.addToListMode &&
    prevProps.selectedForListIds === nextProps.selectedForListIds
  );
});

// ═══════════════════════════════════════════════════════════════════
// VirtualizedTaskList — rendu virtualisé au-delà de VIRTUALIZE_THRESHOLD
// items. En dessous, on garde AnimatePresence + map pour préserver les
// animations spring d'entrée/sortie. Au-delà, on utilise react-virtual
// pour ne monter que les cards visibles + un overscan de 5.
// ═══════════════════════════════════════════════════════════════════
const VIRTUALIZE_THRESHOLD = 50;
const ESTIMATED_CARD_HEIGHT = 76; // mesuré : ~68px card + 8px mb-2

interface VirtualizedTaskListProps {
  tasks: Task[];
  addToListMode: boolean;
  selectedForListIds: string[];
  onToggleTaskForList?: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onOpenCollaborator: (id: string) => void;
  onSelectTask: (id: string) => void;
  onAddToList: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onScheduleTask: (task: Task) => void;
}

const VirtualizedTaskList: React.FC<VirtualizedTaskListProps> = (props) => {
  const { tasks } = props;
  const listRef = useRef<HTMLDivElement>(null);

  const cardProps = (task: Task) => ({
    task,
    addToListMode: props.addToListMode,
    selectedForListIds: props.selectedForListIds,
    onToggleTaskForList: props.onToggleTaskForList,
    onToggleComplete: props.onToggleComplete,
    onToggleBookmark: props.onToggleBookmark,
    onOpenCollaborator: props.onOpenCollaborator,
    onSelectTask: props.onSelectTask,
    onAddToList: props.onAddToList,
    onDeleteTask: props.onDeleteTask,
    onScheduleTask: props.onScheduleTask,
  });

  // useWindowVirtualizer : le scroll est sur la fenêtre (les pages COSMO
  // scrollent au niveau document, pas dans un container fixe). Offset retire
  // la position absolue de la liste relative au top de la page.
  const virtualizer = useWindowVirtualizer({
    count: tasks.length,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  // En dessous du seuil, garder AnimatePresence pour les anims
  if (tasks.length < VIRTUALIZE_THRESHOLD) {
    return (
      <AnimatePresence mode="popLayout">
        {tasks.map(task => (
          <TaskCard key={task.id} {...cardProps(task)} />
        ))}
      </AnimatePresence>
    );
  }

  // Au-delà : virtualisation (pas d'AnimatePresence — incompatible avec le
  // mounting/unmounting agressif du virtualizer)
  const items = virtualizer.getVirtualItems();
  return (
    <div
      ref={listRef}
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {items.map(virtualItem => {
        const task = tasks[virtualItem.index];
        return (
          <div
            key={task.id}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start - (listRef.current?.offsetTop ?? 0)}px)`,
            }}
          >
            <TaskCard {...cardProps(task)} />
          </div>
        );
      })}
    </div>
  );
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

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS - Depuis le module events (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const createEventMutation = useCreateEvent();

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
    // Snapshot la tâche AVANT suppression pour permettre l'undo
    const taskSnapshot = tasks.find(t => t.id === taskToDelete);
    deleteMutation.mutate(taskToDelete, {
      onSuccess: () => {
        setTaskToDelete(null);
        if (taskSnapshot) {
          toast.success('Tâche supprimée', {
            action: {
              label: 'Annuler',
              onClick: () => {
                // Recrée la tâche avec les mêmes champs (nouvel id généré côté repo)
                const { id: _id, createdAt: _ca, ...rest } = taskSnapshot;
                createMutation.mutate(rest, {
                  onSuccess: () => toast.success('Tâche restaurée'),
                });
              },
            },
            duration: 6000,
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
                    <AnimatePresence>
                      {addToListMode && (
                        <motion.div
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 28, opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                          className="shrink-0 flex items-center"
                        >
                          <motion.button
                            onClick={() => onToggleTaskForList?.(task.id)}
                            animate={{}}
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.88 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center shrink-0 ${
                              selectedForListIds.includes(task.id)
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-slate-600 dark:border-slate-400'
                            }`}
                          >
                            <motion.svg
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{
                                scale: selectedForListIds.includes(task.id) ? 1 : 0,
                                opacity: selectedForListIds.includes(task.id) ? 1 : 0,
                              }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="w-3.5 h-3.5 text-white"
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </motion.svg>
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      onClick={() => handleToggleComplete(task.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                        task.completed
                          ? 'bg-blue-500 border-blue-500'
                          : addToListMode
                            ? 'border-gray-600 dark:border-gray-500 hover:border-blue-500'
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
                    {task.isCollaborative && (task.collaborators?.length ?? 0) > 0 && (
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

      {/* Mobile View (Cards) — virtualisé au-delà de 50 items */}
      <div className="md:hidden">
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
              exit={{ y: '100%', opacity: 0, transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
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
