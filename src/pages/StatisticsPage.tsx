'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { PageHeading } from '@/components/ui/typography';
import { BarChart3, Target, CheckSquare, Repeat, CalendarDays } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import { useColorSettings } from '@/modules/ui-states';
import { useCategories } from '@/modules/categories';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs, KeyResult } from '@/modules/okrs';
import { parseLocalDate, getLocalDateString, calculateWorkTimeForPeriod } from '../lib/workTimeCalculator';
import { useVisibilityInterval } from '../lib/hooks/usePerformance';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useBilling } from '@/modules/billing/billing.context';
import PremiumGateModal from '@/components/PremiumGateModal';
import { formatTime, formatTimeShort } from './statistics/format';
import { buildInsights } from '@/lib/stats-insights';

// Graphique multi-séries « Temps de travail » (déplacé du Dashboard).
// Lazy : recharts ne charge que si l'utilisateur ouvre la vue détaillée (faille P-2).
const DashboardChart = React.lazy(() => import('@/components/DashboardChart'));

import {
  HabitHeatmap,
  OverviewStatistics,
  TasksStatistics,
  AgendaStatistics,
  OKRStatistics,
  HabitsStatistics,
} from './statistics/sections';
import type { StatSection, TimePeriod, WorkTimePeriodData } from './statistics/types';


