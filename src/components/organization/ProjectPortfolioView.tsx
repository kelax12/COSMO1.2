// ═══════════════════════════════════════════════════════════════════
// Vue « Portefeuille » de l'onglet Projets (M2, audit 2026-09-24)
//
// Une ligne par projet, aucune tâche : responsable, statut, dates,
// avancement, prochain jalon, blocages. C'est la réponse au constat « la liste
// de cartes contenant les tâches devient interminable au-delà de 20 projets » :
// on pilote un portefeuille en le lisant d'un coup d'œil, puis on ouvre la
// page du projet pour le détail.
//
// Recherche et tri sont faits par l'appelant (`portfolio.helpers`), pour que
// la liste de cartes et ce tableau montrent exactement le même ensemble.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CheckSquare, Flag, Link2, UserRound } from 'lucide-react';
import { getDateLocale } from '@/i18n/format';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import type { TeamProject, TeamProjectDependency, TeamProjectMilestone, TeamTask } from '@/modules/team-projects';
import { projectColor } from './team-projects.helpers';
import {
  PROJECT_STATUS_META, projectProgress, isProjectLate, nextMilestone, openBlockers,
} from './portfolio.helpers';
import MemberAvatar from './MemberAvatar';
import ProjectBulkBar from './ProjectBulkBar';
import { useT } from '@/i18n/useT';

interface ProjectPortfolioViewProps {
  projects: TeamProject[];
  tasks: TeamTask[];
  members: OrgMember[];
  teams: OrgTeam[];
  milestones: TeamProjectMilestone[];
  dependencies: TeamProjectDependency[];
  /** Tous les projets visibles, pour nommer un bloqueur hors du filtre courant. */
  allProjects: TeamProject[];
  onOpenProject: (projectId: string) => void;
  /**
   * Actions groupées (audit du 2026-09-24) : `project.edit` pour le statut et
   * le responsable, `project.delete` pour l'archivage. Sans l'un ni l'autre,
   * la sélection n'est pas proposée.
   */
  canBulkEdit?: boolean;
  canBulkArchive?: boolean;
}

const ProjectPortfolioView = ({
  projects, tasks, members, teams, milestones, dependencies, allProjects, onOpenProject,
  canBulkEdit = false, canBulkArchive = false,
}: ProjectPortfolioViewProps) => {
  const { t } = useT('org');
  const { t: ta } = useT('orgAdmin');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const canBulk = canBulkEdit || canBulkArchive;
  const { t: pf } = useT('portfolio');
  const shortDate = (d: string) => format(parseISO(d), 'd MMM yyyy', { locale: getDateLocale() });
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const teamById = new Map(teams.map((tm) => [tm.id, tm]));

  return (
    <>
    {canBulk && projects.length > 1 && !selectMode && (
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={() => setSelectMode(true)}
          className="inline-flex items-center gap-1.5 min-h-11 px-2 text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          <CheckSquare size={15} aria-hidden="true" /> {ta('bulk.selectProjects')}
        </button>
      </div>
    )}
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] overflow-x-auto">
      <table className="w-full text-sm" aria-label={pf('tableAria')}>
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] border-b border-[rgb(var(--color-border))]">
            {selectMode && <th scope="col" className="px-3 py-2.5 w-8"><span className="sr-only">{ta('bulk.selectProjects')}</span></th>}
            <th scope="col" className="px-3 py-2.5">{pf('col.project')}</th>
            <th scope="col" className="px-3 py-2.5 hidden md:table-cell">{pf('col.owner')}</th>
            <th scope="col" className="px-3 py-2.5">{pf('col.status')}</th>
            <th scope="col" className="px-3 py-2.5 hidden lg:table-cell">{pf('col.dates')}</th>
            <th scope="col" className="px-3 py-2.5">{pf('col.progress')}</th>
            <th scope="col" className="px-3 py-2.5 hidden xl:table-cell">{pf('col.next')}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const status = project.status ?? 'active';
            const owner = project.ownerId ? memberById.get(project.ownerId) : undefined;
            const progress = projectProgress(project.id, tasks);
            const late = isProjectLate(project);
            const next = nextMilestone(project.id, milestones);
            const blockers = openBlockers(project.id, dependencies, allProjects);
            const team = project.teamId ? teamById.get(project.teamId) : undefined;
            return (
              <tr
                key={project.id}
                className="border-b last:border-b-0 border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))]/60 transition-colors"
              >
                {selectMode && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(project.id)}
                      onChange={() => toggle(project.id)}
                      aria-label={ta('bulk.selectProject', { name: project.name })}
                      className="w-4 h-4 accent-[rgb(var(--color-accent))]"
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 max-w-[280px]">
                  <button
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    aria-label={pf('openProject', { name: project.name })}
                    className="flex items-center gap-2 min-w-0 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${projectColor(project.color).dot}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-[rgb(var(--color-text-primary))] truncate hover:underline">{project.name}</span>
                      {(team || blockers.length > 0) && (
                        <span className="flex items-center gap-2 text-caption text-[rgb(var(--color-text-muted))] truncate">
                          {team && <span className="truncate">{team.name}</span>}
                          {blockers.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 truncate">
                              <Link2 size={10} aria-hidden="true" />
                              {pf('blockedBy', { names: blockers.map((b) => b.name).join(', ') })}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  {owner ? (
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <MemberAvatar avatar={owner.avatar} name={owner.displayName} size={20} />
                      <span className="truncate text-[rgb(var(--color-text-secondary))]">{owner.displayName}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs italic text-[rgb(var(--color-text-muted))]">
                      <UserRound size={12} aria-hidden="true" /> {pf('noOwner')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <span className={`text-caption font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${PROJECT_STATUS_META[status].soft}`}>
                      {pf(`status.${status}`)}
                    </span>
                    {late && (
                      <span className="text-caption font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 whitespace-nowrap">
                        {pf('late')}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-[rgb(var(--color-text-secondary))] whitespace-nowrap">
                  {project.startDate && project.dueDate
                    ? pf('dateRange', { start: shortDate(project.startDate), end: shortDate(project.dueDate) })
                    : project.dueDate
                      ? pf('dueOn', { date: shortDate(project.dueDate) })
                      : project.startDate
                        ? pf('startsOn', { date: shortDate(project.startDate) })
                        : <span className="italic text-[rgb(var(--color-text-muted))]">{pf('noDates')}</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2" title={t('project.doneRatio', { done: progress.done, total: progress.total, percent: progress.percent })}>
                    <span className="w-16 sm:w-24 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
                      <span className={`block h-full rounded-full ${projectColor(project.color).dot}`} style={{ width: `${progress.percent}%` }} />
                    </span>
                    <span className="text-xs tabular-nums text-[rgb(var(--color-text-muted))]">{progress.percent} %</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 hidden xl:table-cell text-xs">
                  {next ? (
                    <span className="inline-flex items-center gap-1 text-[rgb(var(--color-text-secondary))]">
                      <Flag size={11} aria-hidden="true" />
                      <span className="truncate max-w-[140px]">{next.name}</span>
                      <span className="text-[rgb(var(--color-text-muted))]">· {shortDate(next.dueDate)}</span>
                    </span>
                  ) : (
                    <span className="text-[rgb(var(--color-text-muted))]">·</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {selectMode && (
      <ProjectBulkBar
        selected={projects.filter((p) => selectedIds.has(p.id))}
        members={members}
        canEdit={canBulkEdit}
        canArchive={canBulkArchive}
        onDone={() => setSelectedIds(new Set())}
        onExit={exitSelect}
      />
    )}
    </>
  );
};

export default ProjectPortfolioView;
