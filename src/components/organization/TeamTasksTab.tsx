import { useMemo, useState } from 'react';
import { Search, X, ArrowUpDown, ChevronDown, Plus, Pencil, Trash2, MoreHorizontal, UserPlus, CalendarPlus, MessageSquare } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { subtreeOf, useOrgNotifications, useMyOrgPermissions, unreadCommentCountByTask, type OrgMember } from '@/modules/organizations';
import {
  useTeamProjects, useTeamTasks, useCreateTeamTask, useUpdateTeamTask, useDeleteTeamTask,
  useCreateTeamProject,
  type TeamTask, type TeamTaskStatus, type CreateTeamTaskInput, type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { showUndoToast } from '@/lib/undo-toast';
import { formatDeadlineSmart } from '@/components/task-table/helpers';
import {
  projectColor, isTaskOverdue, filterByStatus, formatDuration,
  STATUS_ORDER, STATUS_META, taskDisplayStatus, PROJECT_COLOR_NAMES,
  type TaskStatusFilter,
} from './team-projects.helpers';
import TeamTaskModal from './TeamTaskModal';
import AssignMembersDialog from './AssignMembersDialog';
import AssignEventDialog from './AssignEventDialog';
import MemberAvatar from './MemberAvatar';
import { useAuth } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';

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

type SortField = 'priority' | 'deadline' | 'name' | 'estimatedTime' | 'project';

/** Sans accents/casse — même normalisation que MemberDirectory. */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const chipBase =
  'shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 h-10 sm:h-auto sm:py-2 rounded-lg text-sm font-medium transition-all shadow-sm border';
const chipActive =
  'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))] shadow-md';
const chipInactive =
  'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))]';

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
 * Le popup « Filtres » (plage de priorité) de la page perso n'a pas
 * d'équivalent ici : la plage de priorité s'y règle par une préférence
 * globale (`usePriorityRange`) propre au module tasks personnel, qu'il
 * n'y avait pas de raison de dupliquer pour cinq priorités déjà triables
 * par simple clic d'en-tête.
 */
const TeamTasksTab = ({ orgId, members, currentUserId, isManager, isAdmin }: TeamTasksTabProps) => {
  const { can, canAssign } = useMyOrgPermissions(orgId);
  const { t, tp } = useT('org');
  const { user } = useAuth();
  const { data: allProjects = [] } = useTeamProjects(orgId);
  // `live` : c'est l'écran où l'on regarde la liste arriver (cf. useTeamTasks).
  const { data: tasks = [] } = useTeamTasks(orgId, undefined, { live: true });
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);
  const deleteTask = useDeleteTeamTask(orgId);
  const createProject = useCreateTeamProject(orgId);

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

  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('open');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [taskModal, setTaskModal] = useState<{ mode: 'create' | 'edit'; task?: TeamTask } | null>(null);
  // Actions dédiées du menu ⋯ (remplace « Marquer comme terminée », cf. photo1) :
  // cette table n'a ni colonne assignés ni raccourci agenda, contrairement à la
  // vue perso — ces deux items comblent le manque sans dupliquer le modal.
  const [assigningTask, setAssigningTask] = useState<TeamTask | null>(null);
  const [schedulingTask, setSchedulingTask] = useState<TeamTask | null>(null);
  // Chip « + Nouveau projet » de l'accès rapide — même pattern que la barre
  // de listes personnelle (TaskListsBar) : chip pointillée → formulaire
  // inline (couleur cyclique + nom), pas de modal séparée.
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLOR_NAMES[0]);

  // Compteur par projet (chips) : tâches OUVERTES uniquement — même
  // convention que les chips de listes personnelles, qui comptent le reste
  // à faire, pas le volume total.
  const openCountByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.completed) continue;
      map.set(task.projectId, (map.get(task.projectId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    let result = tasks.filter((task) => projectById.has(task.projectId));
    if (projectFilter) result = result.filter((task) => task.projectId === projectFilter);
    result = filterByStatus(result, statusFilter);
    const q = normalize(searchTerm.trim());
    if (q) result = result.filter((task) => normalize(task.name).includes(q));
    return result;
  }, [tasks, projectById, projectFilter, statusFilter, searchTerm]);

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

  // Suppression réversible (toast Annuler) — même pattern que TeamProjectsTab,
  // pas de confirm() bloquant pour un geste qu'on peut défaire dans les
  // secondes qui suivent.
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

  const hasActiveFilter = !!projectFilter || searchTerm.trim() !== '' || statusFilter !== 'open';

  return (
    <div className="space-y-4">
      {/* Accès rapide aux projets — équivalent entreprise de la barre de
          listes personnelle : les projets sont déjà l'unité de classement
          ici, inutile d'inventer un second système de regroupement. */}
      {projects.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            {t('projects.tasksTabQuickAccess')}
          </h2>
          <div className="flex sm:flex-wrap gap-3 overflow-x-auto sm:overflow-visible -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setProjectFilter(null)}
              className={`${chipBase} ${!projectFilter ? chipActive : chipInactive}`}
            >
              {t('projects.tasksTabAll')}
            </button>
            {projects.map((project) => {
              const color = projectColor(project.color);
              const active = projectFilter === project.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setProjectFilter(active ? null : project.id)}
                  className={`${chipBase} ${active ? chipActive : chipInactive}`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${active ? 'bg-white/80' : color.dot}`}
                    aria-hidden="true"
                  />
                  <span className="truncate max-w-[160px]">{project.name}</span>
                  <span className="text-xs opacity-70">{openCountByProject.get(project.id) ?? 0}</span>
                </button>
              );
            })}

            {!can['project.create'] ? null : !showCreateProject ? (
              <button
                type="button"
                onClick={() => setShowCreateProject(true)}
                className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 h-10 sm:h-auto sm:py-2 px-3.5 rounded-lg border-2 border-dashed border-[rgb(var(--color-border))] bg-transparent text-sm font-medium text-slate-500 dark:text-slate-400 hover:border-[rgb(var(--color-border-strong))] hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
              >
                <Plus size={16} aria-hidden="true" /> {t('projects.newProject')}
              </button>
            ) : (
              <form
                className="flex items-center gap-2 shrink-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newProjectName.trim();
                  if (!name) return;
                  createProject.mutate({ name, color: newProjectColor }, {
                    onSuccess: () => {
                      setNewProjectName('');
                      setNewProjectColor(PROJECT_COLOR_NAMES[0]);
                      setShowCreateProject(false);
                    },
                  });
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const idx = PROJECT_COLOR_NAMES.indexOf(newProjectColor);
                    setNewProjectColor(PROJECT_COLOR_NAMES[(idx + 1) % PROJECT_COLOR_NAMES.length]);
                  }}
                  className={`w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110 ${projectColor(newProjectColor).dot}`}
                  title={t('project.colorAria')}
                />
                <input
                  autoFocus
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder={t('project.namePlaceholder')}
                  className="px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 w-40"
                  style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setShowCreateProject(false); setNewProjectName(''); } }}
                />
                <button
                  type="submit"
                  disabled={!newProjectName.trim() || createProject.isPending}
                  className="px-3 py-1.5 text-sm rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-medium disabled:opacity-40 transition-all"
                >
                  {t('project.create')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateProject(false); setNewProjectName(''); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  aria-label={t('common.cancel')}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Recherche + tri + nouvelle tâche */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('projects.tasksTabSearchPlaceholder')}
            aria-label={t('projects.tasksTabSearchAria')}
            className="w-full pl-9 pr-9 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] transition-all shadow-sm text-sm"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label={t('projects.tasksTabClearSearch')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center hover:bg-[rgb(var(--color-hover))]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="relative w-44 shrink-0">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            aria-label={t('projects.tasksTabSortAria')}
            className="w-full appearance-none border rounded-lg pl-3 pr-16 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] transition-all cursor-pointer shadow-sm"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
          >
            <option value="priority">{t('projects.tasksTabSortPriority')}</option>
            <option value="deadline">{t('projects.tasksTabSortDeadline')}</option>
            <option value="name">{t('projects.tasksTabSortName')}</option>
            <option value="estimatedTime">{t('projects.tasksTabSortDuration')}</option>
            <option value="project">{t('projects.tasksTabSortProject')}</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-9 flex items-center" style={{ color: 'rgb(var(--color-text-muted))' }}>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            aria-label={sortDirection === 'asc' ? t('projects.tasksTabSortAsc') : t('projects.tasksTabSortDesc')}
            title={sortDirection === 'asc' ? t('projects.tasksTabSortAsc') : t('projects.tasksTabSortDesc')}
            className="absolute inset-y-0 right-1 my-auto z-10 flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[rgb(var(--color-hover))]"
            style={{ color: sortDirection === 'desc' ? 'rgb(var(--color-accent))' : 'rgb(var(--color-text-muted))' }}
          >
            <ArrowUpDown size={15} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setTaskModal({ mode: 'create' })}
          disabled={projects.length === 0 || !can['task.create']}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 disabled:hover:scale-100"
        >
          <Plus size={18} aria-hidden="true" />
          {t('projects.tasksTabNewTask')}
        </button>
      </div>

      {/* Filtres de statut — pastilles cliquables, même sémantique que les
          pastilles de synthèse de l'onglet Projets (filterByStatus). */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['open', 'overdue', 'doneThisWeek', 'all'] as TaskStatusFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              statusFilter === f
                ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
                : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))]'
            }`}
          >
            {f === 'open' ? t('projects.tasksTabFilterOpen')
              : f === 'overdue' ? t('projects.tasksTabFilterOverdue')
              : f === 'doneThisWeek' ? t('projects.tasksTabFilterDone')
              : t('projects.tasksTabFilterAll')}
          </button>
        ))}

        {hasActiveFilter && (
          <span className="text-xs text-[rgb(var(--color-text-muted))]">
            {tp('projects.tasksTabShown', sortedTasks.length, { total: tasks.length })}
          </span>
        )}
      </div>

      {/* Table */}
      {projects.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-10 text-center">
          {t('projects.tasksTabNoProject')}
        </p>
      ) : sortedTasks.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-10 text-center">
          {t('projects.tasksTabEmpty')}
        </p>
      ) : (
        <div className="table-container shadow-sm overflow-x-auto">
          <table className="data-table w-full" style={{ minWidth: '1050px' }}>
            <thead>
              <tr>
                <th className="px-2 py-3" style={{ width: '40px' }}><span className="sr-only">{t('projects.tasksTabColComplete')}</span></th>
                <th className="px-2 py-3" style={{ width: '48px' }}><span className="sr-only">{t('projects.tasksTabColProjectColor')}</span></th>
                <th className="cursor-pointer px-2 py-3" onClick={() => handleSort('name')}>
                  {t('projects.tasksTabColName')}{sortIndicator('name')}
                </th>
                <th className="px-2 py-3" style={{ width: '160px' }}>{t('projects.tasksTabColProject')}</th>
                <th className="px-2 py-3" style={{ width: '140px' }}>{t('projects.tasksTabColStatus')}</th>
                <th className="cursor-pointer text-center px-1 py-3" style={{ width: '70px' }} onClick={() => handleSort('priority')}>
                  {t('projects.tasksTabColPriority')}{sortIndicator('priority')}
                </th>
                <th className="cursor-pointer px-2 py-3" style={{ width: '110px' }} onClick={() => handleSort('deadline')}>
                  {t('projects.tasksTabColDeadline')}{sortIndicator('deadline')}
                </th>
                <th className="cursor-pointer text-center px-1 py-3" style={{ width: '80px' }} onClick={() => handleSort('estimatedTime')}>
                  {t('projects.tasksTabColDuration')}{sortIndicator('estimatedTime')}
                </th>
                <th className="text-center px-1 py-3" style={{ width: '70px' }}>{t('projects.tasksTabColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task) => {
                const project = projectById.get(task.projectId);
                const color = project ? projectColor(project.color) : projectColor('blue');
                const overdue = isTaskOverdue(task);
                return (
                  <tr
                    key={task.id}
                    className="transition-colors cursor-pointer hover:bg-[rgb(var(--color-hover))]"
                    onClick={() => setTaskModal({ mode: 'edit', task })}
                    style={{ borderLeft: overdue ? '4px solid rgb(var(--color-error))' : '3px solid transparent' }}
                  >
                    <td className="px-2 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleComplete(task)}
                        role="checkbox"
                        aria-checked={task.completed}
                        aria-label={task.completed ? t('projects.markIncomplete') : t('projects.markComplete')}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                          task.completed
                            ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))]'
                            : 'border-[rgb(var(--color-border-strong))] hover:border-[rgb(var(--color-accent))]'
                        }`}
                      >
                        {task.completed && (
                          <svg className="w-3 h-3 text-[rgb(var(--color-accent-solid-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex justify-center">
                        <span className={`w-4 h-4 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
                      </div>
                    </td>
                    <td className={`font-medium px-2 py-4 text-base ${task.completed ? 'line-through' : ''}`}
                        style={{ color: task.completed ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-text-primary))' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate" title={task.name}>{task.name}</span>
                        {/* Commentaires non lus (mig. 109) — disparaît dès que la tâche
                            est ouverte (useMarkTaskNotificationsRead, TeamTaskModal). */}
                        {(unreadCommentsByTask.get(task.id) ?? 0) > 0 && (
                          <span
                            className="inline-flex items-center gap-1 shrink-0 rounded-full bg-red-500 text-white text-caption font-bold px-1.5 py-0.5"
                            title={tp('common.unreadComments', unreadCommentsByTask.get(task.id) ?? 0)}
                          >
                            <MessageSquare size={10} aria-hidden="true" />
                            {unreadCommentsByTask.get(task.id)}
                          </span>
                        )}
                        {/* Collaborateurs (hors nous) — visibilité immédiate de qui est
                            dessus sans ouvrir la tâche. */}
                        {(() => {
                          const others = task.assigneeIds.filter((id) => id !== user?.id);
                          if (others.length === 0) return null;
                          return (
                            <span className="flex -space-x-1.5 shrink-0" title={others.map((id) => memberById.get(id)?.displayName).filter(Boolean).join(', ')}>
                              {others.slice(0, 3).map((id) => {
                                const m = memberById.get(id);
                                return m ? (
                                  <span key={id} className="rounded-full ring-2 ring-[rgb(var(--color-surface))]">
                                    <MemberAvatar avatar={m.avatar} name={m.displayName} size={22} />
                                  </span>
                                ) : null;
                              })}
                              {others.length > 3 && (
                                <span className="w-[22px] h-[22px] rounded-full bg-[rgb(var(--color-hover))] ring-2 ring-[rgb(var(--color-surface))] flex items-center justify-center text-caption font-bold text-[rgb(var(--color-text-muted))]">
                                  +{others.length - 3}
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2 text-sm truncate" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        {project?.name ?? '—'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} className="px-2 py-4 whitespace-nowrap">
                      {(() => {
                        const display = taskDisplayStatus(task);
                        return (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border transition-colors hover:bg-[rgb(var(--color-hover))]"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-secondary))' }}
                              aria-label={t('projects.tasksTabStatusAria', { name: task.name })}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${display.dot}`} aria-hidden="true" />
                              <span className="truncate max-w-[90px]">{t(display.labelKey as Parameters<typeof t>[0])}</span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {STATUS_ORDER.map((st) => (
                                <DropdownMenuItem key={st} onClick={() => setStatus(task, st)}>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_META[st].dot}`} aria-hidden="true" />
                                  {t(STATUS_META[st].labelKey as Parameters<typeof t>[0])}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })()}
                    </td>
                    <td className="text-center px-1 py-4 whitespace-nowrap">
                      <span className={`inline-flex justify-center items-center w-8 h-8 rounded-full task-priority-${task.priority} text-base font-bold`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-base font-medium">
                      {task.deadline
                        ? <span className={overdue ? 'text-red-500 font-semibold' : ''}>{formatDeadlineSmart(task.deadline)}</span>
                        : <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('projects.tasksTabNoDeadline')}</span>}
                    </td>
                    <td className="text-center px-1 py-4 whitespace-nowrap text-base font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {formatDuration(task.estimatedTime ?? 0)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()} className="px-2 py-4 whitespace-nowrap text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            aria-label={t('projects.tasksTabActionsAria', { name: task.name })}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[rgb(var(--color-hover))]"
                            style={{ color: 'rgb(var(--color-text-muted))' }}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setTaskModal({ mode: 'edit', task })}>
                            <Pencil aria-hidden="true" /> {t('projects.tasksTabEdit')}
                          </DropdownMenuItem>
                          {members.some((m) => canAssign(m.userId)) && (
                            <DropdownMenuItem onClick={() => setAssigningTask(task)}>
                              <UserPlus aria-hidden="true" /> {t('projects.tasksTabAssignAction')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setSchedulingTask(task)}>
                            <CalendarPlus aria-hidden="true" /> {t('projects.tasksTabScheduleAction')}
                          </DropdownMenuItem>
                          {(can['task.deleteAny'] || task.createdBy === currentUserId) && (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => removeWithUndo(task)}
                              className="!text-red-500 focus:!text-red-500"
                            >
                              <Trash2 className="!text-red-500" aria-hidden="true" /> {t('common.deleteAction')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

export default TeamTasksTab;
