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
  ArrowLeft, Settings2, Copy, LayoutTemplate, Archive, ArchiveRestore, Plus,
  CalendarRange, UsersRound, UserRound, ChevronDown, ChevronRight, ListChecks,
} from 'lucide-react';
import { getDateLocale } from '@/i18n/format';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import type { TeamProject, TeamProjectDependency, TeamProjectMilestone, TeamTask } from '@/modules/team-projects';
import { projectColor, sortOpenTasks, sortCompletedTasks } from './team-projects.helpers';
import { PROJECT_STATUS_META, isProjectLate, projectProgress } from './portfolio.helpers';
import MemberAvatar from './MemberAvatar';
import TeamTaskRow from './TeamTaskRow';
import ProjectMilestonesSection from './ProjectMilestonesSection';
import ProjectDependenciesSection from './ProjectDependenciesSection';
import { useT } from '@/i18n/useT';

interface ProjectDetailPageProps {
  project: TeamProject;
  /** Tâches du projet (filtre assigné/statut déjà appliqué par l'onglet). */
  tasks: TeamTask[];
  /** Toutes les tâches du projet, pour l'avancement (non filtré). */
  allProjectTasks: TeamTask[];
  members: OrgMember[];
  teams: OrgTeam[];
  milestones: TeamProjectMilestone[];
  dependencies: TeamProjectDependency[];
  projects: TeamProject[];
  categoryName?: string;
  canEdit: boolean;
  canArchive: boolean;
  canCreateProject: boolean;
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
  project, tasks, allProjectTasks, members, teams, milestones, dependencies, projects, categoryName,
  canEdit, canArchive, canCreateProject,
  onBack, onOpenProject, onEdit, onDuplicate, onSaveTemplate, onArchive, onRestore, onAddTask, onStartSelect,
  onToggleComplete, onReassign, onDelete, onOpenTask, selectable, selectedIds, onToggleSelect,
}: ProjectDetailPageProps) => {
  const { t } = useT('org');
  const [showCompleted, setShowCompleted] = useState(false);
  const color = projectColor(project.color);
  const status = project.status ?? 'active';
  const archived = !!project.archivedAt;
  const owner = project.ownerId ? members.find((m) => m.userId === project.ownerId) : undefined;
  const team = project.teamId ? teams.find((tm) => tm.id === project.teamId) : undefined;
  const progress = projectProgress(project.id, allProjectTasks);
  const late = isProjectLate(project);
  const longDate = (d: string) => format(parseISO(d), 'd MMMM yyyy', { locale: getDateLocale() });

  const openTasks = useMemo(() => sortOpenTasks(tasks.filter((x) => !x.completed)), [tasks]);
  const completedTasks = useMemo(() => sortCompletedTasks(tasks.filter((x) => x.completed)), [tasks]);
  const projectMilestones = milestones.filter((m) => m.projectId === project.id);

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
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <ArrowLeft size={15} aria-hidden="true" /> {t('portfolio.back')}
      </button>

      <header className={`rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 sm:p-5 ${archived ? 'opacity-80' : ''}`}>
        <div className="flex items-start gap-3 flex-wrap">
          <span className={`mt-2 w-3 h-3 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-[rgb(var(--color-text-primary))] break-words">{project.name}</h2>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs">
              <span className={`font-semibold px-2 py-0.5 rounded-full ${PROJECT_STATUS_META[status].soft}`}>
                {t(`portfolio.status.${status}`)}
              </span>
              {late && <span className="font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">{t('portfolio.late')}</span>}
              {archived && <span className="font-semibold px-2 py-0.5 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))]">{t('project.archivedBadge')}</span>}
              <span className="inline-flex items-center gap-1 text-[rgb(var(--color-text-secondary))]">
                <UsersRound size={12} aria-hidden="true" /> {team?.name ?? t('project.wholeOrg')}
              </span>
              {categoryName && <span className="text-[rgb(var(--color-text-secondary))]">· {categoryName}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && !archived && (
              <button type="button" onClick={onEdit} className={actionBtn}>
                <Settings2 size={14} aria-hidden="true" /> {t('portfolio.actions.edit')}
              </button>
            )}
            {canCreateProject && !archived && (
              <>
                <button type="button" onClick={onDuplicate} className={actionBtn}>
                  <Copy size={14} aria-hidden="true" /> {t('portfolio.actions.duplicate')}
                </button>
                <button type="button" onClick={onSaveTemplate} className={actionBtn}>
                  <LayoutTemplate size={14} aria-hidden="true" /> {t('portfolio.actions.saveTemplate')}
                </button>
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
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">{t('portfolio.col.owner')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-[rgb(var(--color-text-primary))]">
              {owner ? (
                <><MemberAvatar avatar={owner.avatar} name={owner.displayName} size={22} /> {owner.displayName}</>
              ) : (
                <span className="inline-flex items-center gap-1 italic text-[rgb(var(--color-text-muted))]"><UserRound size={13} aria-hidden="true" /> {t('portfolio.noOwner')}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">{t('portfolio.col.dates')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-[rgb(var(--color-text-primary))]">
              <CalendarRange size={13} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
              {project.startDate && project.dueDate
                ? t('portfolio.dateRange', { start: longDate(project.startDate), end: longDate(project.dueDate) })
                : project.dueDate
                  ? t('portfolio.dueOn', { date: longDate(project.dueDate) })
                  : project.startDate
                    ? t('portfolio.startsOn', { date: longDate(project.startDate) })
                    : <span className="italic text-[rgb(var(--color-text-muted))]">{t('portfolio.noDates')}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">{t('portfolio.col.progress')}</dt>
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

        <p className={`mt-4 text-sm whitespace-pre-line ${project.description ? 'text-[rgb(var(--color-text-secondary))]' : 'italic text-[rgb(var(--color-text-muted))]'}`}>
          {project.description || t('portfolio.noDescription')}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <section aria-labelledby={`tasks-${project.id}`} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-2">
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <h3 id={`tasks-${project.id}`} className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
              {t('portfolio.tasksTitle')} <span className="font-normal text-[rgb(var(--color-text-muted))]">({tasks.length})</span>
            </h3>
            {tasks.length > 0 && !selectable && (
              <button type="button" onClick={onStartSelect} className="inline-flex items-center gap-1 text-xs font-semibold text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]">
                <ListChecks size={13} aria-hidden="true" /> {t('portfolio.actions.selectTasks')}
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
          {!archived && (
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
          <ProjectMilestonesSection orgId={project.orgId} projectId={project.id} milestones={projectMilestones} canEdit={canEdit && !archived} />
          <ProjectDependenciesSection
            orgId={project.orgId}
            project={project}
            projects={projects}
            dependencies={dependencies}
            canEdit={canEdit && !archived}
            onOpenProject={onOpenProject}
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
