import { SlidersHorizontal, Download, LayoutList } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/i18n/useT';
import { TASK_GROUP_BYS, type TaskGroupBy } from './task-filters';
import { TASK_COLUMNS, type TaskColumnId } from './team-tasks-table.helpers';

interface TeamTasksViewControlsProps {
  columns: readonly TaskColumnId[];
  onColumnsChange: (next: TaskColumnId[]) => void;
  group: TaskGroupBy;
  onGroupChange: (group: TaskGroupBy) => void;
  /** Absent = rien à exporter (liste vide). */
  onExport?: () => void;
}

const btn = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';

/** Colonnes, regroupement et export du tableau des tâches (audit 2026-09-24). */
const TeamTasksViewControls = ({ columns, onColumnsChange, group, onGroupChange, onExport }: TeamTasksViewControlsProps) => {
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
  const groupLabel: Record<TaskGroupBy, string> = {
    none: t('taskTable.groupNone'),
    project: t('taskTable.groupProject'),
    status: t('taskTable.groupStatus'),
    assignee: t('taskTable.groupAssignee'),
    priority: t('taskTable.groupPriority'),
  };
  const toggle = (c: TaskColumnId) =>
    onColumnsChange(columns.includes(c) ? columns.filter((x) => x !== c) : [...columns, c]);

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('taskTable.groupAria')} className={btn}>
          <LayoutList size={13} aria-hidden="true" />
          {group === 'none' ? t('taskTable.groupBy') : groupLabel[group]}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuRadioGroup value={group} onValueChange={(v) => onGroupChange(v as TaskGroupBy)}>
            {TASK_GROUP_BYS.map((g) => (
              <DropdownMenuRadioItem key={g} value={g}>{groupLabel[g]}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

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

      <button type="button" onClick={onExport} disabled={!onExport} aria-label={t('taskTable.exportAria')} className={btn}>
        <Download size={13} aria-hidden="true" />
        {t('taskTable.export')}
      </button>
    </div>
  );
};

export default TeamTasksViewControls;
