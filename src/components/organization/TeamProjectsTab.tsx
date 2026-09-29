import { Suspense, useMemo, useState } from 'react';
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
import { useProjectsUiPrefs, sumEstimatedTime } from './team-projects.helpers';
import { PORTFOLIO_CARD_THRESHOLD, matchesProjectSearch, sortProjects } from './portfolio.helpers';
import { matchesProjectFilters } from './project-filters';
import { readEntityParam } from './deep-link.helpers';
import { useTeamProjectsActions } from './use-team-projects-actions';
import { OrgEmptyState } from './OrgPagePrimitives';
import { ProjectsSkeleton, ProjectsPulse, ProjectsSearchBar } from './ProjectsPulse';
import TeamProjectCard from './TeamProjectCard';
// Vues et surfaces à la demande : chargées au premier affichage (budget du chunk).
import {
  TeamProjectsTimeline, ProjectPortfolioView, ProjectDetailPage,
  ProjectEditDialog, BulkActionsBar,
} from './team-projects.lazy';
import ProjectsToolbar from './ProjectsToolbar';
import OrgTaskFilterBar from './OrgTaskFilterBar';
import { usePermissionHints } from './permission-hints';
import { useOrgTaskFilters } from './task-filters';
import { useRememberedTaskFilters } from './remembered-task-filters';
import ProjectTemplatesSection from './ProjectTemplatesSection';
import TeamTaskModal from './TeamTaskModal';
import TruncatedDataNotice from './TruncatedDataNotice';
import TeamTrashDialog from './TeamTrashDialog';
import { useProjectAccess } from './use-project-access';
import { useT } from '@/i18n/useT';
import TeamColorDot from './TeamColorDot';
import { OrgCreateBoundary, useOrgCreate } from './org-create.context';

interface TeamProjectsTabProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  /** Manager/admin — sert encore aux surfaces HIÉRARCHIQUES (dépendances de
   *  tâches), jamais aux droits de création : ceux-ci viennent de la mig. 115. */
  isManager: boolean;
  /** Admin : rôles de projet et purge de la corbeille (mig. 190, 193). */
  isAdmin: boolean;
}

/** État du modal de tâche : création (préréglages) ou édition. */
type TaskModalState =
  | {
    mode: 'create';
    projectId?: string;
    assigneeIds?: string[];
    status?: TeamTaskStatus;
  }
  | { mode: 'edit'; task: TeamTask }
  | null;

