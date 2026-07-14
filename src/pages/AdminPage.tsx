// Dashboard admin de croissance — /admin (aucun lien dans l'app).
// La frontière de sécurité est la RPC get_admin_stats() (42501 si non
// admin) ; ici le Navigate n'est que de l'UX. Jamais d'error.message
// rendu (règle V7) : tout échec redirige silencieusement vers /dashboard.
import React, { Suspense, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PageHeading } from '@/components/ui/typography';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useAdminStats,
  chooseGranularity,
  fillMissingDays,
  aggregateWeekly,
  toCumulative,
  type DailyPoint,
  type Granularity,
} from '@/modules/admin';
import type { AdminChartPoint, LabeledValue } from './admin/AdminCharts';

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

// 'YYYY-MM-DD' → Date locale (jamais new Date('YYYY-MM-DD') : parse UTC).
const toLocalDate = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const formatLabel = (day: string, granularity: Granularity): string => {
  const date = toLocalDate(day);
  return granularity === 'week'
    ? `sem. ${format(date, 'd MMM', { locale: fr })}`
    : format(date, 'd MMM', { locale: fr });
};

/** Zéro-fill jusqu'à aujourd'hui puis bucket jour/semaine selon le span. */
const bucketize = (points: DailyPoint[], today: string) => {
  const filled = fillMissingDays(points, today);
  const granularity = chooseGranularity(filled);
  const bucketed = granularity === 'week' ? aggregateWeekly(filled) : filled;
  return { bucketed, granularity };
};

const pct = (part: number, total: number): string =>
  total > 0 ? `${Math.round((100 * part) / total)}%` : '—';

const pctNum = (part: number, total: number): number =>
  total > 0 ? Math.round((100 * part) / total) : 0;

const KpiCard: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="card p-5">
    <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>{label}</p>
    <p className="text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{value}</p>
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
    { label: '≥1 événement', value: pctNum(adoption.eventsUsers, totals.users), hint: `${adoption.eventsUsers}/${totals.users} utilisateurs` },
    { label: '≥1 OKR', value: pctNum(adoption.okrsUsers, totals.users), hint: `${adoption.okrsUsers}/${totals.users} utilisateurs` },
  ];

  const engagementData: LabeledValue[] = [
    { label: 'Activation 24 h', value: pctNum(activation24h.activated, activation24h.total), hint: `${activation24h.activated}/${activation24h.total} ont créé ≥1 objet le 1er jour` },
    { label: 'Complétion tâches', value: pctNum(tasksCompletion.completed, tasksCompletion.total), hint: `${tasksCompletion.completed}/${tasksCompletion.total} tâches complétées` },
    { label: 'Stickiness DAU/MAU', value: pctNum(stickiness.dau, stickiness.mau), hint: `${stickiness.dau} actifs aujourd'hui / ${stickiness.mau} sur 30 j` },
    { label: 'Churn 30 j+', value: pctNum(totals.inactive30dPlus, totals.users), hint: `${totals.inactive30dPlus}/${totals.users} comptes inactifs depuis 30 j+` },
  ];

  const usageData: LabeledValue[] = [
    { label: 'Tâches', value: usage.tasks },
    { label: 'Habitudes', value: usage.habits },
    { label: 'Événements', value: usage.events },
    { label: 'OKRs', value: usage.okrs },
    { label: 'Partages', value: usage.sharedTasks },
  ];

  const collabData: LabeledValue[] = [
    { label: 'Ont partagé', value: collaboration.sharers, hint: `${collaboration.sharers} users (${pct(collaboration.sharers, totals.users)})` },
    { label: 'Ont ≥1 ami', value: collaboration.usersWithFriends, hint: `${collaboration.usersWithFriends} users (${pct(collaboration.usersWithFriends, totals.users)})` },
    { label: 'Demandes acceptées', value: collaboration.acceptedRequests },
  ];

  const demoData: LabeledValue[] = [
    { label: 'Visiteurs démo', value: demo.visitors },
    { label: 'Comptes créés', value: demo.converted, hint: `${demo.converted} convertis (${demo.visitors > 0 ? `${demo.conversionPct}%` : '—'})` },
  ];

  // Cohortes rétention : les 12 dernières semaines, ordre chronologique.
  const retentionData: LabeledValue[] = data.retentionJ7.slice(-12).map((c) => ({
    label: format(toLocalDate(c.week), 'd MMM', { locale: fr }),
    value: pctNum(c.retained, c.signups),
    hint: `${c.retained}/${c.signups} inscrits encore actifs J+7`,
  }));

  return (
    <div
      className="p-4 md:p-8 max-w-7xl mx-auto pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
    >
      <div className="mb-8">
        <PageHeading variant="standard" className="mb-2">Stats COSMO</PageHeading>
        <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
          Croissance et activité — généré le {format(new Date(data.generatedAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
        </p>
      </div>

      {/* Croissance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Comptes créés" value={String(totals.users)} />
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
          note="Journal d'activité actif depuis la migration 056 — l'historique démarre à son déploiement"
        >
          {dau ? (
            <DauChart data={dau.points} />
          ) : (
            <EmptyChart>Pas encore de données d'activité</EmptyChart>
          )}
        </ChartCard>

        <ChartCard title="Répartition de l'activité" note="Segments exclusifs — chaque compte est dans une seule tranche">
          {activityData.length > 0 ? <Donut data={activityData} /> : <EmptyChart>Aucun compte</EmptyChart>}
        </ChartCard>
        <ChartCard title="Acquisition" note="Inscriptions par méthode de connexion">
          {providerData.length > 0 ? <Donut data={providerData} /> : <EmptyChart>Aucune inscription</EmptyChart>}
        </ChartCard>

        <ChartCard title="Adoption par fonctionnalité" note="% des comptes ayant créé au moins 1 élément">
          <PercentBars data={adoptionData} />
        </ChartCard>
        <ChartCard title="Engagement" note="Activation = ≥1 objet créé dans les 24 h après inscription">
          <PercentBars data={engagementData} color="#8b5cf6" />
        </ChartCard>

        <ChartCard title="Usage produit" note="Volumes totaux créés">
          <CountBars data={usageData} />
        </ChartCard>
        <ChartCard title="Collaboration" note="Le partage de tâches est le levier d'acquisition virale">
          <CountBars data={collabData} />
        </ChartCard>

        <ChartCard title="Conversion démo" note={`Taux de conversion : ${demo.visitors > 0 ? `${demo.conversionPct}%` : '—'}`}>
          <CountBars data={demoData} />
        </ChartCard>
        <ChartCard
          title="Rétention J7 par cohorte"
          note="Inscrits de la semaine encore actifs entre J+7 et J+13 — mesurable ~2 semaines après la mig. 056"
        >
          {retentionData.length > 0 ? (
            <PercentBars data={retentionData} color="#22c55e" />
          ) : (
            <EmptyChart>Pas encore de cohortes</EmptyChart>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

export default AdminPage;
