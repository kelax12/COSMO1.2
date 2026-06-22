// ═══════════════════════════════════════════════════════════════════
// task-table/list — composants de présentation extraits de TaskTable.tsx
// (god-component refactor #6). VirtualizedTaskList (liste mobile) + TaskRow
// (ligne desktop, mémoïsée). La TaskCard mobile vit dans ./TaskCard, les
// formatters dans ./helpers. Aucune logique métier (filtrage/tri =
// task-filtering.ts).
// ═══════════════════════════════════════════════════════════════════
import React, { useRef } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, Calendar, MoreHorizontal, UserPlus, Copy, Trash2, Pencil, ListPlus, Hourglass } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import TaskCategoryIndicator from "../TaskCategoryIndicator";
import { useCategoryLookup } from "@/modules/categories";
import { Task } from "@/modules/tasks";
import { Friend } from "@/modules/friends";
import { TaskCard } from "./TaskCard";
import { isTaskOverdue, formatDeadlineSmart, formatDuration } from "./helpers";

// Re-export des formatters pour compat avec d'éventuels imports existants.
export { formatDate, formatDeadlineSmart, formatDuration } from "./helpers";

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
  onDuplicate: (id: string) => void;
  collaboratorsByTask: Map<string, string[]>;
  pendingCollaboratorTaskIds: Set<string>;
  friends: Friend[];
}

