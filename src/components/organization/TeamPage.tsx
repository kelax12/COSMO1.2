import { Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarPlus, Pencil, Trash2, FolderKanban, Target, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { startOfDay, subDays } from 'date-fns';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import type { OrgMember } from '@/modules/organizations';
import { useTeamProjects, useTeamTaskWorkingSet } from '@/modules/team-projects';
import { useTeamOKRs } from '@/modules/team-okrs';
import { OrgBreadcrumb } from './OrgPagePrimitives';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import TeamMembersPanel from './TeamMembersPanel';
import TeamProfileEditor from './TeamProfileEditor';
import TeamWorkloadSection from './TeamWorkloadSection';
import DeleteTeamDialog from './DeleteTeamDialog';
import { OrgTabSkeleton } from './OrgLoadingSkeletons';
import { buildOrgLink, orgSectionPath } from './deep-link.helpers';
import { krProgress, okrProgress } from './team-stats.helpers';
import {
  TEAM_STATS_WINDOW_DAYS,
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

// Chargée à l'ouverture : la page d'équipe n'en paie rien tant qu'on ne planifie pas.
const TeamEventDialog = lazyWithRetry(() => import('./TeamEventDialog'));

const cardClass = 'rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]';
const headingClass = 'text-base font-bold text-[rgb(var(--color-text-primary))] mb-4';
const sectionLabelClass =
  'flex items-center gap-2 px-5 pt-6 pb-2 text-sm font-semibold text-[rgb(var(--color-text-secondary))]';
const rowClass = 'flex items-center gap-3 px-5 py-3 min-h-12 hover:bg-[rgb(var(--color-hover))]';

/** Chiffre en ligne : valeur puis libellé. */
const StatInline = ({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) => (
  <div className="flex items-baseline gap-2">
    <dt className="order-2 text-sm text-[rgb(var(--color-text-muted))]">{label}</dt>
    <dd className={`order-1 text-2xl font-bold tabular-nums ${tone === 'danger' ? 'text-red-500' : 'text-[rgb(var(--color-text-primary))]'}`}>{value}</dd>
  </div>
);

/**
 * Page d'une équipe, `/entreprise/teams/:id` (audit Membres du 2026-09-24 :
 * « l'équipe n'est qu'une étiquette »). Description, responsables, membres,
 * projets, OKR, statistiques et charge par membre, lus sous la RLS de
 * l'appelant : il ne voit que les projets et OKR auxquels il a déjà accès.
 *
 * Mise en page du 2026-09-27 : contenu en liste dense à gauche, l'équipe
 * dans un panneau latéral, la charge de travail en pleine largeur dessous.
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
  const [planning, setPlanning] = useState(false);
  const [openKrs, setOpenKrs] = useState<ReadonlySet<string>>(new Set());

  const team = teams.find((tm) => tm.id === teamId);
  const teamMemberships = useMemo(() => memberships.filter((m) => m.teamId === teamId), [memberships, teamId]);
  const teamProjects = useMemo(() => (team ? teamProjectsOf(team, projects) : []), [team, projects]);
  const activeProjects = teamProjects.filter((p) => !p.archivedAt);
  const teamOkrs = useMemo(() => (team ? teamOkrsOf(team, okrs) : []), [team, okrs]);
  const projectIds = useMemo(() => new Set(teamProjects.map((p) => p.id)), [teamProjects]);
  const stats = useMemo(() => computeTeamStats(tasks, projectIds), [tasks, projectIds]);
  const teamMembers = useMemo(() => {
    const byId = new Map(members.map((m) => [m.userId, m]));
    return sortTeamMembers(
      teamMemberships.map((m) => byId.get(m.userId)).filter((m): m is OrgMember => !!m),
      teamMemberships,
    );
  }, [members, teamMemberships]);

  const { t: ta } = useT('orgAdmin');
  const backLink = (
    <OrgBreadcrumb
      items={[
        { label: ta('ui.crumbTeams'), to: orgSectionPath('teams') },
        { label: team?.name ?? t('teamPage.back') },
      ]}
    />
  );

  if (loadingTeams) return <OrgTabSkeleton label={ta('page.tabLoading')} />;
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
  const openByProject = new Map<string, number>();
  for (const task of tasks) {
    if (!task.completed) openByProject.set(task.projectId, (openByProject.get(task.projectId) ?? 0) + 1);
  }
  const toggleKrs = (okrId: string) =>
    setOpenKrs((prev) => {
      const next = new Set(prev);
      if (next.has(okrId)) next.delete(okrId);
      else next.add(okrId);
      return next;
    });

  return (
    <div className="space-y-6">
      {backLink}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className={`${cardClass} overflow-hidden`}>
            <header className="p-6 border-b border-[rgb(var(--color-border))]">
              <div className="flex items-start gap-4">
                <span className="mt-2.5 w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: team.color }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold text-[rgb(var(--color-text-primary))] break-words">{team.name}</h2>
                  <p className="mt-0.5 text-sm text-[rgb(var(--color-text-muted))]">
                    {tp('team.memberCount', teamMemberships.length)} · {tp('team.projectCount', activeProjects.length)}
                  </p>
                  {team.description ? (
                    <p className="mt-3 text-sm text-[rgb(var(--color-text-secondary))] whitespace-pre-line">{team.description}</p>
                  ) : (
                    <p className="mt-3 text-sm italic text-[rgb(var(--color-text-muted))]">
                      {canManage ? t('teamPage.noDescriptionManager') : t('teamPage.noDescription')}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPlanning(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
                  >
                    <CalendarPlus size={15} aria-hidden="true" />
                    <span className="hidden sm:inline">{ta('ui.event.open')}</span>
                    <span className="sr-only sm:hidden">{ta('ui.event.open')}</span>
                  </button>
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

              {/* Tâches ouvertes et en retard des projets de l'équipe. */}
              <section className="mt-5" aria-labelledby="team-stats-title">
                <h3 id="team-stats-title" className="sr-only">{t('teamPage.statsTitle', { days: TEAM_STATS_WINDOW_DAYS })}</h3>
                {teamProjects.length === 0 ? (
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('teamPage.statsEmpty')}</p>
                ) : (
                  <dl className="flex flex-wrap gap-x-8 gap-y-2">
                    <StatInline label={t('teamPage.statOpen')} value={String(stats.open)} />
                    <StatInline label={t('teamPage.statOverdue')} value={String(stats.overdue)} tone={stats.overdue > 0 ? 'danger' : undefined} />
                  </dl>
                )}
              </section>
            </header>

          <section aria-labelledby="team-projects-title">
            <h3 id="team-projects-title" className={sectionLabelClass}>
              <FolderKanban size={16} aria-hidden="true" />
              {t('teamPage.projectsTitle')}
            </h3>
            {activeProjects.length === 0 ? (
              <p className="px-5 py-3 text-sm text-[rgb(var(--color-text-muted))]">{t('teamPage.projectsEmpty')}</p>
            ) : (
              <ul>
                {activeProjects.map((p) => (
                  <li key={p.id}>
                    <Link to={buildOrgLink('projects', { project: p.id })} className={rowClass}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
                      <span className="flex-1 truncate text-[15px] font-medium text-[rgb(var(--color-text-primary))]">{p.name}</span>
                      <span className="text-sm text-[rgb(var(--color-text-muted))] shrink-0">
                        {tp('teamPage.openTasks', openByProject.get(p.id) ?? 0)}
                      </span>
                      <ChevronRight size={14} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {teamProjects.length > activeProjects.length && (
              <p className="px-5 pb-2 text-sm text-[rgb(var(--color-text-muted))]">
                {tp('teamPage.archivedProjects', teamProjects.length - activeProjects.length)}
              </p>
            )}
          </section>

          <section aria-labelledby="team-okr-title" className="pb-5">
            <h3 id="team-okr-title" className={sectionLabelClass}>
              <Target size={16} aria-hidden="true" />
              {t('teamPage.okrTitle')}
            </h3>
            {teamOkrs.length === 0 ? (
              <p className="px-5 py-3 text-sm text-[rgb(var(--color-text-muted))]">{t('teamPage.okrEmpty')}</p>
            ) : (
              <ul>
                {teamOkrs.map((o) => {
                  const pct = Math.round(okrProgress(o) * 100);
                  const open = openKrs.has(o.id);
                  const krListId = `team-okr-krs-${o.id}`;
                  return (
                    <li key={o.id}>
                      <Link to={orgSectionPath('okr')} className={rowClass}>
                        <span className="flex-1 truncate text-[15px] font-medium text-[rgb(var(--color-text-primary))]">{o.title}</span>
                        <div
                          className="w-24 sm:w-40 h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden shrink-0"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={t('teamPage.okrProgressAria', { title: o.title })}
                        >
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: team.color }} />
                        </div>
                        <span className="w-12 text-right text-sm font-medium tabular-nums text-[rgb(var(--color-text-muted))] shrink-0">{pct} %</span>
                      </Link>
                      <div className="px-5 pb-2">
                        <button
                          type="button"
                          onClick={() => toggleKrs(o.id)}
                          aria-expanded={open}
                          aria-controls={krListId}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--color-border))] px-3 py-1.5 min-h-10 text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
                        >
                          {open ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                          {open ? t('teamPage.hideKrs') : t('teamPage.showKrs')}
                        </button>
                      </div>
                      {open && (
                        <ul id={krListId} className="pb-3">
                          {o.keyResults.length === 0 ? (
                            <li className="pl-10 pr-5 py-2 text-sm text-[rgb(var(--color-text-muted))]">{t('teamPage.krEmpty')}</li>
                          ) : (
                            o.keyResults.map((kr) => {
                              const krPct = Math.round(krProgress(kr) * 100);
                              return (
                                <li key={kr.id} className="flex items-center gap-3 pl-10 pr-5 py-2">
                                  <span className="flex-1 truncate text-sm text-[rgb(var(--color-text-secondary))]">{kr.title}</span>
                                  <div
                                    className="w-20 sm:w-32 h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden shrink-0"
                                    role="progressbar"
                                    aria-valuenow={krPct}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-label={t('teamPage.okrProgressAria', { title: kr.title })}
                                  >
                                    <div className="h-full rounded-full opacity-60" style={{ width: `${krPct}%`, backgroundColor: team.color }} />
                                  </div>
                                  <span className="w-20 text-right text-sm tabular-nums text-[rgb(var(--color-text-muted))] shrink-0">
                                    {kr.currentValue} / {kr.targetValue}
                                    {kr.unit ? ` ${kr.unit}` : ''}
                                  </span>
                                </li>
                              );
                            })
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className={`${cardClass} p-6`} aria-labelledby="team-people-title">
          <h3 id="team-people-title" className={headingClass}>{t('teamPage.peopleTitle')}</h3>
          <TeamMembersPanel
            orgId={orgId}
            team={team}
            members={members}
            memberships={teamMemberships}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            canManage={canManage}
          />
        </aside>
      </div>

      {teamProjects.length > 0 && (
        <TeamWorkloadSection orgId={orgId} tasks={tasks} projectIds={projectIds} members={teamMembers} currentUserId={currentUserId} />
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-xl">
          <DialogTitle>{t('teamPage.edit')}</DialogTitle>
          {editing && <TeamProfileEditor orgId={orgId} team={team} onDone={() => setEditing(false)} />}
        </DialogContent>
      </Dialog>

      {planning && (
        <Suspense fallback={null}>
          <TeamEventDialog
            open
            onClose={() => setPlanning(false)}
            members={members}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            defaultParticipantIds={teamMemberships.map((m) => m.userId)}
            color={team.color}
          />
        </Suspense>
      )}

      {deleting && (
        <DeleteTeamDialog orgId={orgId} team={team} teams={teams} onClose={() => setDeleting(false)} />
      )}
    </div>
  );
};

export default TeamPage;
