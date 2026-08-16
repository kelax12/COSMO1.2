// Dashboard admin de croissance — /admin (aucun lien dans l'app).
// La frontière de sécurité est la RPC get_admin_stats() (42501 si non
// admin) ; ici le Navigate n'est que de l'UX. Jamais d'error.message
// rendu (règle V7) : tout échec redirige silencieusement vers /dashboard.
import React, { Suspense, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router';
import { format } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { PageHeading } from '@/components/ui/typography';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useAdminStats,
  chooseGranularity,
  fillMissingDays,
  aggregateWeekly,
  toCumulative,
  rankSources,
  stackBySource,
  ACQUISITION_GOALS,
  type DailyPoint,
  type Granularity,
} from '@/modules/admin';
import type { AdminChartPoint, LabeledValue } from './admin/AdminCharts';
import { useT } from '@/i18n/useT';

// Règle P-2 : recharts (vendor-charts) chargé uniquement quand un admin
// ouvre effectivement la page.
const SignupsChart = React.lazy(() =>
  import('./admin/AdminCharts').then((m) => ({ default: m.SignupsChart }))
);
const DauChart = React.lazy(() =>
  import('./admin/AdminCharts').then((m) => ({ default: m.DauChart }))
);
const PercentBars = React.lazy(() =>
  import('./admin/AdminCharts').then((m) => ({ default: m.PercentBars }))
);
const CountBars = React.lazy(() =>
  import('./admin/AdminCharts').then((m) => ({ default: m.CountBars }))
);
const Donut = React.lazy(() =>
  import('./admin/AdminCharts').then((m) => ({ default: m.Donut }))
);
const SourceStackChart = React.lazy(() =>
  import('./admin/AdminCharts').then((m) => ({ default: m.SourceStackChart }))
);
const GoalChart = React.lazy(() =>
  import('./admin/AdminCharts').then((m) => ({ default: m.GoalChart }))
);

// 'YYYY-MM-DD' → Date locale (jamais new Date('YYYY-MM-DD') : parse UTC).
const toLocalDate = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const formatLabel = (day: string, granularity: Granularity): string => {
  const date = toLocalDate(day);
  return granularity === 'week'
    ? `sem. ${format(date, 'd MMM', { locale: getDateLocale() })}`
    : format(date, 'd MMM', { locale: getDateLocale() });
};

/** Zéro-fill jusqu'à aujourd'hui puis bucket jour/semaine selon le span. */
const bucketize = (points: DailyPoint[], today: string) => {
  const filled = fillMissingDays(points, today);
  const granularity = chooseGranularity(filled);
  const bucketed = granularity === 'week' ? aggregateWeekly(filled) : filled;
  return { bucketed, granularity };
};

const pct = (part: number, total: number): string =>
  total > 0 ? `${Math.round((100 * part) / total)}%` : '·';

const pctNum = (part: number, total: number): number =>
  total > 0 ? Math.round((100 * part) / total) : 0;

const KpiCard: React.FC<{ label: string; value: string; hint?: string; highlight?: boolean }> = ({
  label,
  value,
  hint,
  highlight,
}) => (
  <div
    className="card p-5"
    style={highlight ? { borderColor: 'rgb(var(--color-accent))', borderWidth: 2 } : undefined}
  >
    <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>{label}</p>
    <p
      className="text-xl font-bold"
      style={{ color: highlight ? 'rgb(var(--color-accent))' : 'rgb(var(--color-text-primary))' }}
    >
      {value}
    </p>
    {hint && (
      <p className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>{hint}</p>
    )}
  </div>
);

const EmptyChart: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="h-[260px] flex items-center justify-center rounded-xl text-sm"
    style={{ backgroundColor: 'rgb(var(--color-hover))', color: 'rgb(var(--color-text-muted))' }}
  >
    {children}
  </div>
);

const ChartCard: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <div className="card p-4 md:p-6">
    <h2 className="font-bold mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>{title}</h2>
    {note && (
      <p className="text-xs mb-3" style={{ color: 'rgb(var(--color-text-muted))' }}>{note}</p>
    )}
    <Suspense fallback={<div className="h-[260px] rounded-xl animate-pulse" style={{ backgroundColor: 'rgb(var(--color-hover))' }} />}>
      {children}
    </Suspense>
  </div>
);

