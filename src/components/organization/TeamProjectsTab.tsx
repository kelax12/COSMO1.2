import { useState } from 'react';
import { Plus, FolderKanban, ChevronDown, ChevronRight } from 'lucide-react';
import {
  useTeamProjects,
  useTeamTasks,
  useCreateTeamProject,
  useCreateTeamTask,
  useUpdateTeamTask,
  useDeleteTeamTask,
  type TeamTask,
} from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import TeamTaskRow from './TeamTaskRow';

interface TeamProjectsTabProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  /** Manager/admin : peut créer des projets. */
  isManager: boolean;
}

type Scope = 'all' | 'mine';

const TeamProjectsTab = ({ orgId, members, currentUserId, isManager }: TeamProjectsTabProps) => {
  const [scope, setScope] = useState<Scope>('all');
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [composerFor, setComposerFor] = useState<string | null>(null);
  const [composerName, setComposerName] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: projects = [], isLoading: loadingProjects } = useTeamProjects(orgId);
  const { data: tasks = [] } = useTeamTasks(
    orgId,
    scope === 'mine' && currentUserId ? { assigneeId: currentUserId } : undefined,
  );
  const createProject = useCreateTeamProject(orgId);
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);

  const tasksByProject = (projectId: string) => tasks.filter((t) => t.projectId === projectId);

  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (name.length < 1) return;
    createProject.mutate({ name }, {
      onSuccess: () => { setNewProjectName(''); setShowNewProject(false); },
    });
  };

  const handleAddTask = (projectId: string) => {
    const name = composerName.trim();
    if (!name) return;
    createTask.mutate(
      { projectId, name, assigneeId: currentUserId ?? null },
      { onSuccess: () => setComposerName('') },
    );
  };

  const toggleComplete = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: !task.completed } });
  const reassign = (task: TeamTask, assigneeId: string | null) =>
    updateTask.mutate({ taskId: task.id, input: { assigneeId } });
  const remove = (task: TeamTask) => deleteTask.mutate(task.id);

  if (loadingProjects) {
    return <div className="py-10 text-center text-sm text-[rgb(var(--color-text-muted))]">Chargement…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Barre d'actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5">
          {(['all', 'mine'] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                scope === s
                  ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]'
                  : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              {s === 'all' ? 'Toutes les tâches' : 'Mes tâches'}
            </button>
          ))}
        </div>

        {isManager && (
          showNewProject ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                placeholder="Nom du projet"
                autoFocus
                maxLength={120}
                className="h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || createProject.isPending}
                className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                Créer
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors"
            >
              <Plus size={15} aria-hidden="true" /> Nouveau projet
            </button>
          )
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <FolderKanban size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Aucun projet</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
            {isManager ? 'Créez un projet pour organiser les tâches de l\'équipe.' : 'Un manager doit créer un projet.'}
          </p>
        </div>
      ) : (
        projects.map((project) => {
          const projectTasks = tasksByProject(project.id);
          const done = projectTasks.filter((t) => t.completed).length;
          const isCollapsed = collapsed[project.id];
          return (
            <section key={project.id} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] overflow-hidden">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [project.id]: !c[project.id] }))}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[rgb(var(--color-hover))] transition-colors"
              >
                {isCollapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                <span className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{project.name}</span>
                <span className="text-xs text-[rgb(var(--color-text-muted))] ml-auto">
                  {done}/{projectTasks.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="px-2 pb-2">
                  {projectTasks.length === 0 && (
                    <p className="px-3 py-3 text-xs text-[rgb(var(--color-text-muted))]">
                      {scope === 'mine' ? 'Aucune tâche qui vous est assignée ici.' : 'Aucune tâche.'}
                    </p>
                  )}
                  {projectTasks.map((task) => (
                    <TeamTaskRow
                      key={task.id}
                      task={task}
                      members={members}
                      onToggleComplete={toggleComplete}
                      onReassign={reassign}
                      onDelete={remove}
                    />
                  ))}

                  {/* Composer d'ajout de tâche */}
                  {composerFor === project.id ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="text"
                        value={composerName}
                        onChange={(e) => setComposerName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddTask(project.id);
                          if (e.key === 'Escape') { setComposerFor(null); setComposerName(''); }
                        }}
                        placeholder="Nouvelle tâche…"
                        autoFocus
                        maxLength={500}
                        className="flex-1 h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTask(project.id)}
                        disabled={!composerName.trim() || createTask.isPending}
                        className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold"
                      >
                        Ajouter
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setComposerFor(project.id); setComposerName(''); }}
                      className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-[rgb(var(--color-text-muted))] hover:text-indigo-500 transition-colors"
                    >
                      <Plus size={15} aria-hidden="true" /> Ajouter une tâche
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
};

export default TeamProjectsTab;
