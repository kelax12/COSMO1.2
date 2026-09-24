import { useMemo, useState } from 'react';
import {
  Plus, ChevronDown, ChevronRight, UsersRound, MoreHorizontal,
  Pencil, Archive, ArchiveRestore, Clock, ListChecks, Tag,
  ExternalLink, Settings2, Copy, LayoutTemplate, CalendarRange,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { getColorHex } from '@/lib/category-colors';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import type { TeamProject, TeamTask, UpdateTeamProjectInput } from '@/modules/team-projects';
import {
  projectColor,
  sortOpenTasks, sortCompletedTasks, isTaskOverdue,
  sumEstimatedTime, formatDuration,
} from './team-projects.helpers';
import { PROJECT_STATUS_META, isProjectLate } from './portfolio.helpers';
import MemberAvatar from './MemberAvatar';
import TeamTaskRow from './TeamTaskRow';
import ConfirmProjectAudienceDialog from './ConfirmProjectAudienceDialog';
import { useTeamCategories } from '@/modules/team-categories';
import { useT } from '@/i18n/useT';

interface TeamProjectCardProps {
  project: TeamProject;
  /** Tâches du projet (déjà filtrées par assigné le cas échéant). */
  tasks: TeamTask[];
  members: OrgMember[];
  teams: OrgTeam[];
  /**
   * Renommer, décrire, planifier, recolorer, catégoriser : `project.edit`
   * (mig. 153) OU responsable du projet. Jusque-là, c'était `project.create`,
   * dont le nom ne disait pas l'action.
   */
  canEditProject: boolean;
  /**
   * Changer l'ÉQUIPE (donc l'audience, M5) : `project.edit` seul. Le
   * responsable pilote son projet sans pouvoir l'ouvrir à d'autres (trigger
   * `enforce_team_project_edit_scope`).
   */
  canChangeTeam: boolean;
  /** Dupliquer / enregistrer comme modèle CRÉENT un projet : `project.create`. */
  canCreateProject: boolean;
  /** Ouvre la page du projet (`?project=<id>`). */
  onOpenProject: () => void;
  onEditProject: () => void;
  onDuplicate: () => void;
  onSaveTemplate: () => void;
  /** Archive avec « Annuler » : c'est le parent qui montre le toast. */
  onArchive: () => void;
  /** Archiver ou restaurer (`project.delete` — l'archivage EST la suppression ici). */
  canArchiveProject: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** True quand un filtre assigné est actif (adapte l'empty state). */
  assigneeFiltered: boolean;
  /** Ouvre le modal de création (projet présélectionné). */
  onAddTask: (projectId: string) => void;
  onToggleComplete: (task: TeamTask) => void;
  onReassign: (task: TeamTask, assigneeIds: string[]) => void;
  onDelete: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
  onUpdateProject: (input: UpdateTeamProjectInput) => void;
  /** Entre en mode sélection multiple depuis le menu du projet. */
  onStartSelect?: () => void;
  /** Mode sélection multiple (actions groupées). */
  selectable?: boolean;
  /** Ids des tâches sélectionnées. */
  selectedIds?: Set<string>;
  onToggleSelect?: (task: TeamTask) => void;
}

/** Carte d'un projet : header (couleur, progression, contributeurs, retard, menu) + tâches triées. */
const TeamProjectCard = ({
  project, tasks, members, teams, canEditProject, canArchiveProject,
  canChangeTeam, canCreateProject, onOpenProject, onEditProject, onDuplicate, onSaveTemplate, onArchive,
  collapsed, onToggleCollapse, assigneeFiltered,
  onAddTask, onToggleComplete, onReassign, onDelete, onOpenTask,
  onUpdateProject, onStartSelect,
  selectable = false, selectedIds, onToggleSelect,
}: TeamProjectCardProps) => {
  const { t, tp } = useT('org');
  const [renaming, setRenaming] = useState(false);
  // M5 : un changement d'équipe change QUI LIT le projet. Il passe par une
  // confirmation qui nomme la nouvelle audience, jamais par un clic sec.
  // `undefined` = rien en attente ; `null` = vers toute l'organisation.
  const [pendingTeamId, setPendingTeamId] = useState<string | null | undefined>(undefined);
  const requestTeamChange = (teamId: string | null) => {
    if (teamId === (project.teamId ?? null)) return;
    setPendingTeamId(teamId);
  };
  const [renameValue, setRenameValue] = useState(project.name);
  const [showCompleted, setShowCompleted] = useState(false);
  const { data: categories = [] } = useTeamCategories(project.orgId);

  const color = projectColor(project.color);
  const teamName = teams.find((t) => t.id === project.teamId)?.name;
  const category = categories.find((c) => c.id === project.categoryId);
  const archived = !!project.archivedAt;
  const status = project.status ?? 'active';
  const owner = project.ownerId ? members.find((m) => m.userId === project.ownerId) : undefined;
  const late = isProjectLate(project);
  const shortDate = (d: string) => format(parseISO(d), 'd MMM', { locale: getDateLocale() });

  const openTasks = useMemo(() => sortOpenTasks(tasks.filter((t) => !t.completed)), [tasks]);
  const completedTasks = useMemo(() => sortCompletedTasks(tasks.filter((t) => t.completed)), [tasks]);
  const overdueCount = openTasks.filter(isTaskOverdue).length;
  /** Reste à faire estimé : somme des tâches ouvertes ayant une estimation. */
  const restEstimated = useMemo(() => sumEstimatedTime(openTasks), [openTasks]);
  const done = completedTasks.length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  // Contributeurs (assignés distincts) + charge pour le tooltip.
  const contributors = useMemo(() => {
    const byId = new Map<string, { member: OrgMember; open: number; overdue: number }>();
    for (const task of tasks) {
      for (const uid of task.assigneeIds) {
        const m = members.find((x) => x.userId === uid);
        if (!m) continue;
        const entry = byId.get(m.userId) ?? { member: m, open: 0, overdue: 0 };
        if (!task.completed) {
          entry.open += 1;
          if (isTaskOverdue(task)) entry.overdue += 1;
        }
        byId.set(m.userId, entry);
      }
    }
    return [...byId.values()].sort((a, b) => b.open - a.open);
  }, [tasks, members]);

  const commitRename = () => {
    const name = renameValue.trim();
    setRenaming(false);
    if (name && name !== project.name) onUpdateProject({ name });
    else setRenameValue(project.name);
  };

  return (
    <section className={`rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] overflow-hidden ${archived ? 'opacity-70' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
        >
          {collapsed ? <ChevronRight size={16} className="shrink-0" aria-hidden="true" /> : <ChevronDown size={16} className="shrink-0" aria-hidden="true" />}
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
          {renaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setRenaming(false); setRenameValue(project.name); }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              maxLength={120}
              aria-label={t('project.renameAria')}
              className="h-7 px-2 rounded-md border border-indigo-400 bg-[rgb(var(--color-background))] text-sm font-bold focus:outline-none min-w-0 flex-1"
            />
          ) : (
            <span className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">{project.name}</span>
          )}
          {teamName && (
            <span className={`inline-flex items-center gap-1 text-caption font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${color.soft}`}>
              <UsersRound size={10} aria-hidden="true" /> {teamName}
            </span>
          )}
          {/* La catégorie est une PASTILLE à sa propre couleur : elle n'écrase
              plus la couleur du projet (audit 2026-09-24). */}
          {category && (
            <span className="hidden sm:inline-flex items-center gap-1 text-caption font-semibold px-1.5 py-0.5 rounded-full shrink-0 border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))]">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: category.color.startsWith('#') ? category.color : getColorHex(category.color) }}
                aria-hidden="true"
              />
              <Tag size={10} aria-hidden="true" /> {category.name}
            </span>
          )}
          {status !== 'active' && !archived && (
            <span className={`text-caption font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${PROJECT_STATUS_META[status].soft}`}>
              {t(`portfolio.status.${status}`)}
            </span>
          )}
          {late && !archived && (
            <span className="text-caption font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 shrink-0">
              {t('portfolio.late')}
            </span>
          )}
          {(project.startDate || project.dueDate) && !archived && (
            <span className="hidden md:inline-flex items-center gap-1 text-caption text-[rgb(var(--color-text-muted))] shrink-0">
              <CalendarRange size={10} aria-hidden="true" />
              {project.startDate && project.dueDate
                ? t('portfolio.dateRange', { start: shortDate(project.startDate), end: shortDate(project.dueDate) })
                : project.dueDate
                  ? t('portfolio.dueOn', { date: shortDate(project.dueDate) })
                  : t('portfolio.startsOn', { date: shortDate(project.startDate!) })}
            </span>
          )}
          {archived && (
            <span className="text-caption font-semibold px-1.5 py-0.5 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))] shrink-0">
              {t('project.archivedBadge')}
            </span>
          )}
          {overdueCount > 0 && !archived && (
            <span
              className="text-caption font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 shrink-0"
              title={tp('project.overdueTitle', overdueCount)}
            >
              {t('project.overdueBadge', { count: overdueCount })}
            </span>
          )}
          {restEstimated > 0 && !archived && (
            <span
              className="inline-flex items-center gap-1 text-caption text-[rgb(var(--color-text-muted))] shrink-0"
              title={t('project.restEstimated', { duration: formatDuration(restEstimated) })}
            >
              <Clock size={10} aria-hidden="true" /> {formatDuration(restEstimated)}
            </span>
          )}

          {/* Contributeurs (avatars empilés + charge au survol) */}
          <span className="ml-auto flex items-center gap-2 shrink-0">
            {owner && (
              <span className="hidden sm:inline-flex rounded-full ring-2 ring-indigo-500/60" title={`${t('portfolio.col.owner')} : ${owner.displayName}`}>
                <MemberAvatar avatar={owner.avatar} name={owner.displayName} size={22} />
              </span>
            )}
            {contributors.length > 0 && (
              <span className="flex -space-x-1.5" aria-label={`${contributors.length} contributeurs`}>
                {contributors.slice(0, 4).map(({ member, open, overdue }) => (
                  <span
                    key={member.userId}
                    className="rounded-full ring-2 ring-[rgb(var(--color-surface))]"
                    title={
                      overdue > 0
                        ? tp('project.memberOpenOverdue', open, { name: member.displayName, overdue })
                        : tp('project.memberOpen', open, { name: member.displayName })
                    }
                  >
                    <MemberAvatar avatar={member.avatar} name={member.displayName} size={22} />
                  </span>
                ))}
                {contributors.length > 4 && (
                  <span className="w-[22px] h-[22px] rounded-full bg-[rgb(var(--color-hover))] ring-2 ring-[rgb(var(--color-surface))] flex items-center justify-center text-[9px] font-bold text-[rgb(var(--color-text-muted))]">
                    +{contributors.length - 4}
                  </span>
                )}
              </span>
            )}
            {/* Progression */}
            <span className="flex items-center gap-1.5" title={t('project.doneRatio', { done, total, percent: progress })}>
              <span className="w-16 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden hidden sm:block">
                <span className={`block h-full rounded-full ${color.dot} transition-all`} style={{ width: `${progress}%` }} />
              </span>
              <span className="text-xs text-[rgb(var(--color-text-muted))] tabular-nums">{done}/{total}</span>
            </span>
          </span>
        </button>

        {/* Menu du projet. Il n'était monté que pour les managers ; il l'est
            désormais pour tous, car « Sélectionner des tâches » y a remplacé le
            bouton ⋯ de la barre d'outils — un contributeur doit garder l'accès
            aux actions groupées. Les entrées d'administration restent gardées
            par les droits une à une. */}
        {/* « Ouvrir la page » existe pour tous : le menu est toujours monté. */}
        {(
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('project.actionsAria', { name: project.name })}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onOpenProject}>
                <ExternalLink size={14} aria-hidden="true" /> {t('portfolio.actions.open')}
              </DropdownMenuItem>
              {canEditProject && (
                <DropdownMenuItem onClick={onEditProject}>
                  <Settings2 size={14} aria-hidden="true" /> {t('portfolio.actions.edit')}
                </DropdownMenuItem>
              )}
              {canEditProject && (
                <DropdownMenuItem onClick={() => { setRenameValue(project.name); setRenaming(true); }}>
                  <Pencil size={14} aria-hidden="true" /> {t('project.rename')}
                </DropdownMenuItem>
              )}
              {canChangeTeam && teams.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <UsersRound size={14} aria-hidden="true" /> {t('project.teamBadge')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuItem onClick={() => requestTeamChange(null)}>
                      {t('project.wholeOrg')} {!project.teamId && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    {teams.map((team) => (
                      <DropdownMenuItem key={team.id} onClick={() => requestTeamChange(team.id)}>
                        <span className="truncate">{team.name}</span>
                        {project.teamId === team.id && <span className="ml-auto text-xs">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canEditProject && categories.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Tag size={14} aria-hidden="true" /> {t('project.category')}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {/* La catégorie ne touche PLUS à `color` : la réécrire ici
                        effaçait la couleur choisie par l'équipe (audit 2026-09-24). */}
                    <DropdownMenuItem onClick={() => onUpdateProject({ categoryId: null })}>
                      {t('project.noCategory')} {!project.categoryId && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    {categories.map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => onUpdateProject({ categoryId: c.id })}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} aria-hidden="true" />
                        <span className="truncate">{c.name}</span>
                        {project.categoryId === c.id && <span className="ml-auto text-xs">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canCreateProject && !archived && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy size={14} aria-hidden="true" /> {t('portfolio.actions.duplicate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSaveTemplate}>
                    <LayoutTemplate size={14} aria-hidden="true" /> {t('portfolio.actions.saveTemplate')}
                  </DropdownMenuItem>
                </>
              )}
              {/* Actions groupées — ouvertes à tous, et seulement quand il y a
                  des tâches à cocher. */}
              {onStartSelect && tasks.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onStartSelect}>
                    <ListChecks size={14} aria-hidden="true" /> {t('projects.selectMultiple')}
                  </DropdownMenuItem>
                </>
              )}
              {canArchiveProject && <DropdownMenuSeparator />}
              {canArchiveProject && (archived ? (
                <DropdownMenuItem onClick={() => onUpdateProject({ archived: false })}>
                  <ArchiveRestore size={14} aria-hidden="true" /> {t('project.restore')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive size={14} aria-hidden="true" /> {t('project.archive')}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {!collapsed && (
        <div className="px-2 pb-2">
          {/* Tâches ouvertes (deadline ↑ puis priorité ↓) */}
          {openTasks.map((task) => (
            <TeamTaskRow
              key={task.id}
              task={task}
              members={members}
              selectable={selectable}
              selected={!!selectedIds?.has(task.id)}
              onToggleSelect={onToggleSelect}
              onToggleComplete={onToggleComplete}
              onReassign={onReassign}
              onDelete={onDelete}
              onOpen={onOpenTask}
            />
          ))}

          {tasks.length === 0 && (
            <div className="px-3 py-3 flex items-center gap-3">
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {assigneeFiltered ? t('projects.noTaskForFilter') : t('projects.noTask')}
              </p>
              {!assigneeFiltered && !archived && (
                <button
                  type="button"
                  onClick={() => onAddTask(project.id)}
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-600"
                >
                  {t('project.createFirstTask')}
                </button>
              )}
            </div>
          )}

          {/* Section terminées repliable */}
          {completedTasks.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                aria-expanded={showCompleted}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
              >
                {showCompleted ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                {t('project.completed', { count: completedTasks.length })}
              </button>
              {showCompleted && completedTasks.map((task) => (
                <TeamTaskRow
                  key={task.id}
                  task={task}
                  members={members}
                  selectable={selectable}
                  selected={!!selectedIds?.has(task.id)}
                  onToggleSelect={onToggleSelect}
                  onToggleComplete={onToggleComplete}
                  onReassign={onReassign}
                  onDelete={onDelete}
                  onOpen={onOpenTask}
                />
              ))}
            </div>
          )}

          {/* Ajout de tâche — ouvre le modal complet (projet présélectionné) */}
          {!archived && tasks.length > 0 && (
            <button
              type="button"
              onClick={() => onAddTask(project.id)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-[rgb(var(--color-text-muted))] hover:text-indigo-500 transition-colors"
            >
              <Plus size={15} aria-hidden="true" /> {t('project.addTask')}
            </button>
          )}
        </div>
      )}
      {pendingTeamId !== undefined && (
        <ConfirmProjectAudienceDialog
          projectName={project.name}
          targetTeamName={pendingTeamId ? teams.find((team) => team.id === pendingTeamId)?.name ?? null : null}
          orgMemberCount={members.length}
          onConfirm={() => { onUpdateProject({ teamId: pendingTeamId }); setPendingTeamId(undefined); }}
          onCancel={() => setPendingTeamId(undefined)}
        />
      )}
    </section>
  );
};

export default TeamProjectCard;