const AdminPage: React.FC = () => {
  const { t } = useT('admin');
  const { isDemo } = useAuth();
  const { data, isLoading, error } = useAdminStats();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const today = useMemo(() => new Date().toLocaleDateString('en-CA'), []);

  const signups = useMemo(() => {
    if (!data) return null;
    const { bucketed, granularity } = bucketize(data.signupsByDay, today);
    const cumulative = toCumulative(bucketed);
    const points: AdminChartPoint[] = bucketed.map((p, i) => ({
      label: formatLabel(p.day, granularity),
      nouveaux: p.count,
      total: cumulative[i].count,
    }));
    return { points, granularity };
  }, [data, today]);

  const dau = useMemo(() => {
    if (!data || data.dau.length === 0) return null;
    const { bucketed, granularity } = bucketize(data.dau, today);
    const points: AdminChartPoint[] = bucketed.map((p) => ({
      label: formatLabel(p.day, granularity),
      actifs: p.count,
    }));
    return { points, granularity };
  }, [data, today]);

  if (isDemo) return <Navigate to="/dashboard" replace />;
  if (error) return <Navigate to="/dashboard" replace />;

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { totals, demo, usage, adoption, activation24h, tasksCompletion, collaboration, stickiness } = data;
  const { activation48h, orgs, retentionD7BySource } = data;

  // ── Plan d'acquisition 30 j (mig. 099) ───────────────────────────────
  // Canaux triés par volume : c'est cet ordre qui pilote « couper / doubler ».
  const sources = rankSources(data.signupsBySource);
  const sourceRows = sources.map((source) => {
    const signupsCount =
      source === 'autres'
        ? totals.users - sources.reduce((s, k) => s + (data.signupsBySource[k] ?? 0), 0)
        : (data.signupsBySource[source] ?? 0);
    const act = activation48h.bySource[source];
    const ret = retentionD7BySource[source];
    return { source, signups: signupsCount, activation: act, retention: ret };
  });

  // Série empilée : 60 derniers jours renseignés, au-delà le graphe est illisible.
  const stackRows = stackBySource(data.signupsBySourceByDay, sources).slice(-60);
  const stackPoints: AdminChartPoint[] = stackRows.map(({ day, ...counts }) => ({
    label: formatLabel(day, 'day'),
    ...counts,
  }));

  // ── Données des graphiques (dérivées, pas de useMemo : calculs triviaux) ──
  // Répartition de l'activité : segments exclusifs qui somment au total.
  const activityData: LabeledValue[] = [
    { label: "Actifs aujourd'hui", value: totals.activeToday },
    { label: 'Actifs 7 j', value: Math.max(0, totals.active7d - totals.activeToday) },
    { label: 'Inactifs 7-30 j', value: Math.max(0, totals.inactive7dPlus - totals.inactive30dPlus) },
    { label: 'Inactifs 30 j+', value: totals.inactive30dPlus },
  ].filter((d) => d.value > 0);

  const providerData: LabeledValue[] = Object.entries(data.signupsByProvider).map(([provider, count]) => ({
    label: provider.charAt(0).toUpperCase() + provider.slice(1),
    value: count,
    hint: `${count} comptes (${pct(count, totals.users)})`,
  }));

  const adoptionData: LabeledValue[] = [
    { label: '≥1 tâche', value: pctNum(adoption.tasksUsers, totals.users), hint: `${adoption.tasksUsers}/${totals.users} utilisateurs` },
    { label: '≥1 habitude', value: pctNum(adoption.habitsUsers, totals.users), hint: `${adoption.habitsUsers}/${totals.users} utilisateurs` },
    { label: t('eventsAtLeastOne'), value: pctNum(adoption.eventsUsers, totals.users), hint: t('usersRatio', { count: adoption.eventsUsers, total: totals.users }) },
    { label: '≥1 OKR', value: pctNum(adoption.okrsUsers, totals.users), hint: `${adoption.okrsUsers}/${totals.users} utilisateurs` },
  ];

  const engagementData: LabeledValue[] = [
    { label: t('activation24h'), value: pctNum(activation24h.activated, activation24h.total), hint: t('activationHint', { count: activation24h.activated, total: activation24h.total }) },
    { label: t('taskCompletion'), value: pctNum(tasksCompletion.completed, tasksCompletion.total), hint: t('taskCompletionHint', { count: tasksCompletion.completed, total: tasksCompletion.total }) },
    { label: 'Stickiness DAU/MAU', value: pctNum(stickiness.dau, stickiness.mau), hint: `${stickiness.dau} actifs aujourd'hui / ${stickiness.mau} sur 30 j` },
    { label: 'Churn 30 j+', value: pctNum(totals.inactive30dPlus, totals.users), hint: `${totals.inactive30dPlus}/${totals.users} comptes inactifs depuis 30 j+` },
  ];

  const usageData: LabeledValue[] = [
    { label: 'Tâches', value: usage.tasks },
    { label: 'Habitudes', value: usage.habits },
    { label: t('events'), value: usage.events },
    { label: 'OKRs', value: usage.okrs },
    { label: 'Partages', value: usage.sharedTasks },
  ];

  const collabData: LabeledValue[] = [
    { label: t('shared'), value: collaboration.sharers, hint: t('sharedHint', { count: collaboration.sharers, pct: pct(collaboration.sharers, totals.users) }) },
    { label: 'Ont ≥1 ami', value: collaboration.usersWithFriends, hint: `${collaboration.usersWithFriends} users (${pct(collaboration.usersWithFriends, totals.users)})` },
    { label: t('acceptedRequests'), value: collaboration.acceptedRequests },
  ];

  const demoData: LabeledValue[] = [
    { label: t('demoVisitors'), value: demo.visitors },
    { label: t('accountsCreated'), value: demo.converted, hint: t('demoConverted', { count: demo.converted, pct: demo.visitors > 0 ? `${demo.conversionPct}%` : '·' }) },
  ];

  // Cohortes rétention : les 12 dernières semaines, ordre chronologique.
  const retentionData: LabeledValue[] = data.retentionJ7.slice(-12).map((c) => ({
    label: format(toLocalDate(c.week), 'd MMM', { locale: getDateLocale() }),
    value: pctNum(c.retained, c.signups),
    hint: `${c.retained}/${c.signups} inscrits encore actifs J+7`,
  }));

  return (
    <div
      className="p-4 md:p-8 max-w-7xl mx-auto pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <div className="mb-8">
        <PageHeading variant="standard" className="mb-2">{t('title')}</PageHeading>
        <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
          {t('generatedAt', { date: format(new Date(data.generatedAt), "d MMMM yyyy 'à' HH:mm", { locale: getDateLocale() }) })}
        </p>
      </div>

      {/* Plan d'acquisition 30 jours — la lecture du matin */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard
          label={t('goalUsers')}
          value={`${totals.users} / ${ACQUISITION_GOALS.users}`}
          hint={pct(totals.users, ACQUISITION_GOALS.users)}
        />
        <KpiCard
          label={t('goalOrgs')}
          value={`${orgs.with3plusMembers} / ${ACQUISITION_GOALS.orgs}`}
          hint={t('goalOrgsHint', { total: orgs.total, created: orgs.created30d })}
          highlight
        />
        <KpiCard
          label={t('activation48h')}
          value={pct(activation48h.activated, activation48h.total)}
          hint={t('activationHint48h', { count: activation48h.activated, total: activation48h.total })}
        />
        <KpiCard
          label={t('topChannel')}
          value={sourceRows[0] ? sourceRows[0].source : '·'}
          hint={sourceRows[0] ? t('topChannelHint', { count: sourceRows[0].signups }) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title={t('goalChart')} note={t('goalChartNote', { goal: ACQUISITION_GOALS.users })}>
          {signups && <GoalChart data={signups.points} goal={ACQUISITION_GOALS.users} />}
        </ChartCard>
        <ChartCard title={t('signupsBySource')} note={t('signupsBySourceNote')}>
          {stackPoints.length > 0 ? (
            <SourceStackChart data={stackPoints} sources={sources} />
          ) : (
            <EmptyChart>{t('noSignup')}</EmptyChart>
          )}
        </ChartCard>
      </div>

      {/* Tableau « inscriptions par canal » — trié par volume décroissant */}
      <div className="card p-4 md:p-6 mb-8">
        <h2 className="font-bold mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>{t('channels')}</h2>
        <p className="text-xs mb-3" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('channelsNote')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ color: 'rgb(var(--color-text-muted))' }}>
                <th className="text-left font-medium py-2 pr-4">{t('channel')}</th>
                <th className="text-right font-medium py-2 px-4">{t('signupsCol')}</th>
                <th className="text-right font-medium py-2 px-4">{t('shareCol')}</th>
                <th className="text-right font-medium py-2 px-4">{t('activation48hCol')}</th>
                <th className="text-right font-medium py-2 pl-4">{t('retentionD7Col')}</th>
              </tr>
            </thead>
            <tbody style={{ color: 'rgb(var(--color-text-primary))' }}>
              {sourceRows.map((row) => (
                <tr key={row.source} style={{ borderTop: '1px solid rgb(var(--color-border))' }}>
                  <td className="py-2 pr-4 font-medium">{row.source}</td>
                  <td className="py-2 px-4 text-right tabular-nums">{row.signups}</td>
                  <td className="py-2 px-4 text-right tabular-nums" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    {pct(row.signups, totals.users)}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {row.activation ? pct(row.activation.activated, row.activation.total) : '·'}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums">
                    {row.retention && row.retention.signups > 0
                      ? pct(row.retention.retained, row.retention.signups)
                      : '·'}
                  </td>
                </tr>
              ))}
              {sourceRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center" style={{ color: 'rgb(var(--color-text-muted))' }}>
                    {t('noSignup')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Croissance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label={t('accountsCreated')} value={String(totals.users)} />
        <KpiCard
          label="Actifs aujourd'hui"
          value={String(totals.activeToday)}
          hint={`${pct(totals.activeToday, totals.users)} des comptes`}
        />
        <KpiCard
          label="Actifs 7 derniers jours"
          value={String(totals.active7d)}
          hint={`${pct(totals.active7d, totals.users)} des comptes`}
        />
        <KpiCard
          label="Inactifs depuis 7 j+"
          value={String(totals.inactive7dPlus)}
          hint={`${pct(totals.inactive7dPlus, totals.users)} des comptes`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="Inscriptions"
          note={signups?.granularity === 'week' ? 'Par semaine, depuis le lancement' : 'Par jour, depuis le lancement'}
        >
          {signups && <SignupsChart data={signups.points} />}
        </ChartCard>
        <ChartCard
          title="Utilisateurs actifs"
          note={t('activityLogNote')}
        >
          {dau ? (
            <DauChart data={dau.points} />
          ) : (
            <EmptyChart>{t('noActivity')}</EmptyChart>
          )}
        </ChartCard>

        <ChartCard title={t('activitySplit')} note={t('activitySplitNote')}>
          {activityData.length > 0 ? <Donut data={activityData} /> : <EmptyChart>{t('noAccount')}</EmptyChart>}
        </ChartCard>
        <ChartCard title={t('acquisition')} note={t('acquisitionNote')}>
          {providerData.length > 0 ? <Donut data={providerData} /> : <EmptyChart>{t('noSignup')}</EmptyChart>}
        </ChartCard>

        <ChartCard title={t('adoption')} note={t('adoptionNote')}>
          <PercentBars data={adoptionData} />
        </ChartCard>
        <ChartCard title={t('engagement')} note={t('engagementNote')}>
          <PercentBars data={engagementData} color="#8b5cf6" />
        </ChartCard>

        <ChartCard title={t('usage')} note={t('usageNote')}>
          <CountBars data={usageData} />
        </ChartCard>
        <ChartCard title="Collaboration" note="Le partage de tâches est le levier d'acquisition virale">
          <CountBars data={collabData} />
        </ChartCard>

        <ChartCard title={t('demoConversion')} note={t('demoConversionNote', { pct: demo.visitors > 0 ? `${demo.conversionPct}%` : '·' })}>
          <CountBars data={demoData} />
        </ChartCard>
        <ChartCard
          title={t('retention')}
          note={t('retentionNote')}
        >
          {retentionData.length > 0 ? (
            <PercentBars data={retentionData} color="#22c55e" />
          ) : (
            <EmptyChart>{t('noCohort')}</EmptyChart>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

export default AdminPage;
