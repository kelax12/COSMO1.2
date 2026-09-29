import { useMemo, useState, type ReactNode } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, CircleCheck, FolderKanban, Target, UsersRound } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import { useMyOrgPermissions } from '@/modules/organizations';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import {
  aggregateReports,
  groupEventsByPerson,
  groupTasksByProject,
  lastReportDay,
  periodBounds,
  shiftPeriod,
  fromDayKey,
  addDays,
  toDayKey,
  useActivityReports,
  MAX_REPORT_DAYS,
  type ReportPeriodKind,
  type ReportScope,
} from '@/modules/org-reports';
import { useT } from '@/i18n/useT';
import { DatePicker } from '@/components/ui/date-picker';
import { projectColorHex } from './team-projects.helpers';
import { reportAccess } from './report-access.helpers';
import MenuSelect from '@/components/organization/MenuSelect';

interface OrgReportsSectionProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  /** Ouvert depuis la page d'une équipe : le rapport part sur cette équipe si elle est permise. */
  initialTeamId?: string;
}

const card = 'rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 md:p-5';
const muted = 'text-[rgb(var(--color-text-muted))]';
const primary = 'text-[rgb(var(--color-text-primary))]';
const GROUP_PREVIEW = 3;

const hexOf = (color: string | null | undefined) =>
  color && color.startsWith('#') ? color : projectColorHex(color ?? 'blue');

