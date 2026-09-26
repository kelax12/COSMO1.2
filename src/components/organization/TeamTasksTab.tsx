import { Suspense, useCallback, useMemo, useState } from 'react';
import { startOfDay, subDays } from 'date-fns';
import { subtreeOf, useOrgNotifications, useMyOrgPermissions, unreadCommentCountByTask, type OrgMember } from '@/modules/organizations';
import {
  useTeamProjects, useTeamTaskPages, TEAM_TASKS_READ_LIMIT, useCreateTeamTask, useUpdateTeamTask, useDeleteTeamTask, useRestoreTeamTask,
  useTaskIdsWithLabel,
  type TeamTask, type TeamTaskStatus, type CreateTeamTaskInput, type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { useTeamCategories, descendantIdSet, categoryPath, formatPath } from '@/modules/team-categories';
import { showUndoToast } from '@/lib/undo-toast';
import { filterByStatus, STATUS_META, PRIORITY_META, priorityLabelOf, taskDisplayStatus } from './team-projects.helpers';
import TeamTaskModal from './TeamTaskModal';
import AssignMembersDialog from './AssignMembersDialog';
import AssignEventDialog from './AssignEventDialog';
import { TeamTasksSkeleton } from './OrgLoadingSkeletons';
import TeamTasksToolbar, { type SortField } from './TeamTasksToolbar';
import TruncatedDataNotice from './TruncatedDataNotice';
import TeamTasksProjectChips from './TeamTasksProjectChips';
import OrgTaskFilterBar from './OrgTaskFilterBar';
import TaskAttributeFilters from './TaskAttributeFilters';
import TeamTasksTable from './TeamTasksTable';
import TeamTasksViewControls from './TeamTasksViewControls';
import type { TeamTasksRowHandlers } from './TeamTasksTableRow';
import { usePermissionHints } from './permission-hints';
import { useTeamTasksBulk } from './use-team-tasks-bulk';
import { TeamTasksBulkLayer } from './team-tasks-bulk.lazy';
import {
  useOrgTaskFilters, hasActiveTaskFilter, matchesScope, matchesAttributes, taskFiltersToViewParams, viewParamsToTaskFilters,
} from './task-filters';
import {
  readTaskColumns, writeTaskColumns, groupTasks, flattenGroups, buildTasksCsv, UNASSIGNED_GROUP, type TaskColumnId,
} from './team-tasks-table.helpers';
import SavedViewsMenu from './SavedViewsMenu';
import { useOrgTeams } from '@/modules/org-teams';
import { useAuth } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';
import { OrgCreateBoundary } from './org-create.context';

interface TeamTasksTabProps {
  orgId: string;
  members: OrgMember[];
  /** Utilisateur courant — distingue « ma tâche » (toujours supprimable). */
  currentUserId?: string;
  /** Manager/admin — surfaces HIÉRARCHIQUES uniquement (dépendances de tâches). */
  isManager: boolean;
  /** Admin : agenda de tout le monde consultable dans « Assigner l'événement » ; sinon soi + son sous-arbre. */
  isAdmin: boolean;
}

/** Sans accents/casse — même normalisation que MemberDirectory. */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Onglet « Tâches » de l'espace entreprise — entre Pyramide et Projets.
 *
 * Même langage visuel que la page Tâches personnelle (TasksPage + TaskTable) :
 * chips d'accès rapide, recherche + tri, filtres de statut, table triable.
 * Deux différences structurelles, pas cosmétiques :
 *   - les LISTES personnelles n'existent pas côté équipe ; les chips
 *     d'accès rapide portent donc les PROJETS (déjà l'unité de classement
 *     du mode entreprise), pas une liste custom à créer/renommer/partager ;
 *   - la colonne « Catégorie » devient « Projet » — c'est la même position
 *     dans la ligne, mais la donnée qui la remplit n'est plus au même endroit
 *     du modèle (task.category → task.projectId).
 * Priorité, plage d'échéance, catégorie et étiquette se filtrent sous la barre
 * commune (`TaskAttributeFilters`, audit du 2026-09-24), dans l'URL comme le
 * reste. Le tableau (`TeamTasksTable`) est virtualisé, ses colonnes se
 * choisissent, ses lignes se regroupent et s'exportent.
 */
