import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isPast, isToday, parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  X,
  ListTodo,
  TrendingUp,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import {
  useTeamTasks, useTeamProjects, useCreateTeamTask, useUpdateTeamTask, useDeleteTeamTask,
  type TeamTask,
} from '@/modules/team-projects';
import { useOrgMembers, type OrgMember } from '@/modules/organizations';
import { showUndoToast } from '@/lib/undo-toast';
import MemberAvatar from './MemberAvatar';
import TeamTaskModal from './TeamTaskModal';

export type InsightsTab = 'tasks' | 'agenda' | 'contribution';

interface MemberInsightsSheetProps {
  orgId: string;
  member: OrgMember;
  initialTab: InsightsTab;
  /** Le viewer est-il un supérieur hiérarchique (admin ou manager du sous-arbre) ? Autorise l'édition des tâches. */
  canEdit?: boolean;
  onClose: () => void;
}

// L'agenda complet d'un membre a son propre écran plein page (MemberAgendaSheet,
// éditable) — ici on ne garde que tâches + contribution.
const TABS: { id: InsightsTab; label: string; Icon: typeof ListTodo }[] = [
  { id: 'tasks', label: 'Tâches', Icon: ListTodo },
  { id: 'contribution', label: 'Contribution', Icon: TrendingUp },
];

const isOverdue = (t: TeamTask): boolean => {
  if (t.completed || !t.deadline) return false;
  const d = parseISO(t.deadline);
  return isPast(d) && !isToday(d);
};

/**
 * Infos d'un subordonné dans le contexte entreprise (menu ⋯ de la pyramide,
 * réservé aux supérieurs hiérarchiques). Onglets :
 *  - Tâches : les tâches d'équipe assignées au membre.
 *  - Agenda : ses échéances de tâches d'équipe (le calendrier personnel n'est
 *    pas partagé entre membres — hors périmètre RLS actuel).
 *  - Contribution : synthèse de son activité (complétées, taux, retards).
 */
const MemberInsightsSheet = ({ orgId, member, initialTab, canEdit = false, onClose }: MemberInsightsSheetProps) => {
  // 'agenda' a désormais son propre écran plein page — on retombe sur 'tasks'.
  const [tab, setTab] = useState<InsightsTab>(initialTab === 'agenda' ? 'tasks' : initialTab);
  const { data: allTasks = [], isLoading } = useTeamTasks(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: orgMembers = [] } = useOrgMembers(orgId);
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archivedAt), [projects]);

  // Suppression avec « Annuler » : la tâche est recréée à l'identique (même pattern que TeamProjectsTab).
  const removeWithUndo = (task: TeamTask) =>
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        showUndoToast('Tâche supprimée', () =>
          createTask.mutate({
            projectId: task.projectId,
            name: task.name,
            description: task.description,
            priority: task.priority,
            deadline: task.deadline,
            estimatedTime: task.estimatedTime,
            assigneeIds: task.assigneeIds,
          }),
        );
      },
    });

  const myTasks = useMemo(
    () => allTasks.filter((t) => t.assigneeIds.includes(member.userId)),
    [allTasks, member.userId],
  );

  const open = myTasks.filter((t) => !t.completed);
  const done = myTasks.filter((t) => t.completed);
  const overdue = open.filter(isOverdue);
  const completionRate = myTasks.length ? Math.round((done.length / myTasks.length) * 100) : 0;

  // Agenda : échéances à venir/passées des tâches ouvertes, triées par date.
  const scheduled = useMemo(
    () =>
      open
        .filter((t) => !!t.deadline)
        .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)),
    [open],
  );

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={onClose}
        >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Infos de ${member.displayName}`}
      >
        {/* En-tête */}
        <div className="flex items-center gap-3 p-5 pb-3 border-b border-[rgb(var(--color-border))]">
          <MemberAvatar avatar={member.avatar} name={member.displayName} size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate">
              {member.displayName}
            </h2>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">Activité dans l'entreprise</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 px-3 pt-2 border-b border-[rgb(var(--color-border))]">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === id
                  ? 'border-indigo-500 text-[rgb(var(--color-text-primary))]'
                  : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
              }`}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="overflow-y-auto p-5">
          {isLoading ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">Chargement…</p>
          ) : tab === 'tasks' ? (
            <TasksView
              open={open}
              done={done}
              canEdit={canEdit}
              onAddTask={() => setCreatingTask(true)}
              onEditTask={setEditingTask}
            />
          ) : tab === 'agenda' ? (
            <AgendaView scheduled={scheduled} />
          ) : (
            <ContributionView
              total={myTasks.length}
              done={done.length}
              open={open.length}
              overdue={overdue.length}
              completionRate={completionRate}
            />
          )}
        </div>
        </div>
        </div>,
        document.body,
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

