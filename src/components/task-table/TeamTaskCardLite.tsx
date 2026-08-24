// ═══════════════════════════════════════════════════════════════════
// TeamTaskCardLite — carte mobile pour une tâche d'équipe fusionnée dans la
// liste perso (VirtualizedTaskList). Même jeu d'actions restreint que
// TeamTaskRowLite (bascule complété + ouverture de TeamTaskModal) — pas de
// swipe, pas d'actions perso (favoris, dupliquer, partager…).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { CalendarClock, UsersRound } from 'lucide-react';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { isTaskOverdue, projectColor, formatDuration, taskDisplayStatus } from '../organization/team-projects.helpers';
import { formatDate } from './helpers';
import { useT } from '@/i18n/useT';

interface TeamTaskCardLiteProps {
  task: TeamTask;
  project: TeamProject | undefined;
  onToggleComplete: (task: TeamTask) => void;
  onEdit: (task: TeamTask) => void;
}

const TeamTaskCardLiteInner = React.forwardRef<HTMLDivElement, TeamTaskCardLiteProps>(
  ({ task, project, onToggleComplete, onEdit }, ref) => {
    const { t } = useT('tasks');
    const { t: tOrg } = useT('org');
    const overdue = isTaskOverdue(task);
    const color = project ? projectColor(project.color) : projectColor('blue');
    const status = taskDisplayStatus(task);

    return (
      <div
        ref={ref}
        data-testid="team-task-card"
        className="relative mb-1.5 flex items-stretch gap-3 px-3 py-2.5 rounded-card cursor-pointer bg-indigo-500/[0.12] dark:bg-indigo-500/[0.20] border border-indigo-300/40 dark:border-indigo-700/40"
        style={{ minHeight: '60px' }}
        onClick={() => onEdit(task)}
      >
        <div className={`w-1.5 self-stretch rounded-full shrink-0 ${color.dot}`} />

        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
          className="min-w-11 min-h-11 -my-1 -ml-1 p-2 flex items-center justify-center shrink-0"
          aria-label={t('team.completeAria', { name: task.name })}
          aria-pressed={task.completed}
        >
          <span
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              task.completed
                ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]'
                : 'border-[rgb(var(--color-text-muted))]'
            }`}
          >
            {task.completed && (
              <svg className="w-4 h-4 text-[rgb(var(--color-accent-solid-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <p className={`font-medium text-body leading-tight truncate ${task.completed ? 'line-through' : ''}`} style={{ color: 'rgb(var(--color-text-primary))' }}>
            {task.name}
          </p>
          <div className="flex items-center gap-1.5 text-caption" style={{ color: 'rgb(var(--color-text-muted))' }}>
            <span className="inline-flex items-center gap-1 text-caption font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
              <UsersRound size={10} aria-hidden="true" /> {project?.name ?? t('team.badge')}
            </span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} aria-hidden="true" />
              {tOrg(status.labelKey as Parameters<typeof tOrg>[0])}
            </span>
            {task.deadline && (
              <span className={overdue ? 'text-red-500 font-semibold inline-flex items-center gap-0.5' : 'inline-flex items-center gap-0.5'}>
                <CalendarClock size={11} aria-hidden="true" />
                {formatDate(task.deadline)}
              </span>
            )}
            {formatDuration(task.estimatedTime ?? 0) && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatDuration(task.estimatedTime ?? 0)}</span>
              </>
            )}
          </div>
        </div>

        {task.priority > 0 && (
          <div className={`self-center shrink-0 px-1.5 py-0.5 rounded-md font-bold text-caption task-priority-${task.priority}`}>
            P{task.priority}
          </div>
        )}
      </div>
    );
  },
);
TeamTaskCardLiteInner.displayName = 'TeamTaskCardLite';

export const TeamTaskCardLite = React.memo(TeamTaskCardLiteInner);
