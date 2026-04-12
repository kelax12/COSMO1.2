import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { Bar, BarChart, XAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs } from '@/modules/okrs';
import { calculateWorkTimeForPeriod } from '../lib/workTimeCalculator';

type ViewMode = 'jour' | 'semaine' | 'mois';

interface DashboardBarChartProps {
  viewMode: ViewMode;
}

const chartConfig = {
  tasks:  { label: 'Tâches',    color: '#3b82f6' },
  events: { label: 'Agenda',    color: '#ef4444' },
  okrs:   { label: 'OKR',       color: '#22c55e' },
  habits: { label: 'Habitudes', color: '#eab308' },
} satisfies ChartConfig;

const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

interface ChartPoint {
  label: string;
  tasks: number;
  events: number;
  okrs: number;
  habits: number;
}

const DashboardBarChart: React.FC<DashboardBarChartProps> = ({ viewMode }) => {
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useEvents();
  const { data: okrs = [] } = useOkrs();
  const { data: habits = [] } = useHabits();

  const chartData: ChartPoint[] = useMemo(() => {
    const calcPeriod = (start: Date, end: Date) => {
      const r = calculateWorkTimeForPeriod(start, end, { tasks, events, habits, okrs });
      return { tasks: r.tasksTime, events: r.eventsTime, okrs: r.okrTime, habits: r.habitsTime };
    };

    if (viewMode === 'jour') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        return {
          label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase().replace('.', ''),
          ...calcPeriod(start, end),
        };
      });
    }

    if (viewMode === 'semaine') {
      return Array.from({ length: 4 }, (_, i) => {
        const end = new Date();
        end.setDate(end.getDate() - (3 - i) * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        return {
          label: `S${i + 1}`,
          ...calcPeriod(
            new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0),
            new Date(end.getFullYear(),   end.getMonth(),   end.getDate(),   23, 59, 59, 999),
          ),
        };
      });
    }

    // mois
    return Array.from({ length: 6 }, (_, i) => {
      const ref = new Date();
      ref.setDate(1);
      ref.setMonth(ref.getMonth() - (5 - i));
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
      const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        label: ref.toLocaleDateString('fr-FR', { month: 'short' }),
        ...calcPeriod(start, end),
      };
    });
  }, [tasks, events, habits, okrs, viewMode]);

  const periodLabel =
    viewMode === 'jour' ? '7 derniers jours' :
    viewMode === 'semaine' ? '4 dernières semaines' :
    '6 derniers mois';

  const keys = ['tasks', 'events', 'okrs', 'habits'] as const;

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] p-6 lg:p-8 shadow-lg dark:shadow-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden monochrome:hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-[rgb(var(--color-text-primary))] tracking-tight">
            Répartition du temps
          </h2>
          <p className="text-[rgb(var(--color-text-secondary))] text-sm flex items-center gap-2 mt-0.5">
            <Calendar size={14} />
            {periodLabel}
          </p>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-4">
          {keys.map(k => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: chartConfig[k].color }} />
              <span className="text-[rgb(var(--color-text-secondary))] text-xs font-medium">
                {chartConfig[k].label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative z-10">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.4} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11, fontWeight: 600 }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  className="w-[190px]"
                  formatter={(value, name, item, index) => {
                    const key = name as keyof typeof chartConfig;
                    const total =
                      (item.payload.tasks ?? 0) +
                      (item.payload.events ?? 0) +
                      (item.payload.okrs ?? 0) +
                      (item.payload.habits ?? 0);
                    return (
                      <>
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: chartConfig[key]?.color }}
                        />
                        <span className="text-[rgb(var(--color-text-secondary))] text-xs">
                          {chartConfig[key]?.label ?? name}
                        </span>
                        <div className="ml-auto font-mono font-bold text-xs text-[rgb(var(--color-text-primary))]">
                          {formatMinutes(Number(value))}
                        </div>
                        {index === keys.length - 1 && (
                          <div className="mt-1.5 flex basis-full items-center border-t border-[rgb(var(--color-border))] pt-1.5 text-xs font-semibold text-[rgb(var(--color-text-primary))]">
                            Total
                            <div className="ml-auto font-mono font-bold">
                              {formatMinutes(total)}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  }}
                />
              }
            />
            <Bar dataKey="tasks"  stackId="a" fill="var(--color-tasks)"  radius={[0, 0, 0, 0]} />
            <Bar dataKey="events" stackId="a" fill="var(--color-events)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="okrs"   stackId="a" fill="var(--color-okrs)"   radius={[0, 0, 0, 0]} />
            <Bar dataKey="habits" stackId="a" fill="var(--color-habits)" radius={[4, 4, 4, 4]} />
          </BarChart>
        </ChartContainer>
      </div>
    </motion.div>
  );
};

export default DashboardBarChart;