const priorityLabel = (p: number) => `P${Math.min(5, Math.max(1, Math.round(p)))}`;

const TaskRow = ({ t, canEdit, onEdit }: { t: TeamTask; canEdit: boolean; onEdit: (t: TeamTask) => void }) => {
  const content = (
    <>
      {t.completed ? (
        <CheckCircle2 size={16} className="text-green-500 shrink-0" aria-hidden="true" />
      ) : (
        <Circle size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
      )}
      <span className={`text-sm flex-1 truncate ${t.completed ? 'text-[rgb(var(--color-text-muted))] line-through' : 'text-[rgb(var(--color-text-primary))]'}`}>
        {t.name}
      </span>
      {!t.completed && isOverdue(t) && (
        <span className="text-[10px] font-semibold text-red-500 shrink-0">En retard</span>
      )}
      <span className="text-[10px] font-semibold text-[rgb(var(--color-text-muted))] shrink-0">
        {priorityLabel(t.priority)}
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
        onClick={() => onEdit(t)}
        aria-label={`Modifier la tâche ${t.name}`}
        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
      >
        {content}
      </button>
    </li>
  );
};

const AddTaskButton = ({ onAddTask }: { onAddTask: () => void }) => (
  <button
    type="button"
    onClick={onAddTask}
    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-sm font-semibold text-[rgb(var(--color-text-secondary))]"
  >
    <Plus size={14} aria-hidden="true" /> Ajouter une tâche
  </button>
);

const TasksView = ({
  open, done, canEdit, onAddTask, onEditTask,
}: {
  open: TeamTask[]; done: TeamTask[]; canEdit: boolean; onAddTask: () => void; onEditTask: (t: TeamTask) => void;
}) => {
  if (open.length === 0 && done.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-2 text-center">Aucune tâche d'équipe assignée.</p>
        <AddTaskButton onAddTask={onAddTask} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <AddTaskButton onAddTask={onAddTask} />
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
          En cours ({open.length})
        </h3>
        {open.length === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">Aucune tâche en cours.</p>
        ) : (
          <ul className="space-y-1.5">
            {open.map((t) => <TaskRow key={t.id} t={t} canEdit={canEdit} onEdit={onEditTask} />)}
          </ul>
        )}
      </section>
      {done.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
            Terminées ({done.length})
          </h3>
          <ul className="space-y-1.5">
            {done.slice(0, 20).map((t) => <TaskRow key={t.id} t={t} canEdit={canEdit} onEdit={onEditTask} />)}
          </ul>
        </section>
      )}
    </div>
  );
};

const AgendaView = ({ scheduled }: { scheduled: TeamTask[] }) => {
  if (scheduled.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-[rgb(var(--color-text-muted))]">Aucune échéance à venir.</p>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-2">
          Seules les échéances des tâches d'équipe sont visibles (le calendrier personnel reste privé).
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {scheduled.map((t) => {
        const late = isOverdue(t);
        const d = parseISO(t.deadline!);
        const today = isToday(d);
        return (
          <li
            key={t.id}
            className={`flex items-center gap-3 p-2.5 rounded-xl border ${
              late ? 'border-red-300/60 bg-red-50/40 dark:bg-red-900/10' : 'border-[rgb(var(--color-border))]'
            }`}
          >
            <div className={`flex flex-col items-center justify-center w-11 shrink-0 ${late ? 'text-red-500' : today ? 'text-indigo-500' : 'text-[rgb(var(--color-text-secondary))]'}`}>
              <span className="text-sm font-bold leading-none">{format(d, 'd', { locale: fr })}</span>
              <span className="text-[10px] uppercase">{format(d, 'MMM', { locale: fr })}</span>
            </div>
            <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{t.name}</span>
            {late && <AlertTriangle size={14} className="text-red-500 shrink-0" aria-hidden="true" />}
          </li>
        );
      })}
    </ul>
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
  if (total === 0) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">Aucune contribution à afficher.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatBlock value={`${completionRate}%`} label="Taux de complétion" tone="text-emerald-500" />
        <StatBlock value={String(done)} label="Tâches terminées" tone="text-[rgb(var(--color-text-primary))]" />
        <StatBlock value={String(open)} label="En cours" tone="text-indigo-500" />
        <StatBlock value={String(overdue)} label="En retard" tone={overdue > 0 ? 'text-red-500' : 'text-[rgb(var(--color-text-primary))]'} />
      </div>
      {/* Barre de progression complétées / total */}
      <div>
        <div className="flex items-center justify-between text-xs text-[rgb(var(--color-text-muted))] mb-1.5">
          <span>Progression</span>
          <span>{done} / {total}</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[rgb(var(--color-hover))] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionRate}%` }} />
        </div>
      </div>
    </div>
  );
};

export default MemberInsightsSheet;
