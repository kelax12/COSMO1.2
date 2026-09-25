import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Pencil, Trash2, FolderKanban, Target, Crown, ChevronRight } from 'lucide-react';
import { startOfDay, subDays } from 'date-fns';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import type { OrgMember } from '@/modules/organizations';
import { useTeamProjects, useTeamTaskWorkingSet } from '@/modules/team-projects';
import { useTeamOKRs } from '@/modules/team-okrs';
import MemberAvatar from './MemberAvatar';
import TeamMembersPanel from './TeamMembersPanel';
import TeamProfileEditor from './TeamProfileEditor';
import DeleteTeamDialog from './DeleteTeamDialog';
import { OrgTabSkeleton } from './OrgLoadingSkeletons';
import { buildOrgLink, orgSectionPath } from './deep-link.helpers';
import { okrProgress } from './team-stats.helpers';
import {
  TEAM_STATS_WINDOW_DAYS,
  averageOkrProgress,
  canManageTeam,
  computeTeamStats,
  sortTeamMembers,
  teamOkrsOf,
  teamProjectsOf,
} from './team-page.helpers';
import { useT } from '@/i18n/useT';

interface TeamPageProps {
  orgId: string;
  teamId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
}

const cardClass = 'rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4';
const headingClass = 'text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3';

const StatTile = ({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) => (
  <div className="rounded-xl bg-[rgb(var(--color-hover))] px-3 py-2.5">
    <p className={`text-xl font-bold tabular-nums ${tone === 'danger' ? 'text-red-500' : 'text-[rgb(var(--color-text-primary))]'}`}>{value}</p>
    <p className="text-xs text-[rgb(var(--color-text-muted))]">{label}</p>
  </div>
);

/**
 * Page d'une équipe, `/entreprise/teams/:id` (audit Membres du 2026-09-24 :
 * « l'équipe n'est qu'une étiquette »). Description, responsables, membres,
 * projets, OKR et statistiques, lus sous la RLS de l'appelant : il ne voit que
 * les projets et OKR auxquels il a déjà accès ailleurs.
 */
const TeamPage = ({ orgId, teamId, members, currentUserId, isAdmin }: TeamPageProps) => {
  const { t, tp } = useT('org');
  const { data: teams = [], isLoading: loadingTeams } = useOrgTeams(orgId);
  const { data: memberships = [] } = useOrgTeamMembers(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: okrs = [] } = useTeamOKRs(orgId);
  // Ensemble de travail : ouvertes + terminées depuis le début de la fenêtre.
  // Stable sur la durée de la visite, sinon la clé de cache changerait à
  // chaque rendu.
  const since = useMemo(() => startOfDay(subDays(new Date(), TEAM_STATS_WINDOW_DAYS)).toISOString(), []);
  const { data: tasks = [] } = useTeamTaskWorkingSet(orgId, since);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const team = teams.find((tm) => tm.id === teamId);
  const teamMemberships = useMemo(() => memberships.filter((m) => m.teamId === teamId), [memberships, teamId]);
  const teamProjects = useMemo(() => (team ? teamProjectsOf(team, projects) : []), [team, projects]);
  const activeProjects = teamProjects.filter((p) => !p.archivedAt);
  const teamOkrs = useMemo(() => (team ? teamOkrsOf(team, okrs) : []), [team, okrs]);
  const stats = useMemo(
    () => computeTeamStats(tasks, new Set(teamProjects.map((p) => p.id))),
    [tasks, teamProjects],
  );

  const backLink = (
    <Link
      to={orgSectionPath('teams')}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] min-h-11"
    >
      <ArrowLeft size={15} aria-hidden="true" /> {t('teamPage.back')}
    </Link>
  );

  if (loadingTeams) return <OrgTabSkeleton label={t('page.tabLoading')} />;
  if (!team) {
    // Id inconnu, équipe supprimée, ou lien venu d'une autre organisation :
    // la RLS rend la même absence dans les trois cas, l'écran aussi.
    return (
      <div className="space-y-3">
        {backLink}
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-8 text-center">{t('teamPage.notFound')}</p>
      </div>
    );
  }

  const canManage = canManageTeam(team, teamMemberships, currentUserId, isAdmin);
  const canDelete = isAdmin || team.createdBy === currentUserId;
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const leads = sortTeamMembers(
    teamMemberships.filter((m) => m.isLead).map((m) => memberById.get(m.userId)).filter((m): m is OrgMember => !!m),
    teamMemberships,
  );
  const okrAverage = averageOkrProgress(teamOkrs);
  const openByProject = new Map<string, number>();
  for (const task of tasks) {
    if (!task.completed) openByProject.set(task.projectId, (openByProject.get(task.projectId) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      {backLink}

      {editing ? (
        <TeamProfileEditor orgId={orgId} team={team} onDone={() => setEditing(false)} />
      ) : (
        <header className={cardClass}>
          <div className="flex items-start gap-3">
            <span className="mt-1.5 w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: team.color }} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))] break-words">{team.name}</h2>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {tp('team.memberCount', teamMemberships.length)} · {tp('team.projectCount', activeProjects.length)}
              </p>
              {team.description ? (
                <p className="mt-2 text-sm text-[rgb(var(--color-text-secondary))] whitespace-pre-line">{team.description}</p>
              ) : (
                <p className="mt-2 text-sm italic text-[rgb(var(--color-text-muted))]">
                  {canManage ? t('teamPage.noDescriptionManager') : t('teamPage.noDescription')}
                </p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {canManage && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={t('teamPage.edit')}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))]"
                >
                  <Pencil size={15} aria-hidden="true" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setDeleting(true)}
                  aria-label={t('team.deleteAria', { name: team.name })}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Statistiques : les tâches des projets de l'équipe, 30 jours. */}
      <section className={cardClass} aria-labelledby="team-stats-title">
        <h3 id="team-stats-title" className={headingClass}>{t('teamPage.statsTitle', { days: TEAM_STATS_WINDOW_DAYS })}</h3>
        {teamProjects.length === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('teamPage.statsEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <StatTile label={t('teamPage.statOpen')} value={String(stats.open)} />
            <StatTile label={t('teamPage.statOverdue')} value={String(stats.overdue)} tone={stats.overdue > 0 ? 'danger' : undefined} />
            <StatTile label={t('teamPage.statDone')} value={String(stats.doneInWindow)} />
            <StatTile label={t('teamPage.statRate')} value={stats.completionRate === null ? '·' : `${stats.completionRate} %`} />
            <StatTile label={t('teamPage.statOkr')} value={okrAverage === null ? '·' : `${okrAverage} %`} />
          </div>
        )}
      </section>

      <section className={cardClass} aria-labelledby="team-people-title">
        <h3 id="team-people-title" className={headingClass}>{t('teamPage.peopleTitle')}</h3>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--color-text-secondary))]">
          <Crown size={12} className="text-amber-500" aria-hidden="true" />
          {leads.length === 0 ? (
            <span className="text-[rgb(var(--color-text-muted))]">{canManage ? t('teamPage.noLeadManager') : t('teamPage.noLead')}</span>
          ) : (
            leads.map((m) => (
              <span key={m.userId} className="inline-flex items-center gap-1.5">
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={18} />
                {m.userId === currentUserId ? t('common.youBadge') : m.displayName}
              </span>
            ))
          )}
        </div>
        <TeamMembersPanel
          orgId={orgId}
          team={team}
          members={members}
          memberships={teamMemberships}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          canManage={canManage}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={cardClass} aria-labelledby="team-projects-title">
          <h3 id="team-projects-title" className={headingClass}>
            <FolderKanban size={14} className="inline mr-1.5 -mt-0.5" aria-hidden="true" />
            {t('teamPage.projectsTitle')}
          </h3>
          {activeProjects.length === 0 ? (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('teamPage.projectsEmpty')}</p>
          ) : (
            <ul className="space-y-1">
              {activeProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    to={buildOrgLink('projects', { project: p.id })}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[rgb(var(--color-hover))]"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
                    <span className="flex-1 truncate text-sm text-[rgb(var(--color-text-primary))]">{p.name}</span>
                    <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                      {tp('teamPage.openTasks', openByProject.get(p.id) ?? 0)}
                    </span>
                    <ChevronRight size={14} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {teamProjects.length > activeProjects.length && (
            <p className="mt-2 text-xs text-[rgb(var(--color-text-muted))]">
              {tp('teamPage.archivedProjects', teamProjects.length - activeProjects.length)}
            </p>
          )}
        </section>

        <section className={cardClass} aria-labelledby="team-okr-title">
          <h3 id="team-okr-title" className={headingClass}>
            <Target size={14} className="inline mr-1.5 -mt-0.5" aria-hidden="true" />
            {t('teamPage.okrTitle')}
          </h3>
          {teamOkrs.length === 0 ? (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('teamPage.okrEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {teamOkrs.map((o) => {
                const pct = Math.round(okrProgress(o) * 100);
                return (
                  <li key={o.id}>
                    <Link to={orgSectionPath('okr')} className="block rounded-lg px-2 py-1.5 hover:bg-[rgb(var(--color-hover))]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-[rgb(var(--color-text-primary))]">{o.title}</span>
                        <span className="text-xs tabular-nums text-[rgb(var(--color-text-muted))] shrink-0">{pct} %</span>
                      </div>
                      <div
                        className="mt-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t('teamPage.okrProgressAria', { title: o.title })}
                      >
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: team.color }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {deleting && (
        <DeleteTeamDialog orgId={orgId} team={team} teams={teams} onClose={() => setDeleting(false)} />
      )}
    </div>
  );
};

export default TeamPage;
