import { Suspense, useMemo, useState } from 'react';
import { format, isPast, isToday, parseISO, subDays } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { CheckCircle2, Circle, ListChecks, Plus } from 'lucide-react';
import {
  useTeamTasks, useTeamProjects, useCreateTeamTask, useUpdateTeamTask, useDeleteTeamTask, useRestoreTeamTask,
  type TeamTask, type TeamProject,
} from '@/modules/team-projects';
import { useOrgMembers, type OrgMember } from '@/modules/organizations';
import { showUndoToast } from '@/lib/undo-toast';
import TeamTaskModal from './TeamTaskModal';
import { projectColor } from './team-projects.helpers';
import TaskSelectCheckbox from './TaskSelectCheckbox';
import { useTeamTasksBulk } from './use-team-tasks-bulk';
import { TeamTasksBulkLayer } from './team-tasks-bulk.lazy';
import { useT } from '@/i18n/useT';

interface MemberBodyProps {
  orgId: string;
  member: OrgMember;
  /** Le viewer est-il un supérieur hiérarchique ? Autorise l'édition des tâches. */
  canEdit?: boolean;
}

/**
 * Tâches d'équipe d'un membre — partition ouvertes / terminées, et les
 * compteurs qu'en tire l'onglet Contribution.
 *
 * Un hook partagé plutôt qu'un composant parent qui passerait les données aux
 * deux corps : `MemberSheet` ne monte QU'UN onglet à la fois (item #18), donc
 * il n'y a pas de parent commun où poser le calcul. Le coût est nul — les deux
 * onglets lisent le même cache React Query.
 */
const useMemberTasks = (orgId: string, memberId: string) => {
  const { data: allTasks = [], isLoading } = useTeamTasks(orgId);
  const myTasks = useMemo(
    () => allTasks.filter((task) => task.assigneeIds.includes(memberId)),
    [allTasks, memberId],
  );
  const open = myTasks.filter((task) => !task.completed);
  const done = myTasks.filter((task) => task.completed);
  const overdue = open.filter(isOverdue);
  return {
    isLoading,
    allTasks,
    myTasks,
    open,
    done,
    overdue,
    completionRate: myTasks.length ? Math.round((done.length / myTasks.length) * 100) : 0,
  };
};

/**
 * CORPS de l'onglet « Tâches » — sans overlay ni en-tête (item #18).
 *
 * Il porte ses propres modales de création/édition : ce sont des surcouches
 * de l'onglet, pas du chrome de la fiche, et `MemberSheet` n'a pas à les
 * connaître.
 */
export const MemberTasksBody = ({ orgId, member, canEdit = false }: MemberBodyProps) => {
  const { t } = useT('org');
  const { isLoading, open, done } = useMemberTasks(orgId, member.userId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: orgMembers = [] } = useOrgMembers(orgId);
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);
  // « Annuler » = sortir de la corbeille (mig. 152), à l'identique. L'ancien
  // « Annuler » recréait une tâche neuve avec sept champs.
  const restoreTask = useRestoreTeamTask(orgId);
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archivedAt), [projects]);
  // Actions groupées : ce qui est affiché (ouvertes + 20 dernières terminées).
  const listed = useMemo(() => [...open, ...done.slice(0, 20)], [open, done]);
  const bulk = useTeamTasksBulk(orgId, listed);

  // Suppression avec « Annuler » : la tâche est recréée à l'identique (même pattern que TeamProjectsTab).
  const removeWithUndo = (task: TeamTask) =>
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        showUndoToast(t('insights.taskDeleted'), () =>
          restoreTask.mutate(task.id),
        );
      },
    });

  if (isLoading) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">{t('insights.loading')}</p>;
  }

  return (
    <>
      <TasksView
        open={open}
        done={done}
        projects={projects}
        canEdit={canEdit}
        onAddTask={() => setCreatingTask(true)}
        onEditTask={setEditingTask}
        selection={canEdit ? {
          active: bulk.selectMode,
          selectedIds: bulk.selectedIds,
          onToggle: bulk.toggleSelect,
          onStart: () => bulk.setSelectMode(true),
        } : undefined}
      />
      {bulk.selectMode && (
        <Suspense fallback={null}>
          <TeamTasksBulkLayer bulk={bulk} members={orgMembers} projects={projects} placement="inline" />
        </Suspense>
      )}
      {creatingTask && (
        <TeamTaskModal
          isCreating
          projects={activeProjects.length > 0 ? activeProjects : projects}
          members={orgMembers}
          defaultProjectId={(activeProjects[0] ?? projects[0])?.id}
          defaultAssigneeIds={[member.userId]}
          onCreate={(input) => createTask.mutateAsync(input)}
          onClose={() => setCreatingTask(false)}
        />
      )}
      {editingTask && (
        <TeamTaskModal
          task={editingTask}
          projects={activeProjects.length > 0 ? activeProjects : projects}
          members={orgMembers}
          onUpdate={(taskId, input) => updateTask.mutateAsync({ taskId, input })}
          onDelete={removeWithUndo}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  );
};

/** CORPS de l'onglet « Contribution » — sans overlay ni en-tête (item #18). */
export const MemberContributionBody = ({ orgId, member }: MemberBodyProps) => {
  const { t } = useT('org');
  const { isLoading, allTasks, myTasks, open, done, overdue, completionRate } = useMemberTasks(orgId, member.userId);
  // Repère de comparaison : la complétion de toutes les tâches assignées de
  // l'entreprise, lue dans le même cache (aucune requête de plus).
  const orgRate = useMemo(() => {
    const assigned = allTasks.filter((task) => task.assigneeIds.length > 0);
    return assigned.length ? Math.round((assigned.filter((task) => task.completed).length / assigned.length) * 100) : 0;
  }, [allTasks]);

  if (isLoading) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">{t('insights.loading')}</p>;
  }

  return (
    <ContributionView
      total={myTasks.length}
      done={done.length}
      open={open.length}
      overdue={overdue.length}
      completionRate={completionRate}
      orgRate={orgRate}
      doneTasks={done}
    />
  );
};


