// Une carte du Tableau perso.
//
// Trois chemins vers chaque action, dont aucun n'est un geste seul (C-111) :
// cliquer ou Entrée ouvre la fiche ; le bouton « ⇄ », la touche menu
// contextuel ou Maj+F10 ouvrent « Déplacer vers… » ; sur desktop, la carte se
// glisse aussi d'une colonne à l'autre.
import { memo } from 'react';
import { AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { useCategoryLookup } from '@/modules/categories';
import type { Task } from '@/modules/tasks';
import { formatDeadlineSmart, formatOverdueSince, isTaskOverdue } from '@/components/task-table/helpers';
import { useT } from '@/i18n/useT';
import TaskHealthMenu from './TaskHealthMenu';

export const TASK_DRAG_TYPE = 'application/x-cosmo-task';

interface TaskBoardCardProps {
  task: Task;
  draggable: boolean;
  onOpen: (task: Task) => void;
  onRequestMove: (task: Task) => void;
}

const TaskBoardCard = ({ task, draggable, onOpen, onRequestMove }: TaskBoardCardProps) => {
  const { t } = useT('tasks');
  const lookupCategory = useCategoryLookup();
  const category = task.category ? lookupCategory(task.category) : null;
  const overdue = isTaskOverdue(task.deadline, task.completed);
  const hasPriority = task.priority >= 1 && task.priority <= 5;

  return (
    <article
      tabIndex={0}
      data-board-task={task.id}
      draggable={draggable}
      aria-label={t('board.openAria', { name: task.name })}
      aria-keyshortcuts="Shift+F10"
      onDragStart={(e) => {
        e.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(task); }
      }}
      onContextMenu={(e) => { e.preventDefault(); onRequestMove(task); }}
      className={`group rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3 text-left cursor-pointer transition-colors hover:border-[rgb(var(--color-accent))]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 ${draggable ? 'md:cursor-grab md:active:cursor-grabbing' : ''}`}
    >
      {/* Le titre a TOUTE la largeur : une colonne de Tableau est étroite, et
          les boutons placés à côté de lui le réduisaient à une dizaine de
          caractères par ligne (mesuré le 2026-10-08 à 1 280 px). */}
      <p
        className={`text-sm font-medium leading-snug line-clamp-3 ${task.completed ? 'line-through opacity-60' : ''}`}
        style={{ color: 'rgb(var(--color-text-primary))' }}
      >
        {task.name}
      </p>

      <div className="mt-1.5 flex items-center gap-x-1.5 text-caption" style={{ color: 'rgb(var(--color-text-muted))' }}>
        <div className="flex flex-1 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          {category && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
              <span className="truncate max-w-[8rem]">{category.name}</span>
            </span>
          )}
          {task.deadline && (
            <span className={overdue ? 'text-red-500 font-semibold inline-flex items-center gap-0.5' : ''}>
              {overdue && <AlertTriangle size={12} aria-hidden="true" />}
              {overdue ? formatOverdueSince(task.deadline) : formatDeadlineSmart(task.deadline)}
            </span>
          )}
          {hasPriority && (
            <span className="px-1.5 rounded-md text-caption font-semibold bg-[rgb(var(--color-hover))]">
              P{task.priority}
            </span>
          )}
        </div>
        <div className="flex items-center shrink-0 -mr-1.5 -mb-1.5">
          <TaskHealthMenu task={task} className="w-11 h-11 md:w-8 md:h-8" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRequestMove(task); }}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={t('board.moveToAria', { name: task.name })}
            title={t('board.moveTo')}
            className="w-11 h-11 md:w-8 md:h-8 shrink-0 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60"
          >
            <ArrowRightLeft size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
};

export default memo(TaskBoardCard);