const initials = (name: string | null) =>
  (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

const Avatar = ({ name }: { name: string | null }) => (
  <span
    aria-hidden="true"
    className="w-6 h-6 shrink-0 rounded-full bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))] text-caption font-semibold flex items-center justify-center"
  >
    {initials(name)}
  </span>
);

const BlockTitle = ({ Icon, children }: { Icon: typeof CircleCheck; children: ReactNode }) => (
  <h3 className={`flex items-center gap-2 text-sm font-bold mb-3 ${primary}`}>
    <Icon size={16} aria-hidden="true" className={muted} />
    {children}
  </h3>
);

/**
 * Rapports d'activité (mig. 202) : ce que l'entreprise, ou une équipe, a FAIT
 * sur une période. Chaque journée est figée par le serveur à minuit ; semaine,
 * mois et période libre sont l'agrégat de ces journées.
 */
const OrgReportsSection = ({ orgId, members, currentUserId, initialTeamId }: OrgReportsSectionProps) => {
  const { t, tp, locale } = useT('orgAdmin');
  const { can, isLoading: permsLoading } = useMyOrgPermissions(orgId);
  const { data: teams = [], isLoading: teamsLoading } = useOrgTeams(orgId);
  const { data: teamMembers = [], isLoading: teamMembersLoading } = useOrgTeamMembers(orgId);
  const accessLoading = permsLoading || teamsLoading || teamMembersLoading;
  const access = useMemo(() => reportAccess(can, teams, teamMembers, currentUserId), [can, teams, teamMembers, currentUserId]);

  const lastDay = lastReportDay();
  const [kind, setKind] = useState<ReportPeriodKind>('week');
  const [anchor, setAnchor] = useState(lastDay);
  const [custom, setCustom] = useState({ from: addDays(lastDay, -13), to: lastDay });
  const [pickedScope, setPickedScope] = useState<ReportScope | null>(initialTeamId ? { kind: 'team', teamId: initialTeamId } : null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Périmètre effectif : le choix, s'il est encore permis, sinon le premier permis.
  const scope: ReportScope | null = useMemo(() => {
    const allowed = (s: ReportScope) => (s.kind === 'org' ? access.canOrg : access.teams.some((tm) => tm.id === s.teamId));
    if (pickedScope && allowed(pickedScope)) return pickedScope;
    if (access.canOrg) return { kind: 'org' };
    return access.teams[0] ? { kind: 'team', teamId: access.teams[0].id } : null;
  }, [pickedScope, access]);

  const { from, to } = useMemo(() => {
    if (kind !== 'custom') return periodBounds(kind, anchor);
    const a = custom.from <= custom.to ? custom.from : custom.to;
    const b = custom.from <= custom.to ? custom.to : custom.from;
    // Bornée à un an : au-delà, la requête couperait en silence.
    return { from: a < addDays(b, -(MAX_REPORT_DAYS - 1)) ? addDays(b, -(MAX_REPORT_DAYS - 1)) : a, to: b };
  }, [kind, anchor, custom]);

  const { data: days = [], isLoading, isError, refetch } = useActivityReports(orgId, scope, from, to);
  const report = useMemo(() => aggregateReports(days, from, to), [days, from, to]);
  const taskGroups = useMemo(() => groupTasksByProject(report.tasks), [report.tasks]);
  const eventGroups = useMemo(() => groupEventsByPerson(report.events), [report.events]);
  const memberName = useMemo(() => new Map(members.map((m) => [m.userId, m.displayName])), [members]);

  const fmtDay = (key: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, opts).format(fromDayKey(key));
  const fmtTime = (iso: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const minutes = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
  const fmtDuration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`);
  const multiDay = from !== to;

  const periodLabel = kind === 'day'
    ? fmtDay(from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : kind === 'month'
      ? fmtDay(from, { month: 'long', year: 'numeric' })
      : t(kind === 'week' ? 'reports.weekOf' : 'reports.rangeOf', {
          from: fmtDay(from, { day: 'numeric', month: 'short' }),
          to: fmtDay(to, { day: 'numeric', month: 'short', year: 'numeric' }),
        });

  if (accessLoading) {
    return <p className={`text-sm py-8 text-center ${muted}`}>{t('reports.loading')}</p>;
  }
  if (!scope) {
    return <p className={`text-sm py-8 text-center ${muted}`}>{t('reports.noAccess')}</p>;
  }

  const personName = (id: string | null, frozen: string | null) => frozen ?? (id ? memberName.get(id) : null) ?? t('reports.unknownPerson');
  const toggleGroup = (key: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const openTeam = (teamId: string) => {
    if (access.teams.some((tm) => tm.id === teamId)) setPickedScope({ kind: 'team', teamId });
  };

  const kpis = [
    { label: t('reports.kpiTasks'), value: report.tasks.length },
    { label: t('reports.kpiProjects'), value: report.projects.length },
    { label: t('reports.kpiKrs'), value: report.krs.length },
    { label: t('reports.kpiEvents'), value: report.events.length },
  ];
  const nothing = report.tasks.length + report.projects.length + report.krs.length + report.events.length === 0;
  const segBtn = (active: boolean) =>
    `px-3 py-1.5 text-sm transition-colors ${active
      ? 'bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))] font-semibold'
      : `${primary} hover:bg-[rgb(var(--color-hover))]`}`;
  const input = 'px-2.5 py-1.5 text-sm rounded-lg border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]';

  return (
    <div className="space-y-4">
      {/* Périmètre */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('reports.scopeLabel')}>
        {access.canOrg && access.teams.length > 0 && (
          <div className="inline-flex rounded-lg border border-[rgb(var(--color-border))] overflow-hidden">
            <button type="button" aria-pressed={scope.kind === 'org'} className={segBtn(scope.kind === 'org')} onClick={() => setPickedScope({ kind: 'org' })}>
              {t('reports.scopeOrg')}
            </button>
            <button
              type="button"
              aria-pressed={scope.kind === 'team'}
              className={segBtn(scope.kind === 'team')}
              onClick={() => access.teams[0] && setPickedScope({ kind: 'team', teamId: access.teams[0].id })}
            >
              {t('reports.scopeTeam')}
            </button>
          </div>
        )}
        {scope.kind === 'team' && access.teams.length > 1 && (
          <MenuSelect
            aria-label={t('reports.teamSelect')}
            className={input}
            value={scope.teamId}
            onChange={(e) => setPickedScope({ kind: 'team', teamId: e.target.value })}
          >
            {access.teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
          </MenuSelect>
        )}
        {scope.kind === 'team' && access.teams.length === 1 && (
          <span className={`text-sm font-semibold ${primary}`}>{access.teams[0].name}</span>
        )}
      </div>

      {/* Période */}
      <div className="flex flex-wrap items-center gap-2">
        {kind !== 'custom' && (
          <div className="flex items-center gap-1">
            <button type="button" aria-label={t('reports.prev')} onClick={() => setAnchor(shiftPeriod(kind, anchor, -1))}
              className={`p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] ${primary}`}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span className={`text-sm font-semibold first-letter:uppercase min-w-0 ${primary}`} aria-live="polite">{periodLabel}</span>
            <button type="button" aria-label={t('reports.next')} disabled={to >= lastDay}
              onClick={() => setAnchor(shiftPeriod(kind, anchor, 1) > lastDay ? lastDay : shiftPeriod(kind, anchor, 1))}
              className={`p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] disabled:opacity-40 disabled:cursor-not-allowed ${primary}`}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {kind === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="report-from" className={muted}>{t('reports.from')}</label>
            <DatePicker id="report-from" className="w-40" value={custom.from} allowClear={false} displayFormat="d MMM yyyy"
              onChange={(v) => v && setCustom((c) => ({ ...c, from: v > lastDay ? lastDay : v }))} />
            <label htmlFor="report-to" className={muted}>{t('reports.to')}</label>
            <DatePicker id="report-to" className="w-40" value={custom.to} allowClear={false} displayFormat="d MMM yyyy" minDate={custom.from}
              onChange={(v) => v && setCustom((c) => ({ ...c, to: v > lastDay ? lastDay : v }))} />
          </div>
        )}
        <div className="ml-auto inline-flex rounded-lg border border-[rgb(var(--color-border))] overflow-hidden" role="group" aria-label={t('reports.periodLabel')}>
          {(['day', 'week', 'month', 'custom'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} className={segBtn(kind === k)} onClick={() => setKind(k)}>
              {t(k === 'day' ? 'reports.periodDay' : k === 'week' ? 'reports.periodWeek' : k === 'month' ? 'reports.periodMonth' : 'reports.periodCustom')}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className={`text-sm py-8 text-center ${muted}`}>{t('reports.loading')}</p>
      ) : isError ? (
        <div className={`${card} text-center`}>
          <p className={`text-sm mb-2 ${primary}`}>{t('reports.error')}</p>
          <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-blue-500 hover:text-blue-600">{t('reports.retry')}</button>
        </div>
      ) : (
        <>
          {/* Chiffres clés */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl bg-[rgb(var(--color-hover))] p-3 md:p-4">
                <div className={`text-xs ${muted}`}>{k.label}</div>
                <div className={`text-2xl font-bold tabular-nums ${primary}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {report.daysCovered === 0 ? (
            <p className={`text-sm py-6 text-center ${muted}`}>{t('reports.noReportYet')}</p>
          ) : nothing && report.teams.every((tm) => tm.tasksDone === 0) ? (
            <p className={`text-sm py-6 text-center ${muted}`}>{t('reports.empty')}</p>
          ) : null}

          {report.truncated && <p className={`text-xs ${muted}`}>{t('reports.truncated')}</p>}

          {/* Performance par équipe (rapport d'entreprise) */}
          {scope.kind === 'org' && report.teams.length > 0 && (
            <section className={card}>
              <BlockTitle Icon={UsersRound}>{t('reports.teamsTitle')}</BlockTitle>
              <ul className="divide-y divide-[rgb(var(--color-border))]">
                {report.teams.map((tm) => {
                  const max = Math.max(1, ...report.teams.map((x) => x.tasksDone));
                  const openable = access.teams.some((x) => x.id === tm.id);
                  const body = (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hexOf(tm.color) }} aria-hidden="true" />
                      <span className={`w-32 md:w-44 truncate text-sm ${primary}`}>{tm.name}</span>
                      <span className="flex-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(tm.tasksDone / max) * 100}%` }} />
                      </span>
                      <span className={`text-xs tabular-nums shrink-0 ${muted}`}>{tp('reports.teamsTasks', tm.tasksDone)}</span>
                    </>
                  );
                  return (
                    <li key={tm.id}>
                      {openable ? (
                        <button type="button" onClick={() => openTeam(tm.id)} aria-label={t('reports.teamsOpen', { name: tm.name })}
                          className="w-full flex items-center gap-3 py-2 text-left hover:bg-[rgb(var(--color-hover))] rounded-lg px-1 -mx-1">
                          {body}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 py-2">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Tâches terminées, par projet */}
          {taskGroups.length > 0 && (
            <section className={card}>
              <BlockTitle Icon={CircleCheck}>{t('reports.tasksTitle')}</BlockTitle>
              <div className="space-y-4">
                {taskGroups.map((g) => {
                  const key = g.projectId ?? '';
                  const open = expanded.has(key);
                  const shown = open ? g.tasks : g.tasks.slice(0, GROUP_PREVIEW);
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2 mb-1">
                        {g.projectId && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hexOf(g.projectColor) }} aria-hidden="true" />}
                        <span className={`text-sm font-semibold ${primary}`}>{g.projectName ?? t('reports.noProject')}</span>
                        <span className={`text-xs ${muted}`}>· {tp('reports.groupCount', g.tasks.length)}</span>
                      </div>
                      <ul className="divide-y divide-[rgb(var(--color-border))]">
                        {shown.map((task) => {
                          const who = personName(task.byId, task.byName);
                          return (
                            <li key={task.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                              <Avatar name={who} />
                              <span className={`flex-1 min-w-0 truncate ${primary}`}>{task.name}</span>
                              <span className={`text-xs shrink-0 ${muted}`}>
                                {who} · {multiDay ? `${fmtDay(toDayKey(new Date(task.at)), { day: 'numeric', month: 'short' })} ` : ''}{fmtTime(task.at)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {g.tasks.length > GROUP_PREVIEW && (
                        <button type="button" aria-expanded={open} onClick={() => toggleGroup(key)}
                          className="mt-1 text-xs font-semibold text-blue-500 hover:text-blue-600">
                          {open ? t('reports.showLess') : t('reports.showAll', { count: g.tasks.length })}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Avancement des projets */}
          {report.projects.length > 0 && (
            <section className={card}>
              <BlockTitle Icon={FolderKanban}>{t('reports.projectsTitle')}</BlockTitle>
              <ul className="divide-y divide-[rgb(var(--color-border))]">
                {report.projects.map((p) => (
                  <li key={p.id} className="flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                    <span className={`w-full md:w-48 truncate ${primary}`}>{p.name}</span>
                    <span className="flex-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden relative" aria-hidden="true">
                      <span className="absolute inset-y-0 left-0 bg-emerald-500/35" style={{ width: `${p.after}%` }} />
                      <span className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${p.before}%` }} />
                    </span>
                    <span className={`w-10 text-right tabular-nums ${primary}`}>{p.after} %</span>
                    <span className="w-20 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {p.after >= 100 ? t('reports.projectDone') : t('reports.projectDelta', { count: p.after - p.before })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Avancement des KR */}
          {report.krs.length > 0 && (
            <section className={card}>
              <BlockTitle Icon={Target}>{t('reports.krsTitle')}</BlockTitle>
              <ul className="divide-y divide-[rgb(var(--color-border))]">
                {report.krs.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="flex-1 min-w-0">
                      <span className={`block truncate ${primary}`}>{k.title}</span>
                      <span className={`block truncate text-xs ${muted}`}>{k.okrTitle}</span>
                    </span>
                    <span className={`tabular-nums shrink-0 ${primary}`}>
                      {k.before !== null ? `${k.before} % → ` : ''}{k.after} %
                    </span>
                    <span className="w-16 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {k.completed ? t('reports.krCompleted') : k.before !== null ? t('reports.projectDelta', { count: k.after - k.before }) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Événements, par personne */}
          {eventGroups.length > 0 && (
            <section className={card}>
              <BlockTitle Icon={CalendarClock}>{t('reports.eventsTitle')}</BlockTitle>
              <ul className="divide-y divide-[rgb(var(--color-border))]">
                {eventGroups.map((g) => {
                  const who = personName(g.userId, g.userName);
                  return (
                    <li key={g.userId} className="flex items-start gap-2.5 py-2 text-sm">
                      <Avatar name={who} />
                      <span className={`w-28 shrink-0 truncate font-medium ${primary}`}>{who}</span>
                      <ul className="flex-1 min-w-0 space-y-0.5">
                        {g.events.map((e, i) => (
                          <li key={`${e.start}-${i}`} className="flex gap-2">
                            <span className={`truncate ${primary}`}>{e.title}</span>
                            <span className={`text-xs shrink-0 mt-0.5 ${muted}`}>
                              {multiDay ? `${fmtDay(toDayKey(new Date(e.start)), { day: 'numeric', month: 'short' })} ` : ''}{fmtTime(e.start)}, {fmtDuration(minutes(e.start, e.end))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <p className={`text-xs ${muted}`}>{t('reports.footer')}</p>
        </>
      )}
    </div>
  );
};

export default OrgReportsSection;
