import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useTeamTasksSelection } from './use-team-tasks-selection';
import { Plus, FolderKanban, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import {
  useTeamProjects,
  useTeamTasks,
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
  ProjectEditDialog, BulkActionsBar, ProjectAddTaskPicker,
} from './team-projects.lazy';
import ProjectsToolbar, { NewProjectButton } from './ProjectsToolbar';
import OrgTaskFilterBar from './OrgTaskFilterBar';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { MobileFiltersButton, MobileFiltersSheet } from './MobileTeamTasks';
import { usePermissionHints } from './permission-hints';
import { useOrgTaskFilters } from './task-filters';
import { useRememberedTaskFilters } from './remembered-task-filters';
import TeamTaskModal from './TeamTaskModal';
import TruncatedDataNotice from './TruncatedDataNotice';
import TeamTrashDialog from './TeamTrashDialog';
import { useProjectAccess } from './use-project-access';
import { useT } from '@/i18n/useT';
import { OrgCreateBoundary, useOrgCreate } from './org-create.context';

interface TeamProjectsTabProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  /** Droit `task.editAny` : modifier les dépendances de tâches (mig. 229). */
  canEditDependencies: boolean;
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

/**
 * Page projet : `?project=<id>` (M2). L'adresse est celle qu'émettent déjà la
 * palette de commandes et le panneau de droite. Le paramètre RESTE dans l'URL :
 * c'est l'adresse de la page.
 */
function useProjectParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectParam = readEntityParam(searchParams, 'project');
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
  return { projectParam, openProject, closeProject };
}

/**
 * Projets visibles (filtre équipe + actifs/archivés), vue servie, recherche et
 * tri (M2, même ensemble pour cartes et portefeuille), et les tâches des
 * projets affichés : les filtres trient des projets, un projet retenu montre
 * TOUTES ses tâches.
 */
function useProjectsView(o: {
  allProjects: TeamProject[];
  allTasks: TeamTask[];
  teams: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  members: OrgMember[];
  filters: ReturnType<typeof useOrgTaskFilters>['filters'];
  prefs: ReturnType<typeof useProjectsUiPrefs>['prefs'];
  sortDesc: boolean;
  statsById: ReturnType<typeof useProjectAccess>['statsById'];
}) {
  const { allProjects, allTasks, teams, categories, members, filters, prefs, sortDesc, statsById } = o;
  const { team: teamFilter, q: query } = filters;
  const { sort } = prefs;
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

  const shownProjects = useMemo(() => {
    const teamName = (id?: string | null) => teams.find((tm) => tm.id === id)?.name;
    const found = activeProjects.filter((p) => matchesProjectFilters(p, filters, allTasks) && matchesProjectSearch(p, query, {
      teamName: teamName(p.teamId),
      categoryName: categories.find((c) => c.id === p.categoryId)?.name,
      ownerName: members.find((m) => m.userId === p.ownerId)?.displayName,
    }));
    const sorted = sortProjects(found, sort, allTasks, statsById);
    return sortDesc ? sorted.reverse() : sorted;
  }, [activeProjects, query, sort, sortDesc, allTasks, teams, categories, members, filters, statsById]);

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
  return { activeProjects, archivedProjects, manyProjects, view, shownProjects, statsTasks, visibleTasks, totalEstimated };
}

/**
 * Pastille « Sélectionner » : en Portefeuille elle sélectionne des PROJETS
 * (statut, responsable, archivage, suppression) ; ailleurs des tâches, s'il
 * y en a d'affichées.
 */
function projectsStartSelect(o: {
  view: string;
  canBulkProjects: boolean;
  shownProjectCount: number;
  portfolioSelect: boolean;
  visibleTaskCount: number;
  selectMode: boolean;
  startPortfolioSelect: () => void;
  startTaskSelect: () => void;
}): (() => void) | undefined {
  if (o.view === 'portfolio') {
    return o.canBulkProjects && o.shownProjectCount > 1 && !o.portfolioSelect ? o.startPortfolioSelect : undefined;
  }
  return o.visibleTaskCount > 0 && !o.selectMode ? o.startTaskSelect : undefined;
}