const TeamTasksTab = ({ orgId, members, currentUserId, isManager, isAdmin }: TeamTasksTabProps) => {
  const { can, canAssign } = useMyOrgPermissions(orgId);
  const hints = usePermissionHints(orgId);
  const { t, tp } = useT('org');
  const { user } = useAuth();
  const { data: allProjects = [], isLoading: loadingProjects } = useTeamProjects(orgId);

  // Filtres : le MÊME état que l'onglet Projets, dans l'URL (task-filters.ts).
  const { filters, setFilters } = useOrgTaskFilters('open');
  const { project: projectFilter, status: statusFilter, q: searchTerm } = filters;
  const { data: teams = [] } = useOrgTeams(orgId);
  const pf = useT('portfolio');
  const { data: categories = [] } = useTeamCategories(orgId);
  const { data: labelTaskIds } = useTaskIdsWithLabel(filters.label);
  const categoryIds = useMemo(
    () => (filters.category ? descendantIdSet(filters.category, categories) : undefined),
    [filters.category, categories],
  );
  const categoryNameOf = useCallback(
    (id: string) => (categories.some((c) => c.id === id) ? formatPath(categoryPath(id, categories)) : undefined),
    [categories],
  );

  // Lecture ciblée (audit du 2026-09-24) : hors filtre « Toutes », l'écran n'a
  // besoin que des tâches OUVERTES et de celles terminées récemment (« terminées
  // cette semaine » lit 7 jours, on en prend 30 de marge). Le serveur trie donc
  // AVANT le plafond, et une vieille tâche encore ouverte ne sort plus de la
  // liste parce que l'organisation en a créé mille autres depuis. « Toutes »
  // reste la lecture complète, plafonnée, et le dit par un bandeau.
  const recentSince = useMemo(() => startOfDay(subDays(new Date(), 30)).toISOString(), []);
  // `live` : c'est l'écran où l'on regarde la liste arriver (cf. useTeamTasks).
  // Pages serveur (mig. 191) : au-delà de mille, « Charger plus » lit la page
  // suivante au lieu de laisser les tâches suivantes hors de portée.
  const {
    data: taskPages, isLoading: loadingTasks, hasNextPage, fetchNextPage, isFetchingNextPage,
  } = useTeamTaskPages(orgId, statusFilter === 'all' ? null : recentSince, { live: true });
  const tasks = useMemo(() => taskPages?.pages.flat() ?? [], [taskPages]);
  const isLoading = loadingProjects || loadingTasks;
  const truncated = !!hasNextPage;
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);
  // « Annuler » = sortir de la corbeille (mig. 152), à l'identique. L'ancien
  // « Annuler » recréait une tâche neuve avec sept champs.
  const restoreTask = useRestoreTeamTask(orgId);

  const projects = useMemo(() => allProjects.filter((p) => !p.archivedAt), [allProjects]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  // Badge « commentaires non lus » à côté du nom (mig. 109) — RLS ne renvoie
  // déjà que MES notifications (org_notifications_select), donc ce badge
  // n'apparaît que pour les tâches où je suis assigné et où quelqu'un
  // d'autre a commenté depuis ma dernière visite de la tâche.
  const { data: notifications = [] } = useOrgNotifications(orgId);
  const unreadCommentsByTask = useMemo(() => unreadCommentCountByTask(notifications), [notifications]);

  // Agendas consultables depuis « Assigner l'événement » : soi (toujours en
  // tête, RLS `events` autorise déjà son propre user_id) + le sous-arbre
  // managérial (RLS `events_manager_select`/`_insert`, mig. 077/081/084) —
  // admin : toute l'organisation. Même périmètre que `canSeeAgenda` dans
  // MemberSheet/MemberDirectory, calculé ici faute de pyramide à disposition.
  const agendaViewableMembers = useMemo(() => {
    if (!user) return [];
    const self = members.find((m) => m.userId === user.id);
    if (isAdmin) {
      const others = members.filter((m) => m.userId !== user.id);
      return self ? [self, ...others] : others;
    }
    const subtree = subtreeOf(members, user.id);
    const others = members.filter((m) => subtree.has(m.userId));
    return self ? [self, ...others] : others;
  }, [members, user, isAdmin]);

  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [taskModal, setTaskModal] = useState<{ mode: 'create' | 'edit'; task?: TeamTask } | null>(null);
  // Actions dédiées du menu ⋯ (remplace « Marquer comme terminée », cf. photo1) :
  // cette table n'a ni colonne assignés ni raccourci agenda, contrairement à la
  // vue perso — ces deux items comblent le manque sans dupliquer le modal.
  const [assigningTask, setAssigningTask] = useState<TeamTask | null>(null);
  const [schedulingTask, setSchedulingTask] = useState<TeamTask | null>(null);
  const [columns, setColumnsState] = useState<TaskColumnId[]>(() => readTaskColumns(orgId));
  const setColumns = (next: TaskColumnId[]) => {
    setColumnsState(next);
    writeTaskColumns(orgId, next);
  };
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());

  const visibleTasks = useMemo(() => {
    let result = tasks.filter((task) => projectById.has(task.projectId));
    if (projectFilter) result = result.filter((task) => task.projectId === projectFilter);
    result = result.filter((task) => matchesScope(task, filters, (id) => projectById.get(id)?.teamId));
    result = filterByStatus(result, statusFilter);
    result = result.filter((task) => matchesAttributes(task, filters, { categoryIds, labelTaskIds }));
    const q = normalize(searchTerm.trim());
    if (q) result = result.filter((task) => normalize(task.name).includes(q));
    return result;
  }, [tasks, projectById, projectFilter, statusFilter, searchTerm, filters, categoryIds, labelTaskIds]);

  const sortedTasks = useMemo(() => {
    const withValue = (task: TeamTask): string | number => {
      switch (sortField) {
        case 'priority': return task.priority;
        case 'deadline': return task.deadline || '9999-99-99';
        case 'name': return normalize(task.name);
        case 'estimatedTime': return task.estimatedTime ?? 0;
        case 'project': return normalize(projectById.get(task.projectId)?.name ?? '');
      }
    };
    const sorted = [...visibleTasks].sort((a, b) => {
      const va = withValue(a);
      const vb = withValue(b);
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    });
    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [visibleTasks, sortField, sortDirection, projectById]);

  const bulk = useTeamTasksBulk(orgId, sortedTasks);

  // Regroupement : l'ordre du tri vaut À L'INTÉRIEUR de chaque groupe.
  const lines = useMemo(() => {
    const nameOf = (key: string) =>
      filters.group === 'project' ? projectById.get(key)?.name ?? ''
        : filters.group === 'assignee' ? memberById.get(key)?.displayName ?? '' : key;
    return flattenGroups(groupTasks(sortedTasks, filters.group, nameOf), filters.group !== 'none', collapsedGroups);
  }, [sortedTasks, filters.group, projectById, memberById, collapsedGroups]);

  const groupLabel = (key: string): { label: string; dot?: string } => {
    switch (filters.group) {
      case 'project': return { label: projectById.get(key)?.name ?? '—' };
      case 'status': return { label: t(STATUS_META[key as TeamTaskStatus].labelKey as Parameters<typeof t>[0]), dot: STATUS_META[key as TeamTaskStatus].dot };
      case 'priority': return { label: priorityLabelOf(Number(key)), dot: PRIORITY_META[Number(key)]?.dot };
      case 'assignee':
        if (key === UNASSIGNED_GROUP) return { label: pf.t('taskTable.groupUnassigned') };
        return { label: key === (currentUserId ?? user?.id) ? pf.t('taskTable.you') : memberById.get(key)?.displayName ?? '—' };
      default: return { label: '' };
    }
  };
  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Export : les tâches AFFICHÉES, filtres et tri appliqués. Le module CSV est
  // chargé au clic, pas avec l'onglet.
  const exportCsv = async () => {
    const { downloadCSV } = await import('@/lib/csv-export');
    const h = pf.t;
    const { headers, rows } = buildTasksCsv(sortedTasks, {
      headers: {
        name: h('taskTable.exportHeaders.name'), project: h('taskTable.exportHeaders.project'),
        status: h('taskTable.exportHeaders.status'), priority: h('taskTable.exportHeaders.priority'),
        start: h('taskTable.exportHeaders.start'), deadline: h('taskTable.exportHeaders.deadline'),
        duration: h('taskTable.exportHeaders.duration'), assignees: h('taskTable.exportHeaders.assignees'),
        category: h('taskTable.exportHeaders.category'), createdAt: h('taskTable.exportHeaders.createdAt'),
      },
      statusOf: (task) => t(taskDisplayStatus(task).labelKey as Parameters<typeof t>[0]),
      projectOf: (id) => projectById.get(id)?.name ?? '',
      personOf: (id) => memberById.get(id)?.displayName ?? '',
      categoryOf: (id) => categoryNameOf(id) ?? '',
    });
    downloadCSV(pf.t('taskTable.exportFile'), headers, rows);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortIndicator = (field: SortField) =>
    field === sortField ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

  const handleCreate = (input: CreateTeamTaskInput) => createTask.mutateAsync(input);

  const handleUpdate = async (taskId: string, input: UpdateTeamTaskInput) => {
    await updateTask.mutateAsync({ taskId, input });
  };

  const toggleComplete = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: !task.completed } });

  const setStatus = (task: TeamTask, status: TeamTaskStatus) =>
    updateTask.mutate({ taskId: task.id, input: { status } });

  const setAssignees = (task: TeamTask, assigneeIds: string[]) =>
    updateTask.mutate({ taskId: task.id, input: { assigneeIds } });

  // Édition EN LIGNE (audit 2026-09-24) : priorité et échéance sans ouvrir la fiche.
  const setPriority = (task: TeamTask, priority: number) =>
    updateTask.mutate({ taskId: task.id, input: { priority } });
  const setDeadline = (task: TeamTask, deadline: string) =>
    updateTask.mutate({ taskId: task.id, input: { deadline } });

  // Suppression réversible (toast Annuler) — même pattern que TeamProjectsTab,
  // pas de confirm() bloquant pour un geste qu'on peut défaire dans les
  // secondes qui suivent.
  const removeWithUndo = (task: TeamTask) =>
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        showUndoToast(t('projects.taskDeleted'), () =>
          restoreTask.mutate(task.id),
        );
      },
    });

  const hasActiveFilter = hasActiveTaskFilter(filters, 'open');
  const canAssignSomeone = members.some((m) => canAssign(m.userId));

  const handlers: TeamTasksRowHandlers = {
    open: (task) => setTaskModal({ mode: 'edit', task }),
    toggleComplete,
    setStatus,
    setPriority,
    setDeadline,
    assign: canAssignSomeone ? setAssigningTask : undefined,
    schedule: setSchedulingTask,
    remove: removeWithUndo,
    toggleSelect: bulk.toggleSelect,
    editReason: hints.taskEditReason,
    deleteReason: hints.taskDeleteReason,
  };

  return (
    <div className="space-y-4">
      <TeamTasksProjectChips
        projects={projects}
        tasks={tasks}
        projectFilter={projectFilter}
        onProjectFilter={(project) => setFilters({ project })}
        canCreateProject={can['project.create']}
        createDeniedReason={hints.deniedReason('project.create')}
      />

      <OrgTaskFilterBar
        filters={filters}
        setFilters={setFilters}
        defaultStatus="open"
        members={members}
        teams={teams}
        projects={projects}
        currentUserId={currentUserId}
        searchPlaceholder={t('projects.tasksTabSearchPlaceholder')}
        searchAria={t('projects.tasksTabSearchAria')}
      />

      <TaskAttributeFilters orgId={orgId} filters={filters} setFilters={setFilters} />

      <TeamTasksToolbar
        sortField={sortField}
        onSortField={setSortField}
        sortDirection={sortDirection}
        onToggleSortDirection={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
        canCreate={projects.length > 0 && can['task.create']}
        createDeniedReason={projects.length === 0 ? t('projects.tasksTabNoProject') : hints.deniedReason('task.create')}
        onStartSelect={sortedTasks.length > 0 && !bulk.selectMode ? () => bulk.setSelectMode(true) : undefined}
        onCreate={() => setTaskModal({ mode: 'create' })}
        // `!isLoading` : « 0 sur 0 affichées » est un chiffre, donc une
        // affirmation. Tant que rien n'est arrivé, on n'en fait aucune.
        shownLabel={hasActiveFilter && !isLoading
          ? tp('projects.tasksTabShown', sortedTasks.length, { total: tasks.length })
          : null}
      />

      {/* Vues enregistrées (mig. 192) : les filtres de l'URL, nommés. */}
      <div className="flex justify-end items-center gap-1.5 flex-wrap -mt-2">
        <TeamTasksViewControls
          columns={columns}
          onColumnsChange={setColumns}
          group={filters.group}
          onGroupChange={(group) => setFilters({ group })}
          onExport={sortedTasks.length > 0 ? () => void exportCsv() : undefined}
        />
        <SavedViewsMenu
          orgId={orgId}
          scope="tasks"
          current={taskFiltersToViewParams(filters, 'open')}
          onApply={(params) => setFilters(viewParamsToTaskFilters(params, 'open'))}
        />
      </div>

      {!isLoading && truncated && (
        <div className="space-y-2">
          <TruncatedDataNotice limit={tasks.length} />
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full h-9 rounded-lg text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-60"
          >
            {isFetchingNextPage ? t('projects.loadingMoreTasks') : t('projects.loadMoreTasks', { count: TEAM_TASKS_READ_LIMIT })}
          </button>
        </div>
      )}

      {/* Table */}
      {/* Premier chargement d'abord : `projects.length === 0` est vrai tant que
          la requête n'a pas répondu, et l'écran conseillait alors de « créer un
          projet » à une organisation qui en a douze. */}
      {isLoading ? (
        <TeamTasksSkeleton label={t('projects.tasksTabLoading')} />
      ) : projects.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-10 text-center">
          {t('projects.tasksTabNoProject')}
        </p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-10 text-center">
          {t('projects.tasksTabEmpty')}
        </p>
      ) : (
        <TeamTasksTable
          lines={lines}
          columns={columns}
          projectById={projectById}
          memberById={memberById}
          categoryNameOf={categoryNameOf}
          currentUserId={currentUserId ?? user?.id}
          unreadCommentsByTask={unreadCommentsByTask}
          selectMode={bulk.selectMode}
          selectedIds={bulk.selectedIds}
          handlers={handlers}
          groupLabel={groupLabel}
          onToggleGroup={toggleGroup}
          sortIndicator={sortIndicator}
          onSort={handleSort}
        />
      )}

      {taskModal && (
        <TeamTaskModal
          isCreating={taskModal.mode === 'create'}
          task={taskModal.task}
          projects={projects}
          members={members}
          defaultProjectId={projectFilter ?? undefined}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={removeWithUndo}
          onClose={() => setTaskModal(null)}
          isManager={isManager}
        />
      )}

      {/* Actions groupées : la même barre que Projets (cohérence globale). */}
      {bulk.selectMode && (
        <Suspense fallback={null}>
          <TeamTasksBulkLayer bulk={bulk} members={members} projects={projects} />
        </Suspense>
      )}

      <AssignMembersDialog
        orgId={orgId}
        task={assigningTask}
        members={members}
        onSave={setAssignees}
        onClose={() => setAssigningTask(null)}
      />

      <AssignEventDialog
        task={schedulingTask}
        members={agendaViewableMembers}
        currentUserId={user?.id}
        onClose={() => setSchedulingTask(null)}
      />
    </div>
  );
};

// Frontière du formulaire unique de création (org-create.context) : posée par
// chaque écran qui crée, pas par la page, dont le chunk a un cliquet.
const TeamTasksTabWithCreate = (props: TeamTasksTabProps) => (
  <OrgCreateBoundary orgId={props.orgId}>
    <TeamTasksTab {...props} />
  </OrgCreateBoundary>
);

export default TeamTasksTabWithCreate;
