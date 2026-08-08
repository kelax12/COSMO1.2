import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { showUndoToast } from '@/lib/undo-toast';
import {
  Plus, FolderKanban, AlarmClock, CircleDashed, CheckCircle2,
  ChevronDown, ChevronRight, Clock,
} from 'lucide-react';
import {
  useTeamProjects,
  useTeamTasks,
  useCreateTeamProject,
  useUpdateTeamProject,
  useCreateTeamTask,
  useUpdateTeamTask,
  useDeleteTeamTask,
  type TeamTask,
  type TeamTaskStatus,
  type TeamProject,
  type CreateTeamProjectInput,
  type CreateTeamTaskInput,
  type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { useOrgTeams } from '@/modules/org-teams';
import type { OrgMember } from '@/modules/organizations';
import {
  useProjectsUiPrefs, isTaskOverdue, completedThisWeek,
  filterByStatus, sumEstimatedTime, formatDuration, type TaskStatusFilter,
} from './team-projects.helpers';
import { readEntityParam } from './deep-link.helpers';
import TeamProjectCard from './TeamProjectCard';
import ProjectsToolbar from './ProjectsToolbar';
import TeamProjectsKanban from './TeamProjectsKanban';
import TeamProjectsTimeline from './TeamProjectsTimeline';
import TeamTaskModal from './TeamTaskModal';
import NewTeamProjectModal from './NewTeamProjectModal';
import AssignTaskSheet from './AssignTaskSheet';
import BulkActionsBar from './BulkActionsBar';
import { useT } from '@/i18n/useT';

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

/**
 * Pastille de synthèse cliquable : bascule le filtre de statut.
 *
 * Une statistique qu'on ne peut pas creuser est une statistique morte — c'est
 * tout l'objet de ce composant, les pastilles étant auparavant décoratives.
 */
const StatPill = ({ active, onClick, label, tone, children }: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'neutral' | 'danger' | 'success';
  children: React.ReactNode;
}) => {
  const toneClass =
    tone === 'danger'
      ? 'bg-red-500/10 text-red-500 font-semibold'
      : tone === 'success'
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
        : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] font-medium';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 ${toneClass} ${
        active ? 'ring-2 ring-[rgb(var(--color-accent))]' : 'hover:brightness-110'
      }`}
    >
      {children}
    </button>
  );
};

const TeamProjectsTab = ({ orgId, members, currentUserId, isManager }: TeamProjectsTabProps) => {
  const { t, tp } = useT('org');
  const { prefs, updatePrefs } = useProjectsUiPrefs(orgId);
  const [showNewProject, setShowNewProject] = useState(false);
  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  // Colonne kanban (membre) ciblée par le « + ». La colonne « Non assignées »
  // ne passe PLUS par ici : avec `member = null`, la sheet ne proposait qu'un
  // unique bouton « Créer une nouvelle tâche » — un clic de plus pour
  // rien, elle ouvre directement TaskModal (cf. handler du kanban plus bas).
  const [assignSheetFor, setAssignSheetFor] = useState<string | 'closed'>('closed');

  const { data: allProjects = [], isLoading: loadingProjects } = useTeamProjects(orgId);
  const { data: allTasks = [] } = useTeamTasks(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const createProject = useCreateTeamProject(orgId);
  const updateProject = useUpdateTeamProject(orgId);
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);

  const { teamFilter, assigneeFilter, view, collapsed, showArchived, statusFilter, kanbanGroupBy } = prefs;

  // Un second clic sur la pastille active retire le filtre.
  const toggleStatus = (next: TaskStatusFilter) =>
    updatePrefs({ statusFilter: statusFilter === next ? 'all' : next });

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

  // Vue filtrée : assigné (dropdown) PUIS statut (pastilles). Les compteurs des
  // pastilles restent calculés sur `statsTasks`, NON filtré — sinon cliquer
  // « en retard » ferait tomber son propre compteur à sa valeur filtrée, et on
  // ne pourrait plus savoir combien il y en a réellement.
  const visibleTasks = useMemo(() => {
    const byAssignee = assigneeFilter
      ? allTasks.filter((t) => t.assigneeIds.includes(assigneeFilter))
      : allTasks;
    return filterByStatus(byAssignee, statusFilter);
  }, [allTasks, assigneeFilter, statusFilter]);

  /** Reste à faire estimé sur le périmètre visible (tâches ouvertes). */
  const totalEstimated = useMemo(
    () => sumEstimatedTime(statsTasks.filter((t) => !t.completed)),
    [statsTasks],
  );
  const tasksByProject = (projectId: string) => visibleTasks.filter((t) => t.projectId === projectId);

  const assignSheetMember = assignSheetFor !== 'closed'
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
  // `status` seul : le serveur synchronise `completed` (trigger mig. 091).
  const setStatus = (task: TeamTask, status: TeamTaskStatus) =>
    updateTask.mutate({ taskId: task.id, input: { status } });

  /**
   * Réassignation par glisser-déposer (kanban) — avec « Annuler ».
   *
   * Un drag se déclenche à la souris sans confirmation : c'est le geste le plus
   * facile à faire par accident de toute la vue. Il lui fallait donc le même
   * filet que la suppression, qui l'avait déjà.
   */
  const setAssigneesWithUndo = (task: TeamTask, assigneeIds: string[]) => {
    const previous = task.assigneeIds;
    updateTask.mutate({ taskId: task.id, input: { assigneeIds } });
    showUndoToast(t('projects.reassigned'), () =>
      updateTask.mutate({ taskId: task.id, input: { assigneeIds: previous } }),
    );
  };

  // Suppression avec « Annuler » : la tâche est recréée à l'identique.
  const removeWithUndo = (task: TeamTask) =>
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        showUndoToast(t('projects.taskDeleted'), () =>
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

  // ─── Sélection multiple + actions groupées ──────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleSelect = (task: TeamTask) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const exitSelectMode = () => {
    setSelectMode(false);
    clearSelection();
  };

  /** Tâches sélectionnées ENCORE visibles — une sélection ne survit pas au filtre. */
  const selectedTasks = useMemo(
    () => visibleTasks.filter((t) => selectedIds.has(t.id)),
    [visibleTasks, selectedIds],
  );

  const bulkSetCompleted = (completed: boolean) => {
    for (const task of selectedTasks) {
      if (task.completed === completed) continue;
      updateTask.mutate({ taskId: task.id, input: { completed } });
    }
    clearSelection();
  };

  // Suppression groupée : une seule ligne d'annulation qui recrée TOUT le lot,
  // plutôt qu'un toast par tâche qui noierait l'écran.
  const bulkDelete = () => {
    const doomed = [...selectedTasks];
    if (doomed.length === 0) return;
    clearSelection();
    for (const task of doomed) deleteTask.mutate(task.id);
    showUndoToast(tp('projects.bulkDeleted', doomed.length), () => {
      for (const task of doomed) {
        createTask.mutate({
          projectId: task.projectId,
          name: task.name,
          description: task.description,
          priority: task.priority,
          deadline: task.deadline,
          estimatedTime: task.estimatedTime,
          assigneeIds: task.assigneeIds,
        });
      }
    });
  };

  // ─── Deep-link `?task=<id>` ─────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const deepTaskId = readEntityParam(searchParams, 'task');

  // Ouvre la tâche ciblée par l'URL une fois les données arrivées, puis retire
  // le paramètre : sans ce nettoyage, refermer le modal le rouvrirait au rendu
  // suivant, l'URL restant la source de vérité.
  useEffect(() => {
    if (!deepTaskId) return;
    const target = allTasks.find((t) => t.id === deepTaskId);
    if (!target) return;
    setTaskModal({ mode: 'edit', task: target });
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  }, [deepTaskId, allTasks, searchParams, setSearchParams]);

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
      if (ps.length > 0) sections.push({ key: team.id, label: t('projects.teamSection', { name: team.name }), projects: ps });
    }
    const orgProjects = activeProjects.filter((p) => !p.teamId || !teams.some((t) => t.id === p.teamId));
    if (orgProjects.length > 0) sections.push({ key: 'org', label: sections.length > 0 ? t('projects.orgSection') : null, projects: orgProjects });
    return sections;
    // `t` en dépendance : les en-têtes de section sont traduits ici.
  }, [teamFilter, teams, activeProjects, t]);

  if (loadingProjects) return <ProjectsSkeleton />;

  const renderProjectCard = (project: TeamProject) => (
    <TeamProjectCard
      key={project.id}
      project={project}
      tasks={tasksByProject(project.id)}
      members={members}
      teams={teams}
      isManager={isManager}
      // Le mode sélection ne vaut que pour la vue liste : superposer des cases
      // à cocher au glisser-déposer du kanban rendrait le clic ambigu.
      onStartSelect={view === 'list' ? () => setSelectMode(true) : undefined}
      selectable={selectMode}
      selectedIds={selectedIds}
      onToggleSelect={toggleSelect}
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
      {/* Pouls : stats de l'espace projets.
          Les compteurs QUI NE FILTRENT PAS perdent la forme de pastille et se
          regroupent en une mention discrète : ils portaient jusqu'ici le style
          exact des pastilles cliquables, si bien qu'un clic sans effet
          enseignait que la rangée entière était inerte. */}
      {activeProjects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="inline-flex items-center gap-1.5 text-[rgb(var(--color-text-muted))]">
            <FolderKanban size={12} aria-hidden="true" />
            {tp('projects.projectCount', activeProjects.length)}
            {totalEstimated > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <Clock size={12} aria-hidden="true" />
                {t('projects.estimatedTotal', { duration: formatDuration(totalEstimated) })}
              </>
            )}
          </span>
          <StatPill
            active={statusFilter === 'open'}
            onClick={() => toggleStatus('open')}
            label={statusFilter === 'open' ? t('projects.filterClear') : t('projects.filterOpen')}
            tone="neutral"
          >
            <CircleDashed size={12} aria-hidden="true" /> {tp('projects.openCount', openCount)}
          </StatPill>
          {overdueCount > 0 && (
            <StatPill
              active={statusFilter === 'overdue'}
              onClick={() => toggleStatus('overdue')}
              label={statusFilter === 'overdue' ? t('projects.filterClear') : t('projects.filterOverdue')}
              tone="danger"
            >
              <AlarmClock size={12} aria-hidden="true" /> {tp('projects.overdueCount', overdueCount)}
            </StatPill>
          )}
          {doneThisWeek > 0 && (
            <StatPill
              active={statusFilter === 'doneThisWeek'}
              onClick={() => toggleStatus('doneThisWeek')}
              label={statusFilter === 'doneThisWeek' ? t('projects.filterClear') : t('projects.filterDone')}
              tone="success"
            >
              <CheckCircle2 size={12} aria-hidden="true" /> {tp('projects.doneThisWeek', doneThisWeek)}
            </StatPill>
          )}
        </div>
      )}

      {/* Barre d'outils : périmètre · vue · action primaire (ProjectsToolbar) */}
      <ProjectsToolbar
        members={members}
        teams={teams}
        currentUserId={currentUserId}
        prefs={prefs}
        updatePrefs={updatePrefs}
        isManager={isManager}
        onNewProject={() => setShowNewProject(true)}
      />

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
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('projects.empty')}</p>
          {isManager ? (
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              <Plus size={15} aria-hidden="true" /> {t('projects.createProject')}
            </button>
          ) : (
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">{t('projects.managerMustCreate')}</p>
          )}
        </div>
      ) : view === 'timeline' ? (
        <TeamProjectsTimeline
          projects={activeProjects}
          tasks={visibleTasks}
          onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
        />
      ) : view === 'kanban' ? (
        <TeamProjectsKanban
          projects={activeProjects}
          tasks={statsTasks}
          members={members}
          onSetAssignees={setAssigneesWithUndo}
          onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
          onAddToColumn={(memberId) =>
            memberId
              ? setAssignSheetFor(memberId)
              // Colonne « Non assignées » : la sheet n'aurait proposé qu'un
              // unique bouton — droit au modal, sans détour.
              : setTaskModal({ mode: 'create', projectId: activeProjects[0]?.id, assigneeIds: [] })
          }
          groupBy={kanbanGroupBy}
          onSetGroupBy={(next) => updatePrefs({ kanbanGroupBy: next })}
          onSetStatus={setStatus}
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
                {t('projects.archived', { count: archivedProjects.length })}
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
            if (assignSheetFor !== 'closed' && !task.assigneeIds.includes(assignSheetFor)) {
              setAssignees(task, [...task.assigneeIds, assignSheetFor]);
            }
          }}
          onCreateNew={() => {
            const target = assignSheetFor;
            setAssignSheetFor('closed');
            setTaskModal({
              mode: 'create',
              projectId: activeProjects[0]?.id,
              assigneeIds: target !== 'closed' ? [target] : [],
            });
          }}
          onClose={() => setAssignSheetFor('closed')}
        />
      )}

      {/* Barre d'actions groupées (flottante) */}
      {selectMode && (
        <BulkActionsBar
          count={selectedTasks.length}
          hasOpen={selectedTasks.some((t) => !t.completed)}
          hasCompleted={selectedTasks.some((t) => t.completed)}
          onComplete={() => bulkSetCompleted(true)}
          onReopen={() => bulkSetCompleted(false)}
          onDelete={bulkDelete}
          onExit={exitSelectMode}
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
          isManager={isManager}
          onClose={() => setTaskModal(null)}
        />
      )}
    </div>
  );
};

export default TeamProjectsTab;