/** Ce que les surfaces de l'onglet partagent. */
interface ProjectsCtx {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  teams: NonNullable<ReturnType<typeof useOrgTeams>['data']>;
  allProjects: TeamProject[];
  allTasks: TeamTask[];
  can: ReturnType<typeof useMyOrgPermissions>['can'];
  actions: ReturnType<typeof useTeamProjectsActions>;
  canEditProjectFor: (p: TeamProject) => boolean;
  openProject: (projectId: string) => void;
  setTaskModal: (state: TaskModalState) => void;
  setEditProjectId: (id: string | null) => void;
  selection: Pick<ReturnType<typeof useTeamTasksSelection>, 'selectMode' | 'setSelectMode' | 'selectedIds' | 'toggleSelect'>;
}

/** Créer une tâche dans un projet, l'utilisateur courant assigné d'office. */
const createInProject = (ctx: ProjectsCtx, projectId: string): TaskModalState =>
  ({ mode: 'create', projectId, assigneeIds: ctx.currentUserId ? [ctx.currentUserId] : [] });

/** Surfaces communes (modales, barre groupée). */
function ProjectsOverlays({ ctx, activeProjects, editProjectId, addTaskProjectId, setAddTaskProjectId, taskModal, bulkBarProps, canAssign, canEditDependencies }: {
  ctx: ProjectsCtx;
  activeProjects: TeamProject[];
  editProjectId: string | null;
  addTaskProjectId: string | null;
  setAddTaskProjectId: (id: string | null) => void;
  taskModal: TaskModalState;
  bulkBarProps: ReturnType<typeof useTeamTasksSelection>['bulkBarProps'];
  canAssign: (userId: string) => boolean;
  canEditDependencies: boolean;
}) {
  const { orgId, members, allProjects, allTasks, can, actions, setTaskModal, setEditProjectId } = ctx;
  const editProject = editProjectId ? allProjects.find((p) => p.id === editProjectId) : undefined;
  const addTaskProject = addTaskProjectId ? allProjects.find((p) => p.id === addTaskProjectId) : undefined;
  const create = taskModal?.mode === 'create' ? taskModal : undefined;
  return (
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

      {addTaskProject && (
        <ProjectAddTaskPicker
          project={addTaskProject}
          tasks={allTasks}
          projects={allProjects}
          onPick={(task) => { actions.updateTaskInput(task, { projectId: addTaskProject.id }); setAddTaskProjectId(null); }}
          onCreate={() => {
            setTaskModal(createInProject(ctx, addTaskProject.id));
            setAddTaskProjectId(null);
          }}
          onClose={() => setAddTaskProjectId(null)}
        />
      )}

      {ctx.selection.selectMode && (
        <BulkActionsBar
          {...bulkBarProps}
          assignableMembers={members.filter((m) => canAssign(m.userId))}
          projects={activeProjects}
          listsOrgId={orgId}
          selectedTaskIds={[...ctx.selection.selectedIds]}
        />
      )}

      {taskModal && (
        <TeamTaskModal
          task={taskModal.mode === 'edit' ? taskModal.task : undefined}
          isCreating={taskModal.mode === 'create'}
          projects={activeProjects.length > 0 ? activeProjects : allProjects}
          members={members}
          defaultProjectId={create?.projectId}
          defaultAssigneeIds={create?.assigneeIds}
          defaultStatus={create?.status}
          onCreate={(input: CreateTeamTaskInput) => actions.createTaskAsync(input)}
          onUpdate={(taskId: string, input: UpdateTeamTaskInput) => actions.updateTaskAsync({ taskId, input })}
          onDelete={actions.removeWithUndo}
          canEditDependencies={canEditDependencies}
          onClose={() => setTaskModal(null)}
        />
      )}
    </Suspense>
  );
}

