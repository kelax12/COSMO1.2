import { useMemo, useState } from 'react';
import { showUndoToast } from '@/lib/undo-toast';
import {
  Plus, FolderKanban, LayoutList, SquareKanban, AlarmClock,
  CircleDashed, CheckCircle2, ChevronDown, ChevronRight, UserRound,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  useTeamProjects,
  useTeamTasks,
  useCreateTeamProject,
  useUpdateTeamProject,
  useCreateTeamTask,
  useUpdateTeamTask,
  useDeleteTeamTask,
  type TeamTask,
  type TeamProject,
  type CreateTeamProjectInput,
  type CreateTeamTaskInput,
  type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { useOrgTeams } from '@/modules/org-teams';
import type { OrgMember } from '@/modules/organizations';
import {
  useProjectsUiPrefs, isTaskOverdue, completedThisWeek,
} from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';
import TeamProjectCard from './TeamProjectCard';
import TeamProjectsKanban from './TeamProjectsKanban';
import TeamTaskModal from './TeamTaskModal';
import NewTeamProjectModal from './NewTeamProjectModal';
import AssignTaskSheet from './AssignTaskSheet';

interface TeamProjectsTabProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  /** Manager/admin : peut créer des projets. */
  isManager: boolean;
}

/** État du modal de tâche : création (préréglages) ou édition. */
type TaskModalState =
  | { mode: 'create'; projectId?: string; assigneeIds?: string[] }
  | { mode: 'edit'; task: TeamTask }
  | null;

/** Skeleton de chargement au format carte projet. */
const ProjectsSkeleton = () => (
  <div className="space-y-4" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[rgb(var(--color-hover))]" />
          <div className="h-4 w-40 rounded bg-[rgb(var(--color-hover))]" />
          <div className="ml-auto h-3 w-16 rounded bg-[rgb(var(--color-hover))]" />
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="h-3 w-3/4 rounded bg-[rgb(var(--color-hover))]" />
          <div className="h-3 w-2/3 rounded bg-[rgb(var(--color-hover))]" />
        </div>
      </div>
    ))}
  </div>
);