// ═══════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════
export default function StatisticsPage() {
  const isMobile = useIsMobile();
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useEvents();
  const { data: okrs = [] } = useOkrs();
  const { colorSettings } = useColorSettings();
  const { data: categories = [] } = useCategories();
  const { data: habits = [] } = useHabits();
  const { isPremium } = useBilling();
  const [selectedSection, setSelectedSection] = useState<StatSection>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');
  // Vue d'ensemble : bascule entre le graphique « Tout » (une courbe agrégée)
  // et « voir le détail » (multi-courbes par catégorie, ex-Dashboard).
  const [overviewDetail, setOverviewDetail] = useState(false);
  const [showReferenceBar, setShowReferenceBar] = useState(true);
  const [referenceValue, setReferenceValue] = useState(60);
  const [now, setNow] = useState(new Date());
  const [showPremiumGate, setShowPremiumGate] = useState(false);

  useVisibilityInterval(useCallback(() => setNow(new Date()), []), 60000, true);

  // Insights en langage naturel (#34) — calculés client-side, max 3 phrases.
  const insights = useMemo(() => buildInsights(tasks, habits, now), [tasks, habits, now]);

  const getPeriodDetails = (period: TimePeriod, periodDate: Date) => {
    let startDate: Date, endDate: Date;

    if (period === 'day') {
      startDate = new Date(periodDate); startDate.setHours(0, 0, 0, 0);
      endDate = new Date(periodDate); endDate.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      startDate = new Date(periodDate); startDate.setHours(0, 0, 0, 0);
      endDate = new Date(periodDate); endDate.setDate(endDate.getDate() + 6); endDate.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      startDate = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
      endDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0); endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(periodDate.getFullYear(), 0, 1);
      endDate = new Date(periodDate.getFullYear(), 11, 31); endDate.setHours(23, 59, 59, 999);
    }

    return calculateWorkTimeForPeriod(startDate, endDate, { tasks, events, habits, okrs });
  };

  const calculateWorkTime = (period: TimePeriod) => {
    const periodList: { label: string; date: string; fullDate: Date; weekNumber?: number }[] = [];

    switch (period) {
      case 'day':
        for (let i = 9; i >= 0; i--) {
          const date = new Date(now); date.setDate(date.getDate() - i);
          periodList.push({ label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), date: getLocalDateString(date), fullDate: date });
        }
        break;
      case 'week':
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now); date.setDate(date.getDate() - (i * 7));
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - (date.getDay() === 0 ? 6 : date.getDay() - 1));
          const startOfYear = new Date(weekStart.getFullYear(), 0, 1);
          const weekNumber = Math.ceil(((weekStart.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
          periodList.push({ label: `S${weekNumber}`, date: getLocalDateString(weekStart), fullDate: weekStart, weekNumber });
        }
        break;
      case 'month':
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now); date.setMonth(date.getMonth() - i);
          periodList.push({ label: date.toLocaleDateString('fr-FR', { month: 'short' }), date: getLocalDateString(date), fullDate: date });
        }
        break;
      case 'year':
        for (let i = 4; i >= 0; i--) {
          const date = new Date(now); date.setFullYear(date.getFullYear() - i);
          periodList.push({ label: date.getFullYear().toString(), date: getLocalDateString(date), fullDate: date });
        }
        break;
    }

    return periodList.map((p, index) => {
      const details = getPeriodDetails(period, p.fullDate);
      let relevantTime = 0;
      if (selectedSection === 'tasks') relevantTime = details.tasksTime;
      else if (selectedSection === 'agenda') relevantTime = details.eventsTime;
      else if (selectedSection === 'habits') relevantTime = details.habitsTime;
      else if (selectedSection === 'okr') relevantTime = details.okrTime;
      else relevantTime = details.totalTime;

      const finalTime = Math.round(relevantTime);
      return { ...p, totalTime: finalTime, hours: Math.floor(finalTime / 60), minutes: Math.round(finalTime % 60), details, index };
    });
  };

  const workTimeData = useMemo(
    () => calculateWorkTime(selectedPeriod),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPeriod, selectedSection, tasks, events, habits, okrs, now]
  );

  const rollingRange = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const start = new Date(today);
    const end = new Date(today); end.setHours(23, 59, 59, 999);
    if (selectedPeriod === 'week') start.setDate(today.getDate() - 6);
    else if (selectedPeriod === 'month') start.setDate(today.getDate() - 29);
    else if (selectedPeriod === 'year') start.setDate(today.getDate() - 364);
    return { start, end };
  }, [selectedPeriod, now]);

  const rollingTasks = useMemo(() => tasks.filter(task => {
    if (!task.completed || !task.completedAt) return false;
    const d = parseLocalDate(task.completedAt);
    return d >= rollingRange.start && d <= rollingRange.end;
  }), [tasks, rollingRange]);

  const rollingEvents = useMemo(() => events.filter(event => {
    const d = parseLocalDate(event.start);
    return d >= rollingRange.start && d <= rollingRange.end;
  }), [events, rollingRange]);

  const rollingWorkTimeData: WorkTimePeriodData[] = useMemo(() => {
    const details = {
      completedTasks: rollingTasks,
      events: rollingEvents,
      totalTime: 0,
      tasksTime: rollingTasks.reduce((sum, task) => sum + task.estimatedTime, 0),
      eventsTime: rollingEvents.reduce((sum, event) => {
        const s = new Date(event.start), e = new Date(event.end);
        return sum + (e.getTime() - s.getTime()) / (1000 * 60);
      }, 0),
      habitsTime: habits.reduce((total, habit) => {
        const count = Object.keys(habit.completions).filter(date => {
          const hDate = parseLocalDate(date);
          const norm = new Date(hDate.getFullYear(), hDate.getMonth(), hDate.getDate());
          return norm >= rollingRange.start && norm <= rollingRange.end && habit.completions[date];
        }).length;
        return total + count * habit.estimatedTime;
      }, 0),
      okrTime: 0,
    };
    okrs.forEach(okr => {
      okr.keyResults.forEach(kr => {
        const krHistory = (kr as KeyResult & { history?: { date: string; increment: number }[] }).history || [];
        const hist = krHistory.filter(h => {
          const hDate = parseLocalDate(h.date);
          const norm = new Date(hDate.getFullYear(), hDate.getMonth(), hDate.getDate());
          return norm >= rollingRange.start && norm <= rollingRange.end;
        });
        details.okrTime += hist.reduce((s, h) => s + h.increment, 0) * kr.estimatedTime;
      });
    });
    details.totalTime = details.tasksTime + details.eventsTime + details.habitsTime + details.okrTime;
    return [{ label: '', totalTime: details.totalTime, details }];
  }, [rollingTasks, rollingEvents, habits, okrs, rollingRange]);

  const totalWorkTime = workTimeData.reduce((sum, d) => sum + d.totalTime, 0);
  const avgWorkTime = workTimeData.length > 0 ? Math.round(totalWorkTime / workTimeData.length) : 0;

  const fixedStats = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eod = new Date(d); eod.setHours(23, 59, 59, 999);
    const pick = (data: ReturnType<typeof calculateWorkTimeForPeriod>) => {
      if (selectedSection === 'tasks')  return data.tasksTime;
      if (selectedSection === 'agenda') return data.eventsTime;
      if (selectedSection === 'habits') return data.habitsTime;
      if (selectedSection === 'okr')    return data.okrTime;
      return data.totalTime;
    };
    return {
      today: pick(calculateWorkTimeForPeriod(d, eod, { tasks, events, habits, okrs })),
      week:  pick(calculateWorkTimeForPeriod(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6),   eod, { tasks, events, habits, okrs })),
      month: pick(calculateWorkTimeForPeriod(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29),  eod, { tasks, events, habits, okrs })),
      year:  pick(calculateWorkTimeForPeriod(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 364), eod, { tasks, events, habits, okrs })),
    };
  }, [tasks, events, habits, okrs, now, selectedSection]);

  const periodDescriptiveText: Record<TimePeriod, string> = {
    day: "aujourd'hui",
    week: '7 derniers jours',
    month: '30 derniers jours',
    year: '365 derniers jours',
  };

  const sections = [
    { id: 'all', label: "Vue d'ensemble", icon: BarChart3, color: '#8B5CF6' },
    { id: 'tasks', label: 'Tâches', icon: CheckSquare, color: '#3B82F6' },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays, color: '#ef4444' },
    { id: 'okr', label: 'OKR', icon: Target, color: '#22C55E' },
    { id: 'habits', label: 'Habitudes', icon: Repeat, color: '#EAB308' },
  ];

  const periods = [
    { id: 'day', label: 'Jour' },
    { id: 'week', label: 'Semaine' },
    { id: 'month', label: 'Mois' },
    { id: 'year', label: 'Année' },
  ];

  const sectionColor =
    selectedSection === 'tasks' ? '#3B82F6' :
    selectedSection === 'agenda' ? '#ef4444' :
    selectedSection === 'habits' ? '#EAB308' :
    selectedSection === 'okr' ? '#22C55E' : '#8B5CF6';

  const areaChartData = workTimeData.map(d => ({ label: d.label, minutes: d.totalTime }));

  const areaChartConfig = useMemo<ChartConfig>(() => ({
    minutes: { label: 'Temps (min)', color: sectionColor },
  }), [sectionColor]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-[calc(64px+env(safe-area-inset-bottom)+24px)] md:pb-8" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      <div className="mb-8">
        <PageHeading variant="standard" className="mb-2">Statistiques</PageHeading>
        <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Analysez votre productivité et vos performances</p>
      </div>

      {/* Insights en langage naturel (#34) — la conclusion avant les graphes */}
      {insights.length > 0 && (
        <div className="card p-4 mb-8 space-y-1.5" role="status">
          {insights.map((insight) => (
            <p key={insight} className="text-sm flex items-start gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
              <span className="text-blue-500 shrink-0" aria-hidden="true">→</span>
              {insight}
            </p>
          ))}
        </div>
      )}

      {/* Stat cards — sans icônes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Aujourd'hui", val: fixedStats.today },
          { label: 'Cette semaine', val: fixedStats.week },
          { label: 'Ce mois', val: fixedStats.month },
          { label: 'Cette année', val: fixedStats.year },
        ].map((s, idx) => (
          <div key={idx} className="card p-5">
            <p className="text-xs font-medium mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>{s.label}</p>
            <p className="text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTimeShort(s.val)}</p>
          </div>
        ))}
      </div>

      {/* Gate premium — graphiques et détails */}
      {!isPremium() ? (
        <div className="relative">
          {/* Aperçu flouté */}
          <div className="pointer-events-none select-none blur-sm opacity-40 space-y-4">
            <div className="card p-6 h-48 flex items-center justify-center">
              <div className="w-full h-32 bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 dark:from-blue-800/30 dark:via-purple-800/30 dark:to-pink-800/30 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="card p-6 h-32 flex flex-col gap-2">
                  <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-1/2" />
                  <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-3/4" />
                  <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-2/3 mt-2" />
                </div>
              ))}
            </div>
          </div>
          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                <BarChart3 size={24} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1">Analyses détaillées</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                Accédez aux graphiques et aux statistiques avancées avec un compte Premium.
              </p>
              <button
                onClick={() => setShowPremiumGate(true)}
                className="w-full px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-amber-500 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/30"
              >
                Débloquer — pub ou abonnement
              </button>
            </div>
          </div>
        </div>
      ) : (
      <>
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
        {/* Sélecteur de section */}
        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
          <span className="text-sm font-medium shrink-0" style={{ color: 'rgb(var(--color-text-secondary))' }}>Analyser :</span>
          <div className="flex rounded-xl p-1 overflow-x-auto flex-nowrap flex-1 md:flex-none" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
            {sections.map(section => {
              const Icon = section.icon;
              const isSelected = selectedSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id as StatSection)}
                  aria-label={section.label}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${isSelected ? 'shadow-sm' : ''}`}
                  style={{
                    backgroundColor: isSelected ? 'rgb(var(--color-surface))' : 'transparent',
                    color: isSelected ? section.color : 'rgb(var(--color-text-secondary))',
                  }}
                >
                  <Icon size={16} aria-hidden="true" style={{ color: isSelected ? section.color : 'rgb(var(--color-text-secondary))' }} />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sélecteur de période — droite, style Agenda */}
        <div className="flex gap-1 p-1 rounded-xl border flex-nowrap overflow-x-auto w-full md:w-auto"
          style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>
          {periods.map(period => (
            <button
              key={period.id}
              onClick={() => setSelectedPeriod(period.id as TimePeriod)}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none whitespace-nowrap ${
                selectedPeriod === period.id ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: selectedPeriod === period.id ? 'rgb(var(--color-accent))' : 'transparent',
                color: selectedPeriod === period.id ? 'white' : 'rgb(var(--color-text-secondary))',
              }}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vue d'ensemble : toggle Tout / voir le détail */}
      {selectedSection === 'all' && (
        <div className="flex justify-end mb-3">
          <div className="inline-flex rounded-xl border p-0.5" style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>
            <button
              type="button"
              onClick={() => setOverviewDetail(false)}
              aria-pressed={!overviewDetail}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: !overviewDetail ? 'rgb(var(--color-accent))' : 'transparent',
                color: !overviewDetail ? 'white' : 'rgb(var(--color-text-secondary))',
              }}
            >
              Tout
            </button>
            <button
              type="button"
              onClick={() => setOverviewDetail(true)}
              aria-pressed={overviewDetail}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: overviewDetail ? 'rgb(var(--color-accent))' : 'transparent',
                color: overviewDetail ? 'white' : 'rgb(var(--color-text-secondary))',
              }}
            >
              Voir le détail
            </button>
          </div>
        </div>
      )}

      {/* Graphique principal */}
      {selectedSection === 'all' && overviewDetail ? (
        <div className="mb-8">
          <React.Suspense fallback={<div className="card p-6 h-[340px] animate-pulse" />}>
            <DashboardChart viewMode={selectedPeriod === 'day' ? 'jour' : selectedPeriod === 'week' ? 'semaine' : 'mois'} />
          </React.Suspense>
        </div>
      ) : (
      <div className="card p-6 mb-8">
        <div className={(!isMobile && selectedSection === 'habits') ? 'relative' : ''} style={(!isMobile && selectedSection === 'habits') ? { paddingRight: 'calc(25% + 20px)' } : undefined}>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {selectedSection === 'agenda' ? 'Durée totale des événements' : 'Temps investi'}
            </h2>
            <p className="text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>
              Moyenne : {formatTime(avgWorkTime)} · Total : {formatTime(totalWorkTime)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showReferenceBar}
                onChange={(e) => setShowReferenceBar(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: '#3B82F6' }}
              />
              <span className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>Objectif</span>
            </label>
            {showReferenceBar && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={referenceValue}
                  onChange={(e) => setReferenceValue(Number(e.target.value))}
                  step="5"
                  className="w-20 px-2 py-1.5 text-sm rounded-lg border"
                  style={{
                    backgroundColor: 'rgb(var(--color-hover))',
                    borderColor: 'rgb(var(--color-border))',
                    color: 'rgb(var(--color-text-primary))',
                  }}
                />
                <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>min</span>
              </div>
            )}
          </div>
        </div>

        <ChartContainer config={areaChartConfig} className="h-[260px] w-full" style={{ aspectRatio: 'auto' }}>
          <AreaChart data={areaChartData} margin={{ left: 4, right: 20, top: 16, bottom: 0 }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-minutes)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-minutes)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={56}
              tickFormatter={(v: number) => formatTimeShort(v)}
            />
            <ChartTooltip
              cursor={false}
              content={((props: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
                if (!props.active || !props.payload?.length) return null;
                return (
                  <div
                    className="rounded-xl border px-3 py-2 shadow-lg text-sm"
                    style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
                  >
                    <p className="text-xs mb-1 font-medium" style={{ color: 'rgb(var(--color-text-muted))' }}>{props.label}</p>
                    <p className="font-black" style={{ color: sectionColor }}>{formatTime(props.payload[0].value)}</p>
                  </div>
                );
              }) as unknown as React.ComponentProps<typeof ChartTooltip>['content']}
            />
            {showReferenceBar && referenceValue > 0 && (
              <ReferenceLine
                y={referenceValue}
                stroke="#3B82F6"
                strokeDasharray="8 4"
                strokeWidth={2}
                label={{ value: `Objectif ${formatTimeShort(referenceValue)}`, position: 'insideTopLeft', fill: '#3B82F6', fontSize: 11, fontWeight: 700 }}
              />
            )}
            <Area
              dataKey="minutes"
              type="linear"
              fill="url(#areaFill)"
              fillOpacity={1}
              stroke="var(--color-minutes)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
        {!isMobile && selectedSection === 'habits' && (
          <div className="absolute top-0 right-0 bottom-0 border-l pl-5 flex flex-col overflow-hidden"
            style={{ width: '25%', borderColor: 'rgb(var(--color-border))' }}>
            <p className="text-sm font-semibold mb-3 flex-shrink-0" style={{ color: 'rgb(var(--color-text-secondary))' }}>Calendrier</p>
            <div className="flex-1 min-h-0 flex flex-col">
              <HabitHeatmap habits={habits} now={now} embedded />
            </div>
          </div>
        )}
        </div>

      </div>
      )}

      {/* Heatmap habitudes sur mobile — card standalone sous le graphique */}
      {isMobile && selectedSection === 'habits' && (
        <div className="mb-6">
          <HabitHeatmap habits={habits} now={now} />
        </div>
      )}

      <div className="mb-8 text-center">
        <span className="text-xl md:text-2xl font-black text-slate-400 dark:text-white not-italic uppercase tracking-tight">
          {periodDescriptiveText[selectedPeriod]}
        </span>
      </div>

      {selectedSection === 'tasks' && <TasksStatistics tasks={rollingTasks} colorSettings={colorSettings} categories={categories} />}
      {selectedSection === 'agenda' && <AgendaStatistics events={rollingEvents} categories={categories} />}
      {selectedSection === 'okr' && <OKRStatistics objectives={okrs} rollingRange={rollingRange} />}
      {selectedSection === 'habits' && <HabitsStatistics habits={habits} rollingRange={rollingRange} selectedPeriod={selectedPeriod} now={now} />}
      {selectedSection === 'all' && <OverviewStatistics workTimeData={rollingWorkTimeData} />}
      </>
      )}

      <PremiumGateModal
        isOpen={showPremiumGate}
        onClose={() => setShowPremiumGate(false)}
        featureName="les analyses détaillées"
      />
    </div>
  );
}