/** Page d'un projet (`?project=<id>`), ou « introuvable » avec un retour. */
function ProjectDetailRoute({ ctx, projectParam, closeProject, statsById, projectMembers, projectDeps, categories, isAdmin, overlays }: {
  ctx: ProjectsCtx;
  projectParam: string;
  closeProject: () => void;
  statsById: ReturnType<typeof useProjectAccess>['statsById'];
  projectMembers: ReturnType<typeof useProjectAccess>['projectMembers'];
  projectDeps: NonNullable<ReturnType<typeof useTeamProjectDependencies>['data']>;
  categories: { id: string; name: string }[];
  isAdmin: boolean;
  overlays: ReactNode;
}) {
  const { t: pf } = useT('portfolio');
  const { allProjects, allTasks, can, actions, selection } = ctx;
  const detailProject = allProjects.find((p) => p.id === projectParam);
  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      {detailProject ? (
        <ProjectDetailPage
          project={detailProject}
          tasks={allTasks.filter((t) => t.projectId === detailProject.id)}
          allProjectTasks={allTasks.filter((t) => t.projectId === detailProject.id)}
          stats={statsById?.get(detailProject.id)}
          projectMembers={projectMembers.filter((m) => m.projectId === detailProject.id)}
          currentUserId={ctx.currentUserId}
          isAdmin={isAdmin}
          canCreateTask={can['task.create']}
          members={ctx.members}
          teams={ctx.teams}
          dependencies={projectDeps}
          projects={allProjects}
          categoryName={categories.find((c) => c.id === detailProject.categoryId)?.name}
          canEdit={ctx.canEditProjectFor(detailProject)}
          canArchive={can['project.delete']}
          canManageAudience={can['project.edit']}
          canCreateProject={can['project.create']}
          onBack={closeProject}
          onOpenProject={ctx.openProject}
          onEdit={() => ctx.setEditProjectId(detailProject.id)}
          onDuplicate={() => actions.duplicateProject(detailProject)}
          onSaveTemplate={() => actions.saveAsTemplate(detailProject)}
          onArchive={() => actions.archiveWithUndo(detailProject)}
          onRestore={() => actions.restoreProject(detailProject)}
          onAddTask={() => ctx.setTaskModal(createInProject(ctx, detailProject.id))}
          onStartSelect={() => selection.setSelectMode(true)}
          onToggleComplete={actions.toggleComplete}
          onReassign={actions.setAssignees}
          onDelete={actions.removeWithUndo}
          onOpenTask={(task) => ctx.setTaskModal({ mode: 'edit', task })}
          selectable={selection.selectMode}
          selectedIds={selection.selectedIds}
          onToggleSelect={selection.toggleSelect}
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

/**
 * Recherche et vues, collées : deux lignes d'une même barre. Mobile (242,
 * 250) : périmètre, vues nommées, préréglages et tri dans une feuille.
 */
function ProjectsFilterArea({ ctx, filters, setFilters, toolbar, onCreateTeam, createDeniedReason, onNewProject }: {
  ctx: ProjectsCtx;
  filters: ReturnType<typeof useOrgTaskFilters>['filters'];
  setFilters: ReturnType<typeof useOrgTaskFilters>['setFilters'];
  toolbar: ReactNode;
  onCreateTeam?: () => void;
  createDeniedReason?: string;
  onNewProject: () => void;
}) {
  const { t: pf } = useT('portfolio');
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <div className="space-y-2">
    <OrgTaskFilterBar
      filters={filters}
      setFilters={setFilters}
      defaultStatus="all"
      members={ctx.members}
      teams={ctx.teams}
      currentUserId={ctx.currentUserId}
      searchPlaceholder={pf('searchPlaceholder')}
      searchAria={pf('searchAria')}
      entity="projects"
      onCreateTeam={onCreateTeam}
      scopeSlot={isMobile ? (scope) => (
        <MobileFiltersSheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          {scope}
          {toolbar}
        </MobileFiltersSheet>
      ) : undefined}
      trailing={(
        <>
          {isMobile && <MobileFiltersButton activeCount={0} onOpenChange={setFiltersOpen} />}
          {/* Corbeille (M4) : ne s'affiche que s'il y a quelque chose à restaurer. */}
          <TeamTrashDialog orgId={ctx.orgId} projects={ctx.allProjects} members={ctx.members} />
          <NewProjectButton
            canCreateProject={ctx.can['project.create']}
            createDeniedReason={createDeniedReason}
            onNewProject={onNewProject}
            guideId="projects-new"
          />
        </>
      )}
    />

    {/* Les cartes portent une progression (terminées / total) : elles ont
        besoin de TOUTES les tâches, donc de la lecture complète. Au-delà du
        plafond, elles se calculent sur un extrait, et l'écran le dit. */}
    {ctx.allTasks.length >= TEAM_TASKS_READ_LIMIT && <TruncatedDataNotice limit={TEAM_TASKS_READ_LIMIT} />}

    {!isMobile && toolbar}
    </div>
  );
}

/** Liste des projets : vide, planning, portefeuille ou cartes, puis les archivés. */
function ProjectsContent({ ctx, projectsView, query, prefs, updatePrefs, timelineGroupBy, statsById, projectDeps, portfolioSelect, setPortfolioSelect, onNewProject, renderProjectCard }: {
  ctx: ProjectsCtx;
  projectsView: ReturnType<typeof useProjectsView>;
  query: string;
  prefs: ReturnType<typeof useProjectsUiPrefs>['prefs'];
  updatePrefs: ReturnType<typeof useProjectsUiPrefs>['updatePrefs'];
  timelineGroupBy: ReturnType<typeof useProjectsUiPrefs>['prefs']['timelineGroupBy'];
  statsById: ReturnType<typeof useProjectAccess>['statsById'];
  projectDeps: NonNullable<ReturnType<typeof useTeamProjectDependencies>['data']>;
  portfolioSelect: boolean;
  setPortfolioSelect: (v: boolean) => void;
  onNewProject: () => void;
  renderProjectCard: (project: TeamProject) => ReactNode;
}) {
  const { t } = useT('org');
  const { t: pf } = useT('portfolio');
  const { t: ta } = useT('orgAdmin');
  const { can, actions, selection } = ctx;
  const { activeProjects, archivedProjects, view, shownProjects, visibleTasks } = projectsView;
  const { showArchived } = prefs;
  if (activeProjects.length === 0 && archivedProjects.length === 0) {
    return (
      <OrgEmptyState
        Icon={FolderKanban}
        title={t('projects.empty')}
        body={can['project.create'] ? ta('ui.empty.projectsBody') : t('projects.managerMustCreate')}
        action={can['project.create'] ? (
          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] text-sm font-semibold"
          >
            <Plus size={15} aria-hidden="true" /> {t('projects.createProject')}
          </button>
        ) : undefined}
      />
    );
  }
  if (view === 'timeline') {
    return (
      <TeamProjectsTimeline
        projects={shownProjects}
        tasks={visibleTasks}
        members={ctx.members}
        groupBy={timelineGroupBy}
        onOpenTask={(task) => ctx.setTaskModal({ mode: 'edit', task })}
        onOpenProject={ctx.openProject}
        selectable={selection.selectMode}
        selectedIds={selection.selectedIds}
        onToggleSelect={selection.toggleSelect}
      />
    );
  }
  return (
    <>
      {query && shownProjects.length === 0 && (
        <p className="py-8 text-center text-sm text-[rgb(var(--color-text-muted))]">{pf('noResult', { query })}</p>
      )}
      <div data-guide-id="projects-list" className="space-y-3">
      {view === 'portfolio' ? (
        shownProjects.length > 0 && (
          <ProjectPortfolioView
            projects={shownProjects}
            tasks={ctx.allTasks}
            statsById={statsById}
            members={ctx.members}
            teams={ctx.teams}
            dependencies={projectDeps}
            allProjects={ctx.allProjects}
            onOpenProject={ctx.openProject}
            rowActions={{
              canEdit: ctx.canEditProjectFor,
              canCreate: can['project.create'],
              canArchive: can['project.delete'],
              onEdit: (p) => ctx.setEditProjectId(p.id),
              onDuplicate: (p) => actions.duplicateProject(p),
              onSaveTemplate: (p) => actions.saveAsTemplate(p),
              onArchive: (p) => actions.archiveWithUndo(p),
              onRestore: (p) => void actions.patchProject(p, { archived: false }),
            }}
            canBulkEdit={can['project.edit']}
            canBulkArchive={can['project.delete']}
            selectMode={portfolioSelect}
            onExitSelect={() => setPortfolioSelect(false)}
          />
        )
      ) : (
        shownProjects.map(renderProjectCard)
      )}
      </div>

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
  );
}

const TeamProjectsTab = ({ orgId, members, currentUserId, canEditDependencies, isAdmin }: TeamProjectsTabProps) => {
  const { can, canAssign } = useMyOrgPermissions(orgId);
  const hints = usePermissionHints(orgId);
  const { tp } = useT('org');
  const { t: pf, tp: tpf } = useT('portfolio');
  const { prefs, updatePrefs } = useProjectsUiPrefs(orgId);
  // Création : LE formulaire unique de l'organisation (org-create.context).
  const create = useOrgCreate();
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<TaskModalState>(null);
  // « Ajouter une tâche… » d'une carte : sélecteur d'abord, création en option.
  const [addTaskProjectId, setAddTaskProjectId] = useState<string | null>(null);
  // Sélection de PROJETS du Portefeuille : distincte de la sélection de tâches.
  const [portfolioSelect, setPortfolioSelect] = useState(false);
  // Filtres : le MÊME état d'URL que l'onglet Tâches (task-filters.ts), mais
  // ils trient ici des PROJETS (project-filters.ts, répartition) :
  // personne, équipe, recherche, « En retard », « Cette semaine ».
  const { filters, setFilters } = useOrgTaskFilters('all');
  useRememberedTaskFilters(orgId, 'projects');
  const { team: teamFilter, q: query } = filters;

  const { data: allProjects = [], isLoading: loadingProjects } = useTeamProjects(orgId);
  const { data: allTasks = [] } = useTeamTasks(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: categories = [] } = useTeamCategories(orgId);
  const { data: projectDeps = [] } = useTeamProjectDependencies(orgId);
  const { projectMembers, statsById, isLeadOf } = useProjectAccess(orgId, currentUserId); // mig. 190, 191

  const { collapsed, timelineGroupBy, sort } = prefs;
  // Sens du tri : les flèches à côté du critère l'inversent.
  const [sortDesc, setSortDesc] = useState(false);

  const { projectParam, openProject, closeProject } = useProjectParam();

  const actions = useTeamProjectsActions({
    orgId,
    currentUserId,
    allTasks,
    onOpenProject: openProject,
  });

  // L'équipe filtrée devient l'équipe par défaut du projet ; une équipe créée
  // d'ici devient le filtre : la créer pour ne pas la voir serait un geste à vide.
  const newProject = () =>
    create.openProject({
      defaultTeamId: teamFilter && teamFilter !== 'org' ? teamFilter : '',
      onCreated: openProject,
    });
  const newTeam = () => create.openTeam({ onCreated: (team) => setFilters({ team }) });

  /** `project.edit` (mig. 153), responsable, ou co-pilote (mig. 190). */
  const canEditProjectFor = (p: TeamProject) =>
    can['project.edit'] || (!!currentUserId && p.ownerId === currentUserId) || isLeadOf(p);

  const projectsView = useProjectsView({ allProjects, allTasks, teams, categories, members, filters, prefs, sortDesc, statsById });
  const { activeProjects, manyProjects, view, shownProjects, statsTasks, visibleTasks, totalEstimated } = projectsView;
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
  // les sections (cohérence globale).

  // Au-delà de 20 projets, les cartes s'ouvrent REPLIÉES (sauf décision).
  const isCollapsed = (projectId: string) => collapsed[projectId] ?? manyProjects;
  const toggleCollapse = (projectId: string) =>
    updatePrefs((prev) => ({ collapsed: { ...prev.collapsed, [projectId]: !(prev.collapsed[projectId] ?? manyProjects) } }));

  if (loadingProjects) return <ProjectsSkeleton />;

  const ctx: ProjectsCtx = {
    orgId, members, currentUserId, teams, allProjects, allTasks, can, actions, canEditProjectFor, openProject,
    setTaskModal, setEditProjectId, selection: { selectMode, setSelectMode, selectedIds, toggleSelect },
  };

  const renderProjectCard = (project: TeamProject) => (
    <TeamProjectCard
      key={project.id}
      project={project}
      tasks={tasksByProject(project.id)}
      members={members}
      teams={teams}
      canEditProject={canEditProjectFor(project)}
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
      onAddTask={(projectId) => setAddTaskProjectId(projectId)}
      onToggleComplete={actions.toggleComplete}
      onReassign={actions.setAssignees}
      onDelete={actions.removeWithUndo}
      onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
      onUpdateProject={(input) => void actions.patchProject(project, input)}
    />
  );

  const overlays = (
    <ProjectsOverlays
      ctx={ctx}
      activeProjects={activeProjects}
      editProjectId={editProjectId}
      addTaskProjectId={addTaskProjectId}
      setAddTaskProjectId={setAddTaskProjectId}
      taskModal={taskModal}
      bulkBarProps={bulkBarProps}
      canAssign={canAssign}
      canEditDependencies={canEditDependencies}
    />
  );

  if (projectParam) {
    return (
      <ProjectDetailRoute
        ctx={ctx}
        projectParam={projectParam}
        closeProject={closeProject}
        statsById={statsById}
        projectMembers={projectMembers}
        projectDeps={projectDeps}
        categories={categories}
        isAdmin={isAdmin}
        overlays={overlays}
      />
    );
  }

  // Ligne « Sélectionner / Trier » (maquette) : le tri n'a de
  // sens qu'en Liste et Portefeuille ; la sélection multiple vaut pour la
  // Liste et le Planning (des tâches y sont visibles), jamais le Portefeuille
  // (aucune tâche affichée).
  const showSort = (view === 'list' || view === 'portfolio') && activeProjects.length > 0;
  const onStartSelect = projectsStartSelect({
    view,
    canBulkProjects: can['project.edit'] || can['project.delete'],
    shownProjectCount: shownProjects.length,
    portfolioSelect,
    visibleTaskCount: visibleTasks.length,
    selectMode,
    startPortfolioSelect: () => setPortfolioSelect(true),
    startTaskSelect: () => setSelectMode(true),
  });

  const toolbar = (
    <ProjectsToolbar
      currentUserId={currentUserId}
      prefs={prefs}
      updatePrefs={updatePrefs}
      effectiveView={view}
      onStartSelect={onStartSelect}
      sortControl={showSort ? (
        <ProjectsSearchBar sort={sort} onSortChange={(s) => updatePrefs({ sort: s })} sortDesc={sortDesc} onToggleSortDirection={() => setSortDesc((d) => !d)} />
      ) : undefined}
    />
  );

  return (
    <div className="space-y-4">
      {activeProjects.length > 0 && (
        <ProjectsPulse projectCount={activeProjects.length} totalEstimated={totalEstimated} />
      )}

      <ProjectsFilterArea
        ctx={ctx}
        filters={filters}
        setFilters={setFilters}
        toolbar={toolbar}
        onCreateTeam={can['team.create'] ? newTeam : undefined}
        createDeniedReason={hints.deniedReason('project.create')}
        onNewProject={() => newProject()}
      />
      {view === 'list' && manyProjects && (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf('manyProjectsHint', { count: PORTFOLIO_CARD_THRESHOLD })}</p>
      )}

      <Suspense fallback={<ProjectsSkeleton />}>
        <ProjectsContent
          ctx={ctx}
          projectsView={projectsView}
          query={query}
          prefs={prefs}
          updatePrefs={updatePrefs}
          timelineGroupBy={timelineGroupBy}
          statsById={statsById}
          projectDeps={projectDeps}
          portfolioSelect={portfolioSelect}
          setPortfolioSelect={setPortfolioSelect}
          onNewProject={() => newProject()}
          renderProjectCard={renderProjectCard}
        />
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