const TeamProjectsTab = ({ orgId, members, currentUserId, isManager }: TeamProjectsTabProps) => {
  const { prefs, updatePrefs } = useProjectsUiPrefs(orgId);
  const [showNewProject, setShowNewProject] = useState(false);
  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  // Colonne kanban ciblée par le « + » (null fermé, 'unassigned' possible).
  const [assignSheetFor, setAssignSheetFor] = useState<string | null | 'closed'>('closed');

  const { data: allProjects = [], isLoading: loadingProjects } = useTeamProjects(orgId);
  const { data: allTasks = [] } = useTeamTasks(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const createProject = useCreateTeamProject(orgId);
  const updateProject = useUpdateTeamProject(orgId);
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);

  const { teamFilter, assigneeFilter, view, collapsed, showArchived } = prefs;

  // ─── Projets visibles (filtre équipe + actifs/archivés) ────────────
  const matchesTeam = (p: TeamProject) => {
    if (!teamFilter) return true;
    if (teamFilter === 'org') return !p.teamId;
    return p.teamId === teamFilter;
  };
  const activeProjects = allProjects.filter((p) => !p.archivedAt && matchesTeam(p));
  const archivedProjects = allProjects.filter((p) => !!p.archivedAt && matchesTeam(p));

  // ─── Tâches : stats globales (non filtrées) + vue filtrée par assigné ──
  const activeProjectIds = useMemo(() => new Set(activeProjects.map((p) => p.id)), [activeProjects]);
  const statsTasks = useMemo(
    () => allTasks.filter((t) => activeProjectIds.has(t.projectId)),
    [allTasks, activeProjectIds],
  );
  const openCount = statsTasks.filter((t) => !t.completed).length;
  const overdueCount = statsTasks.filter(isTaskOverdue).length;
  const doneThisWeek = completedThisWeek(statsTasks);

  const visibleTasks = useMemo(
    () => (assigneeFilter ? allTasks.filter((t) => t.assigneeIds.includes(assigneeFilter)) : allTasks),
    [allTasks, assigneeFilter],
  );
  const tasksByProject = (projectId: string) => visibleTasks.filter((t) => t.projectId === projectId);

  const filteredMember = members.find((m) => m.userId === assigneeFilter);
  const assignSheetMember = assignSheetFor !== 'closed' && assignSheetFor !== null
    ? members.find((m) => m.userId === assignSheetFor) ?? null
    : null;

  // ─── Actions ────────────────────────────────────────────────────────
  // Crée le projet PUIS ses tâches initiales sous son id (séquentiel pour
  // récupérer l'id du projet avant d'y rattacher les tâches).
  const handleCreateProjectFull = async (
    input: CreateTeamProjectInput,
    draftTasks: { name: string; assigneeIds: string[] }[],
  ) => {
    const project = await createProject.mutateAsync(input);
    for (const t of draftTasks) {
      await createTask.mutateAsync({ projectId: project.id, name: t.name, assigneeIds: t.assigneeIds });
    }
  };

  const toggleComplete = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: !task.completed } });
  const setAssignees = (task: TeamTask, assigneeIds: string[]) =>
    updateTask.mutate({ taskId: task.id, input: { assigneeIds } });

  // Suppression avec « Annuler » : la tâche est recréée à l'identique.
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

  const modalCreate = (input: CreateTeamTaskInput) => createTask.mutateAsync(input);
  const modalUpdate = (taskId: string, input: UpdateTeamTaskInput) =>
    updateTask.mutateAsync({ taskId, input });

  const toggleCollapse = (projectId: string) =>
    updatePrefs((prev) => ({ collapsed: { ...prev.collapsed, [projectId]: !prev.collapsed[projectId] } }));

  // ─── Groupement par équipe (vue liste, sans filtre équipe) ──────────
  const groupedSections = useMemo(() => {
    if (teamFilter || teams.length === 0) return null;
    const sections: { key: string; label: string | null; projects: TeamProject[] }[] = [];
    for (const team of teams) {
      const ps = activeProjects.filter((p) => p.teamId === team.id);
      if (ps.length > 0) sections.push({ key: team.id, label: `Équipe ${team.name}`, projects: ps });
    }
    const orgProjects = activeProjects.filter((p) => !p.teamId || !teams.some((t) => t.id === p.teamId));
    if (orgProjects.length > 0) sections.push({ key: 'org', label: sections.length > 0 ? 'Entreprise' : null, projects: orgProjects });
    return sections;
  }, [teamFilter, teams, activeProjects]);

  if (loadingProjects) return <ProjectsSkeleton />;

  const renderProjectCard = (project: TeamProject) => (
    <TeamProjectCard
      key={project.id}
      project={project}
      tasks={tasksByProject(project.id)}
      members={members}
      teams={teams}
      isManager={isManager}
      collapsed={!!collapsed[project.id]}
      onToggleCollapse={() => toggleCollapse(project.id)}
      assigneeFiltered={!!assigneeFilter}
      onAddTask={(projectId) =>
        setTaskModal({ mode: 'create', projectId, assigneeIds: currentUserId ? [currentUserId] : [] })
      }
      onToggleComplete={toggleComplete}
      onReassign={setAssignees}
      onDelete={removeWithUndo}
      onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
      onUpdateProject={(input) => updateProject.mutate({ projectId: project.id, input })}
    />
  );

  return (
    <div className="space-y-4">
      {/* Pouls : stats de l'espace projets */}
      {activeProjects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] font-medium">
            <FolderKanban size={12} aria-hidden="true" /> {activeProjects.length} projet{activeProjects.length > 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] font-medium">
            <CircleDashed size={12} aria-hidden="true" /> {openCount} ouverte{openCount > 1 ? 's' : ''}
          </span>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 font-semibold">
              <AlarmClock size={12} aria-hidden="true" /> {overdueCount} en retard
            </span>
          )}
          {doneThisWeek > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 size={12} aria-hidden="true" /> {doneThisWeek} terminée{doneThisWeek > 1 ? 's' : ''} cette semaine
            </span>
          )}
        </div>
      )}

      {/* Barre d'actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toutes / Mes tâches */}
          <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5">
            <button
              type="button"
              onClick={() => updatePrefs({ assigneeFilter: null })}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                !assigneeFilter ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              Toutes les tâches
            </button>
            <button
              type="button"
              onClick={() => currentUserId && updatePrefs({ assigneeFilter: currentUserId })}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                assigneeFilter === currentUserId ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              Mes tâches
            </button>
          </div>

          {/* Tâches d'un membre */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Filtrer par assigné"
              className={`h-9 px-2.5 rounded-lg border inline-flex items-center gap-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                filteredMember && assigneeFilter !== currentUserId
                  ? 'border-indigo-500 text-[rgb(var(--color-text-primary))]'
                  : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]'
              }`}
            >
              {filteredMember && assigneeFilter !== currentUserId ? (
                <>
                  <MemberAvatar avatar={filteredMember.avatar} name={filteredMember.displayName} size={20} />
                  <span className="max-w-[110px] truncate">{filteredMember.displayName}</span>
                </>
              ) : (
                <>
                  <UserRound size={14} aria-hidden="true" /> Tâches de…
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
              <DropdownMenuLabel>Voir les tâches de</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => updatePrefs({ assigneeFilter: null })}>
                <span className="text-[rgb(var(--color-text-muted))]">Tout le monde</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {members.map((m) => (
                <DropdownMenuItem key={m.userId} onClick={() => updatePrefs({ assigneeFilter: m.userId })}>
                  <MemberAvatar avatar={m.avatar} name={m.displayName} size={22} />
                  <span className="truncate">{m.userId === currentUserId ? 'Vous' : m.displayName}</span>
                  {m.userId === assigneeFilter && <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))]">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filtre équipe */}
          {teams.length > 0 && (
            <select
              value={teamFilter}
              onChange={(e) => updatePrefs({ teamFilter: e.target.value })}
              aria-label="Filtrer par équipe"
              className="h-9 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="">Toutes les équipes</option>
              <option value="org">Entreprise (sans équipe)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Liste / Kanban */}
          <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5">
            <button
              type="button"
              onClick={() => updatePrefs({ view: 'list' })}
              aria-label="Vue liste"
              aria-pressed={view === 'list'}
              title="Vue liste"
              className={`w-9 h-8 rounded-md flex items-center justify-center transition-colors ${
                view === 'list' ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              <LayoutList size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => updatePrefs({ view: 'kanban' })}
              aria-label="Vue kanban par assigné"
              aria-pressed={view === 'kanban'}
              title="Vue kanban par assigné"
              className={`w-9 h-8 rounded-md flex items-center justify-center transition-colors ${
                view === 'kanban' ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
            >
              <SquareKanban size={15} aria-hidden="true" />
            </button>
          </div>

          {isManager && !showNewProject && (
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors"
            >
              <Plus size={15} aria-hidden="true" /> Nouveau projet
            </button>
          )}
        </div>
      </div>

      {/* Popup nouveau projet (nom, couleur, équipe/collaborateurs, tâches) */}
      {isManager && showNewProject && (
        <NewTeamProjectModal
          teams={teams}
          members={members}
          defaultTeamId={teamFilter && teamFilter !== 'org' ? teamFilter : ''}
          onSubmit={handleCreateProjectFull}
          onClose={() => setShowNewProject(false)}
        />
      )}

      {/* Contenu */}
      {activeProjects.length === 0 && archivedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <FolderKanban size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Aucun projet</p>
          {isManager ? (
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              <Plus size={15} aria-hidden="true" /> Créer un projet
            </button>
          ) : (
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">Un manager doit créer un projet.</p>
          )}
        </div>
      ) : view === 'kanban' ? (
        <TeamProjectsKanban
          projects={activeProjects}
          tasks={statsTasks}
          members={members}
          onSetAssignees={setAssignees}
          onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
          onAddToColumn={(memberId) => setAssignSheetFor(memberId)}
        />
      ) : (
        <>
          {groupedSections ? (
            groupedSections.map((section) => (
              <div key={section.key} className="space-y-3">
                {section.label && (
                  <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] px-1 pt-1">
                    {section.label}
                  </h3>
                )}
                {section.projects.map(renderProjectCard)}
              </div>
            ))
          ) : (
            activeProjects.map(renderProjectCard)
          )}

          {/* Archivés */}
          {archivedProjects.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => updatePrefs({ showArchived: !showArchived })}
                aria-expanded={showArchived}
                className="inline-flex items-center gap-1.5 px-1 py-1 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
              >
                {showArchived ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                Projets archivés ({archivedProjects.length})
              </button>
              {showArchived && (
                <div className="space-y-3 mt-2">{archivedProjects.map(renderProjectCard)}</div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sheet « attribuer / créer » du kanban */}
      {assignSheetFor !== 'closed' && (
        <AssignTaskSheet
          member={assignSheetMember}
          projects={activeProjects}
          tasks={statsTasks}
          onAssign={(task) => {
            const target = assignSheetFor as string | null;
            if (target && !task.assigneeIds.includes(target)) {
              setAssignees(task, [...task.assigneeIds, target]);
            }
          }}
          onCreateNew={() => {
            const target = assignSheetFor as string | null;
            setAssignSheetFor('closed');
            setTaskModal({
              mode: 'create',
              projectId: activeProjects[0]?.id,
              assigneeIds: target ? [target] : [],
            });
          }}
          onClose={() => setAssignSheetFor('closed')}
        />
      )}

      {/* Modal de tâche (création / édition) */}
      {taskModal && (
        <TeamTaskModal
          task={taskModal.mode === 'edit' ? taskModal.task : undefined}
          isCreating={taskModal.mode === 'create'}
          projects={activeProjects.length > 0 ? activeProjects : allProjects}
          members={members}
          defaultProjectId={taskModal.mode === 'create' ? taskModal.projectId : undefined}
          defaultAssigneeIds={taskModal.mode === 'create' ? taskModal.assigneeIds : undefined}
          onCreate={modalCreate}
          onUpdate={modalUpdate}
          onDelete={removeWithUndo}
          onClose={() => setTaskModal(null)}
        />
      )}
    </div>
  );
};

export default TeamProjectsTab;