const isOverdue = (t: TeamTask): boolean => {
  if (t.completed || !t.deadline) return false;
  const d = parseISO(t.deadline);
  return isPast(d) && !isToday(d);
};


const priorityLabel = (p: number) => `P${Math.min(5, Math.max(1, Math.round(p)))}`;

// La prop de tâche s'appelait `t` — elle masquait le traducteur `t` dès qu'on
// a voulu traduire « En retard ». Renommée `task`.
interface RowSelection {
  active: boolean;
  selectedIds: Set<string>;
  onToggle: (task: TeamTask) => void;
  onStart: () => void;
}

// Grand format (maquette B, 2026-09-28) : une ligne de tableau par tâche,
// projet, échéance et priorité en colonnes dès que la largeur le permet.
const ROW_GRID = 'grid grid-cols-[16px_minmax(0,1fr)_auto] sm:grid-cols-[16px_minmax(0,1fr)_150px_90px_32px] items-center gap-x-3';

const TaskRow = ({ task, project, canEdit, onEdit, selection }: { task: TeamTask; project?: TeamProject; canEdit: boolean; onEdit: (task: TeamTask) => void; selection?: RowSelection }) => {
  const { t } = useT('org');
  const overdue = !task.completed && isOverdue(task);
  if (selection?.active) {
    return (
      <li className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] cursor-pointer hover:bg-[rgb(var(--color-hover))]" onClick={() => selection.onToggle(task)}>
        <TaskSelectCheckbox name={task.name} checked={selection.selectedIds.has(task.id)} onToggle={() => selection.onToggle(task)} />
        <span className="text-sm flex-1 truncate text-[rgb(var(--color-text-primary))]">{task.name}</span>
      </li>
    );
  }
  const content = (
    <>
      {task.completed ? (
        <CheckCircle2 size={16} className="text-green-500 shrink-0" aria-hidden="true" />
      ) : (
        <Circle size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
      )}
      <span className={`text-sm truncate ${task.completed ? 'text-[rgb(var(--color-text-muted))] line-through' : 'text-[rgb(var(--color-text-primary))]'}`}>
        {task.name}
      </span>
      <span className="hidden sm:block min-w-0">
        {project && (
          <span className={`inline-block max-w-full truncate text-[11px] font-semibold px-2 py-0.5 rounded-full ${projectColor(project.color).soft}`}>
            {project.name}
          </span>
        )}
      </span>
      <span className={`hidden sm:block text-xs ${overdue ? 'text-red-500 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
        {task.deadline ? format(parseISO(task.deadline), 'd MMM', { locale: getDateLocale() }) : ''}
      </span>
      <span className="text-[10px] font-semibold text-[rgb(var(--color-text-muted))] text-right whitespace-nowrap">
        {overdue && <span className="sm:hidden text-red-500 mr-1">{t('insights.overdue')}</span>}
        {priorityLabel(task.priority)}
      </span>
    </>
  );
  if (!canEdit) {
    return (
      <li className={`${ROW_GRID} p-2.5 rounded-xl border border-[rgb(var(--color-border))]`}>
        {content}
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onEdit(task)}
        aria-label={t('projects.editTaskAria', { name: task.name })}
        className={`w-full ${ROW_GRID} p-2.5 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left`}
      >
        {content}
      </button>
    </li>
  );
};

const AddTaskButton = ({ onAddTask }: { onAddTask: () => void }) => {
  const { t } = useT('org');
  return (
    <button
      type="button"
      onClick={onAddTask}
      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-sm font-semibold text-[rgb(var(--color-text-secondary))]"
    >
      <Plus size={14} aria-hidden="true" /> {t('insights.addTask')}
    </button>
  );
};

type TaskFilter = 'open' | 'done' | 'overdue';

const TasksView = ({
  open, done, projects, canEdit, onAddTask, onEditTask, selection,
}: {
  open: TeamTask[]; done: TeamTask[]; projects: TeamProject[]; canEdit: boolean; onAddTask: () => void; onEditTask: (t: TeamTask) => void;
  selection?: RowSelection;
}) => {
  const { t } = useT('org');
  const [filter, setFilter] = useState<TaskFilter>('open');
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  if (open.length === 0 && done.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-2 text-center">{t('insights.noTeamTask')}</p>
        <AddTaskButton onAddTask={onAddTask} />
      </div>
    );
  }
  const overdue = open.filter(isOverdue);
  const rows = filter === 'open' ? open : filter === 'overdue' ? overdue : done.slice(0, 20);
  const chips: { id: TaskFilter; label: string }[] = [
    { id: 'open', label: t('insights.inProgress', { count: open.length }) },
    { id: 'done', label: t('insights.completed', { count: done.length }) },
    { id: 'overdue', label: t('popups.member.overdueCount', { count: overdue.length }) },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              filter === c.id
                ? 'border-transparent bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]'
                : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
            }`}
          >
            {c.label}
          </button>
        ))}
        <span className="flex-1" />
        {selection && !selection.active && (
          <button
            type="button"
            onClick={selection.onStart}
            aria-label={t('projects.selectMultiple')}
            className="shrink-0 inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-[rgb(var(--color-border))] text-sm font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
          >
            <ListChecks size={14} aria-hidden="true" /> {t('projects.selectMode')}
          </button>
        )}
      </div>
      <div className={`${ROW_GRID} hidden sm:grid px-2.5 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]`} aria-hidden="true">
        <span />
        <span>{t('popups.member.colTask')}</span>
        <span>{t('popups.member.colProject')}</span>
        <span>{t('popups.member.colDeadline')}</span>
        <span className="text-right">P</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-2 text-center">{t('insights.noOpenTask')}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((task) => (
            <TaskRow key={task.id} task={task} project={projectById.get(task.projectId)} canEdit={canEdit} onEdit={onEditTask} selection={selection} />
          ))}
        </ul>
      )}
      <AddTaskButton onAddTask={onAddTask} />
    </div>
  );
};

