// ═══════════════════════════════════════════════════════════════════
// Sections de StatisticsPage — sous-composants présentationnels extraits
// verbatim (HabitStatItem, HabitHeatmap, Overview/Tasks/Agenda/OKR/Habits).
// Importés uniquement par StatisticsPage (route lazy) → pas d'impact bundle.
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Task } from '@/modules/tasks';
import type { Habit } from '@/modules/habits';
import type { CalendarEvent } from '@/modules/events';
import type { OKR, KeyResult } from '@/modules/okrs';
import { parseLocalDate, getLocalDateString } from '../../lib/workTimeCalculator';
import type { WorkTimePeriodData, KeyResultHistory } from './types';

// ═══════════════════════════════════════════════════════════════════
// COMPOSANT MÉMOÏSÉ — Habit Stat Item
// ═══════════════════════════════════════════════════════════════════
interface HabitStatItemProps {
  habit: {
    id: string;
    name: string;
    periodCompletions: number;
    periodTime: number;
    relevantDaysCount: number;
    frequency?: 'daily' | 'weekly' | 'monthly';
  };
  formatTime: (minutes: number) => string;
}

const HabitStatItem = React.memo<HabitStatItemProps>(({ habit, formatTime }) => {
  const expectedCompletions =
    habit.frequency === 'weekly'  ? Math.ceil(habit.relevantDaysCount / 7) :
    habit.frequency === 'monthly' ? Math.max(1, Math.round(habit.relevantDaysCount / 30)) :
    habit.relevantDaysCount;
  const rate = expectedCompletions > 0
    ? Math.min(100, Math.round((habit.periodCompletions / expectedCompletions) * 100))
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {habit.name}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            {habit.periodCompletions} fois
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-emerald-600">{formatTime(habit.periodTime)}</span>
          <span className="text-xs font-bold" style={{ color: 'rgb(var(--color-text-muted))' }}>{rate}%</span>
        </div>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}, (prev, next) => (
  prev.habit.id === next.habit.id &&
  prev.habit.name === next.habit.name &&
  prev.habit.periodCompletions === next.habit.periodCompletions &&
  prev.habit.periodTime === next.habit.periodTime &&
  prev.habit.relevantDaysCount === next.habit.relevantDaysCount
));