const TeamProjectsTab = ({ orgId, members, currentUserId, isManager, isAdmin }: TeamProjectsTabProps) => {
  const { can, canAssign } = useMyOrgPermissions(orgId);
  const hints = usePermissionHints(orgId);
  const { t, tp } = useT('org');
  const { t: pf, tp: tpf } = useT('portfolio');
  const { t: ta } = useT('orgAdmin');
  const { prefs, updatePrefs } = useProjectsUiPrefs(orgId);
  // Création : LE formulaire unique de l'organisation (org-create.context).
  const create = useOrgCreate();
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  // Sélection de PROJETS du Portefeuille : distincte de la sélection de tâches.
  const [portfolioSelect, setPortfolioSelect] = useState(false);
  // Filtres : le MÊME état d'URL que l'onglet Tâches (task-filters.ts), mais
  // ils trient ici des PROJETS (project-filters.ts, répartition du 2026-09-27) :
  // personne, équipe, recherche, « En retard », « Cette semaine ».
  const { filters, setFilters } = useOrgTaskFilters('all');
  useRememberedTaskFilters(orgId, 'projects');
  const { team: teamFilter, q: query } = filters;

  const { data: allProjects = [], isLoading: loadingProjects } = useTeamProjects(orgId);
  const { data: templates = [] } = useTeamProjectTemplates(orgId);
  const { data: allTasks = [] } = useTeamTasks(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: categories = [] } = useTeamCategories(orgId);
  const { data: milestones = [] } = useTeamProjectMilestones(orgId);
  const { data: projectDeps = [] } = useTeamProjectDependencies(orgId);
  const { projectMembers, statsById, isLeadOf } = useProjectAccess(orgId, currentUserId); // mig. 190, 191

  const { collapsed, showArchived, timelineGroupBy, sort } = prefs;

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
    onOpenProject: openProject,
  });

  // L'équipe filtrée devient l'équipe par défaut du projet ; une équipe créée
  // d'ici devient le filtre : la créer pour ne pas la voir serait un geste à vide.
  const newProject = (templateId?: string) =>
    create.openProject({
      defaultTeamId: teamFilter && teamFilter !== 'org' ? teamFilter : '',
      templateId,
      onCreated: openProject,
    });
  const newTeam = () => create.openTeam({ onCreated: (team) => setFilters({ team }) });

  /** `project.edit` (mig. 153), responsable, ou co-pilote (mig. 190). */
  const canEditProjectFor = (p: TeamProject) =>
    can['project.edit'] || (!!currentUserId && p.ownerId === currentUserId) || isLeadOf(p);

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
  // Le Tableau (kanban) est passé dans l'onglet Tâches : une préférence
  // enregistrée « kanban » retombe sur la liste.
  const storedView = prefs.view === 'kanban' ? 'list' : prefs.view;
  const view = prefs.viewChosen ? storedView : manyProjects ? 'portfolio' : storedView;

  // ─── Recherche et tri (M2) : même ensemble pour cartes et portefeuille ─
  const shownProjects = useMemo(() => {
    const teamName = (id?: string | null) => teams.find((tm) => tm.id === id)?.name;
    const found = activeProjects.filter((p) => matchesProjectFilters(p, filters, allTasks) && matchesProjectSearch(p, query, {
      teamName: teamName(p.teamId),
      categoryName: categories.find((c) => c.id === p.categoryId)?.name,
      ownerName: members.find((m) => m.userId === p.ownerId)?.displayName,
    }));
    return sortProjects(found, sort, allTasks, statsById);
  }, [activeProjects, query, sort, allTasks, teams, categories, members, filters, statsById]);

  // ─── Tâches : celles des projets affichés, sans filtre propre ────────
  // Les filtres trient des projets : un projet retenu montre TOUTES ses tâches.
  const activeProjectIds = useMemo(() => new Set(activeProjects.map((p) => p.id)), [activeProjects]);
  const statsTasks = useMemo(
    () => allTasks.filter((t) => activeProjectIds.has(t.projectId)),
    [allTasks, activeProjectIds],
  );
  const shownProjectIds = useMemo(() => new Set(shownProjects.map((p) => p.id)), [shownProjects]);
  const visibleTasks = useMemo(
    () => statsTasks.filter((t) => shownProjectIds.has(t.projectId)),
    [statsTasks, shownProjectIds],
  );

  const totalEstimated = useMemo(
    () => sumEstimatedTime(statsTasks.filter((t) => !t.completed)),
    [statsTasks],
  );
  const tasksByProject = (projectId: string) => statsTasks.filter((t) => t.projectId === projectId);

  // ─── Sélection multiple + actions groupées (toutes vues) ───────────
  const {
    selectMode, setSelectMode, selectedIds, toggleSelect, bulkBarProps,
  } = useTeamTasksSelection({
    visibleTasks: projectParam ? allTasks.filter((t) => t.projectId === projectParam) : visibleTasks,
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

  // `?task=<id>` n'est plus lu ici : `OrgDeepLinkHost` l'ouvre depuis TOUTES
  // les sections (cohérence globale, 2026-09-25).

  const modalCreate = (input: CreateTeamTaskInput) => actions.createTaskAsync(input);
  const modalUpdate = (taskId: string, input: UpdateTeamTaskInput) =>
    actions.updateTaskAsync({ taskId, input });

  // Au-delà de 20 projets, les cartes s'ouvrent REPLIÉES (sauf décision).
  const isCollapsed = (projectId: string) => collapsed[projectId] ?? manyProjects;
  const toggleCollapse = (projectId: string) =>
    updatePrefs((prev) => ({ collapsed: { ...prev.collapsed, [projectId]: !(prev.collapsed[projectId] ?? manyProjects) } }));

  // ─── Groupement par équipe (vue liste, sans filtre équipe) ──────────
  const groupedSections = useMemo(() => {
    if (teamFilter || teams.length === 0) return null;
    const sections: { key: string; label: string | null; color?: string; projects: TeamProject[] }[] = [];
    for (const team of teams) {
      const ps = shownProjects.filter((p) => p.teamId === team.id);
      if (ps.length > 0) sections.push({ key: team.id, label: t('projects.teamSection', { name: team.name }), color: team.color, projects: ps });
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
      assigneeFiltered={false}
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
      {editProject && (
        <ProjectEditDialog
          project={editProject}
          members={members}
          canChangeOwner={can['project.edit']}
          onSubmit={(input) => actions.patchProject(editProject, input)}
          onClose={() => setEditProjectId(null)}
        />
      )}

      {selectMode && (
        <BulkActionsBar
          {...bulkBarProps}
          assignableMembers={members.filter((m) => canAssign(m.userId))}
          projects={activeProjects}
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
            tasks={allTasks.filter((t) => t.projectId === detailProject.id)}
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
            canManageAudience={can['project.edit']}
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

  // Ligne « Sélectionner / Trier » (maquette du 2026-09-27) : le tri n'a de
  // sens qu'en Liste et Portefeuille ; la sélection multiple vaut pour la
  // Liste et le Planning (des tâches y sont visibles), jamais le Portefeuille
  // (aucune tâche affichée).
  const showSort = (view === 'list' || view === 'portfolio') && activeProjects.length > 0;
  // Portefeuille : la pastille sélectionne des PROJETS (statut, responsable,
  // archivage, suppression), même place que dans les autres vues.
  const canBulkProjects = can['project.edit'] || can['project.delete'];
  const onStartSelect = view === 'portfolio'
    ? (canBulkProjects && shownProjects.length > 1 && !portfolioSelect ? () => setPortfolioSelect(true) : undefined)
    : visibleTasks.length > 0 && !selectMode
      ? () => setSelectMode(true)
      : undefined;

  return (
    <div className="space-y-4">
      {activeProjects.length > 0 && (
        <ProjectsPulse projectCount={activeProjects.length} totalEstimated={totalEstimated} />
      )}

      <OrgTaskFilterBar
        filters={filters}
        setFilters={setFilters}
        defaultStatus="all"
        members={members}
        teams={teams}
        currentUserId={currentUserId}
        searchPlaceholder={pf('searchPlaceholder')}
        searchAria={pf('searchAria')}
        entity="projects"
        onCreateTeam={can['team.create'] ? newTeam : undefined}
      />

      {/* Les cartes portent une progression (terminées / total) : elles ont
          besoin de TOUTES les tâches, donc de la lecture complète. Au-delà du
          plafond, elles se calculent sur un extrait, et l'écran le dit. */}
      {allTasks.length >= TEAM_TASKS_READ_LIMIT && <TruncatedDataNotice limit={TEAM_TASKS_READ_LIMIT} />}
      {/* Corbeille (M4) : ne s'affiche que s'il y a quelque chose à restaurer. */}
      <div className="flex justify-end"><TeamTrashDialog orgId={orgId} projects={allProjects} members={members} /></div>

      <ProjectsToolbar
        currentUserId={currentUserId}
        prefs={prefs}
        updatePrefs={updatePrefs}
        effectiveView={view}
        canCreateProject={can['project.create']}
        createDeniedReason={hints.deniedReason('project.create')}
        onNewProject={() => newProject()}
        onStartSelect={onStartSelect}
        sortControl={showSort ? (
          <ProjectsSearchBar sort={sort} onSortChange={(s) => updatePrefs({ sort: s })} />
        ) : undefined}
      />
      {view === 'list' && manyProjects && (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf('manyProjectsHint', { count: PORTFOLIO_CARD_THRESHOLD })}</p>
      )}

      <Suspense fallback={<ProjectsSkeleton />}>
      {activeProjects.length === 0 && archivedProjects.length === 0 ? (
        <OrgEmptyState
          Icon={FolderKanban}
          title={t('projects.empty')}
          body={can['project.create'] ? ta('ui.empty.projectsBody') : t('projects.managerMustCreate')}
          action={can['project.create'] ? (
            <button
              type="button"
              onClick={() => newProject()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] text-sm font-semibold"
            >
              <Plus size={15} aria-hidden="true" /> {t('projects.createProject')}
            </button>
          ) : undefined}
        />
      ) : view === 'timeline' ? (
        <TeamProjectsTimeline
          projects={shownProjects}
          tasks={visibleTasks}
          members={members}
          groupBy={timelineGroupBy}
          milestones={milestones}
          onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
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
                canBulkEdit={can['project.edit']}
                canBulkArchive={can['project.delete']}
                selectMode={portfolioSelect}
                onExitSelect={() => setPortfolioSelect(false)}
              />
            )
          ) : groupedSections ? (
            groupedSections.map((section) => (
              <div key={section.key} className="space-y-3">
                {section.label && (
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] px-1 pt-1">
                    {section.color && <TeamColorDot color={section.color} />}
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
            onUse={(templateId) => newProject(templateId)}
            onRemove={actions.archiveTemplate}
          />
        </>
      )}
      </Suspense>

      {overlays}
    </div>
  );
};

// Frontière du formulaire unique de création (org-create.context) : posée par
// chaque écran qui crée, pas par la page, dont le chunk a un cliquet.
const TeamProjectsTabWithCreate = (props: TeamProjectsTabProps) => (
  <OrgCreateBoundary orgId={props.orgId}>
    <TeamProjectsTab {...props} />
  </OrgCreateBoundary>
);

export default TeamProjectsTabWithCreate;
