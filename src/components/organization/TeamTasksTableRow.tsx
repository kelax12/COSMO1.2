import { forwardRef, memo, useState } from 'react';
import { Pencil, Trash2, MoreHorizontal, UserPlus, CalendarPlus, MessageSquare, ListPlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { resolveListColor } from '@/pages/tasks/list-colors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateCalendarPanel, DATE_PANEL_CLASS } from '@/components/ui/date-picker';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamProjectHealth, TeamTask, TeamTaskStatus } from '@/modules/team-projects';
import HealthStateMenu from './HealthStateMenu';
import type { ProjectStatus } from '@/modules/org-config';
import { formatDeadlineSmart } from '@/components/task-table/helpers';
import { useT } from '@/i18n/useT';
import {
  projectColor, isTaskOverdue, formatDuration, STATUS_ORDER, STATUS_META, taskDisplayStatus,
  PRIORITY_META, priorityLabelOf,
} from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';
import TaskSelectCheckbox from './TaskSelectCheckbox';
import type { TaskColumnId } from './team-tasks-table.helpers';

export interface TeamTasksRowHandlers {
  open: (task: TeamTask) => void;
  toggleComplete: (task: TeamTask) => void;
  setStatus: (task: TeamTask, status: TeamTaskStatus) => void;
  /** Statut propre au projet (mig. 197) ; il écrit le statut COSMO correspondant. */
  setCustomStatus: (task: TeamTask, statusId: string) => void;
  /** État déclaré (mig. 204), même menu que les KR. */
  setHealth: (task: TeamTask, health: TeamProjectHealth) => void;
  setPriority: (task: TeamTask, priority: number) => void;
  setDeadline: (task: TeamTask, deadline: string) => void;
  assign?: (task: TeamTask) => void;
  schedule: (task: TeamTask) => void;
  remove: (task: TeamTask) => void;
  toggleSelect: (task: TeamTask) => void;
  /** Listes MANUELLES de l'organisation (mig. 203) : « Ajouter à une liste » du menu ⋯. */
  lists?: readonly { id: string; name: string; color: string; taskIds: string[] }[];
  toggleList?: (task: TeamTask, listId: string, inList: boolean) => void;
  editReason: (task: TeamTask) => string | undefined;
  deleteReason: (task: TeamTask) => string | undefined;
}

interface TeamTasksTableRowProps {
  task: TeamTask;
  project?: TeamProject;
  columns: readonly TaskColumnId[];
  memberById: Map<string, OrgMember>;
  currentUserId?: string;
  categoryName?: string;
  /** Statuts propres du projet de la tâche (mig. 197), [] = les cinq statuts COSMO. */
  projectStatuses: readonly ProjectStatus[];
  unreadComments: number;
  selectMode: boolean;
  selected: boolean;
  handlers: TeamTasksRowHandlers;
  /** Index pour la mesure du virtualiseur. */
  index: number;
}

const cellBtn = 'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-[rgb(var(--color-hover))] disabled:cursor-not-allowed disabled:hover:bg-transparent';

/**
 * Colonne « Assignés » (audit 2026-09-24) : jusqu'ici les avatars vivaient dans
 * la cellule du nom et m'EXCLUAIENT, si bien qu'une tâche à moi seul paraissait
 * « à personne ». « Vous » passe en tête, en toutes lettres.
 */
const AssigneesCell = ({ task, memberById, currentUserId }: Pick<TeamTasksTableRowProps, 'task' | 'memberById' | 'currentUserId'>) => {
  const { t } = useT('portfolio');
  const mine = !!currentUserId && task.assigneeIds.includes(currentUserId);
  const others = task.assigneeIds.filter((id) => id !== currentUserId);
  if (!mine && others.length === 0) {
    return <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('taskTable.nobody')}</span>;
  }
  const names = [mine ? t('taskTable.you') : null, ...others.map((id) => memberById.get(id)?.displayName)].filter(Boolean).join(', ');
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0" title={names}>
      {mine && (
        <span className="shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]">
          {t('taskTable.you')}
        </span>
      )}
      {others.length > 0 && (
        <span className="flex -space-x-1.5 shrink-0">
          {others.slice(0, 3).map((id) => {
            const m = memberById.get(id);
            return m ? (
              <span key={id} className="rounded-full ring-2 ring-[rgb(var(--color-surface))]">
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={20} />
              </span>
            ) : null;
          })}
          {others.length > 3 && (
            <span className="w-[22px] h-[22px] rounded-full bg-[rgb(var(--color-hover))] ring-2 ring-[rgb(var(--color-surface))] flex items-center justify-center text-caption font-bold text-[rgb(var(--color-text-muted))]">
              +{others.length - 3}
            </span>
          )}
        </span>
      )}
    </span>
  );
};