/** Fenêtre du calendrier d'activité de l'onglet Contribution. */
const HEATMAP_DAYS = 30;
const HEAT_TONES = ['bg-[rgb(var(--color-hover))]', 'bg-indigo-500/25', 'bg-indigo-500/50', 'bg-indigo-500/75', 'bg-indigo-500'];

// Grand format (maquette C, 2026-09-28) : calendrier des 30 derniers jours,
// puis trois indicateurs dont la complétion rapportée à l'entreprise.
const ContributionView = ({ total, done, open, overdue, completionRate, orgRate, doneTasks }: {
  total: number; done: number; open: number; overdue: number; completionRate: number; orgRate: number; doneTasks: TeamTask[];
}) => {
  const { t } = useT('org');
  const days = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of doneTasks) {
      if (task.completedAt) {
        const key = format(parseISO(task.completedAt), 'yyyy-MM-dd');
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const today = new Date();
    return Array.from({ length: HEATMAP_DAYS }, (_, i) => {
      const d = subDays(today, HEATMAP_DAYS - 1 - i);
      return { date: d, count: counts.get(format(d, 'yyyy-MM-dd')) ?? 0 };
    });
  }, [doneTasks]);
  const recent = days.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">{t('insights.noContribution')}</p>;
  }
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
          {t('popups.member.heatmap', { days: HEATMAP_DAYS })}
        </h3>
        <ol className="grid grid-cols-10 sm:grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
          {days.map(({ date, count }) => {
            const label = t('popups.member.heatmapDay', { date: format(date, 'd MMM', { locale: getDateLocale() }), count });
            return (
              <li
                key={date.toISOString()}
                title={label}
                aria-label={label}
                className={`aspect-square rounded-md ${HEAT_TONES[Math.min(count, HEAT_TONES.length - 1)]}`}
              />
            );
          })}
        </ol>
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4">
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('insights.completionRate')}</p>
          <p className="text-2xl font-bold text-emerald-500">{completionRate}%</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('popups.member.orgAverage', { value: `${orgRate}%` })}</p>
        </div>
        <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4">
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('popups.member.doneRecent', { days: HEATMAP_DAYS })}</p>
          <p className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">{recent}</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{done} / {total}</p>
        </div>
        <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4">
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('insights.inProgressShort')}</p>
          <p className="text-2xl font-bold text-indigo-500">{open}</p>
          <p className={`text-xs ${overdue > 0 ? 'text-red-500 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
            {t('popups.member.overdueCount', { count: overdue })}
          </p>
        </div>
      </div>
    </div>
  );
};
