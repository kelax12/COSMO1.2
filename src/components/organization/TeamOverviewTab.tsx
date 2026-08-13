import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Line, LineChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import WorkSummaryCard, { ProgressRing } from './WorkSummaryCard';
import { useTeamTasks, useTeamProjects } from '@/modules/team-projects';
import { useTeamOKRs } from '@/modules/team-okrs';
import { subtreeOf, isManagerOf, type OrgMember } from '@/modules/organizations';
import { projectColor } from './team-projects.helpers';
import { Download, ClipboardCheck } from 'lucide-react';
import { downloadCSV } from '@/lib/csv-export';
import {
  STATS_PERIODS, type StatsPeriod, periodStart, filterByActivity, scopeOkrs,
  summarize, overallOkrProgress, memberLoad, overdueByMember,
  projectBreakdown, velocityByWeek, completionTrend, okrBreakdown, isOverdue,
  memberWorkload,
} from './team-stats.helpers';
import TeamWorkloadCard from './TeamWorkloadCard';
import WeeklyReviewSheet from './WeeklyReviewSheet';
import { buildOrgLink } from './deep-link.helpers';
import { useT } from '@/i18n/useT';

interface TeamOverviewTabProps {
  orgId: string;
  members: OrgMember[];
  /** Admin : stats de toute l'entreprise ; manager : son sous-arbre (#13). */
  isAdmin: boolean;
  currentUserId?: string;
}

const firstName = (name: string) => name.split(' ')[0];

// Les libellés viennent du catalogue au RENDU : une constante de module serait
// figée au premier import (cf. src/i18n/catalog.ts).
const velocityColor = '#10b981';
const trendColor = '#6366f1';

const SectionCard = ({ title, children, aside }: {
  title: string; children: React.ReactNode; aside?: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2 mb-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{title}</h3>
      {aside}
    </div>
    {children}
  </div>
);

const EmptyRow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-[rgb(var(--color-text-muted))] py-6 text-center">{children}</p>
);

/** Barre horizontale (div) : ratio 0..1 → largeur, couleur Tailwind. */
const MiniBar = ({ ratio, colorClass }: { ratio: number; colorClass: string }) => (
  <span className="flex-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden min-w-[40px]">
    <span className={`block h-full rounded-full ${colorClass}`} style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
  </span>
);

/**
 * Onglet Statistiques (#13, point 5) — dérivé côté client des tâches et OKR :
 * sélecteur de période, cartes de synthèse, charge & complétion par membre,
 * répartition par projet, vélocité hebdo, tendance du taux de complétion,
 * avancement OKR détaillé, retards par membre.
 *
 * Périmètre : admin → toute l'entreprise ; manager → soi + son sous-arbre.
 * La période filtre les tâches par date de création ; les OKR restent « en
 * direct » (jauge de l'état courant, pas une activité datée).
 */
