import { useMemo, useState, type ReactNode } from 'react';
import {
  ChevronLeft, ChevronRight, CircleCheck, Download, FolderKanban, Sparkles, Target, UsersRound,
} from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import { useMyOrgPermissions } from '@/modules/organizations';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import {
  aggregateReports,
  buildHighlights,
  dailySeries,
  eventMinutes,
  groupActivityByPerson,
  lastReportDay,
  periodBounds,
  previousPeriod,
  shiftPeriod,
  sortKrsByGain,
  sortProjectsByGain,
  totalEventMinutes,
  trendOf,
  fromDayKey,
  addDays,
  toDayKey,
  useActivityReports,
  MAX_REPORT_DAYS,
  type PersonActivity,
  type ReportPeriodKind,
  type ReportScope,
  type Trend,
} from '@/modules/org-reports';
import { useT } from '@/i18n/useT';
import { toast } from '@/lib/toast';
import { DatePicker } from '@/components/ui/date-picker';
import { projectColorHex } from './team-projects.helpers';
import { reportAccess } from './report-access.helpers';
import MenuSelect from '@/components/organization/MenuSelect';
import type { ReportPdfModel } from './report-pdf';
import ReportPeopleList, { type PeopleSort } from './ReportPeopleList';

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

const hexOf = (color: string | null | undefined) =>
  color && color.startsWith('#') ? color : projectColorHex(color ?? 'blue');

const BlockTitle = ({ Icon, children, aside }: { Icon: typeof CircleCheck; children: ReactNode; aside?: ReactNode }) => (
  <div className="flex items-center gap-2 mb-3">
    <h3 className={`flex items-center gap-2 text-sm font-bold ${primary}`}>
      <Icon size={16} aria-hidden="true" className={muted} />
      {children}
    </h3>
    {aside && <span className={`ml-auto text-xs ${muted}`}>{aside}</span>}
  </div>
);

/** Avant la période en gris, le gain de la période en vert à sa suite. */
const ProgressBar = ({ before, after }: { before: number; after: number }) => {
  const from = Math.min(100, Math.max(0, before));
  const to = Math.min(100, Math.max(from, after));
  return (
    <span className="mt-1.5 block h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden relative" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 bg-[rgb(var(--color-text-muted)/0.35)]" style={{ width: `${from}%` }} />
      <span className="absolute inset-y-0 bg-emerald-500" style={{ left: `${from}%`, width: `${to - from}%` }} />
    </span>
  );
};

const Badge = ({ children }: { children: ReactNode }) => (
  <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
    {children}
  </span>
);

type Tone = 'up' | 'down' | 'flat';
const toneOf = (trend: Trend): Tone => (trend.delta > 0 ? 'up' : trend.delta < 0 ? 'down' : 'flat');
const toneClass: Record<Tone, string> = {
  up: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  down: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  flat: 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-muted))]',
};
const strokeOf: Record<Tone, string> = { up: '#10b981', down: '#d97706', flat: 'rgb(var(--color-text-muted))' };

