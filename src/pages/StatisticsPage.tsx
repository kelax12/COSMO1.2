'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { BarChart3, Clock, TrendingUp, Calendar, ChevronDown, Target, CheckSquare, Repeat, CalendarDays } from 'lucide-react';
import { useColorSettings } from '@/modules/ui-states';
import { useTasks, Task } from '@/modules/tasks';
import { useHabits, Habit } from '@/modules/habits';
import { useEvents, CalendarEvent } from '@/modules/events';
import { useOkrs, OKR, KeyResult } from '@/modules/okrs';
import { parseLocalDate, getLocalDateString, calculateWorkTimeForPeriod } from '../lib/workTimeCalculator';
import { useVisibilityInterval } from '../lib/hooks/usePerformance';

type StatSection = 'all' | 'tasks' | 'agenda' | 'okr' | 'habits';
type TimePeriod = 'day' | 'week' | 'month' | 'year';

// Interfaces pour les composants de statistiques
interface WorkTimePeriodData {
  label: string;
  totalTime: number;
  details: {
    tasksTime: number;
    eventsTime: number;
    habitsTime: number;
    okrTime: number;
  };
}

interface KeyResultHistory {
  date: string;
  increment: number;
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSANT MÉMOÏSÉ - Habit Stat Item (évite re-renders inutiles)
// ═══════════════════════════════════════════════════════════════════
interface HabitStatItemProps {
  habit: {
    id: string;
    name: string;
    periodCompletions: number;
    periodTime: number;
    relevantDaysCount: number;
  };
  formatTime: (minutes: number) => string;
}

const HabitStatItem = React.memo<HabitStatItemProps>(({ habit, formatTime }) => {
  const rate = habit.relevantDaysCount > 0 
    ? Math.min(100, Math.round((habit.periodCompletions / habit.relevantDaysCount) * 100)) 
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
          <span className="text-xs font-bold" style={{ color: 'rgb(var(--color-text-muted))' }}>
            {rate}%
          </span>
        </div>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div 
          className="h-full bg-emerald-500 transition-all duration-1000" 
          style={{ width: `${rate}%` }} 
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Ne re-render que si les données de l'habitude changent réellement
  return (
    prevProps.habit.id === nextProps.habit.id &&
    prevProps.habit.name === nextProps.habit.name &&
    prevProps.habit.periodCompletions === nextProps.habit.periodCompletions &&
    prevProps.habit.periodTime === nextProps.habit.periodTime &&
    prevProps.habit.relevantDaysCount === nextProps.habit.relevantDaysCount
  );
});

export default function StatisticsPage() {
  // Use new module for tasks (read-only)
  const { data: tasks = [] } = useTasks();
  // Use new module for events (read-only)
  const { data: events = [] } = useEvents();
  // Use new module for okrs (read-only)
  const { data: okrs = [] } = useOkrs();
  const { colorSettings } = useColorSettings();
  const { data: habits = [] } = useHabits();
  const [selectedSection, setSelectedSection] = useState<StatSection>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('week');
  const [showReferenceBar, setShowReferenceBar] = useState(true);
  const [referenceValue, setReferenceValue] = useState(60);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);
  const [now, setNow] = useState(new Date());

  // ═══════════════════════════════════════════════════════════════════
  // PERFORMANCE: Utilise visibility-aware interval (pause quand onglet caché)
  // ═══════════════════════════════════════════════════════════════════
  useVisibilityInterval(
    useCallback(() => setNow(new Date()), []),
    60000,
    true
  );