const TeamOverviewTab = ({ orgId, members, isAdmin, currentUserId }: TeamOverviewTabProps) => {
  const { t, tp } = useT('org');
  // Configs de graphique construites au RENDU : elles portent des libellés
  // traduits, une constante de module les figerait au premier import.
  const velocityConfig = { completed: { label: t('overview.completed'), color: velocityColor } } satisfies ChartConfig;
  const trendConfig = { rate: { label: t('overview.completionRate'), color: trendColor } } satisfies ChartConfig;
  const { data: allTasks = [] } = useTeamTasks(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: allOkrs = [] } = useTeamOKRs(orgId);
  const [period, setPeriod] = useState<StatsPeriod>('30');
  const [reviewOpen, setReviewOpen] = useState(false);
  const navigate = useNavigate();

  // Revue hebdomadaire (#26) : elle sert a arbitrer la charge d'AUTRES
  // personnes. Un membre sans subordonne n'a rien a y arbitrer — le bouton ne
  // lui est donc pas propose.
  const canReview = isAdmin || (!!currentUserId && isManagerOf(members, currentUserId));

  // Périmètre : admin → tous les membres ; manager → soi + sous-arbre.
  const scopedMembers = useMemo(() => {
    if (isAdmin || !currentUserId) return members;
    const mine = subtreeOf(members, currentUserId);
    return members.filter((m) => m.userId === currentUserId || mine.has(m.userId));
  }, [members, isAdmin, currentUserId]);

  // Tâches du périmètre (tous horizons) — base des séries temporelles.
  const scopedTasks = useMemo(() => {
    if (isAdmin) return allTasks;
    const scope = new Set(scopedMembers.map((m) => m.userId));
    return allTasks.filter((t) => t.assigneeIds.some((id) => scope.has(id)));
  }, [allTasks, scopedMembers, isAdmin]);

  // OKR du périmètre : admin → tout ; manager → KR assignés à son sous-arbre
  // + objectifs collectifs (reco #15, cohérence avec tâches/membres).
  const okrs = useMemo(() => {
    const scope = new Set(scopedMembers.map((m) => m.userId));
    return scopeOkrs(allOkrs, scope, isAdmin);
  }, [allOkrs, scopedMembers, isAdmin]);

  const start = useMemo(() => periodStart(period), [period]);
  // Tâches « actives » dans la fenêtre (ouvertes, créées ou terminées dedans) —
  // base des cartes et répartitions (reco #13 : plus de biais createdAt).
  const periodTasks = useMemo(() => filterByActivity(scopedTasks, start), [scopedTasks, start]);

  const summary = useMemo(() => summarize(periodTasks), [periodTasks]);
  const okrProgress = useMemo(() => overallOkrProgress(okrs), [okrs]);
  const load = useMemo(() => memberLoad(periodTasks, scopedMembers), [periodTasks, scopedMembers]);
  // Charge : calculée sur les tâches du périmètre SANS filtre de période — une
  // tâche ouverte pèse sur l'équipe qu'elle ait été créée hier ou il y a six
  // mois. La borner à la fenêtre affichée sous-estimerait la charge réelle.
  const workload = useMemo(() => memberWorkload(scopedTasks, scopedMembers), [scopedTasks, scopedMembers]);
  const overdueMembers = useMemo(() => overdueByMember(periodTasks, scopedMembers), [periodTasks, scopedMembers]);
  const byProject = useMemo(() => projectBreakdown(periodTasks, projects), [periodTasks, projects]);
  const velocity = useMemo(() => velocityByWeek(scopedTasks, start), [scopedTasks, start]);
  const trend = useMemo(() => completionTrend(scopedTasks, start), [scopedTasks, start]);
  const okrStats = useMemo(() => okrBreakdown(okrs), [okrs]);

  // ⚠️ Ne PAS écrire `.filter(isOverdue)` : `Array.filter` passe (item, index,
  // array), donc l'index atterrirait dans le paramètre `now` de `isOverdue`.
  // TypeScript l'attrape (types incompatibles), mais l'intention mérite d'être
  // écrite : la lambda est obligatoire.
  const overdueTasks = useMemo(() => periodTasks.filter((t) => isOverdue(t)), [periodTasks]);
  const maxOpen = Math.max(1, ...load.map((m) => m.open));
  const maxProjectOpen = Math.max(1, ...byProject.map((p) => p.open));
  const maxOverdue = Math.max(1, ...overdueMembers.map((m) => m.count));
  const hasVelocity = velocity.some((v) => v.completed > 0);
  const hasTrend = trend.some((t) => t.rate > 0);

  const periodLabel = STATS_PERIODS.find((p) => p.id === period)?.label ?? '';
  const periodHint = period === 'all' ? t('overview.sinceStart') : t('overview.activeOver', { period: periodLabel });

  // Export CSV (reco #14) — membres, projets, OKR (3 fichiers espacés,
  // Safari refuse plusieurs .click() simultanés, cf. exportAllCSV).
  const handleExport = () => {
    downloadCSV(
      'cosmo-stats-membres',
      [t('overview.csvMember'), t('overview.csvOpen'), t('overview.csvDone'), t('overview.csvTotal'), t('overview.csvRate'), t('overview.csvOverdue')],
      load.map((m) => [
        m.name, m.open, m.done, m.total, m.completionRate,
        overdueMembers.find((o) => o.userId === m.userId)?.count ?? 0,
      ]),
    );
    setTimeout(() => downloadCSV(
      'cosmo-stats-projets',
      [t('overview.csvProject'), t('overview.openShort'), t('overview.overdueShort'), t('overview.csvTotal')],
      byProject.map((p) => [p.name, p.open, p.overdue, p.total]),
    ), 150);
    setTimeout(() => downloadCSV(
      'cosmo-stats-okr',
      ['Objectif', 'Progression (%)', 'Nb KR'],
      okrStats.map((o) => [o.title, o.progress, o.krCount]),
    ), 300);
  };

  return (
    <div className="space-y-5">
      {/* En-tête : sélecteur de période */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-[rgb(var(--color-text-muted))]">
          {isAdmin ? t('overview.scopeAdmin') : t('overview.scopeMember')}
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-0.5" role="tablist" aria-label={t('overview.period')}>
            {STATS_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  period === p.id
                    ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))]'
                    : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {canReview && (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              <ClipboardCheck size={13} aria-hidden="true" /> {t('weeklyReview.open')}
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
          >
            <Download size={13} aria-hidden="true" /> Exporter CSV
          </button>
        </div>
      </div>

      {/* Carte de synthèse « progress-first » */}
      <WorkSummaryCard
        title={tp('summary.taskTotal', summary.total, { period: periodHint })}
        completed={summary.completed}
        inProgress={Math.max(0, summary.total - summary.completed - summary.overdueCount)}
        overdue={summary.overdueCount}
        completionRate={summary.completionRate}
        emptyLabel={t('overview.emptyPeriod')}
        aside={<ProgressRing value={okrProgress} label="Progression OKR" />}
      />

      {/* Charge de l'équipe — placée juste sous la synthèse : c'est la question
          la plus opérationnelle de l'onglet, elle ne doit pas se mériter. */}
      <TeamWorkloadCard rows={workload} members={scopedMembers} />

      {/* Par membre + Par projet */}
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <SectionCard title={t('overview.byMember')}>
          {load.every((m) => m.total === 0) ? (
            <EmptyRow>{t('overview.emptyAssigned')}</EmptyRow>
          ) : (
            <ul className="space-y-2.5">
              {load.filter((m) => m.total > 0).map((m) => (
                <li key={m.userId} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate">{m.name}</span>
                  <MiniBar ratio={m.open / maxOpen} colorClass="bg-[rgb(var(--color-accent-solid))]" />
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-[rgb(var(--color-text-muted))]" title={t('overview.openTasks')}>
                    {m.open}
                  </span>
                  <span
                    className={`w-11 shrink-0 text-right text-xs font-semibold tabular-nums ${
                      m.completionRate >= 66 ? 'text-emerald-500' : m.completionRate >= 33 ? 'text-amber-500' : 'text-[rgb(var(--color-text-muted))]'
                    }`}
                    title={t('overview.doneRatio', { done: m.done, total: m.total })}
                  >
                    {m.completionRate}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t('overview.byProject')}>
          {byProject.length === 0 ? (
            <EmptyRow>{t('overview.emptyByProject')}</EmptyRow>
          ) : (
            <ul className="space-y-2.5">
              {byProject.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${projectColor(p.color).dot}`} aria-hidden="true" />
                  <span className="w-24 shrink-0 text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate">{p.name}</span>
                  <MiniBar ratio={p.open / maxProjectOpen} colorClass={projectColor(p.color).dot} />
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[rgb(var(--color-text-muted))]" title={t('overview.openShort')}>{p.open}</span>
                  {p.overdue > 0 ? (
                    <span className="w-14 shrink-0 text-right text-[10px] font-semibold text-red-500" title={t('overview.overdueShort')}>{p.overdue} retard</span>
                  ) : (
                    <span className="w-14 shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Vélocité + Tendance */}
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <SectionCard title={t('overview.velocity')}>
          {!hasVelocity ? (
            <EmptyRow>{t('overview.emptyVelocity')}</EmptyRow>
          ) : (
            <ChartContainer config={velocityConfig} className="h-[200px] w-full">
              <BarChart data={velocity} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.4} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </SectionCard>

        <SectionCard title={t('overview.trend')}>
          {!hasTrend ? (
            <EmptyRow>{t('overview.emptyTrend')}</EmptyRow>
          ) : (
            <ChartContainer config={trendConfig} className="h-[200px] w-full">
              <LineChart data={trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.4} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tick={{ fontSize: 11 }} width={28} unit="%" />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Line dataKey="rate" type="monotone" stroke="var(--color-rate)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          )}
        </SectionCard>
      </div>

      {/* Avancement OKR détaillé */}
      <SectionCard title={t('overview.okrProgressTitle')}>
        {okrStats.length === 0 ? (
          <EmptyRow>{t('overview.emptyOkr')}</EmptyRow>
        ) : (
          <ul className="space-y-3">
            {okrStats.map((o) => (
              <li key={o.id}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate">{o.title}</span>
                  <span className={`text-xs font-bold tabular-nums shrink-0 ${
                    o.progress >= 66 ? 'text-emerald-500' : o.progress >= 33 ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {o.progress}%
                  </span>
                </div>
                <MiniBar
                  ratio={o.progress / 100}
                  colorClass={o.progress >= 66 ? 'bg-emerald-500' : o.progress >= 33 ? 'bg-amber-500' : 'bg-red-500'}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Retards par membre + liste des tâches en retard */}
      {summary.overdueCount > 0 && (
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          <SectionCard title={t('overview.overdueByMember')}>
            <ul className="space-y-2.5">
              {overdueMembers.map((m) => (
                <li key={m.userId} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate">{m.name}</span>
                  <MiniBar ratio={m.count / maxOverdue} colorClass="bg-red-500" />
                  <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-red-500">{m.count}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <div className="rounded-2xl border border-red-300/60 dark:border-red-700/40 bg-red-50/50 dark:bg-red-900/10 p-4 sm:p-5">
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400 mb-3">
              {t('summary.overdueTasks', { count: overdueTasks.length })}
            </h3>
            <ul className="space-y-1.5">
              {overdueTasks.slice(0, 6).map((t) => {
                const names = t.assigneeIds
                  .map((id) => scopedMembers.find((m) => m.userId === id))
                  .filter((m): m is OrgMember => !!m)
                  .map((m) => firstName(m.displayName));
                return (
                  <li key={t.id} className="flex items-center justify-between text-sm gap-3">
                    <span className="text-[rgb(var(--color-text-primary))] truncate">{t.name}</span>
                    {names.length > 0 && (
                      <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                        {names.slice(0, 2).join(', ')}{names.length > 2 ? ` +${names.length - 2}` : ''}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {reviewOpen && (
        <WeeklyReviewSheet
          orgId={orgId}
          // Meme perimetre que les statistiques affichees au-dessus : la revue
          // ne doit pas montrer une equipe plus large que l'onglet qui la porte.
          tasks={scopedTasks}
          members={scopedMembers}
          onOpenTask={(taskId) => {
            setReviewOpen(false);
            navigate(buildOrgLink('projects', { task: taskId }));
          }}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
};

export default TeamOverviewTab;
