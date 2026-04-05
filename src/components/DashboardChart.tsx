import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Calendar, Clock, Flame } from 'lucide-react';
import { useTasks, Task } from '@/modules/tasks';
import { useHabits, Habit } from '@/modules/habits';
import { useEvents, CalendarEvent } from '@/modules/events';
import { useOkrs, OKR } from '@/modules/okrs';
import { calculateWorkTimeForPeriod } from '../lib/workTimeCalculator';

interface WorkTimeData {
  tasks: Task[];
  events: CalendarEvent[];
  habits: Habit[];
  okrs: OKR[];
}

const calculateWorkTimeForDate = (
  date: Date,
  data: WorkTimeData
): number => {
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  const result = calculateWorkTimeForPeriod(startDate, endDate, data);
  return result.totalTime;
};

const DashboardChart: React.FC = () => {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  // Use new module for tasks (read-only)
  const { data: tasks = [] } = useTasks();
  // Use new module for events (read-only)
  const { data: events = [] } = useEvents();
  // Use new module for okrs (read-only)
  const { data: okrs = [] } = useOkrs();
  const { data: habits = [] } = useHabits();

  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      days.push({
        date: date.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase().replace('.', ''),
        time: calculateWorkTimeForDate(date, { tasks, events, habits, okrs }),
        fullDate: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      });
    }
    return days;
  }, [tasks, events, habits, okrs]);

  const maxTime = Math.max(...chartData.map(d => d.time), 1);
  const avgTime = chartData.reduce((sum, d) => sum + d.time, 0) / chartData.length;
  const totalTime = chartData.reduce((sum, d) => sum + d.time, 0);
  const todayTime = chartData[chartData.length - 1].time;

  const formatTimeShort = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const formatTimeFull = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const yScaleMax = Math.max(Math.ceil(maxTime / 120) * 120, 120);
  const yTicks = [];
  for (let i = 0; i <= yScaleMax; i += 120) {
    yTicks.push(i);
  }

  return (
    <motion.div 
      className="relative overflow-hidden rounded-3xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] p-6 lg:p-8 shadow-lg dark:shadow-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute inset-0 overflow-hidden monochrome:hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 overflow-hidden hidden monochrome:block">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-white/[0.01] rounded-full blur-3xl" />
        </div>

      <div className="relative z-10 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <motion.div 
              className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/25 monochrome:bg-white monochrome:from-white monochrome:to-white monochrome:shadow-white/10"
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
              <TrendingUp size={24} className="text-white monochrome:text-zinc-900" />
          </motion.div>
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-[rgb(var(--color-text-primary))] tracking-tight">
              Temps de travail
            </h2>
            <p className="text-[rgb(var(--color-text-secondary))] text-sm flex items-center gap-2">
              <Calendar size={14} />
              7 derniers jours
            </p>
          </div>
        </div>
        
          <motion.div 
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-[rgb(var(--color-success)/0.1)] border border-[rgb(var(--color-success)/0.2)] monochrome:bg-white/5 monochrome:border-white/10"
            whileHover={{ scale: 1.02 }}
          >
            <Flame size={16} className="text-[rgb(var(--color-success))] monochrome:text-white" />
            <span className="text-[rgb(var(--color-success))] text-sm font-medium monochrome:text-zinc-300">+12% cette semaine</span>
          </motion.div>
      </div>
  
      <div className="relative z-10 mb-6">
          <div className="flex">
                {/* Y-Axis Labels */}
                <div className="flex flex-col justify-between pr-3 w-14" style={{ height: '200px' }}>
                  {[...yTicks].reverse().map((tick) => (
                    <span key={tick} className="text-[11px] font-medium text-[rgb(var(--color-text-muted))] text-right leading-none flex items-center justify-end" style={{ height: 0 }}>
                      {formatTimeShort(tick)}
                    </span>
                  ))}
                </div>
    
              {/* Chart Area */}
              <div className="flex-1 relative" style={{ height: '200px' }}>
                {/* Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {yTicks.map((tick) => (
                    <div key={tick} className="border-b border-[rgb(var(--color-border)/0.5)] w-full" style={{ height: 0 }} />
                  ))}
                </div>
  
              {/* Bars Container */}
              <div className="absolute inset-0 flex items-end justify-around px-2">
                {chartData.map((day, index) => {
                  const chartHeight = 200;
                  const barHeight = (day.time / yScaleMax) * chartHeight;
                  const isToday = index === chartData.length - 1;
                  const isHovered = hoveredBar === index;
  
                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center justify-end relative h-full"
                      style={{ width: `${100 / chartData.length}%` }}
                      onMouseEnter={() => setHoveredBar(index)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {/* Tooltip */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            className="absolute z-20 flex flex-col items-center"
                            style={{ bottom: barHeight + 10 }}
                          >
                            <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] px-3 py-1.5 rounded-xl shadow-xl text-center">
                              <div className="text-[rgb(var(--color-text-primary))] font-bold text-xs whitespace-nowrap">
                                {formatTimeFull(day.time)}
                              </div>
                              <div className="text-[rgb(var(--color-text-secondary))] text-[10px] whitespace-nowrap">
                                {day.fullDate}
                              </div>
                            </div>
                            <div className="w-2 h-2 bg-[rgb(var(--color-surface))] border-r border-b border-[rgb(var(--color-border))] rotate-45 -mt-1 shadow-xl" />
                          </motion.div>
                        )}
                      </AnimatePresence>
  
                        {/* Bar */}
                        <motion.div
                          className={`w-8 rounded-t-lg cursor-pointer transition-all duration-200 ${
                            isToday 
                              ? 'bg-gradient-to-t from-[rgb(var(--color-accent))] to-[rgb(var(--color-accent)/0.6)] monochrome:from-white monochrome:to-white/60' 
                              : 'bg-gradient-to-t from-[rgb(var(--color-accent)/0.8)] to-[rgb(var(--color-accent)/0.4)] monochrome:from-zinc-400 monochrome:to-zinc-600'
                          }`}
                        style={{
                          opacity: hoveredBar === null || isHovered ? 1 : 0.4,
                          minHeight: 4
                        }}
                        initial={{ height: 0 }}
                        animate={{ height: barHeight }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 100, 
                          damping: 15, 
                          delay: index * 0.05 
                        }}
                      />
                    </div>
                  );
                })}
              </div>
          </div>
        </div>
  
              {/* X-Axis Labels */}
              <div className="flex mt-3">
                <div className="pr-3 w-14" />
                <div className="flex-1 flex justify-around px-2">
            {chartData.map((day, index) => {
              const isToday = index === chartData.length - 1;
              const isHovered = hoveredBar === index;
              return (
                  <div 
                    key={index} 
                    className="text-center"
                    style={{ width: `${100 / chartData.length}%` }}
                  >
                    <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors duration-200 ${
                      isToday ? 'text-[rgb(var(--color-accent))]' : isHovered ? 'text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
                    }`}>
                      {day.date}
                    </span>
                  </div>
              );
            })}
          </div>
        </div>
      </div>
  
        {/* Stats grid */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            { 
              label: "Aujourd'hui", 
              value: formatTimeFull(todayTime),
              icon: Clock,
              color: 'text-[rgb(var(--color-accent))]',
              iconBg: 'bg-[rgb(var(--color-accent)/0.1)]'
            },
            { 
              label: 'Moyenne', 
              value: formatTimeFull(Math.round(avgTime)),
              icon: TrendingUp,
              color: 'text-[rgb(var(--color-secondary))]',
              iconBg: 'bg-[rgb(var(--color-secondary)/0.1)]'
            },
            { 
              label: 'Total', 
              value: `${Math.floor(totalTime / 60)}h`,
              icon: Flame,
              color: 'text-[rgb(var(--color-warning))]',
              iconBg: 'bg-[rgb(var(--color-warning)/0.1)]'
            }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                className="flex flex-col p-5 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] transition-all duration-300 hover:shadow-md"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl ${stat.iconBg} ${stat.color}`}>
                    <stat.icon size={18} />
                  </div>
                  <span className="text-[rgb(var(--color-text-secondary))] text-xs font-semibold uppercase tracking-wide">{stat.label}</span>
                </div>
                <div className={`text-2xl lg:text-3xl font-bold text-[rgb(var(--color-text-primary))] tracking-tight`}>
                  {stat.value}
                </div>
              </motion.div>
            ))}
        </div>
    </motion.div>
  );
};

export default DashboardChart;
