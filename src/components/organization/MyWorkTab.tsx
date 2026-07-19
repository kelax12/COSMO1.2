import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ListTodo, AlertTriangle, CalendarDays, Check, Target, CircleCheck, ChevronRight,
} from 'lucide-react';
import {
  useTeamProjects,
  useTeamTasks,
  useUpdateTeamTask,
  type TeamTask,
  type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { useTeamOKRs } from '@/modules/team-okrs';
import type { OrgMember } from '@/modules/organizations';
import { projectColor, PRIORITY_META, sortOpenTasks } from './team-projects.helpers';
import WorkSummaryCard from './WorkSummaryCard';
import TeamTaskModal from './TeamTaskModal';

interface MyWorkTabProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
}

const isOverdue = (t: TeamTask): boolean => {
  if (t.completed || !t.deadline) return false;
  const d = parseISO(t.deadline);
  return isPast(d) && !isToday(d);
};

/** Bloc latéral « prochaine échéance » de la carte de synthèse Aperçu. */
const NextDeadline = ({ task }: { task: TeamTask | null }) => {
  if (!task || !task.deadline) {
    return (
      <div className="flex flex-col items-center text-[rgb(var(--color-text-muted))]">
        <CalendarDays size={22} aria-hidden="true" />
        <span className="text-xs mt-1.5">À jour</span>
      </div>
    );
  }
  const d = parseISO(task.deadline);
  const late = isOverdue(task);
  return (
    <div className="flex flex-col items-center max-w-[130px]">
      <div className={`flex flex-col items-center leading-none ${late ? 'text-red-500' : 'text-[rgb(var(--color-accent))]'}`}>
        <span className="text-xl font-bold">{format(d, 'd', { locale: fr })}</span>
        <span className="text-[10px] uppercase mt-0.5">{format(d, 'MMM', { locale: fr })}</span>
      </div>
      <span className="text-xs text-[rgb(var(--color-text-primary))] mt-2 text-center truncate max-w-full">{task.name}</span>
      <span className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5">Prochaine échéance</span>
    </div>
  );
};

/**
 * Onglet Aperçu (#7) — MON travail dans l'entreprise : mes tâches assignées
 * (cochables), mes échéances à venir et mes projets. Les statistiques
 * collectives ont déménagé dans l'onglet Statistiques (#13, managers/admin).
 */
/** Étape de la checklist de démarrage (reco #3, admins d'une org jeune). */
interface StartStep { id: string; label: string; done: boolean; tab: string; }