  useEffect(() => {
    const updateWidth = () => {
      if (chartContainerRef.current) {
        setChartWidth(chartContainerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const getPeriodDetails = (period: TimePeriod, periodDate: Date) => {
    let startDate: Date, endDate: Date;

    if (period === 'day') {
      startDate = new Date(periodDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(periodDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      startDate = new Date(periodDate);
      endDate = new Date(periodDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      startDate = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
      endDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'year') {
      startDate = new Date(periodDate.getFullYear(), 0, 1);
      endDate = new Date(periodDate.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
    } else {
      return {
        completedTasks: [],
        events: [],
        habits: [],
        totalTime: 0,
        tasksTime: 0,
        eventsTime: 0,
        habitsTime: 0,
        okrTime: 0
      };
    }

    return calculateWorkTimeForPeriod(startDate, endDate, { tasks, events, habits, okrs });
  };

    const calculateWorkTime = (period: TimePeriod) => {
      const periods = [];

      switch (period) {
        case 'day':
          for (let i = 9; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            periods.push({
              label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
              date: getLocalDateString(date),
              fullDate: date
            });
          }
          break;
        case 'week':
          for (let i = 11; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - (i * 7));
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - (date.getDay() === 0 ? 6 : date.getDay() - 1));
            
            const startOfYear = new Date(weekStart.getFullYear(), 0, 1);
            const weekNumber = Math.ceil(((weekStart.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
            
            periods.push({
              label: `S${weekNumber}`,
              date: getLocalDateString(weekStart),
              fullDate: weekStart,
              weekNumber: weekNumber
            });
          }
          break;
        case 'month':
          for (let i = 11; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            periods.push({
              label: date.toLocaleDateString('fr-FR', { month: 'short' }),
              date: getLocalDateString(date),
              fullDate: date
            });
          }
          break;
        case 'year':
          for (let i = 4; i >= 0; i--) {
            const date = new Date(now);
            date.setFullYear(date.getFullYear() - i);
            periods.push({
              label: date.getFullYear().toString(),
              date: getLocalDateString(date),
              fullDate: date
            });
          }
          break;
      }

      return periods.map((p, index) => {
        const periodDetails = getPeriodDetails(period, p.fullDate);
        
        let relevantTime = 0;
        if (selectedSection === 'tasks') relevantTime = periodDetails.tasksTime;
        else if (selectedSection === 'agenda') relevantTime = periodDetails.eventsTime;
        else if (selectedSection === 'habits') relevantTime = periodDetails.habitsTime;
        else if (selectedSection === 'okr') relevantTime = periodDetails.okrTime;
        else relevantTime = periodDetails.totalTime;

        const finalTime = Math.round(relevantTime);

        return {
          ...p,
          totalTime: finalTime,
          hours: Math.floor(finalTime / 60),
          minutes: Math.round(finalTime % 60),
          details: periodDetails,
          index
        };
      });
    };

    const workTimeData = React.useMemo(() => calculateWorkTime(selectedPeriod), [selectedPeriod, selectedSection, tasks, events, habits, okrs, now]);
    
    // Calculate the rolling range matching the descriptive text below the chart
    const rollingRange = React.useMemo(() => {
      // Create 'today' at 00:00:00 local time
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const start = new Date(today);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);

      if (selectedPeriod === 'week') start.setDate(today.getDate() - 6);
      else if (selectedPeriod === 'month') start.setDate(today.getDate() - 29);
      else if (selectedPeriod === 'year') start.setDate(today.getDate() - 364);

      return { start, end };
    }, [selectedPeriod, now]);

    const rollingTasks = React.useMemo(() => {
      return tasks.filter(task => {
        if (!task.completed || !task.completedAt) return false;
        const d = parseLocalDate(task.completedAt);
        return d >= rollingRange.start && d <= rollingRange.end;
      });
    }, [tasks, rollingRange]);

    const rollingEvents = React.useMemo(() => {
      return events.filter(event => {
        const d = parseLocalDate(event.start);
        return d >= rollingRange.start && d <= rollingRange.end;
      });
    }, [events, rollingRange]);

    const rollingWorkTimeData = React.useMemo(() => {
      // Create a single period detail for the rolling range for OverviewStatistics
      const details = {
        completedTasks: rollingTasks,
        events: rollingEvents,
        totalTime: 0,
        tasksTime: 0,
        eventsTime: 0,
        habitsTime: 0,
        okrTime: 0
      };

      details.tasksTime = rollingTasks.reduce((sum, task) => sum + task.estimatedTime, 0);
      details.eventsTime = rollingEvents.reduce((sum, event) => {
        const start = new Date(event.start);
        const end = new Date(event.end);
        return sum + (end.getTime() - start.getTime()) / (1000 * 60);
      }, 0);

      // Habits time for rolling range
      details.habitsTime = habits.reduce((total, habit) => {
        const completionsInRange = Object.keys(habit.completions).filter(date => {
          const hDate = parseLocalDate(date);
          const hDateNormalized = new Date(hDate.getFullYear(), hDate.getMonth(), hDate.getDate());
          return hDateNormalized >= rollingRange.start && hDateNormalized <= rollingRange.end && habit.completions[date];
        }).length;
        return total + (completionsInRange * habit.estimatedTime);
      }, 0);

      // OKR time for rolling range
      okrs.forEach(okr => {
        okr.keyResults.forEach(kr => {
          const historyInRange = (kr.history || []).filter(h => {
            const hDate = parseLocalDate(h.date);
            const hDateNormalized = new Date(hDate.getFullYear(), hDate.getMonth(), hDate.getDate());
            return hDateNormalized >= rollingRange.start && hDateNormalized <= rollingRange.end;
          });
          const totalIncrements = historyInRange.reduce((sum, h) => sum + h.increment, 0);
          details.okrTime += totalIncrements * kr.estimatedTime;
        });
      });

      details.totalTime = details.tasksTime + details.eventsTime + details.habitsTime + details.okrTime;

      return [{ details }];
    }, [rollingTasks, rollingEvents, habits, okrs, rollingRange]);
    
    const totalWorkTime = workTimeData.reduce((sum, d) => sum + d.totalTime, 0);
  const avgWorkTime = workTimeData.length > 0 ? Math.round(totalWorkTime / workTimeData.length) : 0;
  const maxWorkTime = Math.max(...workTimeData.map(d => d.totalTime), 1);

  const globalStats = {
    today: workTimeData[workTimeData.length - 1]?.totalTime || 0,
    week: workTimeData.slice(-7).reduce((sum, d) => sum + d.totalTime, 0),
    month: workTimeData.slice(-30).reduce((sum, d) => sum + d.totalTime, 0),
    year: totalWorkTime
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins < 10 ? '0' : ''}${mins}`;
  };

  const formatTimeShort = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h` : `${minutes}min`;
  };

  const generateSmartYScale = (maxValue: number, refValue: number) => {
    const maxDisplayValue = Math.max(maxValue, refValue, 15);
    let step;
    if (maxDisplayValue <= 30) step = 15;
    else if (maxDisplayValue <= 60) step = 30;
    else if (maxDisplayValue <= 120) step = 30;
    else if (maxDisplayValue <= 240) step = 60;
    else step = Math.ceil(maxDisplayValue / 6 / 60) * 60;
    const scaleMax = Math.ceil((maxDisplayValue * 1.2) / step) * step;
    const ticks = [];
    for (let i = 0; i <= scaleMax; i += step) ticks.push(i);
    return { ticks, max: scaleMax, step };
  };

    const yScale = React.useMemo(() => generateSmartYScale(maxWorkTime, referenceValue), [maxWorkTime, referenceValue]);
    const chartHeight = 350;

    const periodDescriptiveText = {
      day: "aujourd'hui",
      week: "7 derniers jours",
      month: "30 derniers jours",
      year: "365 derniers jours"
    };

    const sections = [
    { id: 'all', label: 'Vue d\'ensemble', icon: BarChart3, color: '#8B5CF6' },
    { id: 'tasks', label: 'Tâches', icon: CheckSquare, color: '#3B82F6' },
    { id: 'agenda', label: 'Agenda', icon: CalendarDays, color: '#F97316' },
    { id: 'okr', label: 'OKR', icon: Target, color: '#22C55E' },
    { id: 'habits', label: 'Habitudes', icon: Repeat, color: '#EAB308' }
  ];

  const periods = [
    { id: 'day', label: 'Par jour' },
    { id: 'week', label: 'Par semaine' },
    { id: 'month', label: 'Par mois' },
    { id: 'year', label: 'Par année' }
  ];

    const isMobile = chartWidth < 640;
    const paddingLeft = isMobile ? 50 : 70;
    const paddingRight = isMobile ? 20 : 40;
    const paddingTop = 40;
    const paddingBottom = isMobile ? 70 : 50;
    const chartInnerWidth = chartWidth - paddingLeft - paddingRight;
    const chartInnerHeight = chartHeight - paddingTop - paddingBottom;


  const barWidth = Math.min(40, (chartInnerWidth / workTimeData.length) * 0.6);
  const barGap = (chartInnerWidth - barWidth * workTimeData.length) / (workTimeData.length + 1);

  const getBarHeight = (value: number) => (value / yScale.max) * chartInnerHeight;
  const getBarY = (value: number) => paddingTop + chartInnerHeight - getBarHeight(value);
  const getBarX = (index: number) => paddingLeft + barGap + index * (barWidth + barGap);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>Statistiques</h1>
        <p style={{ color: 'rgb(var(--color-text-secondary))' }}>Analysez votre productivité et vos performances</p>
      </div>

<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Aujourd'hui", val: globalStats.today, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.45)' },
              { label: "Cette semaine", val: globalStats.week, color: '#10B981', bg: 'rgba(16, 185, 129, 0.45)' },
              { label: "Ce mois", val: globalStats.month, color: '#F97316', bg: 'rgba(249, 115, 22, 0.45)' },
              { label: "Cette année", val: globalStats.year, color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.45)' }
            ].map((s, idx) => (
            <div key={idx} className="card p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: s.bg }}>
                  <Calendar size={22} style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'rgb(var(--color-text-muted))' }}>{s.label}</p>
                  <p className="text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTimeShort(s.val)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      <div className="mb-6 space-y-4">
<div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>Analyser :</span>
            <div className="flex rounded-xl p-1 bg-hover" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
              {sections.map(section => {
                const Icon = section.icon;
                const isSelected = selectedSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id as StatSection)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isSelected ? 'shadow-sm' : ''}`}
                    style={{
                      backgroundColor: isSelected ? 'rgb(var(--color-surface))' : 'transparent',
                      color: isSelected ? section.color : 'rgb(var(--color-text-secondary))'
                    }}
                  >
                    <Icon size={16} style={{ color: isSelected ? section.color : 'rgb(var(--color-text-secondary))' }} />
                    <span className="hidden sm:inline">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        <div className="flex rounded-xl p-1 w-fit bg-hover" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
          {periods.map(period => (
            <button
              key={period.id}
              onClick={() => setSelectedPeriod(period.id as TimePeriod)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${selectedPeriod === period.id ? 'shadow-sm' : ''}`}
              style={{
                backgroundColor: selectedPeriod === period.id ? 'rgb(var(--color-surface))' : 'transparent',
                color: selectedPeriod === period.id ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))'
              }}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6 mb-8">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {selectedSection === 'agenda' ? 'Durée totale des événements' : 'Temps investi'} {periods.find(p => p.id === selectedPeriod)?.label.toLowerCase()}
            </h2>
            <p className="text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>Moyenne: {formatTime(avgWorkTime)} · Total: {formatTime(totalWorkTime)}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showReferenceBar} onChange={(e) => setShowReferenceBar(e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#3B82F6' }} />
              <span className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>Objectif</span>
            </label>
            {showReferenceBar && (
              <div className="flex items-center gap-2">
                <input type="number" value={referenceValue} onChange={(e) => setReferenceValue(Number(e.target.value))} step="5" className="w-20 px-2 py-1.5 text-sm rounded-lg border border-border bg-hover text-primary" style={{ backgroundColor: 'rgb(var(--color-hover))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }} />
                <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>min</span>
              </div>
            )}
          </div>
        </div>

          <div ref={chartContainerRef} className="relative rounded-xl overflow-hidden bg-hover" style={{ height: `${chartHeight}px`, backgroundColor: 'rgb(var(--color-hover))' }}>
            <svg width="100%" height="100%" className="overflow-visible">
              <defs>
                <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#2563EB" /></linearGradient>
                <linearGradient id="barGradientSuccess" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="#059669" /></linearGradient>
                <linearGradient id="barGradientWarning" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#F59E0B" /><stop offset="100%" stopColor="#D97706" /></linearGradient>
              </defs>
              {yScale.ticks.map((tick) => {
                const y = getBarY(tick);
                return (
                  <g key={`grid-${tick}`}>
                    <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="rgb(var(--color-border))" strokeWidth="1" strokeDasharray={tick === 0 ? "none" : "4,4"} opacity={tick === 0 ? 1 : 0.5} />
                    <text x={paddingLeft - 10} y={y + 4} textAnchor="end" className="text-xs" fill="rgb(var(--color-text-muted))">{formatTimeShort(tick)}</text>
                  </g>
                );
              })}
              {showReferenceBar && referenceValue <= yScale.max && (
                <g>
                  <line x1={paddingLeft} y1={getBarY(referenceValue)} x2={chartWidth - paddingRight} y2={getBarY(referenceValue)} stroke="#3B82F6" strokeWidth="2" strokeDasharray="8,4" />
                  <rect x={chartWidth - paddingRight - 60} y={getBarY(referenceValue) - 10} width="55" height="20" rx="4" fill="#3B82F6" />
                  <text x={chartWidth - paddingRight - 32} y={getBarY(referenceValue) + 4} textAnchor="middle" className="text-xs font-medium" fill="white">{formatTimeShort(referenceValue)}</text>
                </g>
              )}
              {workTimeData.map((data, index) => {
                const barHeight = getBarHeight(data.totalTime);
                const barX = getBarX(index);
                const barY = getBarY(data.totalTime);
                const isAboveTarget = showReferenceBar && data.totalTime >= referenceValue;
                const isHovered = hoveredPoint === index;
                const gradientId = showReferenceBar ? (isAboveTarget ? "barGradientSuccess" : "barGradientWarning") : "barGradient";
                return (
                  <g key={index} onMouseEnter={() => setHoveredPoint(index)} onMouseLeave={() => setHoveredPoint(null)} className="cursor-pointer">
                    <rect x={barX} y={barY} width={barWidth} height={Math.max(barHeight, 2)} rx="6" fill={`url(#${gradientId})`} opacity={isHovered ? 1 : 0.85} style={{ transition: 'all 0.2s ease', transform: isHovered ? 'scaleY(1.02)' : 'scaleY(1)', transformOrigin: 'bottom' }} />
                    {isHovered && <text x={barX + barWidth / 2} y={barY - 8} textAnchor="middle" className="text-[10px] sm:text-xs font-semibold" fill="rgb(var(--color-text-primary))">{formatTime(data.totalTime)}</text>}
                    <text 
                      x={barX + barWidth / 2} 
                      y={chartHeight - paddingBottom + (isMobile ? 15 : 20)} 
                      textAnchor={isMobile ? "start" : "middle"} 
                      className="text-[10px] sm:text-xs" 
                      fill="rgb(var(--color-text-muted))"
                      transform={isMobile ? `rotate(45, ${barX + barWidth / 2}, ${chartHeight - paddingBottom + 15})` : ""}
                    >
                      {data.label}
                    </text>
                  </g>
                );
              })}
            </svg>
            </div>
  
      </div>

      <div className="mb-8 text-center">
        <span className="text-xl md:text-2xl font-black text-slate-400 dark:text-white not-italic uppercase tracking-tight">
          {periodDescriptiveText[selectedPeriod]}
        </span>
      </div>

      {selectedSection === 'tasks' && <TasksStatistics tasks={rollingTasks} colorSettings={colorSettings} />}
      {selectedSection === 'agenda' && <AgendaStatistics events={rollingEvents} colorSettings={colorSettings} />}
      {selectedSection === 'okr' && <OKRStatistics objectives={okrs} rollingRange={rollingRange} />}
        {selectedSection === 'habits' && <HabitsStatistics habits={habits} rollingRange={rollingRange} selectedPeriod={selectedPeriod} now={now} />}
      {selectedSection === 'all' && <OverviewStatistics workTimeData={rollingWorkTimeData} colorSettings={colorSettings} />}
    </div>
  );
}

const OverviewStatistics: React.FC<{ workTimeData: WorkTimePeriodData[], colorSettings: Record<string, string> }> = ({ workTimeData, colorSettings }) => {
  const totalDetails = workTimeData.reduce((acc, period) => {
    acc.tasksTime += period.details.tasksTime;
    acc.eventsTime += period.details.eventsTime;
    acc.habitsTime += period.details.habitsTime;
    acc.okrTime += period.details.okrTime;
    return acc;
  }, { tasksTime: 0, eventsTime: 0, habitsTime: 0, okrTime: 0 });

  const totalTime = totalDetails.tasksTime + totalDetails.eventsTime + totalDetails.habitsTime + totalDetails.okrTime;
  const maxTime = Math.max(totalDetails.tasksTime, totalDetails.eventsTime, totalDetails.habitsTime, totalDetails.okrTime, 1);

  const formatTime = (m: number) => {
    const hours = Math.floor(m / 60); const mins = Math.round(m % 60);
    return hours === 0 ? `${mins}min` : `${hours}h${mins < 10 ? '0' : ''}${mins}`;
  };

  const breakdown = [
    { id: 'tasks', label: 'Tâches', time: totalDetails.tasksTime, color: '#3B82F6', icon: CheckSquare },
    { id: 'agenda', label: 'Agenda', time: totalDetails.eventsTime, color: '#F97316', icon: CalendarDays },
    { id: 'habits', label: 'Habitudes', time: totalDetails.habitsTime, color: '#EAB308', icon: Repeat },
    { id: 'okr', label: 'OKR', time: totalDetails.okrTime, color: '#22C55E', icon: Target },
  ].sort((a, b) => b.time - a.time);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}><BarChart3 size={20} className="text-violet-500" />Répartition globale du temps</h3>
          <div className="space-y-6">
            {breakdown.map(item => (
              <div key={item.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${item.color}20` }}><item.icon size={18} style={{ color: item.color }} /></div>
                    <span className="font-bold text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTime(item.time)}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{totalTime > 0 ? Math.round((item.time / totalTime) * 100) : 0}%</span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ backgroundColor: item.color, width: `${(item.time / maxTime) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <div className="relative w-48 h-48 mb-6">
            <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full rotate-[-90deg]">
              {totalTime > 0 ? (() => {
                let currentCumulative = 0;
                return breakdown.map((item, idx) => {
                  const pct = item.time / totalTime;
                  if (pct === 0) return null;
                  const sx = Math.cos(currentCumulative * 2 * Math.PI);
                  const sy = Math.sin(currentCumulative * 2 * Math.PI);
                  currentCumulative += pct;
                  const [ex, ey] = [Math.cos(currentCumulative * 2 * Math.PI), Math.sin(currentCumulative * 2 * Math.PI)];
                  return <path key={idx} d={`M ${sx} ${sy} A 1 1 0 ${pct > 0.5 ? 1 : 0} 1 ${ex} ${ey} L 0 0`} fill={item.color} stroke="rgb(var(--color-surface))" strokeWidth="0.02" />;
                });
              })() : <circle cx="0" cy="0" r="1" fill="rgb(var(--color-hover))" />}
              <circle cx="0" cy="0" r="0.75" fill="rgb(var(--color-surface))" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Total investi</span>
              <span className="text-xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTime(totalTime)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full">
            {breakdown.filter(i => i.time > 0).map(item => (
              <div key={item.id} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground justify-center">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TasksStatistics: React.FC<{ tasks: Task[], colorSettings: Record<string, string> }> = ({ tasks, colorSettings }) => {
  const colorDistribution = Object.keys(colorSettings).map(color => ({
    color, name: colorSettings[color], count: tasks.filter(task => task.category === color).length
  }));
  const priorityDistribution = [1, 2, 3, 4, 5].map(priority => ({
    priority, count: tasks.filter(task => task.priority === priority).length
  }));
  const maxColorCount = Math.max(...colorDistribution.map(c => c.count), 1);
  const maxPriorityCount = Math.max(...priorityDistribution.map(p => p.count), 1);
  const avgPriority = tasks.length > 0 ? (priorityDistribution.reduce((acc, item) => acc + (item.priority * item.count), 0) / tasks.length).toFixed(1) : "0";
  const getColorValue = (colorKey: string) => ({ red: '#EF4444', blue: '#3B82F6', green: '#10B981', purple: '#8B5CF6', orange: '#F97316' }[colorKey] || '#64748B');
  const priorityColors = ['#DC2626', '#F97316', '#F59E0B', '#3B82F6', '#6B7280'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>Répartition par couleur</h3><span className="text-sm font-medium px-2 py-1 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">{tasks.length} tâches réalisées</span></div>
        <div className="space-y-4">
          {colorDistribution.map(item => (
            <div key={item.color} className="space-y-2">
              <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorValue(item.color) }} /><span className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.name}</span></div><span className="text-sm font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.count}</span></div>
              <div className="w-full rounded-full h-2.5" style={{ backgroundColor: 'rgb(var(--color-hover))' }}><div className="h-2.5 rounded-full transition-all duration-500" style={{ backgroundColor: getColorValue(item.color), width: `${(item.count / maxColorCount) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>Répartition par priorité</h3><span className="text-sm font-medium px-2 py-1 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">Priorité moyenne : {avgPriority}</span></div>
        <div className="space-y-4">
          {priorityDistribution.map((item, idx) => (
            <div key={item.priority} className="space-y-2">
              <div className="flex justify-between items-center"><span className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>Priorité {item.priority}</span><span className="text-sm font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.count}</span></div>
              <div className="w-full rounded-full h-2.5" style={{ backgroundColor: 'rgb(var(--color-hover))' }}><div className="h-2.5 rounded-full transition-all duration-500" style={{ backgroundColor: priorityColors[idx], width: `${(item.count / maxPriorityCount) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AgendaStatistics: React.FC<{ events: CalendarEvent[], colorSettings: Record<string, string> }> = ({ events, colorSettings }) => {
  const timeByColor = Object.keys(colorSettings).map(color => {
    const colorEvents = events.filter(e => e.color === color);
    const totalMinutes = colorEvents.reduce((sum, event) => sum + (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000, 0);
    return { color, name: colorSettings[color], minutes: totalMinutes, count: colorEvents.length };
  }).filter(item => item.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const totalMinutesAll = timeByColor.reduce((sum, item) => sum + item.minutes, 0);
  const maxMinutes = Math.max(...timeByColor.map(c => c.minutes), 1);
  const sortedEvents = [...events].map(event => ({ ...event, duration: (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000 })).sort((a, b) => b.duration - a.duration);
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours === 0 ? `${mins}min` : `${hours}h${mins < 10 ? '0' : ''}${mins}`;
  };
  const getColorValue = (colorKey: string) => ({ red: '#EF4444', blue: '#3B82F6', green: '#10B981', purple: '#8B5CF6', orange: '#F97316', okr: '#6366F1' }[colorKey] || '#64748B');
  let currentCumulative = 0;
  const getCoords = (pct: number) => [Math.cos((pct - 0.25) * 2 * Math.PI), Math.sin((pct - 0.25) * 2 * Math.PI)];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}><BarChart3 size={20} className="text-violet-500" />Répartition par catégorie</h3>
          <div className="flex flex-wrap items-center justify-center gap-10 lg:gap-16">
            <div className="relative w-56 h-56 shrink-0">
              <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full">
                {timeByColor.length > 0 ? timeByColor.map((item, idx) => {
                  const pct = item.minutes / totalMinutesAll;
                  const [sx, sy] = getCoords(currentCumulative);
                  currentCumulative += pct;
                  const [ex, ey] = getCoords(currentCumulative);
                  return <path key={idx} d={`M ${sx} ${sy} A 1 1 0 ${pct > 0.5 ? 1 : 0} 1 ${ex} ${ey} L 0 0`} fill={getColorValue(item.color)} stroke="#FFFFFF" strokeWidth="0.04" />;
                }) : <circle cx="0" cy="0" r="1" fill="rgb(var(--color-hover))" />}
                <circle cx="0" cy="0" r="0.75" fill="rgb(var(--color-surface))" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Total</span><span className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTime(totalMinutesAll)}</span></div>
            </div>
            <div className="flex-1 min-w-[280px] space-y-4">
              {timeByColor.map(item => (
                <div key={item.color} className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm"><div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorValue(item.color) }} /><span className="font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>{item.name}</span></div><div className="flex items-center gap-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{formatTime(item.minutes)}</span><span className="font-black text-violet-500">{Math.round((item.minutes / totalMinutesAll) * 100)}%</span></div></div>
                  <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden"><div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ backgroundColor: getColorValue(item.color), width: `${(item.minutes / maxMinutes) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}><Clock size={20} className="text-emerald-500" />Événements par temps de travail</h3>
          <div className="space-y-3">
            {sortedEvents.length > 0 ? sortedEvents.map(event => (
              <div key={event.id} className="flex items-center justify-between p-3 rounded-xl border transition-all hover:bg-muted/30" style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>
                <div className="flex items-center gap-3 overflow-hidden"><div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${getColorValue(event.color)}20` }}><div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorValue(event.color) }} /></div><div className="overflow-hidden"><p className="font-semibold text-sm truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>{event.title}</p><p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'rgb(var(--color-text-muted))' }}>{colorSettings[event.color]} · {new Date(event.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p></div></div>
                <div className="text-right shrink-0 ml-4"><p className="font-black text-sm" style={{ color: getColorValue(event.color) }}>{formatTime(event.duration)}</p></div>
              </div>
            )) : <div className="py-8 text-center text-muted-foreground">Aucun événement</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const OKRStatistics: React.FC<{ objectives: OKR[], rollingRange: { start: Date, end: Date } }> = ({ objectives, rollingRange }) => {
  const okrWorkTime = objectives.map(okr => {
    let workedTime = 0;
    okr.keyResults.forEach((kr: KeyResult) => {
      const history = (kr as KeyResult & { history?: KeyResultHistory[] }).history || [];
      const totalIncrements = history.reduce((sum: number, h: KeyResultHistory) => {
        const hDate = parseLocalDate(h.date);
        const hDateNormalized = new Date(hDate.getFullYear(), hDate.getMonth(), hDate.getDate());
        
        const isInRange = hDateNormalized >= rollingRange.start && hDateNormalized <= rollingRange.end;
        return isInRange ? sum + h.increment : sum;
      }, 0);
      workedTime += totalIncrements * kr.estimatedTime;
    });
    return { id: okr.id, title: okr.title, workedTime };
  }).filter(okr => okr.workedTime > 0);

  const totalWorkedTime = okrWorkTime.reduce((sum, obj) => sum + obj.workedTime, 0);
  const formatTime = (m: number) => {
    const hours = Math.floor(m / 60); const mins = Math.round(m % 60);
    return hours === 0 ? `${mins}min` : `${hours}h${mins < 10 ? '0' : ''}${mins}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5 border-l-4 border-l-blue-500"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Objectifs</p><p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{objectives.length}</p></div>
        <div className="card p-5 border-l-4 border-l-emerald-500"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Objectifs travaillés</p><p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{okrWorkTime.length}</p></div>
        <div className="card p-5 border-l-4 border-l-violet-500"><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Temps total réel</p><p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>{formatTime(totalWorkedTime)}</p></div>
      </div>
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}><Target size={20} className="text-violet-500" />Répartition de l'effort par OKR</h3>
        <div className="space-y-6">
          {okrWorkTime.length > 0 ? okrWorkTime.sort((a, b) => b.workedTime - a.workedTime).map(okr => (
            <div key={okr.id} className="space-y-2">
              <div className="flex justify-between items-center"><span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{okr.title}</span><div className="flex items-center gap-3"><span className="text-sm font-bold text-violet-500">{formatTime(okr.workedTime)}</span><span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">{Math.round((okr.workedTime / totalWorkedTime) * 100)}%</span></div></div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-violet-500 transition-all duration-1000" style={{ width: `${(okr.workedTime / Math.max(...okrWorkTime.map(o => o.workedTime))) * 100}%` }} /></div>
            </div>
          )) : <div className="py-8 text-center text-muted-foreground">Aucun effort enregistré.</div>}
        </div>
      </div>
    </div>
  );
};

const HabitsStatistics: React.FC<{ habits: Habit[], rollingRange: { start: Date, end: Date }, selectedPeriod: string, now: Date }> = ({ habits, rollingRange, selectedPeriod, now }) => {
  const habitsStats = habits.map(habit => {
      let completionsCount = 0;
      let relevantDaysCount = 0;
      
      const createdDate = habit.createdAt ? new Date(habit.createdAt) : new Date(0);
      createdDate.setHours(0, 0, 0, 0);

      // Count completions in the defined range
      Object.keys(habit.completions).forEach(date => {
        if (!habit.completions[date]) return;
        const hDate = parseLocalDate(date);
        hDate.setHours(0, 0, 0, 0);
        if (hDate >= rollingRange.start && hDate <= rollingRange.end) {
          completionsCount++;
        }
      });

      // Calculate relevant days (days in this range that are after creation AND NOT IN FUTURE)
      const effectiveEnd = new Date(rollingRange.end > now ? now : rollingRange.end);
      effectiveEnd.setHours(23, 59, 59, 999);
      const effectiveStart = new Date(createdDate > rollingRange.start ? createdDate : rollingRange.start);
      effectiveStart.setHours(0, 0, 0, 0);

      if (effectiveStart <= effectiveEnd) {
        const diffTime = effectiveEnd.getTime() - effectiveStart.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        relevantDaysCount = diffDays;
      }

      return { ...habit, periodCompletions: completionsCount, periodTime: completionsCount * habit.estimatedTime, relevantDaysCount };
    });

  const totalCompletions = habitsStats.reduce((sum, h) => sum + h.periodCompletions, 0);
  const totalEstimatedTime = habitsStats.reduce((sum, h) => sum + h.periodTime, 0);
  const totalRelevantDays = habitsStats.reduce((sum, h) => sum + h.relevantDaysCount, 0);
  
  const formatTime = (m: number) => {
    const hours = Math.floor(m / 60); const mins = Math.round(m % 60);
    return hours === 0 ? `${mins}min` : `${hours}h${mins < 10 ? '0' : ''}${mins}`;
  };
  
  const avgRate = totalRelevantDays > 0 ? Math.round((totalCompletions / totalRelevantDays) * 100) : 0;
  
  // ═══════════════════════════════════════════════════════════════════
  // PERFORMANCE: Mémorisation des filtres pour éviter re-calculs
  // ═══════════════════════════════════════════════════════════════════
  const activeHabitsCount = useMemo(
    () => habitsStats.filter(h => h.periodCompletions > 0).length,
    [habitsStats]
  );
  
  const relevantHabitsCount = useMemo(
    () => habitsStats.filter(h => h.relevantDaysCount > 0).length,
    [habitsStats]
  );
  
  const sortedRelevantHabits = useMemo(
    () => habitsStats
      .filter(h => h.relevantDaysCount > 0)
      .sort((a, b) => b.periodTime - a.periodTime),
    [habitsStats]
  );

  const periodSuffix = 
    selectedPeriod === 'day' ? "aujourd'hui" :
    selectedPeriod === 'week' ? "(7 derniers jours)" :
    selectedPeriod === 'month' ? "(30 derniers jours)" :
    "(365 derniers jours)";

  const detailSuffix = 
    selectedPeriod === 'day' ? "aujourd'hui" :
    selectedPeriod === 'week' ? "(7 derniers jours)" :
    selectedPeriod === 'month' ? "(30 derniers jours)" :
    "(365 derniers jours)";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5 border-l-4 border-l-blue-500">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
            Habitudes actives {periodSuffix}
          </p>
            <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {habitsStats.filter(h => h.periodCompletions > 0).length} / {habitsStats.filter(h => h.relevantDaysCount > 0).length}
            </p>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
            Taux de succès {periodSuffix}
          </p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {avgRate}%
          </p>
        </div>
        <div className="card p-5 border-l-4 border-l-violet-500">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
            Temps investi {periodSuffix}
          </p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {formatTime(totalEstimatedTime)}
          </p>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
          <Repeat size={20} className="text-emerald-500" />
          Détail par habitude {detailSuffix}
        </h3>
        <div className="space-y-6">
          {habitsStats.filter(h => h.relevantDaysCount > 0).length > 0 ? habitsStats.filter(h => h.relevantDaysCount > 0).sort((a, b) => b.periodTime - a.periodTime).map(habit => {
            const rate = habit.relevantDaysCount > 0 ? Math.min(100, Math.round((habit.periodCompletions / habit.relevantDaysCount) * 100)) : 0;
              return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5 border-l-4 border-l-blue-500">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
            Habitudes actives {periodSuffix}
          </p>
            <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {activeHabitsCount} / {relevantHabitsCount}
            </p>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
            Taux de succès {periodSuffix}
          </p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {avgRate}%
          </p>
        </div>
        <div className="card p-5 border-l-4 border-l-violet-500">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
            Temps investi {periodSuffix}
          </p>
          <p className="text-2xl font-black" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {formatTime(totalEstimatedTime)}
          </p>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
          <Repeat size={20} className="text-emerald-500" />
          Détail par habitude {detailSuffix}
        </h3>
        <div className="space-y-6">
          {sortedRelevantHabits.length > 0 ? sortedRelevantHabits.map(habit => (
            <HabitStatItem 
              key={habit.id} 
              habit={habit} 
              formatTime={formatTime} 
            />
          )) : <div className="py-8 text-center text-muted-foreground">Aucune habitude complétée ou active sur cette période.</div>}
        </div>
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${rate}%` }} />
                </div>
              </div>
            );
          }) : <div className="py-8 text-center text-muted-foreground">Aucune habitude complétée ou active sur cette période.</div>}
        </div>
      </div>
    </div>
  );
}