/** Courbe jour par jour d'un chiffre clé : décorative, le chiffre et la tendance portent le sens. */
const Sparkline = ({ values, tone }: { values: number[]; tone: Tone }) => {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${18 - (v / max) * 16}`).join(' ');
  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="mt-1 w-full h-5" aria-hidden="true">
      <polyline fill="none" stroke={strokeOf[tone]} strokeWidth="2" vectorEffect="non-scaling-stroke" points={points} />
    </svg>
  );
};

/**
 * Rapports d'activité (mig. 202) : ce que l'entreprise, ou une équipe, a FAIT
 * sur une période. Chaque journée est figée par le serveur à minuit ; semaine,
 * mois et période libre sont l'agrégat de ces journées. Chaque chiffre se lit
 * contre la période de même longueur qui précède.
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
  const [peopleSort, setPeopleSort] = useState<PeopleSort>('tasks');
  const [exporting, setExporting] = useState(false);

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
  const prev = useMemo(() => previousPeriod(from, to), [from, to]);

  const { data: days = [], isLoading, isError, refetch } = useActivityReports(orgId, scope, from, to);
  const { data: prevDays } = useActivityReports(orgId, scope, prev.from, prev.to);
  const report = useMemo(() => aggregateReports(days, from, to), [days, from, to]);
  const prevReport = useMemo(() => (prevDays ? aggregateReports(prevDays, prev.from, prev.to) : null), [prevDays, prev]);
  // Sans journée générée avant, il n'y a rien à comparer : pas de tendance plutôt qu'un faux « +100 % ».
  const hasPrev = !!prevReport && prevReport.daysCovered > 0;
  const series = useMemo(() => dailySeries(days, from, to), [days, from, to]);
  const highlights = useMemo(() => buildHighlights(report, hasPrev ? prevReport!.tasks.length : null), [report, hasPrev, prevReport]);
  const projects = useMemo(() => sortProjectsByGain(report.projects), [report.projects]);
  const krs = useMemo(() => sortKrsByGain(report.krs), [report.krs]);
  const memberName = useMemo(() => new Map(members.map((m) => [m.userId, m.displayName])), [members]);

  const fmtDay = (key: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, opts).format(fromDayKey(key));
  const fmtTime = (iso: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const fmtDuration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}` : `${m} min`);
  const multiDay = from !== to;

  const personName = (id: string | null, frozen: string | null) => frozen ?? (id ? memberName.get(id) : null) ?? t('reports.unknownPerson');
  const people = useMemo(() => {
    const list = groupActivityByPerson(report.tasks, report.events).map((p) => ({ ...p, minutes: totalEventMinutes(p.events) }));
    if (peopleSort === 'agenda') return [...list].sort((a, b) => b.minutes - a.minutes || b.tasks.length - a.tasks.length);
    if (peopleSort === 'name') {
      return [...list].sort((a, b) => (a.userName ?? memberName.get(a.userId ?? '') ?? '').localeCompare(b.userName ?? memberName.get(b.userId ?? '') ?? '', locale));
    }
    return list;
  }, [report.tasks, report.events, peopleSort, memberName, locale]);

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

  const scopeName = scope.kind === 'org'
    ? t('reports.scopeAll')
    : access.teams.find((tm) => tm.id === scope.teamId)?.name ?? t('reports.scopeTeam');
  const scopeOptions = [
    ...(access.canOrg ? [{ value: 'org', label: t('reports.scopeAll') }] : []),
    ...access.teams.map((tm) => ({ value: tm.id, label: tm.name })),
  ];
  const openTeam = (teamId: string) => {
    if (access.teams.some((tm) => tm.id === teamId)) setPickedScope({ kind: 'team', teamId });
  };

  const trendLabel = (trend: Trend, unit?: (n: number) => string) => {
    if (trend.delta === 0) return t('reports.trendSame');
    const sign = trend.delta > 0 ? '+' : '-';
    if (unit) return `${sign}${unit(Math.abs(trend.delta))}`;
    return trend.percent !== null ? `${sign}${Math.abs(trend.percent)} %` : `${sign}${Math.abs(trend.delta)}`;
  };
  const agendaMinutes = totalEventMinutes(report.events);
  const kpis = [
    { label: t('reports.kpiTasks'), value: String(report.tasks.length), series: series.tasks,
      trend: hasPrev ? trendOf(report.tasks.length, prevReport!.tasks.length) : null, unit: undefined },
    { label: t('reports.kpiProjects'), value: String(report.projects.length), series: series.projects,
      trend: hasPrev ? trendOf(report.projects.length, prevReport!.projects.length) : null, unit: undefined },
    { label: t('reports.kpiKrs'), value: String(report.krs.length), series: series.krs,
      trend: hasPrev ? trendOf(report.krs.length, prevReport!.krs.length) : null, unit: undefined },
    { label: t('reports.kpiAgenda'), value: fmtDuration(agendaMinutes), series: series.eventMinutes,
      trend: hasPrev ? trendOf(agendaMinutes, totalEventMinutes(prevReport!.events)) : null, unit: fmtDuration },
  ].map((k) => ({ ...k, tone: k.trend ? toneOf(k.trend) : ('flat' as Tone), trendText: k.trend ? trendLabel(k.trend, k.unit) : null }));

  // Le résumé en phrases : partagé par l'écran et le PDF.
  const summary: string[] = [];
  if (highlights.projectsDone.length > 0) {
    summary.push(tp('reports.hlProjectsDone', highlights.projectsDone.length, { name: highlights.projectsDone[0].name }));
  }
  if (highlights.krsCompleted.length > 0) summary.push(tp('reports.hlKrs', highlights.krsCompleted.length));
  if (scope.kind === 'org' && highlights.topTeam) summary.push(t('reports.hlTopTeam', highlights.topTeam));
  if (summary.length === 0 && report.tasks.length > 0) summary.push(tp('reports.hlTasks', report.tasks.length));
  // Une hausse « depuis zéro » n'a pas de pourcentage : on ne la raconte pas.
  const tr = highlights.tasksTrend;
  if (tr && report.tasks.length > 0) {
    if (tr.delta === 0 || tr.percent === 0) summary.push(t('reports.hlTrendFlat'));
    else if (tr.percent !== null) summary.push(t(tr.delta > 0 ? 'reports.hlTrendUp' : 'reports.hlTrendDown', { percent: Math.abs(tr.percent) }));
  }

  const nothing = report.tasks.length + report.projects.length + report.krs.length + report.events.length === 0;
  const segBtn = (active: boolean) =>
    `px-3 py-1.5 text-sm transition-colors ${active
      ? 'bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))] font-semibold'
      : `${primary} hover:bg-[rgb(var(--color-hover))]`}`;
  const input = 'px-2.5 py-1.5 text-sm rounded-lg border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]';
  const iconBtn = `p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] disabled:opacity-40 disabled:cursor-not-allowed ${primary}`;


  /** Tâches puis événements d'une personne, avec leur moment : l'écran et le PDF lisent la même liste. */
  const personItems = (p: PersonActivity) => [
    ...p.tasks.map((task) => ({
      key: task.id, kind: 'task' as const, text: task.name,
      when: multiDay ? fmtDay(toDayKey(new Date(task.at)), { weekday: 'short', day: 'numeric' }) : fmtTime(task.at),
    })),
    ...p.events.map((e, i) => ({
      key: `${e.start}-${i}`, kind: 'event' as const, text: `${e.title} · ${fmtDuration(eventMinutes(e))}`,
      when: `${multiDay ? `${fmtDay(toDayKey(new Date(e.start)), { weekday: 'short', day: 'numeric' })} ` : ''}${fmtTime(e.start)}`,
    })),
  ];
  const personMeta = (p: PersonActivity & { minutes: number }) => [
    tp('reports.groupCount', p.tasks.length),
    p.minutes > 0 ? t('reports.agendaTime', { time: fmtDuration(p.minutes) }) : null,
  ].filter(Boolean).join(' · ');

  const progressDetail = (before: number | null, after: number) =>
    before !== null ? `${before} → ${after} % · ${t('reports.projectDelta', { count: after - before })}` : `${after} %`;

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { downloadReportPdf } = await import('./report-pdf');
      const model: ReportPdfModel = {
        fileName: `rapport-${scope.kind === 'org' ? 'entreprise' : scopeName.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${from}_${to}.pdf`,
        title: t('reports.title'),
        scopeLabel: scopeName,
        periodLabel: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1),
        generatedLabel: t('reports.pdfGenerated', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date()) }),
        pageLabel: (page, total) => t('reports.pdfPage', { page, total }),
        summaryTitle: t('reports.summaryTitle'),
        summary,
        kpis: kpis.map((k) => ({ label: k.label, value: k.value, trend: k.trendText, tone: k.trend ? k.tone : null, series: k.series })),
        teamsTitle: t('reports.teamsTitle'),
        teams: scope.kind === 'org'
          ? report.teams.map((tm) => ({ name: tm.name, color: hexOf(tm.color), value: tm.tasksDone, label: tp('reports.teamsTasks', tm.tasksDone) }))
          : [],
        projectsTitle: t('reports.projectsTitle'),
        projects: projects.map((p) => ({
          name: p.name, before: p.before, after: p.after,
          badge: p.after >= 100 ? t('reports.projectDone') : null, detail: progressDetail(p.before, p.after),
        })),
        krsTitle: t('reports.krsTitle'),
        krs: krs.map((k) => ({
          name: k.title, sub: k.okrTitle, before: k.before ?? k.after, after: k.after,
          badge: k.completed ? t('reports.krCompleted') : null, detail: progressDetail(k.before, k.after),
        })),
        peopleTitle: t('reports.peopleTitle'),
        people: people.map((p) => ({
          name: personName(p.userId, p.userName),
          meta: personMeta(p),
          items: personItems(p).map(({ kind: k, text, when }) => ({ kind: k, text, when })),
        })),
        footer: t('reports.footer'),
      };
      await downloadReportPdf(model);
    } catch {
      toast.error(t('reports.exportError'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Périmètre, période, export */}
      <div className="flex flex-wrap items-center gap-2">
        <div data-guide-id="report-scope" role="group" aria-label={t('reports.scopeLabel')}>
          {scopeOptions.length > 1 ? (
            <MenuSelect
              aria-label={t('reports.scopeLabel')}
              className={input}
              value={scope.kind === 'org' ? 'org' : scope.teamId}
              onChange={(e) => setPickedScope(e.target.value === 'org' ? { kind: 'org' } : { kind: 'team', teamId: e.target.value })}
            >
              {scopeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </MenuSelect>
          ) : (
            <span className={`text-sm font-semibold ${primary}`}>{scopeName}</span>
          )}
        </div>

        {kind !== 'custom' && (
          <div className="flex items-center gap-1 min-w-0">
            <button type="button" aria-label={t('reports.prev')} onClick={() => setAnchor(shiftPeriod(kind, anchor, -1))} className={iconBtn}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span className={`text-sm font-semibold first-letter:uppercase min-w-0 ${primary}`} aria-live="polite">{periodLabel}</span>
            <button type="button" aria-label={t('reports.next')} disabled={to >= lastDay}
              onClick={() => setAnchor(shiftPeriod(kind, anchor, 1) > lastDay ? lastDay : shiftPeriod(kind, anchor, 1))}
              className={iconBtn}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div data-guide-id="report-period" className="inline-flex rounded-lg border border-[rgb(var(--color-border))] overflow-hidden" role="group" aria-label={t('reports.periodLabel')}>
            {(['day', 'week', 'month', 'custom'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} className={segBtn(kind === k)} onClick={() => setKind(k)}>
                {t(k === 'day' ? 'reports.periodDay' : k === 'week' ? 'reports.periodWeek' : k === 'month' ? 'reports.periodMonth' : 'reports.periodCustom')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportPdf}
            disabled={exporting || isLoading || isError}
            aria-label={exporting ? t('reports.exporting') : t('reports.exportPdf')}
            title={t('reports.exportPdf')}
            className={`p-2 rounded-lg border border-[rgb(var(--color-border))] ${iconBtn}`}
          >
            <Download size={16} aria-hidden="true" className={exporting ? 'animate-pulse' : undefined} />
          </button>
        </div>
      </div>

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

      {isLoading ? (
        <p className={`text-sm py-8 text-center ${muted}`}>{t('reports.loading')}</p>
      ) : isError ? (
        <div className={`${card} text-center`}>
          <p className={`text-sm mb-2 ${primary}`}>{t('reports.error')}</p>
          <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-blue-500 hover:text-blue-600">{t('reports.retry')}</button>
        </div>
      ) : (
        <>
          {/* En bref */}
          {summary.length > 0 && (
            <section className="rounded-2xl bg-[rgb(var(--color-hover))] p-4" aria-labelledby="report-summary-title">
              <h3 id="report-summary-title" className={`flex items-center gap-1.5 text-xs mb-1 ${muted}`}>
                <Sparkles size={14} aria-hidden="true" />
                {t('reports.summaryTitle')}
              </h3>
              <p className={`text-sm leading-relaxed ${primary}`}>{summary.join(' ')}</p>
            </section>
          )}

          {/* Chiffres clés, comparés à la période précédente */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl bg-[rgb(var(--color-hover))] p-3 md:p-4">
                <div className={`text-xs ${muted}`}>{k.label}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-2xl font-bold tabular-nums ${primary}`}>{k.value}</span>
                  {k.trendText && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${toneClass[k.tone]}`}
                      aria-label={t('reports.trendAria', { value: k.trendText })}>
                      {k.trendText}
                    </span>
                  )}
                </div>
                {multiDay && <Sparkline values={k.series} tone={k.tone} />}
              </div>
            ))}
          </div>

          {report.daysCovered === 0 ? (
            <div className="py-6 text-center space-y-2">
              <p className={`text-sm ${muted}`}>{t('reports.noReportYet')}</p>
              {kind !== 'custom' && (
                <button type="button" onClick={() => setAnchor(shiftPeriod(kind, anchor, -1))} className="text-sm font-semibold text-[rgb(var(--color-accent))] hover:underline">
                  {t('reports.emptyGoPrev')}
                </button>
              )}
            </div>
          ) : nothing && report.teams.every((tm) => tm.tasksDone === 0) ? (
            <div className="py-6 text-center space-y-2">
              <p className={`text-sm ${muted}`}>{t('reports.empty')}</p>
              {kind !== 'custom' && (
                <button type="button" onClick={() => setAnchor(shiftPeriod(kind, anchor, -1))} className="text-sm font-semibold text-[rgb(var(--color-accent))] hover:underline">
                  {t('reports.emptyGoPrev')}
                </button>
              )}
            </div>
          ) : null}

          {report.truncated && <p className={`text-xs ${muted}`}>{t('reports.truncated')}</p>}

          {/* Par équipe (rapport d'entreprise) : la deuxième question qu'on se pose */}
          {scope.kind === 'org' && report.teams.length > 0 && (
            <section className={card}>
              <BlockTitle Icon={UsersRound} aside={access.teams.length > 0 ? <span className="hidden md:inline">{t('reports.teamsHint')}</span> : undefined}>
                {t('reports.teamsTitle')}
              </BlockTitle>
              <ul>
                {report.teams.map((tm) => {
                  const max = Math.max(1, ...report.teams.map((x) => x.tasksDone));
                  const openable = access.teams.some((x) => x.id === tm.id);
                  const body = (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hexOf(tm.color) }} aria-hidden="true" />
                      <span className={`w-24 md:w-44 truncate text-sm ${primary}`}>{tm.name}</span>
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

          {/* Projets et OKR qui ont avancé : terminés d'abord, puis le plus gros gain */}
          {(projects.length > 0 || krs.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {projects.length > 0 && (
                <section className={card}>
                  <BlockTitle Icon={FolderKanban}>{t('reports.projectsTitle')}</BlockTitle>
                  <ul className="space-y-3">
                    {projects.map((p) => (
                      <li key={p.id} className="text-sm">
                        <div className="flex items-center gap-3">
                          <span className={`flex-1 min-w-0 truncate ${primary}`}>{p.name}</span>
                          {p.after >= 100
                            ? <Badge>{t('reports.projectDone')}</Badge>
                            : <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{t('reports.projectDelta', { count: p.after - p.before })}</span>}
                        </div>
                        <ProgressBar before={p.before} after={p.after} />
                        <span className={`block text-xs mt-1 tabular-nums ${muted}`}>{p.before} → {p.after} %</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {krs.length > 0 && (
                <section className={card}>
                  <BlockTitle Icon={Target}>{t('reports.krsTitle')}</BlockTitle>
                  <ul className="space-y-3">
                    {krs.map((k) => (
                      <li key={k.id} className="text-sm">
                        <div className="flex items-center gap-3">
                          <span className={`flex-1 min-w-0 truncate ${primary}`}>{k.title}</span>
                          {k.completed
                            ? <Badge>{t('reports.krCompleted')}</Badge>
                            : k.before !== null && (
                              <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{t('reports.projectDelta', { count: k.after - k.before })}</span>
                            )}
                        </div>
                        <ProgressBar before={k.before ?? k.after} after={k.after} />
                        <span className={`block truncate text-xs mt-1 ${muted}`}>
                          {k.okrTitle} · {k.before !== null ? `${k.before} → ` : ''}{k.after} %
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {/* Personnes : une ligne compacte chacune, le détail s'ouvre au clic */}
          {people.length > 0 && (
            <ReportPeopleList
              people={people}
              sort={peopleSort}
              onSortChange={setPeopleSort}
              nameOf={(p) => personName(p.userId, p.userName)}
              metaOf={personMeta}
              itemsOf={personItems}
              inputClassName={input}
            />
          )}

          <p className={`text-xs ${muted}`}>{t('reports.footer')}</p>
        </>
      )}
    </div>
  );
};

export default OrgReportsSection;
