import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs } from '@/modules/okrs';
import { calculateWorkTimeForPeriod } from '../lib/workTimeCalculator';

type ViewMode = 'jour' | 'semaine' | 'mois';

interface DashboardChartProps {
  viewMode: ViewMode;
}

const SERIES = [
  { key: 'tasks',  label: 'Tâches',   color: '#3b82f6' },
  { key: 'events', label: 'Agenda',   color: '#ef4444' },
  { key: 'okrs',   label: 'OKR',      color: '#22c55e' },
  { key: 'habits', label: 'Habitudes', color: '#eab308' },
] as const;

type SeriesKey = typeof SERIES[number]['key'];

interface ChartPoint {
  label: string;
  tasks: number;
  events: number;
  okrs: number;
  habits: number;
}

const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: SeriesKey; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[rgb(var(--color-text-secondary))] text-xs font-semibold mb-2 uppercase tracking-wide">{label}</p>
      {payload.map(entry => {
        const series = SERIES.find(s => s.key === entry.dataKey);
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[rgb(var(--color-text-secondary))] text-xs">{series?.label ?? entry.dataKey}</span>
            <span className="text-[rgb(var(--color-text-primary))] text-xs font-bold ml-auto pl-4">{formatMinutes(entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
};

const DashboardChart: React.FC<DashboardChartProps> = ({ viewMode }) => {
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useEvents();
  const { data: okrs = [] } = useOkrs();
  const { data: habits = [] } = useHabits();

  const chartData: ChartPoint[] = useMemo(() => {
    const calcPeriod = (start: Date, end: Date) => {
      const r = calculateWorkTimeForPeriod(start, end, { tasks, events, habits, okrs });
      return {
        tasks: r.tasksTime,
        events: r.eventsTime,
        okrs: r.okrTime,
        habits: r.habitsTime,
      };
    };

    if (viewMode === 'jour') {
      const points: ChartPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        const label = d.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase().replace('.', '');
        points.push({ label, ...calcPeriod(start, end) });
      }
      return points;
    }

    if (viewMode === 'semaine') {
      const points: ChartPoint[] = [];
      for (let i = 3; i >= 0; i--) {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
        const endD   = new Date(end.getFullYear(),   end.getMonth(),   end.getDate(),   23, 59, 59, 999);
        points.push({ label: `S${4 - i}`, ...calcPeriod(startD, endD) });
      }
      return points;
    }

    // mois
    const points: ChartPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = new Date();
      ref.setDate(1);
      ref.setMonth(ref.getMonth() - i);
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
      const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = ref.toLocaleDateString('fr-FR', { month: 'short' });
      points.push({ label, ...calcPeriod(start, end) });
    }
    return points;
  }, [tasks, events, habits, okrs, viewMode]);

  const periodLabel = viewMode === 'jour' ? '7 derniers jours' : viewMode === 'semaine' ? '4 dernières semaines' : '6 derniers mois';

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] p-6 lg:p-8 shadow-lg dark:shadow-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden monochrome:hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl" />
      </div>
      <div className="absolute inset-0 overflow-hidden hidden monochrome:block">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-white/[0.01] rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-[rgb(var(--color-text-primary))] tracking-tight">
            Temps de travail
          </h2>
          <p className="text-[rgb(var(--color-text-secondary))] text-sm flex items-center gap-2 mt-0.5">
            <Calendar size={14} />
            {periodLabel}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative z-10" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {SERIES.map(s => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="rgb(var(--color-border))"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 11, fontWeight: 600 }}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'rgb(var(--color-text-muted))', fontSize: 11 }}
              tickFormatter={formatMinutes}
              width={44}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgb(var(--color-border))', strokeWidth: 1 }} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => {
                const s = SERIES.find(s => s.key === value);
                return <span style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 12, fontWeight: 600 }}>{s?.label ?? value}</span>;
              }}
            />
            {SERIES.map(s => (
              <Area
                key={s.key}
                dataKey={s.key}
                type="monotone"
                fill={`url(#fill-${s.key})`}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default DashboardChart;
