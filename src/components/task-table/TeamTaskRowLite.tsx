// ═══════════════════════════════════════════════════════════════════
// TeamTaskRowLite — ligne desktop pour une tâche d'équipe fusionnée dans la
// liste perso (TaskTable). Même nombre de colonnes que TaskRow, mais jeu
// d'actions volontairement restreint : bascule complété + ouverture de
// TeamTaskModal. Pas de sélection multiple, dupliquer, supprimer, planifier
// ou collaborateur perso — ces actions n'ont pas de sens ici et existent déjà
// dans l'espace Entreprise (lien "Ouvrir dans l'espace entreprise").
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { Link } from 'react-router';
import { UsersRound, ArrowUpRight } from 'lucide-react';
import type { TeamProject, TeamTask } from '@/modules/team-projects';
import { isTaskOverdue, projectColor } from '../organization/team-projects.helpers';
import { formatDeadlineSmart, formatDuration } from './helpers';
import { useT } from '@/i18n/useT';

interface TeamTaskRowLiteProps {
  task: TeamTask;
  project: TeamProject | undefined;
  onToggleComplete: (task: TeamTask) => void;
  onEdit: (task: TeamTask) => void;
}

export const TeamTaskRowLite = React.memo(({ task, project, onToggleComplete, onEdit }: TeamTaskRowLiteProps) => {
  const { t } = useT('tasks');
  const overdue = isTaskOverdue(task);
  const color = project ? projectColor(project.color) : projectColor('blue');

  return (
    <tr
      className="animate-fade-in transition-colors cursor-pointer bg-indigo-500/[0.09] hover:bg-indigo-500/[0.15] dark:bg-indigo-500/[0.16] dark:hover:bg-indigo-500/[0.22]"
      onClick={() => onEdit(task)}
      style={{ borderLeft: overdue ? '4px solid rgb(var(--color-error))' : '3px solid transparent' }}
    >
      <td className="px-2 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => onToggleComplete(task)}
            role="checkbox"
            aria-checked={task.completed}
            aria-label={t('team.completeAria', { name: task.name })}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
              task.completed
                ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]'
                : 'border-[rgb(var(--color-border-strong))] hover:border-[rgb(var(--color-accent))]'
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
          <span className={`w-4 h-4 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
        </div>
      </td>
      <td className={`font-medium px-2 py-4 text-base ${task.completed ? 'line-through' : ''}`}
          style={{ color: task.completed ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-text-primary))' }}>
        <div className="flex items-center gap-2">
          <span className="truncate" title={task.name}>{task.name}</span>
          <span className="inline-flex items-center gap-1 text-caption font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
            <UsersRound size={10} aria-hidden="true" /> {t('team.badge')}
          </span>
        </div>
      </td>
      <td className="px-2 py-4 whitespace-nowrap">
        <span className="inline-flex items-center gap-2 text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          <span className="truncate">{project?.name ?? '—'}</span>
        </span>
      </td>
      <td className="text-center px-1 py-4 whitespace-nowrap">
        <span className={`inline-flex justify-center items-center w-8 h-8 rounded-full task-priority-${task.priority} text-base font-bold`}>
          {task.priority}
        </span>
      </td>
      <td className="px-2 py-4 whitespace-nowrap text-base font-medium">
        {task.deadline
          ? <span className={overdue ? 'text-red-500 font-semibold' : ''}>{formatDeadlineSmart(task.deadline)}</span>
          : <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('card.noDeadline')}</span>}
      </td>
      <td className="text-center px-1 py-4 whitespace-nowrap text-base font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
        {formatDuration(task.estimatedTime)}
      </td>
      <td onClick={(e) => e.stopPropagation()} className="px-2 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center gap-1">
          <Link
            to="/entreprise"
            onClick={(e) => e.stopPropagation()}
            aria-label={t('team.enterpriseSpace')}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[rgb(var(--color-hover))]"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </td>
    </tr>
  );
});
TeamTaskRowLite.displayName = 'TeamTaskRowLite';
