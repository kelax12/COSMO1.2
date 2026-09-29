import { Suspense, useCallback, useMemo, useState } from 'react';
import { startOfDay, subDays } from 'date-fns';
import { subtreeOf, useOrgNotifications, useMyOrgPermissions, unreadCommentCountByTask, type OrgMember } from '@/modules/organizations';
import {
  useTeamProjects, useTeamTaskPages, TEAM_TASKS_READ_LIMIT, useCreateTeamTask, useUpdateTeamTask, useDeleteTeamTask, useRestoreTeamTask,
  useTaskIdsWithLabel, useTeamTaskDependencies,
  type TeamTask, type TeamTaskStatus, type CreateTeamTaskInput, type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { useTeamCategories, descendantIdSet, categoryPath, formatPath } from '@/modules/team-categories';
import { useOrgSettings, useProjectStatuses } from '@/modules/org-config';
import { showUndoToast } from '@/lib/undo-toast';
import { filterByStatus, useProjectsUiPrefs, STATUS_META, STATUS_ORDER, PRIORITY_META, priorityLabelOf } from './team-projects.helpers';
import TeamTaskModal from './TeamTaskModal';
import AssignMembersDialog from './AssignMembersDialog';
import AssignEventDialog from './AssignEventDialog';
import { TeamTasksSkeleton } from './OrgLoadingSkeletons';
import TeamTasksToolbar, { TeamTasksSelectRow } from './TeamTasksToolbar';
import TruncatedDataNotice from './TruncatedDataNotice';
import TeamTaskListsBar from './TeamTaskListsBar';
import { useTeamTaskLists } from './use-team-task-lists';
import OrgTaskFilterBar from './OrgTaskFilterBar';
import TeamTasksTable from './TeamTasksTable';
import TeamTasksViewControls from './TeamTasksViewControls';
import type { TeamTasksRowHandlers } from './TeamTasksTableRow';
import { usePermissionHints } from './permission-hints';
import { useTeamTasksBulk } from './use-team-tasks-bulk';
import { TeamTasksBulkLayer } from './team-tasks-bulk.lazy';
import { TeamProjectsKanban } from './team-projects.lazy';
import {
  useOrgTaskFilters, hasActiveTaskFilter, matchesScope, matchesAttributes, isGroupableSort,
  type TaskSortCriterion, type DeadlineBucket,
} from './task-filters';
import { useRememberedTaskFilters } from './remembered-task-filters';
import {
  readTaskColumns, writeTaskColumns, groupTasks, flattenGroups, UNASSIGNED_GROUP, type TaskColumnId,
} from './team-tasks-table.helpers';
import FilterPresets from './FilterPresets';
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
 * L'accès rapide porte les LISTES de l'organisation (mig. 203, 2026-09-28),
 * avec LA barre de la page personnelle (`TeamTaskListsBar`) ; il portait
 * auparavant les projets, qui restent filtrables par la barre de filtres.
 * Une différence structurelle, pas cosmétique :
 *   - la colonne « Catégorie » devient « Projet » — c'est la même position
 *     dans la ligne, mais la donnée qui la remplit n'est plus au même endroit
 *     du modèle (task.category → task.projectId).
 * Tri et regroupement du tableau ne font plus qu'un menu (2026-09-27) : le
 * critère choisi (`filters.group`, dans l'URL) trie TOUJOURS la liste, et les
 * cinq critères groupables y ajoutent une ligne d'en-tête. Le tableau
 * (`TeamTasksTable`) est virtualisé, ses colonnes se choisissent et
 * s'exportent.
 */
const TeamTasksTab = ({ orgId, members, currentUserId, isManager, isAdmin }: TeamTasksTabProps) => {
  const { can, canAssign } = useMyOrgPermissions(orgId);
  const hints = usePermissionHints(orgId);
  const { t, tp } = useT('org');
  const { t: tt } = useT('tasks');
  const { user } = useAuth();
  const { data: allProjects = [], isLoading: loadingProjects } = useTeamProjects(orgId);

  // Filtres : le MÊME état que l'onglet Projets, dans l'URL (task-filters.ts).
  const { filters, setFilters } = useOrgTaskFilters('open');
  useRememberedTaskFilters(orgId, 'tasks');
  const { project: projectFilter, status: statusFilter, q: searchTerm } = filters;
  const { data: taskDependencies = [] } = useTeamTaskDependencies(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const pf = useT('portfolio');
  const { data: categories = [] } = useTeamCategories(orgId);
  const { data: labelTaskIds } = useTaskIdsWithLabel(filters.label);
  // Réglages de l'entreprise (mig. 195) et statuts propres des projets (mig. 197).
  const { data: orgSettings } = useOrgSettings(orgId);
  const { data: projectStatuses = [] } = useProjectStatuses(orgId);
  const statusesByProject = useMemo(() => {
    const m = new Map<string, typeof projectStatuses>();
    for (const s of projectStatuses) m.set(s.projectId, [...(m.get(s.projectId) ?? []), s]);
    return m;
  }, [projectStatuses]);
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
  const lists = useTeamTaskLists({
    orgId, tasks, t: tt,
    setDeadline: (taskId, deadline) => updateTask.mutate({ taskId, input: { deadline } }),
  });
  const { filterByList } = lists;
  const manualLists = lists.lists.filter((l) => l.type !== 'smart');

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

  // Tri ET regroupement (UN critère, fusion du 2026-09-27) : `filters.group`,
  // dans l'URL. Seul le sens du tri reste un état local, comme avant.
  const sortField = filters.group;
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [taskModal, setTaskModal] = useState<{
    mode: 'create' | 'edit'; task?: TeamTask; assigneeIds?: string[]; status?: TeamTaskStatus; fromKanban?: boolean;
  } | null>(null);
  // Vue Table / Tableau (kanban venu de l'onglet Projets le 2026-09-27).
  const { prefs: uiPrefs, updatePrefs: updateUiPrefs } = useProjectsUiPrefs(orgId);
  const { tasksView, kanbanGroupBy } = uiPrefs;
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

  // Tâche « bloquée » : au moins une dépendance dont la cible n'est pas terminée
  // (même lecture que TeamTaskDependenciesSection). Calculé sur TOUTES les
  // tâches connues, pas seulement les visibles : une bloqueuse peut être filtrée
  // ailleurs (autre projet, autre statut) tout en bloquant encore celle-ci.
  const blockedTaskIds = useMemo(() => {
    if (taskDependencies.length === 0) return new Set<string>();
    const completedById = new Map(tasks.map((t) => [t.id, t.completed]));
    const ids = new Set<string>();
    for (const dep of taskDependencies) {
      // Seule une bloqueuse CHARGÉE et non terminée compte. La lecture ciblée
      // « ouvertes » ne charge pas les tâches terminées : traiter une bloqueuse
      // absente comme ouverte marquerait bloquée toute tâche déjà débloquée.
      if (completedById.get(dep.dependsOnId) === false) ids.add(dep.taskId);
    }
    return ids;
  }, [taskDependencies, tasks]);

  const visibleTasks = useMemo(() => {
    let result = tasks.filter((task) => projectById.has(task.projectId));
    if (projectFilter) result = result.filter((task) => task.projectId === projectFilter);
    result = filterByList(result);
    result = result.filter((task) => matchesScope(task, filters, (id) => projectById.get(id)?.teamId));
    result = filterByStatus(result, statusFilter);
    result = result.filter((task) => matchesAttributes(task, filters, { categoryIds, labelTaskIds }));
    if (filters.blocked) result = result.filter((task) => blockedTaskIds.has(task.id));
    const q = normalize(searchTerm.trim());
    if (q) result = result.filter((task) => normalize(task.name).includes(q));
    return result;
  }, [tasks, projectById, projectFilter, statusFilter, searchTerm, filters, categoryIds, labelTaskIds, blockedTaskIds, filterByList]);

  const sortedTasks = useMemo(() => {
    // Clé primaire = le critère choisi ; clé secondaire = l'échéance (l'ordre
    // À L'INTÉRIEUR d'un groupe), sauf si le critère EST déjà l'échéance, où
    // la priorité sert de départage — même logique qu'avant la fusion, qui
    // triait par priorité par défaut.
    const primary = (task: TeamTask): string | number => {
      switch (sortField) {
        case 'priority': return task.priority;
        case 'deadline': return task.deadline || '9999-99-99';
        case 'name': return normalize(task.name);
        case 'estimatedTime': return task.estimatedTime ?? 0;
        case 'project': return normalize(projectById.get(task.projectId)?.name ?? '');
        case 'assignee': return normalize(memberById.get(task.assigneeIds[0] ?? '')?.displayName ?? '');
        case 'status': return STATUS_ORDER.indexOf(task.status);
      }
    };
    const secondary = (task: TeamTask): string | number =>
      sortField === 'deadline' ? task.priority : (task.deadline || '9999-99-99');
    const sorted = [...visibleTasks].sort((a, b) => {
      const pa = primary(a);
      const pb = primary(b);
      if (pa < pb) return -1;
      if (pa > pb) return 1;
      const sa = secondary(a);
      const sb = secondary(b);
      if (sa < sb) return -1;
      if (sa > sb) return 1;
      return 0;
    });
    return sortDirection === 'asc' ? sorted : sorted.reverse();
  }, [visibleTasks, sortField, sortDirection, projectById, memberById]);

  const bulk = useTeamTasksBulk(orgId, sortedTasks);

  // Regroupement : l'ordre du tri vaut À L'INTÉRIEUR de chaque groupe.
  const grouped = isGroupableSort(filters.group);
  const lines = useMemo(() => {
    const nameOf = (key: string) =>
      filters.group === 'project' ? projectById.get(key)?.name ?? ''
        : filters.group === 'assignee' ? memberById.get(key)?.displayName ?? '' : key;
    return flattenGroups(groupTasks(sortedTasks, filters.group, nameOf), grouped, collapsedGroups);
  }, [sortedTasks, filters.group, grouped, projectById, memberById, collapsedGroups]);

  const deadlineGroupLabel: Record<DeadlineBucket, string> = {
    overdue: t('projects.deadlineGroupOverdue'),
    today: t('projects.deadlineGroupToday'),
    thisWeek: t('projects.deadlineGroupThisWeek'),
    later: t('projects.deadlineGroupLater'),
    noDue: t('projects.deadlineGroupNoDue'),
  };

  const groupLabel = (key: string): { label: string; dot?: string } => {
    switch (filters.group) {
      case 'project': return { label: projectById.get(key)?.name ?? '—' };
      case 'status': return { label: t(STATUS_META[key as TeamTaskStatus].labelKey as Parameters<typeof t>[0]), dot: STATUS_META[key as TeamTaskStatus].dot };
      case 'priority': return { label: priorityLabelOf(Number(key)), dot: PRIORITY_META[Number(key)]?.dot };
      case 'deadline': return { label: deadlineGroupLabel[key as DeadlineBucket] ?? key };
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

  const handleSort = (field: TaskSortCriterion) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setFilters({ group: field });
      setSortDirection('asc');
    }
  };

  const sortIndicator = (field: TaskSortCriterion) =>
    field === sortField ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

  // Priorité non choisie : celle que l'entreprise a réglée (mig. 195), pas P3 en dur.
  const handleCreate = (input: CreateTeamTaskInput) =>
    createTask.mutateAsync({ ...input, priority: input.priority ?? orgSettings?.defaultTaskPriority });

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
  const setCustomStatus = (task: TeamTask, customStatusId: string) =>
    updateTask.mutate({ taskId: task.id, input: { customStatusId } });
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
    setCustomStatus,
    setPriority,
    setDeadline,
    assign: canAssignSomeone ? setAssigningTask : undefined,
    schedule: setSchedulingTask,
    remove: removeWithUndo,
    toggleSelect: bulk.toggleSelect,
    lists: manualLists,
    toggleList: (task, listId, inList) =>
      inList ? lists.removeTaskFromList.mutate({ listId, taskId: task.id }) : lists.addTaskToList.mutate({ listId, taskId: task.id }),
    editReason: hints.taskEditReason,
    deleteReason: hints.taskDeleteReason,
  };

  return (
    <div className="space-y-4">
      <TeamTaskListsBar controller={lists} selection={bulk} />

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

      <TeamTasksToolbar
        sortField={sortField}
        onSortField={(group) => setFilters({ group })}
        sortDirection={sortDirection}
        onToggleSortDirection={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
        canCreate={projects.length > 0 && can['task.create']}
        createDeniedReason={projects.length === 0 ? t('projects.tasksTabNoProject') : hints.deniedReason('task.create')}
        onCreate={() => setTaskModal({ mode: 'create' })}
        viewControls={
          <TeamTasksViewControls
            columns={columns}
            onColumnsChange={setColumns}
            view={tasksView}
            onViewChange={(v) => updateUiPrefs({ tasksView: v })}
            kanbanGroupBy={kanbanGroupBy}
            onKanbanGroupByChange={(g) => updateUiPrefs({ kanbanGroupBy: g })}
          />
        }
      />

      <div className="-mt-2">
        <FilterPresets
          filters={filters} setFilters={setFilters} defaultStatus="open" currentUserId={currentUserId ?? user?.id}
          // « Sélectionner » sur la MÊME ligne que les préréglages, comme sur la page Tâches perso.
          selectMode={bulk.selectMode}
          onToggleSelect={sortedTasks.length > 0 || bulk.selectMode
            ? () => (bulk.selectMode ? bulk.exitSelectMode() : bulk.setSelectMode(true)) : undefined}
        />
      </div>

      <TeamTasksSelectRow
        // `!isLoading` : « 0 sur 0 affichées » est un chiffre, donc une
        // affirmation. Tant que rien n'est arrivé, on n'en fait aucune.
        shownLabel={hasActiveFilter && !isLoading
          ? tp('projects.tasksTabShown', sortedTasks.length, { total: tasks.length })
          : null}
      />

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
      ) : tasksView === 'kanban' ? (
        <Suspense fallback={<TeamTasksSkeleton label={t('projects.tasksTabLoading')} />}>
          <TeamProjectsKanban
            projects={projects}
            tasks={sortedTasks}
            members={members}
            onSetAssignees={setAssignees}
            onOpenTask={(task) => setTaskModal({ mode: 'edit', task })}
            canAssign={canAssign}
            // Le projet n'est jamais deviné : celui du filtre, sinon la fiche le demande.
            onAddToColumn={({ memberId, status }) =>
              setTaskModal({ mode: 'create', assigneeIds: memberId ? [memberId] : [], status, fromKanban: true })}
            groupBy={kanbanGroupBy}
            onSetStatus={setStatus}
            assigneeFilter={filters.assignee}
            selectable={bulk.selectMode}
            selectedIds={bulk.selectedIds}
            onToggleSelect={bulk.toggleSelect}
          />
        </Suspense>
      ) : (
        <TeamTasksTable
          lines={lines}
          columns={columns}
          projectById={projectById}
          memberById={memberById}
          categoryNameOf={categoryNameOf}
          statusesByProject={statusesByProject}
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
          defaultAssigneeIds={taskModal.assigneeIds}
          defaultStatus={taskModal.status}
          defaultListIds={manualLists.some((l) => l.id === lists.selectedListId) ? [lists.selectedListId as string] : undefined}
          requireProjectChoice={taskModal.mode === 'create' && !projectFilter && !!taskModal.fromKanban}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={removeWithUndo}
          onClose={() => setTaskModal(null)}
          isManager={isManager}
        />
      )}

      {/* Actions groupées : la même barre que Projets (cohérence globale). */}
      {/* Pendant « ajouter des tâches à une liste », la barre de la liste porte la validation. */}
      {bulk.selectMode && !lists.selectingTasksForListId && (
        <Suspense fallback={null}>
          <TeamTasksBulkLayer
            bulk={bulk} members={members} projects={projects} lists={manualLists}
            onAddToList={(listId, taskIds) => taskIds.forEach((taskId) => lists.addTaskToList.mutate({ listId, taskId }))}
          />
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
