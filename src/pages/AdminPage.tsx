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
import type { AdminChartPoint } from './admin/AdminCharts';

// Règle P-2 : recharts (vendor-charts) chargé uniquement quand un admin
// ouvre effectivement la page.
const SignupsChart = React.lazy(() =>
  import('./admin/AdminCharts').then((m) => ({ default: m.SignupsChart }))
);
const DauChart = React.lazy(() =>
  import('./admin/AdminCharts').then((m) => ({ default: m.DauChart }))
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

const KpiCard: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="card p-5">
    <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>{label}</p>
    <p className="text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{value}</p>
    {hint && (
      <p className="text-xs mt-1" style={{ color: 'rgb(var(--color-text-secondary))' }}>{hint}</p>
    )}
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
  // Cohortes rétention : plus récentes en premier, on n'affiche que les 12 dernières.
  const retentionRows = [...data.retentionJ7].reverse().slice(0, 12);

  return (
    <div
      className="p-4 md:p-8 max-w-7xl mx-auto pb-[calc(64px+env(safe-area-inset-bottom)+24px)] md:pb-8"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
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
            <div
              className="h-[260px] flex items-center justify-center rounded-xl text-sm"
              style={{ backgroundColor: 'rgb(var(--color-hover))', color: 'rgb(var(--color-text-muted))' }}
            >
              Pas encore de données d'activité
            </div>
          )}
        </ChartCard>
      </div>

      {/* Conversion démo */}
      <h2 className="font-bold mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>Conversion démo</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <KpiCard label="Visiteurs démo" value={String(demo.visitors)} />
        <KpiCard label="Comptes créés après démo" value={String(demo.converted)} />
        <KpiCard label="Taux de conversion" value={demo.visitors > 0 ? `${demo.conversionPct}%` : '—'} />
      </div>

      {/* Usage produit */}
      <h2 className="font-bold mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>Usage produit</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <KpiCard label="Tâches" value={String(usage.tasks)} />
        <KpiCard label="Habitudes" value={String(usage.habits)} />
        <KpiCard label="Événements" value={String(usage.events)} />
        <KpiCard label="OKRs" value={String(usage.okrs)} />
        <KpiCard label="Tâches partagées" value={String(usage.sharedTasks)} />
      </div>

      {/* Adoption par fonctionnalité */}
      <h2 className="font-bold mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>Adoption par fonctionnalité</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Ont ≥1 tâche" value={pct(adoption.tasksUsers, totals.users)} hint={`${adoption.tasksUsers} utilisateurs`} />
        <KpiCard label="Ont ≥1 habitude" value={pct(adoption.habitsUsers, totals.users)} hint={`${adoption.habitsUsers} utilisateurs`} />
        <KpiCard label="Ont ≥1 événement" value={pct(adoption.eventsUsers, totals.users)} hint={`${adoption.eventsUsers} utilisateurs`} />
        <KpiCard label="Ont ≥1 OKR" value={pct(adoption.okrsUsers, totals.users)} hint={`${adoption.okrsUsers} utilisateurs`} />
      </div>

      {/* Engagement */}
      <h2 className="font-bold mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>Engagement</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Activation 24 h"
          value={pct(activation24h.activated, activation24h.total)}
          hint={`${activation24h.activated}/${activation24h.total} ont créé ≥1 objet le 1er jour`}
        />
        <KpiCard
          label="Complétion des tâches"
          value={pct(tasksCompletion.completed, tasksCompletion.total)}
          hint={`${tasksCompletion.completed}/${tasksCompletion.total} tâches complétées`}
        />
        <KpiCard
          label="Stickiness (DAU/MAU)"
          value={pct(stickiness.dau, stickiness.mau)}
          hint={`${stickiness.dau} actifs aujourd'hui / ${stickiness.mau} sur 30 j`}
        />
        <KpiCard
          label="Churn (inactifs 30 j+)"
          value={String(totals.inactive30dPlus)}
          hint={`${pct(totals.inactive30dPlus, totals.users)} des comptes`}
        />
      </div>

      {/* Acquisition */}
      <h2 className="font-bold mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>Acquisition</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Object.entries(data.signupsByProvider).map(([provider, count]) => (
          <KpiCard
            key={provider}
            label={`Inscriptions ${provider.charAt(0).toUpperCase()}${provider.slice(1)}`}
            value={String(count)}
            hint={`${pct(count, totals.users)} des comptes`}
          />
        ))}
      </div>

      {/* Collaboration */}
      <h2 className="font-bold mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>Collaboration</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <KpiCard label="Ont partagé ≥1 tâche" value={String(collaboration.sharers)} hint={`${pct(collaboration.sharers, totals.users)} des comptes`} />
        <KpiCard label="Ont ≥1 ami" value={String(collaboration.usersWithFriends)} hint={`${pct(collaboration.usersWithFriends, totals.users)} des comptes`} />
        <KpiCard label="Demandes d'ami acceptées" value={String(collaboration.acceptedRequests)} />
      </div>

      {/* Rétention J7 */}
      <h2 className="font-bold mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>Rétention J7 par cohorte</h2>
      <p className="text-xs mb-3" style={{ color: 'rgb(var(--color-text-muted))' }}>
        Inscrits de la semaine encore actifs entre J+7 et J+13 — mesurable ~2 semaines après le déploiement du journal d'activité (mig. 056).
      </p>
      <div className="card p-4 overflow-x-auto">
        <table className="w-full text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>
          <thead>
            <tr className="text-left text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
              <th className="py-2 pr-4 font-medium">Semaine d'inscription</th>
              <th className="py-2 pr-4 font-medium">Inscrits</th>
              <th className="py-2 pr-4 font-medium">Retenus J7</th>
              <th className="py-2 font-medium">Taux</th>
            </tr>
          </thead>
          <tbody>
            {retentionRows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  Pas encore de cohortes
                </td>
              </tr>
            )}
            {retentionRows.map((c) => (
              <tr key={c.week} style={{ borderTop: '1px solid rgb(var(--color-border-muted))' }}>
                <td className="py-2 pr-4">{format(toLocalDate(c.week), 'd MMM yyyy', { locale: fr })}</td>
                <td className="py-2 pr-4">{c.signups}</td>
                <td className="py-2 pr-4">{c.retained}</td>
                <td className="py-2 font-semibold">{pct(c.retained, c.signups)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPage;
