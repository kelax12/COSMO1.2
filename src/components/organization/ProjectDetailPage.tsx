// ═══════════════════════════════════════════════════════════════════
// Page d'un projet d'entreprise — `/entreprise/projects?project=<id>` (M2)
//
// L'adresse est celle que la palette de commandes et le panneau de droite
// émettent déjà (`buildOrgLink('projects', { project })`) : le paramètre y
// RESTE, c'est l'adresse de la page, pas un déclencheur à consommer.
//
// Un en-tête qui répond aux questions qu'on pose à un projet (qui en répond,
// où il en est, quand il doit finir, qu'attend-il), puis ses tâches, ses
// jalons et ses dépendances.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Settings2, Copy, LayoutTemplate, Archive, ArchiveRestore, Plus,
  CalendarRange, UsersRound, UserRound, UserPlus, Bell, BellOff, Check, ChevronDown, ChevronRight, ListChecks,
} from 'lucide-react';
import { SAVE_AS_TEMPLATE_ENABLED } from './projectTemplatesFlag';

// « Dupliquer » masqué le 2026-10-13, en attendant de décider s'il reste.
const DUPLICATE_ENABLED = false;
const AVATARS_SHOWN = 5;
import { getDateLocale } from '@/i18n/format';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import type {
  TeamProject, TeamProjectDependency, TeamProjectMember, TeamProjectTaskStats, TeamTask,
} from '@/modules/team-projects';
import { projectColor, sortOpenTasks, sortCompletedTasks } from './team-projects.helpers';
import { PROJECT_STATUS_META, PROJECT_STATUSES, isProjectLate, progressFromStats, projectProgress } from './portfolio.helpers';
import ProjectHealthSection, { ProjectHealthBadge } from './ProjectHealthSection';
import { ProjectRolesDialog, ProjectAddDialog } from './ProjectPeopleDialogs';
import ProjectChat from './ProjectChat';
import { projectFunctionOf } from './project-function';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMyFollows, useToggleFollow, useUpdateTeamProject } from '@/modules/team-projects';
import MemberAvatar from './MemberAvatar';
import { useVisibility } from './useVisibility';
import TeamTaskRow from './TeamTaskRow';
import ProjectAudienceActions from './ProjectAudienceActions';
import { OrgBreadcrumb } from './OrgPagePrimitives';
import { useT } from '@/i18n/useT';

interface ProjectDetailPageProps {
  project: TeamProject;
  /** Tâches du projet (filtre assigné/statut déjà appliqué par l'onglet). */
  tasks: TeamTask[];
  /** Toutes les tâches du projet, pour l'avancement (non filtré). */
  allProjectTasks: TeamTask[];
  /** Avancement compté par le serveur (mig. 191) ; prioritaire sur `allProjectTasks`. */
  stats?: TeamProjectTaskStats;
  /** Membres de CE projet et leur rôle (mig. 190). */
  projectMembers: TeamProjectMember[];
  currentUserId?: string;
  /** Un admin n'est jamais restreint par un rôle de projet. */
  isAdmin: boolean;
  /** `task.create` dans l'organisation. */
  canCreateTask: boolean;
  members: OrgMember[];
  teams: OrgTeam[];
  dependencies: TeamProjectDependency[];
  projects: TeamProject[];
  categoryName?: string;
  canEdit: boolean;
  canArchive: boolean;
  canCreateProject: boolean;
  /** `project.edit` : équipes associées (mig. 164). */
  canManageAudience?: boolean;
  onBack: () => void;
  onOpenProject: (projectId: string) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onSaveTemplate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onAddTask: () => void;
  onStartSelect: () => void;
  onToggleComplete: (task: TeamTask) => void;
  onReassign: (task: TeamTask, assigneeIds: string[]) => void;
  onDelete: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
  selectable: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (task: TeamTask) => void;
}

const actionBtn =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]';