// ═══════════════════════════════════════════════════════════════════
// HEATMAP CALENDRIER — Suivi des habitudes
// ═══════════════════════════════════════════════════════════════════
export const HabitHeatmap = React.memo<{ habits: Habit[]; now: Date; embedded?: boolean }>(({ habits, now, embedded = false }) => {
  const WEEKS = 26;
  const GAP = embedded ? 3 : 2;
  const MONTH_W = embedded ? 24 : 14;
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(embedded ? 28 : 13);
  const CELL = cellSize;

  useEffect(() => {
    if (embedded) return;
    const el = wrapperRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (w > 0) {
        const size = Math.min(42, Math.floor((w - 14 - 7 * 2) / 7));
        setCellSize(Math.max(13, size));
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded]);

  const { weeks, monthLabelMap } = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstDay = new Date(today);
    firstDay.setDate(today.getDate() - (WEEKS * 7 - 1));
    const dow = firstDay.getDay();
    firstDay.setDate(firstDay.getDate() + (dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow));

    const allCells: { date: Date; dateStr: string; completed: number; total: number; rate: number; isFuture: boolean }[] = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + i);
      const dateStr = getLocalDateString(date);
      const isFuture = date > today;

      const activeHabits = habits.filter(h => {
        if (!h.createdAt) return true;
        const created = new Date(h.createdAt);
        const cn = new Date(created.getFullYear(), created.getMonth(), created.getDate());
        return date >= cn;
      });

      const completed = isFuture ? 0 : activeHabits.filter(h => h.completions[dateStr] === true).length;
      const rate = isFuture ? -1 : activeHabits.length > 0 ? completed / activeHabits.length : -1;
      allCells.push({ date, dateStr, completed, total: activeHabits.length, rate, isFuture });
    }

    const result: typeof allCells[] = [];
    for (let w = 0; w < WEEKS; w++) {
      result.push(allCells.slice(w * 7, (w + 1) * 7));
    }
    result.reverse();
    const mMap = new Map<number, string>();
    for (let w = 0; w < WEEKS; w++) {
      const firstOfMonth = result[w].find(c => c.date.getDate() === 1);
      if (firstOfMonth) {
        mMap.set(w, firstOfMonth.date.toLocaleDateString('fr-FR', { month: 'short' }));
      }
    }
    return { weeks: result, monthLabelMap: mMap };
  }, [habits, now]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [weeks]);

  const getCellColor = (rate: number) => {
    if (rate < 0) return 'transparent';
    if (rate === 0) return 'rgba(234,179,8,0.08)';
    if (rate <= 0.25) return 'rgba(234,179,8,0.30)';
    if (rate <= 0.5) return 'rgba(234,179,8,0.55)';
    if (rate <= 0.75) return 'rgba(234,179,8,0.78)';
    return '#EAB308';
  };

  const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const renderTooltip = (cell: { completed: number; total: number; date: Date }) => (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
      style={{ backgroundColor: 'rgb(var(--color-surface))', border: '1px solid rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
    >
      <div className="text-[10px] font-bold text-center">{cell.completed}/{cell.total}</div>
      <div className="text-[9px] font-normal text-center mt-0.5" style={{ color: 'rgb(var(--color-text-muted))' }}>
        {cell.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
      </div>
    </div>
  );

  const legend = (
    <div className="flex items-center gap-1.5 mt-3 justify-end flex-shrink-0">
      <span className="text-[9px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>Moins</span>
      {[0, 0.26, 0.51, 0.76, 1].map((r, i) => (
        <div key={i} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: getCellColor(r), border: '1px solid rgba(234,179,8,0.15)', flexShrink: 0 }} />
      ))}
      <span className="text-[9px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>Plus</span>
    </div>
  );

  // Vertical layout (rows = weeks, cols = days)
  const grid = (scrollClass: string) => (
    <>
      {/* Day headers */}
      <div className="flex flex-shrink-0" style={{ gap: GAP, paddingLeft: MONTH_W + GAP, marginBottom: GAP }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ width: CELL, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-[8px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>{d}</span>
          </div>
        ))}
      </div>
      {/* Scrollable weeks (rows) */}
      <div ref={scrollRef} className={scrollClass}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', gap: GAP, alignItems: 'center', flexShrink: 0 }}>
              {/* Month label */}
              <div style={{ width: MONTH_W, height: CELL, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {monthLabelMap.has(wi) && (
                  <span className="text-[8px] font-semibold leading-none select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>
                    {monthLabelMap.get(wi)}
                  </span>
                )}
              </div>
              {/* Day cells */}
              {week.map((cell, di) => (
                <div key={di} className="relative group" style={{ width: CELL, height: CELL, flexShrink: 0 }}>
                  <div
                    className="w-full h-full rounded-[3px] transition-transform duration-100 group-hover:scale-110"
                    style={{ backgroundColor: getCellColor(cell.rate), border: `1px solid ${cell.isFuture ? 'transparent' : 'rgba(234,179,8,0.15)'}` }}
                  />
                  {!cell.isFuture && cell.rate >= 0 && renderTooltip(cell)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {grid('overflow-y-auto flex-1 min-h-0')}
        {legend}
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>
        Calendrier de complétion
      </h3>
      <div ref={wrapperRef}>
        {grid('overflow-y-auto')}
      </div>
      {legend}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// VUE D'ENSEMBLE
// ═══════════════════════════════════════════════════════════════════
export const OverviewStatistics: React.FC<{ workTimeData: WorkTimePeriodData[] }> = ({ workTimeData }) => {
  const totalDetails = workTimeData.reduce(
    (acc, p) => ({
      tasksTime: acc.tasksTime + p.details.tasksTime,
      eventsTime: acc.eventsTime + p.details.eventsTime,
      habitsTime: acc.habitsTime + p.details.habitsTime,
      okrTime: acc.okrTime + p.details.okrTime,
    }),
    { tasksTime: 0, eventsTime: 0, habitsTime: 0, okrTime: 0 }
  );

  const totalTime = totalDetails.tasksTime + totalDetails.eventsTime + totalDetails.habitsTime + totalDetails.okrTime;
  const maxTime = Math.max(totalDetails.tasksTime, totalDetails.eventsTime, totalDetails.habitsTime, totalDetails.okrTime, 1);

  const formatTime = (m: number) => {
    const h = Math.floor(m / 60), mins = Math.round(m % 60);
    return h === 0 ? `${mins}min` : `${h}h${mins < 10 ? '0' : ''}${mins}`;
  };

  const breakdown = [
    { id: 'tasks', label: 'Tâches', time: totalDetails.tasksTime, color: '#3B82F6' },
    { id: 'agenda', label: 'Agenda', time: totalDetails.eventsTime, color: '#ef4444' },
    { id: 'habits', label: 'Habitudes', time: totalDetails.habitsTime, color: '#EAB308' },
    { id: 'okr', label: 'OKR', time: totalDetails.okrTime, color: '#22C55E' },
  ].sort((a, b) => b.time - a.time);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-6" style={{ color: 'rgb(var(--color-text-primary))' }}>
            Répartition globale du temps
          </h3>
          <div className="space-y-6">
            {breakdown.map(item => (
              <div key={item.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="font-bold text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTime(item.time)}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {totalTime > 0 ? Math.round((item.time / totalTime) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ backgroundColor: item.color, width: `${(item.time / maxTime) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <div className="relative w-36 h-36 sm:w-48 sm:h-48 mb-6">
            <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full rotate-[-90deg]">
              {totalTime > 0 ? (() => {
                let cum = 0;
                return breakdown.map((item, idx) => {
                  const pct = item.time / totalTime;
                  if (pct === 0) return null;
                  const sx = Math.cos(cum * 2 * Math.PI), sy = Math.sin(cum * 2 * Math.PI);
                  cum += pct;
                  const ex = Math.cos(cum * 2 * Math.PI), ey = Math.sin(cum * 2 * Math.PI);
                  return <path key={idx} d={`M ${sx} ${sy} A 1 1 0 ${pct > 0.5 ? 1 : 0} 1 ${ex} ${ey} L 0 0`}
                    fill={item.color} stroke="rgb(var(--color-surface))" strokeWidth="0.02" />;
                });
              })() : <circle cx="0" cy="0" r="1" fill="rgb(var(--color-hover))" />}
              <circle cx="0" cy="0" r="0.75" fill="rgb(var(--color-surface))" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Total</span>
              <span className="text-xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTime(totalTime)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full">
            {breakdown.filter(i => i.time > 0).map(item => (
              <div key={item.id} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground justify-center">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// TÂCHES
// ═══════════════════════════════════════════════════════════════════
export const TasksStatistics: React.FC<{
  tasks: Task[];
  colorSettings: Record<string, string>;
  categories: Array<{ id: string; color: string; name: string }>;
}> = ({ tasks, colorSettings, categories }) => {
  const getColorValue = (catId: string | undefined) => categories.find(c => c.id === catId)?.color || '#64748B';
  // Fix dots gris : itérer sur les VRAIES catégories (UUIDs), pas sur colorSettings (clés hardcodées cat-1...).
  // Fallback aux entrées colorSettings si aucune catégorie chargée (mode démo très précoce).
  const colorDistribution = (categories.length > 0
    ? categories.map(c => ({
        catId: c.id,
        name: c.name,
        count: tasks.filter(t => t.category === c.id).length,
      }))
    : Object.keys(colorSettings).map(catId => ({
        catId,
        name: colorSettings[catId],
        count: tasks.filter(t => t.category === catId).length,
      }))
  ).filter(item => item.count > 0);
  const priorityDistribution = [1, 2, 3, 4, 5].map(priority => ({
    priority, count: tasks.filter(t => t.priority === priority).length,
  }));
  const maxColorCount = Math.max(...colorDistribution.map(c => c.count), 1);
  const maxPriorityCount = Math.max(...priorityDistribution.map(p => p.count), 1);
  const avgPriority = tasks.length > 0
    ? (priorityDistribution.reduce((acc, item) => acc + item.priority * item.count, 0) / tasks.length).toFixed(1)
    : '0';
  const priorityColors = ['#DC2626', '#F97316', '#F59E0B', '#3B82F6', '#6B7280'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>Répartition par couleur</h3>
          <span className="text-sm font-medium px-2 py-1 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">{tasks.length} tâches</span>
        </div>
        <div className="space-y-4">
          {colorDistribution.map(item => (
            <div key={item.catId} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorValue(item.catId) }} />
                  <span className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.name}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.count}</span>
              </div>
              <div className="w-full rounded-full h-2.5" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                <div className="h-2.5 rounded-full transition-all duration-500"
                  style={{ backgroundColor: getColorValue(item.catId), width: `${(item.count / maxColorCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>Répartition par priorité</h3>
          <span className="text-sm font-medium px-2 py-1 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">Moy. {avgPriority}</span>
        </div>
        <div className="space-y-4">
          {priorityDistribution.map((item, idx) => (
            <div key={item.priority} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>Priorité {item.priority}</span>
                <span className="text-sm font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.count}</span>
              </div>
              <div className="w-full rounded-full h-2.5" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                <div className="h-2.5 rounded-full transition-all duration-500"
                  style={{ backgroundColor: priorityColors[idx], width: `${(item.count / maxPriorityCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// AGENDA
// ═══════════════════════════════════════════════════════════════════
export const AgendaStatistics: React.FC<{
  events: CalendarEvent[];
  categories: Array<{ id: string; color: string; name: string }>;
}> = ({ events, categories }) => {
  const getColorValue = (hex: string | undefined) => hex || '#64748B';
  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
    return h === 0 ? `${m}min` : `${h}h${m < 10 ? '0' : ''}${m}`;
  };

  const timeByColor = useMemo(() => {
    const uniqueHexColors = [...new Set(events.map(e => e.color).filter((c): c is string => Boolean(c)))];
    return uniqueHexColors.map(hexColor => {
      const colorEvents = events.filter(e => e.color === hexColor);
      const totalMinutes = colorEvents.reduce((sum, e) => sum + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000, 0);
      const cat = categories.find(c => c.color.toLowerCase() === hexColor.toLowerCase());
      return { color: hexColor, name: cat?.name || hexColor, minutes: totalMinutes, count: colorEvents.length };
    }).filter(item => item.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  }, [events, categories]);

  const totalMinutesAll = timeByColor.reduce((sum, item) => sum + item.minutes, 0);
  const maxMinutes = Math.max(...timeByColor.map(c => c.minutes), 1);
  const sortedEvents = [...events]
    .map(e => ({ ...e, duration: (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000 }))
    .sort((a, b) => b.duration - a.duration);

  let cumulative = 0;
  const getCoords = (pct: number): [number, number] => [
    Math.cos((pct - 0.25) * 2 * Math.PI),
    Math.sin((pct - 0.25) * 2 * Math.PI),
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-6" style={{ color: 'rgb(var(--color-text-primary))' }}>Répartition par catégorie</h3>
          <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-16">
            <div className="relative w-44 h-44 sm:w-56 sm:h-56 shrink-0">
              <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full">
                {timeByColor.length > 0 ? timeByColor.map((item, idx) => {
                  const pct = item.minutes / totalMinutesAll;
                  const [sx, sy] = getCoords(cumulative);
                  cumulative += pct;
                  const [ex, ey] = getCoords(cumulative);
                  return <path key={idx} d={`M ${sx} ${sy} A 1 1 0 ${pct > 0.5 ? 1 : 0} 1 ${ex} ${ey} L 0 0`}
                    fill={getColorValue(item.color)} stroke="#FFFFFF" strokeWidth="0.04" />;
                }) : <circle cx="0" cy="0" r="1" fill="rgb(var(--color-hover))" />}
                <circle cx="0" cy="0" r="0.75" fill="rgb(var(--color-surface))" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Total</span>
                <span className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTime(totalMinutesAll)}</span>
              </div>
            </div>
            <div className="flex-1 min-w-[200px] space-y-4">
              {timeByColor.map(item => (
                <div key={item.color} className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorValue(item.color) }} />
                      <span className="font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{formatTime(item.minutes)}</span>
                      <span className="font-black text-violet-500">{Math.round((item.minutes / totalMinutesAll) * 100)}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ backgroundColor: getColorValue(item.color), width: `${(item.minutes / maxMinutes) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-6" style={{ color: 'rgb(var(--color-text-primary))' }}>Événements par temps de travail</h3>
          <div className="space-y-2">
            {sortedEvents.length > 0 ? sortedEvents.slice(0, 20).map(event => (
              <div key={event.id} className="flex items-center justify-between p-3 rounded-xl border transition-all hover:bg-muted/30"
                style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>
                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${getColorValue(event.color)}20` }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorValue(event.color) }} />
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{event.title}</p>
                    <p className="text-[10px] uppercase tracking-wider font-bold truncate" style={{ color: 'rgb(var(--color-text-muted))' }}>
                      {categories.find(c => c.color.toLowerCase() === event.color?.toLowerCase())?.name || event.color}
                      <span className="hidden sm:inline"> · {new Date(event.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    </p>
                  </div>
                </div>
                <p className="font-black text-sm shrink-0 ml-3" style={{ color: getColorValue(event.color) }}>{formatTime(event.duration)}</p>
              </div>
            )) : <div className="py-8 text-center text-muted-foreground">Aucun événement</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// OKR
// ═══════════════════════════════════════════════════════════════════
export const OKRStatistics: React.FC<{ objectives: OKR[]; rollingRange: { start: Date; end: Date } }> = ({ objectives, rollingRange }) => {
  const okrWorkTime = objectives.map(okr => {
    let workedTime = 0;
    okr.keyResults.forEach((kr: KeyResult) => {
      const history = (kr as KeyResult & { history?: KeyResultHistory[] }).history || [];
      const total = history.reduce((sum: number, h: KeyResultHistory) => {
        const hDate = parseLocalDate(h.date);
        const norm = new Date(hDate.getFullYear(), hDate.getMonth(), hDate.getDate());
        return norm >= rollingRange.start && norm <= rollingRange.end ? sum + h.increment : sum;
      }, 0);
      workedTime += total * kr.estimatedTime;
    });
    return { id: okr.id, title: okr.title, workedTime };
  }).filter(o => o.workedTime > 0);

  const totalWorkedTime = okrWorkTime.reduce((sum, o) => sum + o.workedTime, 0);
  const maxWorkedTime = Math.max(...okrWorkTime.map(o => o.workedTime), 1);
  const formatTime = (m: number) => {
    const h = Math.floor(m / 60), mins = Math.round(m % 60);
    return h === 0 ? `${mins}min` : `${h}h${mins < 10 ? '0' : ''}${mins}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Objectifs</p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{objectives.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Objectifs travaillés</p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{okrWorkTime.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Temps total réel</p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTime(totalWorkedTime)}</p>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-6" style={{ color: 'rgb(var(--color-text-primary))' }}>
          Répartition de l'effort par OKR
        </h3>
        <div className="space-y-6">
          {okrWorkTime.length > 0 ? okrWorkTime.sort((a, b) => b.workedTime - a.workedTime).map(okr => (
            <div key={okr.id} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{okr.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-violet-500">{formatTime(okr.workedTime)}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                    {Math.round((okr.workedTime / totalWorkedTime) * 100)}%
                  </span>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-violet-500 transition-all duration-1000"
                  style={{ width: `${(okr.workedTime / maxWorkedTime) * 100}%` }} />
              </div>
            </div>
          )) : <div className="py-8 text-center text-muted-foreground">Aucun effort enregistré.</div>}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// HABITUDES
// ═══════════════════════════════════════════════════════════════════
export const HabitsStatistics: React.FC<{
  habits: Habit[];
  rollingRange: { start: Date; end: Date };
  selectedPeriod: string;
  now: Date;
}> = ({ habits, rollingRange, selectedPeriod, now }) => {
  const habitsStats = useMemo(() => habits.map(habit => {
    let completionsCount = 0;
    const createdDate = habit.createdAt ? new Date(habit.createdAt) : new Date(0);
    createdDate.setHours(0, 0, 0, 0);

    Object.keys(habit.completions).forEach(date => {
      if (!habit.completions[date]) return;
      const hDate = parseLocalDate(date);
      hDate.setHours(0, 0, 0, 0);
      if (hDate >= rollingRange.start && hDate <= rollingRange.end) completionsCount++;
    });

    const effectiveEnd = new Date(rollingRange.end > now ? now : rollingRange.end);
    effectiveEnd.setHours(23, 59, 59, 999);
    const effectiveStart = new Date(createdDate > rollingRange.start ? createdDate : rollingRange.start);
    effectiveStart.setHours(0, 0, 0, 0);

    const relevantDaysCount = effectiveStart <= effectiveEnd
      ? Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 0;

    return { ...habit, periodCompletions: completionsCount, periodTime: completionsCount * habit.estimatedTime, relevantDaysCount, frequency: habit.frequency };
  }), [habits, rollingRange, now]);

  const totalCompletions = habitsStats.reduce((sum, h) => sum + h.periodCompletions, 0);
  const totalEstimatedTime = habitsStats.reduce((sum, h) => sum + h.periodTime, 0);
  const totalExpected = habitsStats.reduce((sum, h) => {
    if (h.frequency === 'weekly')  return sum + Math.ceil(h.relevantDaysCount / 7);
    if (h.frequency === 'monthly') return sum + Math.max(1, Math.round(h.relevantDaysCount / 30));
    return sum + h.relevantDaysCount;
  }, 0);
  const avgRate = totalExpected > 0 ? Math.round((totalCompletions / totalExpected) * 100) : 0;

  const activeHabitsCount = useMemo(() => habitsStats.filter(h => h.periodCompletions > 0).length, [habitsStats]);
  const sortedRelevantHabits = useMemo(
    () => habitsStats.filter(h => h.relevantDaysCount > 0).sort((a, b) => b.periodTime - a.periodTime),
    [habitsStats]
  );

  const formatTime = (m: number) => {
    const h = Math.floor(m / 60), mins = Math.round(m % 60);
    return h === 0 ? `${mins}min` : `${h}h${mins < 10 ? '0' : ''}${mins}`;
  };

  const periodSuffix =
    selectedPeriod === 'day' ? "aujourd'hui" :
    selectedPeriod === 'week' ? '(7 j)' :
    selectedPeriod === 'month' ? '(30 j)' : '(365 j)';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Habitudes actives {periodSuffix}</p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{activeHabitsCount}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Taux de succès {periodSuffix}</p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{avgRate}%</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Temps investi {periodSuffix}</p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTime(totalEstimatedTime)}</p>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-6" style={{ color: 'rgb(var(--color-text-primary))' }}>
          Détail par habitude {periodSuffix}
        </h3>
        <div className="space-y-6">
          {sortedRelevantHabits.length > 0
            ? sortedRelevantHabits.map(habit => (
                <HabitStatItem key={habit.id} habit={habit} formatTime={formatTime} />
              ))
            : <div className="py-8 text-center text-muted-foreground">Aucune habitude complétée ou active sur cette période.</div>}
        </div>
      </div>
    </div>
  );
};
