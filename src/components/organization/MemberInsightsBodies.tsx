import { Suspense, useMemo, useState } from 'react';
import { isPast, isToday, parseISO } from 'date-fns';
import { CheckCircle2, Circle, ListChecks, Plus } from 'lucide-react';
import {
  useTeamTasks, useTeamProjects, useCreateTeamTask, useUpdateTeamTask, useDeleteTeamTask, useRestoreTeamTask,
  type TeamTask,
} from '@/modules/team-projects';
import { useOrgMembers, type OrgMember } from '@/modules/organizations';
import { showUndoToast } from '@/lib/undo-toast';
import TeamTaskModal from './TeamTaskModal';
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
  const { isLoading, myTasks, open, done, overdue, completionRate } = useMemberTasks(orgId, member.userId);

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

const TaskRow = ({ task, canEdit, onEdit, selection }: { task: TeamTask; canEdit: boolean; onEdit: (task: TeamTask) => void; selection?: RowSelection }) => {
  const { t } = useT('org');
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
      <span className={`text-sm flex-1 truncate ${task.completed ? 'text-[rgb(var(--color-text-muted))] line-through' : 'text-[rgb(var(--color-text-primary))]'}`}>
        {task.name}
      </span>
      {!task.completed && isOverdue(task) && (
        <span className="text-[10px] font-semibold text-red-500 shrink-0">{t('insights.overdue')}</span>
      )}
      <span className="text-[10px] font-semibold text-[rgb(var(--color-text-muted))] shrink-0">
        {priorityLabel(task.priority)}
      </span>
    </>
  );
  if (!canEdit) {
    return (
      <li className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))]">
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
        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
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

const TasksView = ({
  open, done, canEdit, onAddTask, onEditTask, selection,
}: {
  open: TeamTask[]; done: TeamTask[]; canEdit: boolean; onAddTask: () => void; onEditTask: (t: TeamTask) => void;
  selection?: RowSelection;
}) => {
  const { t } = useT('org');
  if (open.length === 0 && done.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-2 text-center">{t('insights.noTeamTask')}</p>
        <AddTaskButton onAddTask={onAddTask} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-1"><AddTaskButton onAddTask={onAddTask} /></div>
        {selection && !selection.active && (
          <button
            type="button"
            onClick={selection.onStart}
            aria-label={t('projects.selectMultiple')}
            className="shrink-0 inline-flex items-center gap-1.5 py-2 px-3 rounded-xl border border-[rgb(var(--color-border))] text-sm font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
          >
            <ListChecks size={14} aria-hidden="true" /> {t('projects.selectMode')}
          </button>
        )}
      </div>
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
          {t('insights.inProgress', { count: open.length })}
        </h3>
        {open.length === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('insights.noOpenTask')}</p>
        ) : (
          <ul className="space-y-1.5">
            {open.map((t) => <TaskRow key={t.id} task={t} canEdit={canEdit} onEdit={onEditTask} selection={selection} />)}
          </ul>
        )}
      </section>
      {done.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
            {t('insights.completed', { count: done.length })}
          </h3>
          <ul className="space-y-1.5">
            {done.slice(0, 20).map((t) => <TaskRow key={t.id} task={t} canEdit={canEdit} onEdit={onEditTask} selection={selection} />)}
          </ul>
        </section>
      )}
    </div>
  );
};

const StatBlock = ({ value, label, tone }: { value: string; label: string; tone: string }) => (
  <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4 text-center">
    <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{label}</p>
  </div>
);

const ContributionView = ({ total, done, open, overdue, completionRate }: {
  total: number; done: number; open: number; overdue: number; completionRate: number;
}) => {
  const { t } = useT('org');
  if (total === 0) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">{t('insights.noContribution')}</p>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatBlock value={`${completionRate}%`} label={t('insights.completionRate')} tone="text-emerald-500" />
        <StatBlock value={String(done)} label={t('insights.tasksDone')} tone="text-[rgb(var(--color-text-primary))]" />
        <StatBlock value={String(open)} label={t('insights.inProgressShort')} tone="text-indigo-500" />
        <StatBlock value={String(overdue)} label={t('insights.overdueShort')} tone={overdue > 0 ? 'text-red-500' : 'text-[rgb(var(--color-text-primary))]'} />
      </div>
      {/* Barre de progression complétées / total */}
      <div>
        <div className="flex items-center justify-between text-xs text-[rgb(var(--color-text-muted))] mb-1.5">
          <span>{t('insights.progress')}</span>
          <span>{done} / {total}</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[rgb(var(--color-hover))] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionRate}%` }} />
        </div>
      </div>
    </div>
  );
};