const StartChecklist = ({ steps }: { steps: StartStep[] }) => {
  const navigate = useNavigate();
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">Bien démarrer</h3>
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{doneCount}/{steps.length}</span>
      </div>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={s.done}
              onClick={() => navigate(`/entreprise?tab=${s.tab}`)}
              className={`w-full flex items-center gap-2.5 py-2 px-2 rounded-xl text-left transition-colors ${
                s.done ? 'opacity-60' : 'hover:bg-[rgb(var(--color-hover))]'
              }`}
            >
              <CircleCheck
                size={17}
                className={s.done ? 'text-emerald-500 shrink-0' : 'text-[rgb(var(--color-text-muted))] shrink-0'}
                aria-hidden="true"
              />
              <span className={`flex-1 text-sm ${s.done ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
                {s.label}
              </span>
              {!s.done && <ChevronRight size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const MyWorkTab = ({ orgId, members, currentUserId }: MyWorkTabProps) => {
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: tasks = [] } = useTeamTasks(orgId);
  const { data: okrs = [] } = useTeamOKRs(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

  const activeProjects = useMemo(() => projects.filter((p) => !p.archivedAt), [projects]);
  const activeProjectIds = useMemo(() => new Set(activeProjects.map((p) => p.id)), [activeProjects]);

  const mine = useMemo(
    () =>
      currentUserId
        ? tasks.filter((t) => t.assigneeIds.includes(currentUserId) && activeProjectIds.has(t.projectId))
        : [],
    [tasks, currentUserId, activeProjectIds],
  );
  const open = useMemo(() => sortOpenTasks(mine.filter((t) => !t.completed)), [mine]);
  const done = mine.filter((t) => t.completed);
  const overdue = open.filter(isOverdue);
  const completionRate = mine.length ? Math.round((done.length / mine.length) * 100) : 0;

  // Échéances à venir (mes tâches ouvertes datées, triées).
  const scheduled = useMemo(
    () => open.filter((t) => !!t.deadline).sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)),
    [open],
  );

  const nextDeadline = useMemo(
    () => scheduled.find((t) => !isOverdue(t)) ?? scheduled[0] ?? null,
    [scheduled],
  );

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Prochaines échéances de l'ENTREPRISE (reco #2, Option A) : deadlines des
  // tâches d'équipe ouvertes (tous assignés) + échéances des OKR, à venir,
  // triées, 6 max. Zéro modèle d'événement partagé nécessaire.
  const orgDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items: { id: string; date: Date; name: string; kind: 'task' | 'okr'; projectName?: string }[] = [];
    for (const t of tasks) {
      if (t.completed || !t.deadline || !activeProjectIds.has(t.projectId)) continue;
      const d = parseISO(t.deadline);
      if (Number.isNaN(d.getTime()) || d < today) continue;
      items.push({ id: `task-${t.id}`, date: d, name: t.name, kind: 'task', projectName: projectById.get(t.projectId)?.name });
    }
    for (const o of okrs) {
      if (!o.endDate) continue;
      const d = parseISO(o.endDate);
      if (Number.isNaN(d.getTime()) || d < today) continue;
      items.push({ id: `okr-${o.id}`, date: d, name: o.title, kind: 'okr' });
    }
    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6);
  }, [tasks, okrs, activeProjectIds, projectById]);

  // Checklist de démarrage (reco #3) — admins uniquement, masquée dès que
  // les 4 étapes sont faites.
  const isAdmin = members.find((m) => m.userId === currentUserId)?.role === 'admin';
  const startSteps = useMemo<StartStep[]>(() => [
    { id: 'project', label: 'Créer un premier projet', done: activeProjects.length > 0, tab: 'projects' },
    { id: 'invite', label: 'Inviter des membres', done: members.length > 1, tab: 'members' },
    { id: 'pyramid', label: 'Construire la pyramide hiérarchique', done: members.some((m) => !!m.managerId), tab: 'pyramid' },
    { id: 'okr', label: 'Définir un premier OKR', done: okrs.length > 0, tab: 'okr' },
  ], [activeProjects.length, members, okrs.length]);
  const showChecklist = isAdmin && startSteps.some((s) => !s.done);

  const toggleComplete = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: !task.completed } });
  const modalUpdate = (taskId: string, input: UpdateTeamTaskInput) =>
    updateTask.mutateAsync({ taskId, input });

  return (
    <div className="space-y-5">
      {showChecklist && <StartChecklist steps={startSteps} />}

      {/* Carte de synthèse « progress-first » */}
      <WorkSummaryCard
        title={`Mes ${mine.length} tâche${mine.length > 1 ? 's' : ''} assignée${mine.length > 1 ? 's' : ''}`}
        completed={done.length}
        inProgress={Math.max(0, open.length - overdue.length)}
        overdue={overdue.length}
        completionRate={completionRate}
        emptyLabel="Aucune tâche assignée."
        aside={<NextDeadline task={nextDeadline} />}
      />

      {mine.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <ListTodo size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Aucune tâche assignée</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 max-w-xs">
            Les tâches d'équipe qui vous seront attribuées (ou que vous vous attribuez
            depuis l'onglet Projets) apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          {/* Mes tâches */}
          <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
            <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
              Mes tâches ({open.length})
            </h3>
            {open.length === 0 ? (
              <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">Tout est terminé 🎉</p>
            ) : (
              <ul className="space-y-1">
                {open.map((t) => {
                  const project = projectById.get(t.projectId);
                  const pColor = project ? projectColor(project.color) : null;
                  const late = isOverdue(t);
                  const priority = PRIORITY_META[t.priority] ?? PRIORITY_META[3];
                  return (
                    <li key={t.id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors">
                      <button
                        type="button"
                        onClick={() => toggleComplete(t)}
                        aria-label={`Marquer « ${t.name} » comme terminée`}
                        className="w-5 h-5 rounded-md border border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))] flex items-center justify-center shrink-0 transition-colors"
                      >
                        {t.completed && <Check size={13} aria-hidden="true" />}
                      </button>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} title={priority.label} aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => setEditingTask(t)}
                        className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 rounded-md"
                      >
                        <span className="block text-sm text-[rgb(var(--color-text-primary))] truncate">{t.name}</span>
                      </button>
                      {project && pColor && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 truncate max-w-[110px] ${pColor.soft}`}>
                          {project.name}
                        </span>
                      )}
                      {t.deadline && (
                        <span className={`text-[10px] shrink-0 ${late ? 'text-red-500 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
                          {format(parseISO(t.deadline), 'd MMM', { locale: fr })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Mes échéances (agenda entreprise) */}
          <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
            <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
              Mes échéances ({scheduled.length})
            </h3>
            {scheduled.length === 0 ? (
              <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">Aucune échéance datée.</p>
            ) : (
              <ul className="space-y-1.5">
                {scheduled.map((t) => {
                  const late = isOverdue(t);
                  const d = parseISO(t.deadline!);
                  const today = isToday(d);
                  return (
                    <li
                      key={t.id}
                      className={`flex items-center gap-3 p-2 rounded-xl border ${
                        late ? 'border-red-300/60 bg-red-50/40 dark:bg-red-900/10' : 'border-[rgb(var(--color-border))]'
                      }`}
                    >
                      <div className={`flex flex-col items-center justify-center w-10 shrink-0 ${late ? 'text-red-500' : today ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-secondary))]'}`}>
                        <span className="text-sm font-bold leading-none">{format(d, 'd', { locale: fr })}</span>
                        <span className="text-[10px] uppercase">{format(d, 'MMM', { locale: fr })}</span>
                      </div>
                      <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{t.name}</span>
                      {late && <AlertTriangle size={14} className="text-red-500 shrink-0" aria-hidden="true" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Prochaines échéances de l'entreprise (reco #2) — visibles par tous,
          même sans tâche assignée. */}
      {orgDeadlines.length > 0 && (
        <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
          <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
            Prochaines échéances de l'entreprise
          </h3>
          <ul className="space-y-1.5">
            {orgDeadlines.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-2 rounded-xl border border-[rgb(var(--color-border))]">
                <div className="flex flex-col items-center justify-center w-10 shrink-0 text-[rgb(var(--color-text-secondary))]">
                  <span className="text-sm font-bold leading-none">{format(item.date, 'd', { locale: fr })}</span>
                  <span className="text-[10px] uppercase">{format(item.date, 'MMM', { locale: fr })}</span>
                </div>
                <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{item.name}</span>
                {item.kind === 'okr' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]">
                    <Target size={10} aria-hidden="true" /> OKR
                  </span>
                ) : item.projectName ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 truncate max-w-[110px] bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]">
                    {item.projectName}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {editingTask && (
        <TeamTaskModal
          task={editingTask}
          projects={activeProjects}
          members={members}
          onUpdate={modalUpdate}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
};

export default MyWorkTab;
