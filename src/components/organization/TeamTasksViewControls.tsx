import { SlidersHorizontal,LayoutList, SquareKanban } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/i18n/useT';
import { TASK_COLUMNS, type TaskColumnId } from './team-tasks-table.helpers';

interface TeamTasksViewControlsProps {
  columns: readonly TaskColumnId[];
  onColumnsChange: (next: TaskColumnId[]) => void;
  /** Table ou Tableau (kanban). */
  view: 'table' | 'kanban';
  onViewChange: (view: 'table' | 'kanban') => void;
  /** Axe des colonnes du Tableau. */
  kanbanGroupBy: 'assignee' | 'status';
  onKanbanGroupByChange: (groupBy: 'assignee' | 'status') => void;
  /** Moitié à rendre : la vue (après les préréglages) ou les colonnes (au
   *  bout de la ligne), 2026-09-30. Absent : les deux. */
  part?: 'view' | 'columns';
}

const segBase = 'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';
const segOn = 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-sm';
const segOff = 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]';
const segGroup = 'inline-flex rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-0.5 gap-0.5';

const btn = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';

/** Colonnes et export du tableau des tâches (audit 2026-09-24). Le
 *  regroupement a fusionné avec le tri, il vit dans `TeamTasksToolbar`
 *  (2026-09-27) — un seul menu répond aux deux questions. */
const TeamTasksViewControls = ({
  columns, onColumnsChange, view, onViewChange, kanbanGroupBy, onKanbanGroupByChange, part,
}: TeamTasksViewControlsProps) => {
  const { t } = useT('portfolio');
  const org = useT('org');
  const columnLabel: Record<TaskColumnId, string> = {
    project: org.t('projects.tasksTabColProject'),
    status: org.t('projects.tasksTabColStatus'),
    assignees: t('taskTable.colAssignees'),
    priority: org.t('projects.tasksTabColPriority'),
    start: t('taskTable.colStart'),
    deadline: org.t('projects.tasksTabColDeadline'),
    duration: org.t('projects.tasksTabColDuration'),
    category: t('taskTable.colCategory'),
  };
  const toggle = (c: TaskColumnId) =>
    onColumnsChange(columns.includes(c) ? columns.filter((x) => x !== c) : [...columns, c]);

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {part !== 'columns' && (
      <div className={segGroup} role="group" aria-label={t('toolbar.viewLabel')}>
        <button type="button" onClick={() => onViewChange('table')} aria-pressed={view === 'table'} className={`${segBase} ${view === 'table' ? segOn : segOff}`}>
          <LayoutList size={13} aria-hidden="true" />
          {t('toolbar.viewList')}
        </button>
        <button type="button" onClick={() => onViewChange('kanban')} aria-pressed={view === 'kanban'} className={`${segBase} ${view === 'kanban' ? segOn : segOff}`}>
          <SquareKanban size={13} aria-hidden="true" />
          {t('toolbar.viewKanban')}
        </button>
      </div>
      )}

      {part === 'view' ? null : view === 'kanban' ? (
        <div className={segGroup} role="group" aria-label={t('toolbar.columnsLabel')}>
          <button type="button" onClick={() => onKanbanGroupByChange('status')} aria-pressed={kanbanGroupBy === 'status'} className={`${segBase} ${kanbanGroupBy === 'status' ? segOn : segOff}`}>
            {t('toolbar.groupByStatus')}
          </button>
          <button type="button" onClick={() => onKanbanGroupByChange('assignee')} aria-pressed={kanbanGroupBy === 'assignee'} className={`${segBase} ${kanbanGroupBy === 'assignee' ? segOn : segOff}`}>
            {t('toolbar.groupByAssignee')}
          </button>
        </div>
      ) : (
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('taskTable.columnsAria')} className={btn}>
          <SlidersHorizontal size={13} aria-hidden="true" />
          {t('taskTable.columns')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {TASK_COLUMNS.map((c) => (
            <DropdownMenuCheckboxItem
              key={c}
              checked={columns.includes(c)}
              onCheckedChange={() => toggle(c)}
              // La liste reste ouverte : on règle plusieurs colonnes d'un geste.
              onSelect={(e) => e.preventDefault()}
            >
              {columnLabel[c]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      )}
    </div>
  );
};

export default TeamTasksViewControls;
