import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CalendarClock, UsersRound, Building2, ArrowUpRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/modules/auth/AuthContext';
import { useActiveOrganization, useOrgMembers } from '@/modules/organizations';
import {
  useTeamProjects,
  useTeamTasks,
  useUpdateTeamTask,
  type TeamTask,
  type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import {
  projectColor, PRIORITY_META, isTaskOverdue, sortOpenTasks,
} from '@/components/organization/team-projects.helpers';
import TeamTaskModal from '@/components/organization/TeamTaskModal';

/**
 * Page To-Do : « Mes tâches d'équipe » — les tâches d'entreprise qui me sont
 * assignées, regroupées sous une catégorie AUTO créée par projet. Ces
 * catégories se démarquent des catégories personnelles : bordure en
 * pointillés, icône équipe, badge « Équipe » et pastille couleur du projet.
 * Aucune donnée dupliquée : lecture directe du module team-projects.
 */
const TeamAssignedSection = () => {
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;

  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: allTasks = [] } = useTeamTasks(orgId);
  const { data: members = [] } = useOrgMembers(orgId);
  const updateTask = useUpdateTeamTask(orgId ?? '');

  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

  // Mes tâches ouvertes, regroupées par projet actif (catégorie auto).
  const groups = useMemo(() => {
    if (!user) return [];
    const mine = allTasks.filter((t) => !t.completed && t.assigneeIds.includes(user.id));
    const byProject = new Map<string, TeamTask[]>();
    for (const t of mine) {
      byProject.set(t.projectId, [...(byProject.get(t.projectId) ?? []), t]);
    }
    return projects
      .filter((p) => !p.archivedAt && byProject.has(p.id))
      .map((project) => ({ project, tasks: sortOpenTasks(byProject.get(project.id) ?? []) }));
  }, [allTasks, projects, user]);

  if (!orgId || groups.length === 0) return null;

  const toggleComplete = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: !task.completed } });

  const modalUpdate = (taskId: string, input: UpdateTeamTaskInput) =>
    updateTask.mutateAsync({ taskId, input });

  return (
    <section className="mt-8" aria-label="Mes tâches d'équipe">
      {/* En-tête de section — marque la frontière avec les tâches perso */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
          <Building2 size={15} aria-hidden="true" />
        </span>
        <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
          Mes tâches d'équipe
        </h2>
        <span className="text-xs text-[rgb(var(--color-text-muted))]">· {activeOrg.name}</span>
        <Link
          to="/entreprise"
          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-600 transition-colors"
        >
          Espace entreprise <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>

      <div className="space-y-3">
        {groups.map(({ project, tasks }) => {
          const color = projectColor(project.color);
          return (
            <div
              key={project.id}
              className="rounded-2xl border border-dashed border-indigo-300/60 dark:border-indigo-700/50 bg-indigo-500/[0.03] overflow-hidden"
            >
              {/* Catégorie auto = projet (style distinct des catégories perso) */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-dashed border-indigo-300/40 dark:border-indigo-700/40">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
                <span className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">
                  {project.name}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
                  <UsersRound size={10} aria-hidden="true" /> Équipe
                </span>
                <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))] tabular-nums">
                  {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="px-2 py-1.5">
                {tasks.map((task) => {
                  const overdue = isTaskOverdue(task);
                  const priority = PRIORITY_META[task.priority] ?? PRIORITY_META[3];
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-[rgb(var(--color-hover))] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleComplete(task)}
                        aria-label={`Marquer « ${task.name} » comme terminée`}
                        className="w-5 h-5 rounded-md border border-[rgb(var(--color-border))] hover:border-indigo-500 flex items-center justify-center shrink-0 transition-colors"
                      >
                        {task.completed && <Check size={13} aria-hidden="true" />}
                      </button>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} title={priority.label} aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => setEditingTask(task)}
                        aria-label={`Modifier la tâche ${task.name}`}
                        className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 rounded-md"
                      >
                        <span className="block text-sm text-[rgb(var(--color-text-primary))] truncate">{task.name}</span>
                        {task.deadline && (
                          <span className={`text-xs inline-flex items-center gap-1 ${overdue ? 'text-red-500' : 'text-[rgb(var(--color-text-muted))]'}`}>
                            <CalendarClock size={11} aria-hidden="true" />
                            {format(parseISO(task.deadline), 'd MMM', { locale: fr })}
                            {overdue && ' · en retard'}
                          </span>
                        )}
                      </button>
                      {task.assigneeIds.length > 1 && (
                        <span
                          className="text-[10px] font-semibold text-[rgb(var(--color-text-muted))] shrink-0"
                          title="Tâche partagée avec d'autres membres"
                        >
                          +{task.assigneeIds.length - 1}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {editingTask && (
        <TeamTaskModal
          task={editingTask}
          projects={projects.filter((p) => !p.archivedAt)}
          members={members}
          onUpdate={modalUpdate}
          onClose={() => setEditingTask(null)}
        />
      )}
    </section>
  );
};

export default TeamAssignedSection;
