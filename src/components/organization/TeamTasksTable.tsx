// ═══════════════════════════════════════════════════════════════════
// Tableau des tâches d'équipe, VIRTUALISÉ (audit 2026-09-24, M1 point 5)
//
// Jusqu'ici le tableau peignait cent lignes puis « Afficher la suite » : à
// mille tâches, chaque tranche ajoutait neuf cellules et deux menus par ligne,
// et l'écran finissait par peindre tout l'ensemble. Seules les lignes proches
// de la fenêtre sont désormais montées (`useWindowVirtualizer` : les pages
// COSMO défilent au niveau du document, comme la liste mobile de /tasks).
//
// Le tableau reste un `<table>` : des lignes d'espacement en haut et en bas
// tiennent la hauteur, et chaque ligne rendue est mesurée (hauteurs variables).
// ═══════════════════════════════════════════════════════════════════

import { useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject } from '@/modules/team-projects';
import type { ProjectStatus } from '@/modules/org-config';
import { useT } from '@/i18n/useT';
import TeamTasksTableRow, { type TeamTasksRowHandlers } from './TeamTasksTableRow';
import type { TaskColumnId, TaskTableLine } from './team-tasks-table.helpers';

interface TeamTasksTableProps {
  lines: TaskTableLine[];
  columns: readonly TaskColumnId[];
  projectById: Map<string, TeamProject>;
  memberById: Map<string, OrgMember>;
  categoryNameOf: (id: string) => string | undefined;
  /** Statuts propres par projet (mig. 197). */
  statusesByProject: Map<string, ProjectStatus[]>;
  currentUserId?: string;
  unreadCommentsByTask: Map<string, number>;
  selectMode: boolean;
  selectedIds: ReadonlySet<string>;
  handlers: TeamTasksRowHandlers;
  /** Libellé d'un en-tête de groupe, et sa bascule repliée / dépliée. */
  groupLabel: (key: string) => { label: string; dot?: string };
  onToggleGroup: (key: string) => void;
  sortIndicator: (field: 'name' | 'priority' | 'deadline' | 'estimatedTime') => string;
  onSort: (field: 'name' | 'priority' | 'deadline' | 'estimatedTime') => void;
}

const ESTIMATED_ROW = 58;
const NO_STATUSES: ProjectStatus[] = [];

const TeamTasksTable = ({
  lines, columns, projectById, memberById, categoryNameOf, statusesByProject, currentUserId, unreadCommentsByTask,
  selectMode, selectedIds, handlers, groupLabel, onToggleGroup, sortIndicator, onSort,
}: TeamTasksTableProps) => {
  const { t } = useT('org');
  const pf = useT('portfolio');
  const tableRef = useRef<HTMLDivElement>(null);
  // Position du tableau dans le document : le virtualiseur compte depuis le
  // haut de la PAGE. Relue après chaque rendu qui peut la déplacer (filtres,
  // bandeaux), sans quoi les lignes montées décalent de la fenêtre.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    if (Math.abs(top - scrollMargin) > 1) setScrollMargin(top);
  }, [lines.length, columns.length, scrollMargin]);

  const virtualizer = useWindowVirtualizer({
    count: lines.length,
    estimateSize: (i) => (lines[i]?.kind === 'group' ? 40 : ESTIMATED_ROW),
    overscan: 8,
    scrollMargin,
    getItemKey: (i) => lines[i]?.key ?? i,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start - scrollMargin : 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - (items[items.length - 1].end - scrollMargin) : 0;
  const show = (c: TaskColumnId) => columns.includes(c);
  const colCount = 4 + columns.length;

  const th = 'px-2 py-3';
  const sortable = (field: 'name' | 'priority' | 'deadline' | 'estimatedTime', label: string, className: string, width?: string) => (
    <th className={`cursor-pointer ${className}`} style={width ? { width } : undefined} onClick={() => onSort(field)}
      aria-sort={sortIndicator(field) ? (sortIndicator(field).includes('↑') ? 'ascending' : 'descending') : undefined}>
      {label}{sortIndicator(field)}
    </th>
  );

  return (
    <div ref={tableRef} className="table-container shadow-sm overflow-x-auto">
      <table className="data-table w-full" style={{ minWidth: `${560 + columns.length * 110}px` }} aria-label={pf.t('taskTable.tableAria')} aria-rowcount={lines.length}>
        <thead>
          <tr>
            <th className={th} style={{ width: '40px' }}><span className="sr-only">{t('projects.tasksTabColComplete')}</span></th>
            <th className={th} style={{ width: '48px' }}><span className="sr-only">{t('projects.tasksTabColProjectColor')}</span></th>
            {sortable('name', t('projects.tasksTabColName'), th)}
            {show('project') && <th className={th} style={{ width: '160px' }}>{t('projects.tasksTabColProject')}</th>}
            {show('status') && <th className={th} style={{ width: '140px' }}>{t('projects.tasksTabColStatus')}</th>}
            {show('assignees') && <th className={th} style={{ width: '150px' }}>{pf.t('taskTable.colAssignees')}</th>}
            {show('priority') && sortable('priority', t('projects.tasksTabColPriority'), 'text-center px-1 py-3', '80px')}
            {show('start') && <th className={th} style={{ width: '110px' }}>{pf.t('taskTable.colStart')}</th>}
            {show('deadline') && sortable('deadline', t('projects.tasksTabColDeadline'), th, '130px')}
            {show('duration') && sortable('estimatedTime', t('projects.tasksTabColDuration'), 'text-center px-1 py-3', '80px')}
            {show('category') && <th className={th} style={{ width: '160px' }}>{pf.t('taskTable.colCategory')}</th>}
            <th className="text-center px-1 py-3" style={{ width: '70px' }}>{t('projects.tasksTabColActions')}</th>
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && <tr aria-hidden="true"><td colSpan={colCount} style={{ height: padTop, padding: 0 }} /></tr>}
          {items.map((item) => {
            const line = lines[item.index];
            if (!line) return null;
            if (line.kind === 'group') {
              const { label, dot } = groupLabel(line.key);
              return (
                <tr key={line.key} ref={virtualizer.measureElement} data-index={item.index} className="bg-[rgb(var(--color-hover)/0.5)]">
                  <td colSpan={colCount} className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onToggleGroup(line.key)}
                      aria-expanded={!line.collapsed}
                      aria-label={pf.t('taskTable.groupToggle', { name: label })}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[rgb(var(--color-text-primary))] rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                    >
                      {line.collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                      {dot && <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden="true" />}
                      {label}
                      <span className="tabular-nums text-xs font-medium text-[rgb(var(--color-text-muted))]">{line.count}</span>
                    </button>
                  </td>
                </tr>
              );
            }
            const { task } = line;
            return (
              <TeamTasksTableRow
                key={line.key}
                ref={virtualizer.measureElement}
                index={item.index}
                task={task}
                project={projectById.get(task.projectId)}
                columns={columns}
                memberById={memberById}
                currentUserId={currentUserId}
                categoryName={task.categoryId ? categoryNameOf(task.categoryId) : undefined}
                projectStatuses={statusesByProject.get(task.projectId) ?? NO_STATUSES}
                unreadComments={unreadCommentsByTask.get(task.id) ?? 0}
                selectMode={selectMode}
                selected={selectedIds.has(task.id)}
                handlers={handlers}
              />
            );
          })}
          {padBottom > 0 && <tr aria-hidden="true"><td colSpan={colCount} style={{ height: padBottom, padding: 0 }} /></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default TeamTasksTable;
