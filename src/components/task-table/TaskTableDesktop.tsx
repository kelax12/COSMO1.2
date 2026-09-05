// ═══════════════════════════════════════════════════════════════════
// Le TABLEAU des tâches (desktop)
//
// FRONTIÈRE : ce composant reçoit des lignes déjà calculées et un jeu de
// rappels. Il ne sait pas d'où viennent les lignes, ne déclenche aucune
// mutation, n'ouvre aucune modale — il rend un `<table>`, et rien d'autre.
//
// Les props de ligne sont DÉRIVÉES de `TaskRow` (`ComponentProps`) plutôt que
// recopiées : une prop ajoutée à une ligne n'a pas à être redéclarée ici, et
// surtout ne peut pas y être oubliée en silence.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { TaskRow, type UnifiedTaskRow } from './list';
import { TeamTaskRowLite } from './TeamTaskRowLite';
import type { TeamTask } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

type TaskRowProps = React.ComponentProps<typeof TaskRow>;

interface TaskTableDesktopProps extends Omit<TaskRowProps, 'task'> {
  rows: UnifiedTaskRow[];
  sortField?: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  onToggleTeamComplete: (task: TeamTask) => void;
  onEditTeamTask: (task: TeamTask) => void;
}

const TaskTableDesktop = ({
  rows,
  sortField,
  sortDirection,
  onSort,
  onToggleTeamComplete,
  onEditTeamTask,
  ...rowProps
}: TaskTableDesktopProps) => {
  const { t } = useT('tasks');
  const arrow = (field: string) =>
    sortField === field ? <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span> : null;

  return (
    <div className="hidden md:block table-container shadow-sm overflow-x-auto">
      <table className="data-table w-full" style={{ minWidth: '1000px' }}>
        <thead>
          <tr className="">
            {/* A11y: empty <th> need a label for screen readers. */}
            <th className="px-2 py-3" style={{ width: '40px' }}><span className="sr-only">{t('table.colComplete')}</span></th>
            <th className="px-2 py-3" style={{ width: '48px' }}><span className="sr-only">{t('table.colCategoryColor')}</span></th>
            <th className="cursor-pointer px-2 py-3" onClick={() => onSort('name')}>
              {t('table.colName')}
              {arrow('name')}
            </th>
            <th className="px-2 py-3" style={{ width: '150px' }}>{t('table.colCategory')}</th>
            <th
              className="cursor-pointer text-center px-1 py-3"
              onClick={() => onSort('priority')}
              style={{ width: '70px' }}
            >
              {t('table.colPriority')}
              {arrow('priority')}
            </th>
            <th
              className="cursor-pointer px-2 py-3"
              onClick={() => onSort('deadline')}
              style={{ width: '100px' }}
            >
              {rowProps.activeQuickFilter === 'completed' ? t('table.colValidationDate') : t('table.colDeadline')}
              {arrow('deadline')}
            </th>
            <th
              className="cursor-pointer text-center px-1 py-3"
              onClick={() => onSort('estimatedTime')}
              style={{ width: '70px' }}
            >
              {t('table.colDuration')}
              {arrow('estimatedTime')}
            </th>
            <th className="text-center px-1 py-3" style={{ width: '70px' }}>{t('table.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => row.kind === 'perso' ? (
            <TaskRow key={row.id} task={row.task} {...rowProps} />
          ) : (
            <TeamTaskRowLite
              key={row.id}
              task={row.task}
              project={row.project}
              onToggleComplete={onToggleTeamComplete}
              onEdit={onEditTeamTask}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TaskTableDesktop;