const ProjectDetailPage = ({
  project, tasks, allProjectTasks, stats, projectMembers, currentUserId, isAdmin, canCreateTask,
  members, teams, categoryName,
  canEdit, canArchive, canCreateProject,
  onBack, onEdit, onDuplicate, onSaveTemplate, onArchive, onRestore, onAddTask, onStartSelect,
  onToggleComplete, onReassign, onDelete, onOpenTask, selectable, selectedIds, onToggleSelect,
}: ProjectDetailPageProps) => {
  const { t } = useT('org');
  const { t: pf } = useT('portfolio');
  const { t: ta } = useT('orgAdmin');
  const [showCompleted, setShowCompleted] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [addMode, setAddMode] = useState<'person' | 'team' | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const { data: follows } = useMyFollows(project.orgId);
  const toggleFollow = useToggleFollow(project.orgId);
  const followed = follows?.projectIds.includes(project.id) ?? false;
  const updateProject = useUpdateTeamProject(project.orgId);
  const [statusOpen, setStatusOpen] = useState(false);
  const { people: viewers, teamIds: visibleTeamIds, directIds, memberships } = useVisibility({ orgId: project.orgId, teamIds: project.teamId ? [project.teamId] : [], projectId: project.id });
  // Équipes du projet (principale puis associées), puis « +x » : membres
  // directs du projet hors de ces équipes. La hiérarchie ne compte pas.
  const teamNames = visibleTeamIds.map((id) => teams.find((tm) => tm.id === id)?.name).filter(Boolean).join(', ');
  const inTeams = new Set(memberships.filter((m) => visibleTeamIds.includes(m.teamId)).map((m) => m.userId));
  const extraMembers = directIds.filter((id) => !inTeams.has(id)).length;
  const color = projectColor(project.color);
  const status = project.status ?? 'active';
  const archived = !!project.archivedAt;
  const owner = project.ownerId ? members.find((m) => m.userId === project.ownerId) : undefined;
  const progress = stats ? progressFromStats(stats) : projectProgress(project.id, allProjectTasks);
  // Rôle de projet (mig. 190) : le lecteur ne crée pas ; le contributeur crée
  // même sans `task.create`. Miroir de la policy et du trigger, pour ne pas
  // proposer un bouton que la base refuserait.
  const myRole = projectMembers.find((m) => m.userId === currentUserId)?.role;
  // Seuls les responsables (propriétaire, `lead`) et un admin changent les fonctions.
  const canManageRoles = !archived && (isAdmin || projectFunctionOf(currentUserId, project, projectMembers) === 'lead');
  const canAddTask = isAdmin || (myRole !== 'viewer' && (canCreateTask || myRole === 'lead' || myRole === 'contributor'));
  const late = isProjectLate(project);
  const longDate = (d: string) => format(parseISO(d), 'd MMMM yyyy', { locale: getDateLocale() });

  const openTasks = useMemo(() => sortOpenTasks(tasks.filter((x) => !x.completed)), [tasks]);
  const completedTasks = useMemo(() => sortCompletedTasks(tasks.filter((x) => x.completed)), [tasks]);

  const row = (task: TeamTask) => (
    <TeamTaskRow
      key={task.id}
      task={task}
      members={members}
      selectable={selectable}
      selected={selectedIds.has(task.id)}
      onToggleSelect={onToggleSelect}
      onToggleComplete={onToggleComplete}
      onReassign={onReassign}
      onDelete={onDelete}
      onOpen={onOpenTask}
    />
  );

  return (
    <div className="space-y-4">
      <OrgBreadcrumb items={[{ label: ta('ui.crumbProjects'), onClick: onBack }, { label: project.name }]} />

      <header className={`rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 sm:p-5 ${archived ? 'opacity-80' : ''}`}>
        <div className="flex items-start gap-3 flex-wrap">
          <span className={`mt-2 w-3 h-3 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-[rgb(var(--color-text-primary))] break-words">{project.name}</h2>
              {/* Qui voit ce projet, et le geste pour y ajouter quelqu'un. */}
              <div className="flex items-center" aria-label={pf('members.viewersAria', { count: viewers.length })} role="group">
                <button
                  type="button"
                  onClick={() => setRolesOpen(true)}
                  aria-label={pf('members.rolesOpen')}
                  title={pf('members.rolesOpen')}
                  className="flex -space-x-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                >
                  {viewers.slice(0, AVATARS_SHOWN).map((m) => (
                    <span key={m.userId} title={m.displayName} className="rounded-full ring-2 ring-[rgb(var(--color-surface))]">
                      <MemberAvatar avatar={m.avatar} name={m.displayName} size={26} />
                    </span>
                  ))}
                  {viewers.length > AVATARS_SHOWN && (
                    <span className="w-[26px] h-[26px] rounded-full ring-2 ring-[rgb(var(--color-surface))] bg-[rgb(var(--color-hover))] text-[11px] font-semibold tabular-nums text-[rgb(var(--color-text-secondary))] flex items-center justify-center">
                      +{viewers.length - AVATARS_SHOWN}
                    </span>
                  )}
                </button>
                {canEdit && !archived && (
                  <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
                  <PopoverTrigger
                    data-guide-id="project-detail-audience"
                    aria-label={pf('members.open')}
                    title={pf('members.open')}
                    className="ml-1.5 w-[26px] h-[26px] rounded-full border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:border-[rgb(var(--color-accent))] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 p-1">
                    {(['person', 'team'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => { setAddMenuOpen(false); setAddMode(mode); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
                      >
                        {mode === 'person' ? <UserPlus size={15} aria-hidden="true" /> : <UsersRound size={15} aria-hidden="true" />}
                        {pf(mode === 'person' ? 'members.addMember' : 'members.addTeam')}
                      </button>
                    ))}
                  </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
              {/* En cours ET en retard : « En retard » remplace le statut. */}
              {!(late && status === 'active') && (
                canEdit && !archived ? (
                  <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                    <PopoverTrigger
                      aria-label={pf('statusChange', { status: pf(`status.${status}`) })}
                      className={`font-semibold px-2.5 py-1 rounded-full hover:ring-2 hover:ring-[rgb(var(--color-border))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] ${PROJECT_STATUS_META[status].soft}`}
                    >
                      {pf(`status.${status}`)}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-48 p-1">
                      {PROJECT_STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            setStatusOpen(false);
                            if (st !== status) updateProject.mutate({ projectId: project.id, input: { status: st } });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
                        >
                          <span className={`w-2 h-2 rounded-full ${PROJECT_STATUS_META[st].dot}`} aria-hidden="true" />
                          <span className="flex-1 text-left">{pf(`status.${st}`)}</span>
                          {st === status && <Check size={14} aria-hidden="true" />}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className={`font-semibold px-2.5 py-1 rounded-full ${PROJECT_STATUS_META[status].soft}`}>
                    {pf(`status.${status}`)}
                  </span>
                )
              )}
              <ProjectHealthBadge health={project.health} />
              {late && <span className="font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-500">{pf('late')}</span>}
              {myRole && (
                <span className="font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  {pf('members.yourRole', { role: pf(`members.role.${projectFunctionOf(currentUserId, project, projectMembers)}`) })}
                </span>
              )}
              {archived && <span className="font-semibold px-2.5 py-1 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))]">{t('project.archivedBadge')}</span>}
              <span className="inline-flex items-center gap-1 text-[rgb(var(--color-text-secondary))]">
                <UsersRound size={15} aria-hidden="true" />
                {teamNames || t('project.wholeOrg')}
                {extraMembers > 0 && (
                  <span className="font-semibold tabular-nums" title={pf('members.extraHint', { count: extraMembers })}>+{extraMembers}</span>
                )}
              </span>
              {categoryName && <span className="text-[rgb(var(--color-text-secondary))]">· {categoryName}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && !archived && (
              <button type="button" onClick={onEdit} className={actionBtn}>
                <Settings2 size={14} aria-hidden="true" /> {pf('actions.edit')}
              </button>
            )}
            {canCreateProject && !archived && (
              <>
                {DUPLICATE_ENABLED && (
                  <button type="button" onClick={onDuplicate} className={actionBtn}>
                    <Copy size={14} aria-hidden="true" /> {pf('actions.duplicate')}
                  </button>
                )}
                {SAVE_AS_TEMPLATE_ENABLED && (
                  <button type="button" onClick={onSaveTemplate} className={actionBtn}>
                    <LayoutTemplate size={14} aria-hidden="true" /> {pf('actions.saveTemplate')}
                  </button>
                )}
              </>
            )}
            {canArchive && (archived ? (
              <button type="button" onClick={onRestore} className={actionBtn}>
                <ArchiveRestore size={14} aria-hidden="true" /> {t('project.restore')}
              </button>
            ) : (
              <button type="button" onClick={onArchive} className={actionBtn}>
                <Archive size={14} aria-hidden="true" /> {t('project.archive')}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={followed}
              onClick={() => toggleFollow.mutate({ target: 'project', id: project.id, follow: !followed })}
              className={actionBtn}
            >
              {followed ? <BellOff size={14} aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
              {t(followed ? 'follow.unfollow' : 'follow.follow')}
            </button>
          </div>
        </div>

        <ProjectAudienceActions
          project={project}
          teams={teams}
          canManageTeams={canEdit}
          canPurge={canArchive}
          taskCount={allProjectTasks.length}
          onPurged={onBack}
        />

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">{pf('col.owner')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-[rgb(var(--color-text-primary))]">
              {owner ? (
                <><MemberAvatar avatar={owner.avatar} name={owner.displayName} size={20} /> {owner.displayName}</>
              ) : (
                <span className="inline-flex items-center gap-1 italic text-[rgb(var(--color-text-muted))]"><UserRound size={13} aria-hidden="true" /> {pf('noOwner')}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">{pf('col.dates')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-[rgb(var(--color-text-primary))]">
              <CalendarRange size={13} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
              {project.dueDate
                ? pf('dueOn', { date: longDate(project.dueDate) })
                : <span className="italic text-[rgb(var(--color-text-muted))]">{pf('noDates')}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">{pf('col.progress')}</dt>
            <dd className="mt-1.5 flex items-center gap-2">
              <span className="flex-1 max-w-[180px] h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
                <span className={`block h-full rounded-full ${color.dot}`} style={{ width: `${progress.percent}%` }} />
              </span>
              <span className="text-xs tabular-nums text-[rgb(var(--color-text-secondary))]">
                {t('project.doneRatio', { done: progress.done, total: progress.total, percent: progress.percent })}
              </span>
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <section aria-labelledby={`tasks-${project.id}`} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-2">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <h3 id={`tasks-${project.id}`} className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
              {pf('tasksTitle')} <span className="font-normal text-[rgb(var(--color-text-muted))]">({tasks.length})</span>
            </h3>
            {tasks.length > 0 && !selectable && (
              <button type="button" onClick={onStartSelect} className="inline-flex items-center gap-1 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]">
                <ListChecks size={13} aria-hidden="true" /> {pf('actions.selectTasks')}
              </button>
            )}
          </div>
          {openTasks.map(row)}
          {tasks.length === 0 && <p className="px-3 py-3 text-xs text-[rgb(var(--color-text-muted))]">{t('projects.noTask')}</p>}
          {completedTasks.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                aria-expanded={showCompleted}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]"
              >
                {showCompleted ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                {t('project.completed', { count: completedTasks.length })}
              </button>
              {showCompleted && completedTasks.map(row)}
            </div>
          )}
          {!archived && canAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-[rgb(var(--color-text-muted))] hover:text-indigo-500 transition-colors"
            >
              <Plus size={15} aria-hidden="true" /> {t('project.addTask')}
            </button>
          )}
        </section>

        <div className="space-y-4">
          <ProjectHealthSection project={project} members={members} canEdit={canEdit && !archived} />
          <ProjectChat
            project={project}
            projectMembers={projectMembers}
            members={members}
            currentUserId={currentUserId}
            readOnly={archived}
          />
        </div>
      </div>

      <ProjectRolesDialog
        open={rolesOpen}
        onOpenChange={setRolesOpen}
        project={project}
        projectMembers={projectMembers}
        viewers={viewers}
        canManage={canManageRoles}
        currentUserId={currentUserId}
      />
      <ProjectAddDialog
        mode={addMode}
        onClose={() => setAddMode(null)}
        project={project}
        projectMembers={projectMembers}
        orgMembers={members}
        teams={teams}
      />
    </div>
  );
};

export default ProjectDetailPage;