export const VirtualizedTaskList: React.FC<VirtualizedTaskListProps> = (props) => {
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
    onDuplicate: props.onDuplicate,
    collaboratorsByTask: props.collaboratorsByTask,
    pendingCollaboratorTaskIds: props.pendingCollaboratorTaskIds,
    friends: props.friends,
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
        {tasks.map((task, index) => (
          <TaskCard key={task.id} {...cardProps(task)} isFirst={index === 0} />
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
            <TaskCard {...cardProps(task)} isFirst={virtualItem.index === 0} />
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Desktop TaskRow — extrait au niveau module et mémoïsé (shallow). Une ligne
// ne re-render que si SA tâche (ou un flag de vue) change, pas quand une autre
// tâche bascule. Les handlers parents sont stables (useCallback / setState).
// ═══════════════════════════════════════════════════════════════════
interface TaskRowProps {
  task: Task;
  addToListMode: boolean;
  selectedForListIds: string[];
  activeQuickFilter: 'none' | 'favoris' | 'terminées' | 'retard' | 'collaboration';
  showCompleted: boolean;
  onSelectTask: (id: string) => void;
  onToggleTaskForList?: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onScheduleTask: (task: Task) => void;
  onAddToList: (id: string) => void;
  onOpenCollaborator: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDeleteTask: (id: string) => void;
  collaboratorsByTask: Map<string, string[]>;
  pendingCollaboratorTaskIds: Set<string>;
  friends: Friend[];
}

export const TaskRow = React.memo(({
  task,
  addToListMode,
  selectedForListIds,
  activeQuickFilter,
  onSelectTask,
  onToggleTaskForList,
  onToggleComplete,
  onToggleBookmark,
  onScheduleTask,
  onAddToList,
  onOpenCollaborator,
  onDuplicate,
  onDeleteTask,
  collaboratorsByTask,
  pendingCollaboratorTaskIds,
  friends,
}: TaskRowProps) => {
  const getCategoryById = useCategoryLookup();
  const category = getCategoryById(task.category);
  const categoryColor = category?.color || '#94a3b8';
  const overdue = isTaskOverdue(task.deadline, task.completed);
  return (
    <tr
      className={`animate-fade-in transition-colors ${addToListMode ? 'cursor-default' : 'cursor-pointer'} ${task.completed && !addToListMode ? 'opacity-75' : ''}`}
      onClick={() => { if (!addToListMode) onSelectTask(task.id); }}
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
            onClick={() => onToggleComplete(task.id)}
            role="checkbox"
            aria-checked={task.completed}
            aria-label={task.completed ? 'Marquer comme non complétée' : 'Marquer comme complétée'}
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
      <td className="px-2 py-4">
        <div className="flex justify-center">
          <TaskCategoryIndicator category={task.category} />
        </div>
      </td>
      <td className={`font-medium ${addToListMode ? 'px-1' : 'px-2'} py-4 text-base ${task.completed ? 'line-through' : ''}`}
          style={{ color: task.completed ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-text-primary))' }}>
        <div className="flex items-center gap-2">
          <span className="truncate" title={task.name}>{task.name}</span>
          {task.sharedBy ? (
            <span className="text-xs bg-[rgb(var(--color-accent))] text-white px-2 py-0.5 rounded-full shrink-0">{task.sharedBy}</span>
          ) : task.isCollaborative && (collaboratorsByTask.get(task.id)?.length ?? 0) > 0 ? (
            <span className="flex items-center gap-1 shrink-0">
              {(collaboratorsByTask.get(task.id) ?? []).map((id) => {
                const friend = friends.find((f) => f.userId === id || f.id === id || f.name === id);
                const name = friend?.name ?? id;
                return (
                  <span
                    key={id}
                    className="text-xs bg-[rgb(var(--color-accent))] text-white px-2 py-0.5 rounded-full"
                    title={name}
                  >
                    {name}
                  </span>
                );
              })}
              {pendingCollaboratorTaskIds.has(task.id) && (
                <Hourglass
                  size={14}
                  className="shrink-0 text-amber-500"
                  aria-label="Invitation en attente d'acceptation"
                />
              )}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-2 py-4 whitespace-nowrap">
        <span className="inline-flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: categoryColor }} />
          <span className="truncate">{category?.name ?? '—'}</span>
        </span>
      </td>
      <td className={`text-center ${addToListMode ? 'px-0' : 'px-1'} py-4 whitespace-nowrap`}>
        {task.priority === 0 ? (
          <span
            className="inline-flex justify-center items-center w-8 h-8 text-base font-medium"
            style={{ color: 'rgb(var(--color-text-muted))' }}
            title="Aucune priorité"
            aria-label="Aucune priorité"
          >
            —
          </span>
        ) : (
          <span className={`inline-flex justify-center items-center w-8 h-8 rounded-full task-priority-${task.priority} text-base font-bold`}>
            {task.priority}
          </span>
        )}
      </td>
      <td className={`${addToListMode ? 'px-0' : 'px-2'} py-4 whitespace-nowrap text-base font-medium`}>
        {activeQuickFilter === 'terminées'
          ? (task.completedAt ? formatDeadlineSmart(task.completedAt) : '—')
          : (task.deadline
              ? <span className={overdue ? 'text-red-500 font-semibold' : ''}>{formatDeadlineSmart(task.deadline)}</span>
              : <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>Pas d'échéance</span>)}
      </td>
      <td className="text-center px-1 py-4 whitespace-nowrap text-base font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatDuration(task.estimatedTime)}</td>
      <td onClick={e => e.stopPropagation()} className="px-2 py-4 whitespace-nowrap text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Actions pour ${task.name}`}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[rgb(var(--color-hover))]"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSelectTask(task.id)}>
              <Pencil aria-hidden="true" /> Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleBookmark(task.id)}>
              <Bookmark aria-hidden="true" /> {task.bookmarked ? 'Retirer le favori' : 'Favori'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddToList(task.id)}>
              <ListPlus aria-hidden="true" /> Ajouter à une liste
            </DropdownMenuItem>
            {!task.completed && (
              <DropdownMenuItem onClick={() => onScheduleTask(task)}>
                <Calendar aria-hidden="true" /> Planifier
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onOpenCollaborator(task.id)}>
              <UserPlus aria-hidden="true" /> Collaborateur
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(task.id)}>
              <Copy aria-hidden="true" /> Dupliquer la tâche
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDeleteTask(task.id)}
              className="!text-red-500 focus:!text-red-500"
            >
              <Trash2 className="!text-red-500" aria-hidden="true" /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
});
