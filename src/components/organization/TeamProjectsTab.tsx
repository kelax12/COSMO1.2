import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTeamTasksSelection } from './use-team-tasks-selection';
import { Plus, FolderKanban, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import {
  useTeamProjects,
  useTeamProjectTemplates,
  useTeamTasks,
  useTeamProjectMilestones,
  useTeamProjectDependencies,
  TEAM_TASKS_READ_LIMIT,
  type TeamTask,
  type TeamTaskStatus,
  type TeamProject,
  type CreateTeamTaskInput,
  type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { useOrgTeams } from '@/modules/org-teams';
import { useTeamCategories } from '@/modules/team-categories';
import { useMyOrgPermissions, type OrgMember } from '@/modules/organizations';
import {
  useProjectsUiPrefs, isTaskOverdue, completedThisWeek,
  filterByStatus, sumEstimatedTime, type TaskStatusFilter,
} from './team-projects.helpers';
import { PORTFOLIO_CARD_THRESHOLD, matchesProjectSearch, sortProjects } from './portfolio.helpers';
import { readEntityParam } from './deep-link.helpers';
import { useTeamProjectsActions } from './use-team-projects-actions';
import { ProjectsSkeleton, ProjectsPulse, ProjectsSearchBar } from './ProjectsPulse';
import TeamProjectCard from './TeamProjectCard';
// Vues et surfaces à la demande : chargées au premier affichage (budget du chunk).
import {
  TeamProjectsKanban, TeamProjectsTimeline, ProjectPortfolioView, ProjectDetailPage,
  ProjectEditDialog, NewTeamProjectModal, CreateTeamModal, AssignTaskSheet, BulkActionsBar,
} from './team-projects.lazy';
import ProjectsToolbar from './ProjectsToolbar';
import ProjectTemplatesSection from './ProjectTemplatesSection';
import TeamTaskModal from './TeamTaskModal';
import TruncatedDataNotice from './TruncatedDataNotice';
import TeamTrashDialog from './TeamTrashDialog';
import { useProjectAccess } from './use-project-access';
import { useT } from '@/i18n/useT';

interface TeamProjectsTabProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  /** Manager/admin — sert encore aux surfaces HIÉRARCHIQUES (dépendances de
   *  tâches), jamais aux droits de création : ceux-ci viennent de la mig. 115. */
  isManager: boolean;
  /** Admin : peut ajouter n'importe qui à une équipe créée depuis ici (miroir RLS). */
  isAdmin: boolean;
}

/** État du modal de tâche : création (préréglages) ou édition. */
type TaskModalState =
  | {
    mode: 'create';
    projectId?: string;
    assigneeIds?: string[];
    status?: TeamTaskStatus;
    /** Aucun projet en contexte : la fiche le DEMANDE (kanban, audit 2026-09-24). */
    requireProject?: boolean;
  }
  | { mode: 'edit'; task: TeamTask }
  | null;

const TeamProjectsTab = ({ orgId, members, currentUserId, isManager, isAdmin }: TeamProjectsTabProps) => {
  const { can, canAssign } = useMyOrgPermissions(orgId);
  const { t, tp } = useT('org');
  const { t: pf, tp: tpf } = useT('portfolio');
  const { prefs, updatePrefs } = useProjectsUiPrefs(orgId);
  const [showNewProject, setShowNewProject] = useState<false | { templateId?: string }>(false);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  const [query, setQuery] = useState('');
  // Colonne kanban (membre) ciblée par le « + ». La colonne « Non assignées »
  // ne passe pas par ici : elle ouvre directement TaskModal.
  const [assignSheetFor, setAssignSheetFor] = useState<string | 'closed'>('closed');

  const { data: allProjects = [], isLoading: loadingProjects } = useTeamProjects(orgId);
  const { data: templates = [] } = useTeamProjectTemplates(orgId);
  const { data: allTasks = [] } = useTeamTasks(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: categories = [] } = useTeamCategories(orgId);
  const { data: milestones = [] } = useTeamProjectMilestones(orgId);
  const { data: projectDeps = [] } = useTeamProjectDependencies(orgId);
  const { projectMembers, statsById, isLeadOf } = useProjectAccess(orgId, currentUserId); // mig. 190, 191

  const { teamFilter, assigneeFilter, collapsed, showArchived, statusFilter, kanbanGroupBy, timelineGroupBy, sort } = prefs;

  // ─── Page projet : `?project=<id>` (M2) ─────────────────────────────
  // L'adresse est celle qu'émettent déjà la palette de commandes et le panneau
  // de droite. Le paramètre RESTE dans l'URL : c'est l'adresse de la page.
  const [searchParams, setSearchParams] = useSearchParams();
  const projectParam = readEntityParam(searchParams, 'project');
  const detailProject = projectParam ? allProjects.find((p) => p.id === projectParam) : undefined;
  const openProject = (projectId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('project', projectId);
    setSearchParams(next);
  };
  const closeProject = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('project');
    setSearchParams(next);
  };

  const actions = useTeamProjectsActions({
    orgId,
    currentUserId,
    allTasks,
    milestones,
    onTeamCreated: (teamId) => updatePrefs({ teamFilter: teamId }),
    onOpenProject: openProject,
  });

  /** `project.edit` (mig. 153), responsable, ou co-pilote (mig. 190). */
  const canEditProjectFor = (p: TeamProject) =>
    can['project.edit'] || (!!currentUserId && p.ownerId === currentUserId) || isLeadOf(p);

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
  const manyProjects = activeProjects.length > PORTFOLIO_CARD_THRESHOLD;
  // Sans choix explicite, au-delà de 20 projets, on ouvre sur le portefeuille.
  const view = prefs.viewChosen ? prefs.view : manyProjects ? 'portfolio' : prefs.view;

  // ─── Recherche et tri (M2) : même ensemble pour cartes et portefeuille ─
  const shownProjects = useMemo(() => {
    const teamName = (id?: string | null) => teams.find((tm) => tm.id === id)?.name;
    const found = activeProjects.filter((p) => matchesProjectSearch(p, query, {
      teamName: teamName(p.teamId),
      categoryName: categories.find((c) => c.id === p.categoryId)?.name,
      ownerName: members.find((m) => m.userId === p.ownerId)?.displayName,
    }));
    return sortProjects(found, sort, allTasks, statsById);
  }, [activeProjects, query, sort, allTasks, teams, categories, members, statsById]);

  // ─── Tâches : stats globales (non filtrées) + vue filtrée par assigné ──
  const activeProjectIds = useMemo(() => new Set(activeProjects.map((p) => p.id)), [activeProjects]);
  const statsTasks = useMemo(
    () => allTasks.filter((t) => activeProjectIds.has(t.projectId)),
    [allTasks, activeProjectIds],
  );
  const openCount = statsTasks.filter((t) => !t.completed).length;
  const overdueCount = statsTasks.filter(isTaskOverdue).length;
  const doneThisWeek = completedThisWeek(statsTasks);

  // Vue filtrée : équipe (déjà dans `statsTasks`) PUIS assigné PUIS statut.
  // Les compteurs des pastilles restent calculés sur `statsTasks` NON filtré :
  // sinon cliquer « en retard » ferait tomber son propre compteur.
  const visibleTasks = useMemo(() => {
    const byAssignee = assigneeFilter
      ? statsTasks.filter((t) => t.assigneeIds.includes(assigneeFilter))
      : statsTasks;
    return filterByStatus(byAssignee, statusFilter);
  }, [statsTasks, assigneeFilter, statusFilter]);

  const totalEstimated = useMemo(
    () => sumEstimatedTime(statsTasks.filter((t) => !t.completed)),
    [statsTasks],
  );
  const tasksByProject = (projectId: string) => visibleTasks.filter((t) => t.projectId === projectId);

  const assignSheetMember = assignSheetFor !== 'closed'
    ? members.find((m) => m.userId === assignSheetFor) ?? null
    : null;

  // ─── Sélection multiple + actions groupées (toutes vues) ───────────
  const {
    selectMode, setSelectMode, selectedIds, selectedTasks,
    toggleSelect, exitSelectMode, bulkSetCompleted, bulkDelete, bulkAssign, bulkMove, bulkSetStatus,
  } = useTeamTasksSelection({
    visibleTasks: projectParam ? visibleTasks.filter((t) => t.projectId === projectParam) : visibleTasks,
    setCompleted: (task, completed) => actions.updateTaskInput(task, { completed }),
    deleteTask: actions.deleteTaskById,
    restoreTask: actions.restoreDeletedTask,
    deletedLabel: (count) => tp('projects.bulkDeleted', count),
    updateTask: actions.updateTaskInput,
    labels: {
      reassigned: (count) => tpf('bulk.reassigned', count),
      moved: (count) => tpf('bulk.moved', count),
      statusChanged: (count) => tpf('bulk.statusChanged', count),
    },
    canAssign,
  });

  // ─── Deep-link `?task=<id>` ─────────────────────────────────────────
  const deepTaskId = readEntityParam(searchParams, 'task');
  // Ouvre la tâche ciblée par l'URL une fois les données arrivées, puis retire
  // le paramètre : sans ce nettoyage, refermer le modal le rouvrirait.
  useEffect(() => {
    if (!deepTaskId) return;
    const target = allTasks.find((t) => t.id === deepTaskId);
    if (!target) return;
    setTaskModal({ mode: 'edit', task: target });
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  }, [deepTaskId, allTasks, searchParams, setSearchParams]);

  const modalCreate = (input: CreateTeamTaskInput) => actions.createTaskAsync(input);
  const modalUpdate = (taskId: string, input: UpdateTeamTaskInput) =>
    actions.updateTaskAsync({ taskId, input });

  /**
   * Projet d'une tâche créée sans contexte de projet (« + » du kanban) : celui
   * du filtre actif s'il n'en reste qu'un, sinon la fiche le demande. Il
   * tombait jusque-là dans `activeProjects[0]`, le premier projet venu.
   */
  const projectFromFilter = activeProjects.length === 1 ? activeProjects[0].id : undefined;
  const createWithoutProjectContext = (preset: { assigneeIds: string[]; status?: TeamTaskStatus }) =>
    setTaskModal({ mode: 'create', projectId: projectFromFilter, requireProject: !projectFromFilter, ...preset });

  // Au-delà de 20 projets, les cartes s'ouvrent REPLIÉES (sauf décision).
  const isCollapsed = (projectId: string) => collapsed[projectId] ?? manyProjects;
  const toggleCollapse = (projectId: string) =>
    updatePrefs((prev) => ({ collapsed: { ...prev.collapsed, [projectId]: !(prev.collapsed[projectId] ?? manyProjects) } }));

  // ─── Groupement par équipe (vue liste, sans filtre équipe) ──────────
  const groupedSections = useMemo(() => {
    if (teamFilter || teams.length === 0) return null;
    const sections: { key: string; label: string | null; projects: TeamProject[] }[] = [];
    for (const team of teams) {
      const ps = shownProjects.filter((p) => p.teamId === team.id);
      if (ps.length > 0) sections.push({ key: team.id, label: t('projects.teamSection', { name: team.name }), projects: ps });
    }
    const orgProjects = shownProjects.filter((p) => !p.teamId || !teams.some((tm) => tm.id === p.teamId));
    if (orgProjects.length > 0) sections.push({ key: 'org', label: sections.length > 0 ? t('projects.orgSection') : null, projects: orgProjects });
    return sections;
    // `t` en dépendance : les en-têtes de section sont traduits ici.
  }, [teamFilter, teams, shownProjects, t]);

  if (loadingProjects) return <ProjectsSkeleton />;

  const editProject = editProjectId ? allProjects.find((p) => p.id === editProjectId) : undefined;

  const renderProjectCard = (project: TeamProject) => (
    <TeamProjectCard
      key={project.id}
      project={project}
      tasks={tasksByProject(project.id)}
      members={members}
      teams={teams}
      canEditProject={canEditProjectFor(project)}
      canChangeTeam={can['project.edit']}
      canCreateProject={can['project.create']}
      canArchiveProject={can['project.delete']}
      onOpenProject={() => openProject(project.id)}
      onEditProject={() => setEditProjectId(project.id)}
      onDuplicate={() => actions.duplicateProject(project)}
      onSaveTemplate={() => actions.saveAsTemplate(project)}
      onArchive={() => actions.archiveWithUndo(project)}
      onStartSelect={() => setSelectMode(true)}
      selectable={selectMode}
      selectedIds={selectedIds}
      onToggleSelect={toggleSelect}
      collapsed={isCollapsed(project.id)}
      onToggleCollapse={() => toggleCollapse(project.id)}
      assigneeFiltered={!!assigneeFilter}
      onAddTask={(projectId) =>
        setTaskModal({ mode: 'create', projectId, assigneeIds: currentUserId ? [currentUserId] : [] })
      }
      onToggleComplete={actions.toggleComplete}
      onReassign={actions.setAssignees}
      onDelete={actions.removeWithUndo}
      onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
      onUpdateProject={(input) => void actions.patchProject(project, input)}
    />
  );

  // ─── Surfaces communes (modales, barre groupée) ─────────────────────
  const overlays = (
    <Suspense fallback={null}>
      {can['project.create'] && showNewProject && (
        <NewTeamProjectModal
          orgId={orgId}
          teams={teams}
          members={members}
          currentUserId={currentUserId}
          defaultTeamId={teamFilter && teamFilter !== 'org' ? teamFilter : ''}
          templates={templates}
          initialTemplateId={showNewProject.templateId}
          onSubmit={actions.createProjectFull}
          onClose={() => setShowNewProject(false)}
        />
      )}

      {can['team.create'] && showNewTeam && (
        <CreateTeamModal
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onSubmit={actions.createTeamFull}
          onClose={() => setShowNewTeam(false)}
        />
      )}

      {editProject && (
        <ProjectEditDialog
          project={editProject}
          members={members}
          canChangeOwner={can['project.edit']}
          onSubmit={(input) => actions.patchProject(editProject, input)}
          onClose={() => setEditProjectId(null)}
        />
      )}

      {assignSheetFor !== 'closed' && (
        <AssignTaskSheet
          member={assignSheetMember}
          projects={activeProjects}
          tasks={statsTasks}
          onAssign={(task) => {
            if (assignSheetFor !== 'closed' && !task.assigneeIds.includes(assignSheetFor)) {
              actions.setAssignees(task, [...task.assigneeIds, assignSheetFor]);
            }
          }}
          onCreateNew={() => {
            const target = assignSheetFor;
            setAssignSheetFor('closed');
            createWithoutProjectContext({ assigneeIds: target !== 'closed' ? [target] : [] });
          }}
          onClose={() => setAssignSheetFor('closed')}
        />
      )}

      {selectMode && (
        <BulkActionsBar
          count={selectedTasks.length}
          hasOpen={selectedTasks.some((t) => !t.completed)}
          hasCompleted={selectedTasks.some((t) => t.completed)}
          onComplete={() => bulkSetCompleted(true)}
          onReopen={() => bulkSetCompleted(false)}
          onDelete={bulkDelete}
          onExit={exitSelectMode}
          assignableMembers={members.filter((m) => canAssign(m.userId))}
          onAssign={bulkAssign}
          projects={activeProjects}
          onMove={bulkMove}
          onSetStatus={bulkSetStatus}
        />
      )}

      {taskModal && (
        <TeamTaskModal
          task={taskModal.mode === 'edit' ? taskModal.task : undefined}
          isCreating={taskModal.mode === 'create'}
          projects={activeProjects.length > 0 ? activeProjects : allProjects}
          members={members}
          defaultProjectId={taskModal.mode === 'create' ? taskModal.projectId : undefined}
          defaultAssigneeIds={taskModal.mode === 'create' ? taskModal.assigneeIds : undefined}
          defaultStatus={taskModal.mode === 'create' ? taskModal.status : undefined}
          requireProjectChoice={taskModal.mode === 'create' && !!taskModal.requireProject}
          onCreate={modalCreate}
          onUpdate={modalUpdate}
          onDelete={actions.removeWithUndo}
          isManager={isManager}
          onClose={() => setTaskModal(null)}
        />
      )}
    </Suspense>
  );

  // ─── Page d'un projet ───────────────────────────────────────────────
  if (projectParam) {
    return (
      <Suspense fallback={<ProjectsSkeleton />}>
        {detailProject ? (
          <ProjectDetailPage
            project={detailProject}
            tasks={visibleTasks.filter((t) => t.projectId === detailProject.id)
              .concat(activeProjectIds.has(detailProject.id) ? [] : allTasks.filter((t) => t.projectId === detailProject.id))}
            allProjectTasks={allTasks.filter((t) => t.projectId === detailProject.id)}
            stats={statsById?.get(detailProject.id)}
            projectMembers={projectMembers.filter((m) => m.projectId === detailProject.id)}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            canCreateTask={can['task.create']}
            members={members}
            teams={teams}
            milestones={milestones}
            dependencies={projectDeps}
            projects={allProjects}
            categoryName={categories.find((c) => c.id === detailProject.categoryId)?.name}
            canEdit={canEditProjectFor(detailProject)}
            canArchive={can['project.delete']}
            canCreateProject={can['project.create']}
            onBack={closeProject}
            onOpenProject={openProject}
            onEdit={() => setEditProjectId(detailProject.id)}
            onDuplicate={() => actions.duplicateProject(detailProject)}
            onSaveTemplate={() => actions.saveAsTemplate(detailProject)}
            onArchive={() => actions.archiveWithUndo(detailProject)}
            onRestore={() => actions.restoreProject(detailProject)}
            onAddTask={() => setTaskModal({ mode: 'create', projectId: detailProject.id, assigneeIds: currentUserId ? [currentUserId] : [] })}
            onStartSelect={() => setSelectMode(true)}
            onToggleComplete={actions.toggleComplete}
            onReassign={actions.setAssignees}
            onDelete={actions.removeWithUndo}
            onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
            selectable={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        ) : (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">{pf('notFound')}</p>
            <button type="button" onClick={closeProject} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo-600">
              <ArrowLeft size={15} aria-hidden="true" /> {pf('back')}
            </button>
          </div>
        )}
        {overlays}
      </Suspense>
    );
  }

  const showSearch = (view === 'list' || view === 'portfolio') && activeProjects.length > 0;

  return (
    <div className="space-y-4">
      {activeProjects.length > 0 && (
        <ProjectsPulse
          projectCount={activeProjects.length}
          totalEstimated={totalEstimated}
          openCount={openCount}
          overdueCount={overdueCount}
          doneThisWeek={doneThisWeek}
          statusFilter={statusFilter}
          onToggleStatus={toggleStatus}
        />
      )}

      {/* Les cartes portent une progression (terminées / total) : elles ont
          besoin de TOUTES les tâches, donc de la lecture complète. Au-delà du
          plafond, elles se calculent sur un extrait, et l'écran le dit. */}
      {allTasks.length >= TEAM_TASKS_READ_LIMIT && <TruncatedDataNotice limit={TEAM_TASKS_READ_LIMIT} />}
      {/* Corbeille (M4) : ne s'affiche que s'il y a quelque chose à restaurer. */}
      <div className="flex justify-end"><TeamTrashDialog orgId={orgId} projects={allProjects} members={members} /></div>

      <ProjectsToolbar
        orgId={orgId}
        members={members}
        teams={teams}
        currentUserId={currentUserId}
        prefs={prefs}
        updatePrefs={updatePrefs}
        effectiveView={view}
        canCreateProject={can['project.create']}
        canCreateTeam={can['team.create']}
        onNewProject={() => setShowNewProject({})}
        onCreateTeam={() => setShowNewTeam(true)}
        onStartSelect={statsTasks.length > 0 && !selectMode ? () => setSelectMode(true) : undefined}
      />

      {showSearch && (
        <ProjectsSearchBar query={query} onQueryChange={setQuery} sort={sort} onSortChange={(s) => updatePrefs({ sort: s })} />
      )}
      {view === 'list' && manyProjects && (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf('manyProjectsHint', { count: PORTFOLIO_CARD_THRESHOLD })}</p>
      )}

      <Suspense fallback={<ProjectsSkeleton />}>
      {activeProjects.length === 0 && archivedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <FolderKanban size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('projects.empty')}</p>
          {can['project.create'] ? (
            <button
              type="button"
              onClick={() => setShowNewProject({})}
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
          members={members}
          groupBy={timelineGroupBy}
          milestones={milestones}
          onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
          selectable={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ) : view === 'kanban' ? (
        <TeamProjectsKanban
          projects={activeProjects}
          tasks={visibleTasks}
          members={members}
          onSetAssignees={actions.setAssigneesWithUndo}
          onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
          canAssign={canAssign}
          onAddToColumn={({ memberId, status }) =>
            memberId
              ? setAssignSheetFor(memberId)
              // Colonne « Non assignées » ou colonne de statut : droit au modal,
              // avec le statut de la colonne et SANS deviner le projet.
              : createWithoutProjectContext({ assigneeIds: [], status })
          }
          groupBy={kanbanGroupBy}
          onSetStatus={actions.setStatus}
          assigneeFilter={assigneeFilter}
          selectable={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <>
          {query && shownProjects.length === 0 && (
            <p className="py-8 text-center text-sm text-[rgb(var(--color-text-muted))]">{pf('noResult', { query })}</p>
          )}
          {view === 'portfolio' ? (
            shownProjects.length > 0 && (
              <ProjectPortfolioView
                projects={shownProjects}
                tasks={allTasks}
                statsById={statsById}
                members={members}
                teams={teams}
                milestones={milestones}
                dependencies={projectDeps}
                allProjects={allProjects}
                onOpenProject={openProject}
              />
            )
          ) : groupedSections ? (
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
            shownProjects.map(renderProjectCard)
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

          {/* Modèles (M2) : jamais mêlés aux projets en cours. */}
          <ProjectTemplatesSection
            templates={templates}
            canUse={can['project.create']}
            canRemove={can['project.delete']}
            onUse={(templateId) => setShowNewProject({ templateId })}
            onRemove={actions.archiveTemplate}
          />
        </>
      )}
      </Suspense>

      {overlays}
    </div>
  );
};

export default TeamProjectsTab;