/** Échéance éditable dans la ligne : le calendrier COSMO, sans ouvrir la fiche. */
const DeadlineCell = ({ task, disabledReason, onChange }: { task: TeamTask; disabledReason?: string; onChange: (d: string) => void }) => {
  const { t } = useT('portfolio');
  const org = useT('org');
  const [open, setOpen] = useState(false);
  const overdue = isTaskOverdue(task);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={!!disabledReason}
        title={disabledReason}
        aria-label={t('taskTable.deadlineAria', { name: task.name })}
        className={`${cellBtn} text-base font-medium`}
      >
        {task.deadline
          ? <span className={overdue ? 'text-red-500 font-semibold' : ''}>{formatDeadlineSmart(task.deadline)}</span>
          : <span className="text-xs text-[rgb(var(--color-text-muted))]">{org.t('projects.tasksTabNoDeadline')}</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className={DATE_PANEL_CLASS}>
        <DateCalendarPanel
          value={task.deadline}
          onSelect={(d) => {
            setOpen(false);
            if (d !== (task.deadline ?? '')) onChange(d);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

const TeamTasksTableRow = forwardRef<HTMLTableRowElement, TeamTasksTableRowProps>(({
  task, project, columns, memberById, currentUserId, categoryName, projectStatuses, unreadComments,
  selectMode, selected, handlers, index,
}, ref) => {
  const { t, tp } = useT('org');
  const pf = useT('portfolio');
  const color = project ? projectColor(project.color) : projectColor('blue');
  const overdue = isTaskOverdue(task);
  const editReason = handlers.editReason(task);
  const deleteReason = handlers.deleteReason(task);
  const show = (c: TaskColumnId) => columns.includes(c);
  const display = taskDisplayStatus(task);
  const custom = task.customStatusId ? projectStatuses.find((s) => s.id === task.customStatusId) : undefined;

  return (
    <tr
      ref={ref}
      data-index={index}
      className="transition-colors cursor-pointer hover:bg-[rgb(var(--color-hover))]"
      onClick={() => (selectMode ? handlers.toggleSelect(task) : handlers.open(task))}
      style={{ borderLeft: overdue ? '4px solid rgb(var(--color-error))' : '3px solid transparent' }}
    >
      <td className="px-2 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        {selectMode ? (
          <TaskSelectCheckbox name={task.name} checked={selected} onToggle={() => handlers.toggleSelect(task)} />
        ) : (
          <button
            type="button"
            onClick={() => handlers.toggleComplete(task)}
            // Droits : grisée ET expliquée, jamais refusée après coup.
            disabled={!!editReason}
            title={editReason}
            role="checkbox"
            aria-checked={task.completed}
            aria-label={task.completed ? t('projects.markIncomplete') : t('projects.markComplete')}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
              task.completed
                ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]'
                : 'border-[rgb(var(--color-border-strong))] hover:border-[rgb(var(--color-accent))]'
            }`}
          >
            {task.completed && (
              <svg className="w-3 h-3 text-[rgb(var(--color-accent-solid-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}
      </td>
      <td className="px-2 py-3">
        <div className="flex justify-center">
          <span className={`w-4 h-4 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
        </div>
      </td>
      <td className={`font-medium px-2 py-3 text-base ${task.completed ? 'line-through' : ''}`}
          style={{ color: task.completed ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-text-primary))' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate" title={task.name}>{task.name}</span>
          {/* Commentaires non lus (mig. 109). */}
          {unreadComments > 0 && (
            <span
              className="inline-flex items-center gap-1 shrink-0 rounded-full bg-red-500 text-white text-caption font-bold px-1.5 py-0.5"
              title={tp('common.unreadComments', unreadComments)}
            >
              <MessageSquare size={10} aria-hidden="true" />
              {unreadComments}
            </span>
          )}
          <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
            <HealthStateMenu
              health={task.health}
              done={task.completed}
              onSetHealth={(h) => handlers.setHealth(task, h)}
              onMarkDone={() => handlers.toggleComplete(task)}
              ariaLabel={pf.t('healthMenu.taskAria', { name: task.name })}
              disabledReason={editReason}
            />
          </span>
        </div>
      </td>
      {show('project') && (
        <td className="px-2 py-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-2 text-sm truncate" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {project?.name ?? '—'}
          </span>
        </td>
      )}
      {show('status') && (
        <td onClick={(e) => e.stopPropagation()} className="px-2 py-3 whitespace-nowrap">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!!editReason}
              title={editReason}
              className="inline-flex items-center gap-1.5 min-h-9 px-2.5 text-xs rounded-full font-semibold border transition-colors hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-secondary))' }}
              aria-label={t('projects.tasksTabStatusAria', { name: task.name })}
            >
              {custom ? (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: custom.color }} aria-hidden="true" />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${display.dot}`} aria-hidden="true" />
              )}
              <span className="truncate max-w-[90px]">{custom?.name ?? t(display.labelKey as Parameters<typeof t>[0])}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {projectStatuses.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => s.id !== task.customStatusId && handlers.setCustomStatus(task, s.id)}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  {s.name}
                </DropdownMenuItem>
              ))}
              {projectStatuses.length > 0 && <DropdownMenuSeparator />}
              {STATUS_ORDER.map((st) => (
                <DropdownMenuItem key={st} onClick={() => handlers.setStatus(task, st)}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_META[st].dot}`} aria-hidden="true" />
                  {t(STATUS_META[st].labelKey as Parameters<typeof t>[0])}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      )}
      {show('assignees') && (
        <td className="px-2 py-3 whitespace-nowrap">
          <AssigneesCell task={task} memberById={memberById} currentUserId={currentUserId} />
        </td>
      )}
      {show('priority') && (
        <td onClick={(e) => e.stopPropagation()} className="text-center px-1 py-3 whitespace-nowrap">
          {/* Priorité éditable dans la ligne (le lot le permettait, pas la ligne). */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!!editReason}
              title={editReason ?? priorityLabelOf(task.priority)}
              aria-label={pf.t('taskTable.priorityAria', { name: task.name })}
              className={`inline-flex justify-center items-center w-8 h-8 rounded-full task-priority-${task.priority} text-base font-bold disabled:cursor-not-allowed`}
            >
              {task.priority}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {[1, 2, 3, 4, 5].map((p) => (
                <DropdownMenuItem key={p} onClick={() => p !== task.priority && handlers.setPriority(task, p)}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_META[p].dot}`} aria-hidden="true" />
                  {priorityLabelOf(p)}
                  {p === task.priority && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      )}
      {show('start') && (
        <td className="px-2 py-3 whitespace-nowrap text-sm text-[rgb(var(--color-text-secondary))]">
          {task.startDate ? formatDeadlineSmart(task.startDate) : '—'}
        </td>
      )}
      {show('deadline') && (
        <td onClick={(e) => e.stopPropagation()} className="px-2 py-3 whitespace-nowrap">
          <DeadlineCell task={task} disabledReason={editReason} onChange={(d) => handlers.setDeadline(task, d)} />
        </td>
      )}
      {show('duration') && (
        <td className="text-center px-1 py-3 whitespace-nowrap text-base font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
          {formatDuration(task.estimatedTime ?? 0)}
        </td>
      )}
      {show('category') && (
        <td className="px-2 py-3 whitespace-nowrap text-sm text-[rgb(var(--color-text-secondary))] max-w-[160px] truncate" title={categoryName}>
          {categoryName ?? '—'}
        </td>
      )}
      <td onClick={(e) => e.stopPropagation()} className="px-2 py-3 whitespace-nowrap text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={t('projects.tasksTabActionsAria', { name: task.name })}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[rgb(var(--color-hover))]"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Grisé plutôt que masqué (audit du 2026-09-24). */}
            <DropdownMenuItem disabled={!!editReason} title={editReason} onClick={() => handlers.open(task)}>
              <Pencil aria-hidden="true" /> {t('projects.tasksTabEdit')}
            </DropdownMenuItem>
            {handlers.assign && (
              <DropdownMenuItem onClick={() => handlers.assign?.(task)}>
                <UserPlus aria-hidden="true" /> {t('projects.tasksTabAssignAction')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handlers.schedule(task)}>
              <CalendarPlus aria-hidden="true" /> {t('projects.tasksTabScheduleAction')}
            </DropdownMenuItem>
            {handlers.toggleList && handlers.lists && handlers.lists.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ListPlus aria-hidden="true" /> {t('teamLists.addToList')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                  {handlers.lists.map((list) => {
                    const inList = list.taskIds.includes(task.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={list.id}
                        checked={inList}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={() => handlers.toggleList?.(task, list.id, inList)}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: resolveListColor(list.color) }} aria-hidden="true" />
                        <span className="truncate">{list.name}</span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem
              variant="destructive"
              disabled={!!deleteReason}
              onClick={() => handlers.remove(task)}
              className="!text-red-500 focus:!text-red-500 flex-wrap"
            >
              <Trash2 className="!text-red-500" aria-hidden="true" /> {t('common.deleteAction')}
              {deleteReason && (
                <span className="basis-full text-caption font-normal text-[rgb(var(--color-text-muted))] max-w-56">{deleteReason}</span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
});
TeamTasksTableRow.displayName = 'TeamTasksTableRow';

export default memo(TeamTasksTableRow);
