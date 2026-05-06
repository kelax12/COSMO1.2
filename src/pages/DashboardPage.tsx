import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/auth/AuthContext';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useKRCompletions } from '@/modules/kr-completions';
import { useEvents } from '@/modules/events';
import DashboardChart from '../components/DashboardChart';
import DashboardBarChart from '../components/DashboardBarChart';
import TodayHabits from '../components/TodayHabits';
import SocialRequests from '../components/SocialRequests';
import TodayTasks from '../components/TodayTasks';
import CollaborativeTasks from '../components/CollaborativeTasks';
import ActiveOKRs from '../components/ActiveOKRs';
import TextType from '../components/TextType';
import MobileCollapsible from '../components/MobileCollapsible';

type ViewMode = 'jour' | 'semaine' | 'mois';

const MiniBarChart: React.FC<{ data: { value: number; label?: string; date?: string }[]; color?: string }> = ({ data, color = '#2563EB' }) => {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const max = Math.max(...data.map(d => d.value), 1);

  const darken = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (n >> 16) - 40);
    const g = Math.max(0, ((n >> 8) & 0xff) - 40);
    const b = Math.max(0, (n & 0xff) - 40);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  return (
    <div className="flex items-end gap-[3px] h-[56px] w-full pt-1 relative">
      {data.map((d, i) => {
        const tooltipLabel = d.label || d.date || '';
        return (
          <div
            key={i}
            className="flex-1 relative flex flex-col items-center justify-end h-full"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {hovered === i && (
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg pointer-events-none">
                {tooltipLabel ? `${tooltipLabel} : ` : ''}{d.value}
              </div>
            )}
            <div
              className={`w-full rounded-t-[3px] transition-all duration-150 monochrome:bg-white ${
                hovered === i ? 'monochrome:bg-white' : 'monochrome:bg-white/40'
              }`}
              style={{
                height: `${Math.max((d.value / max) * 100, 8)}%`,
                backgroundColor: hovered === i ? darken(color) : color,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('jour');

  const { data: tasks = [] } = useTasks();
  const { data: krCompletions = [] } = useKRCompletions();
  const { data: events = [] } = useEvents();
  const { user: authUser } = useAuth();
  const { data: habits = [] } = useHabits();

  const displayUser = authUser || { id: 'demo', name: 'Utilisateur', email: 'demo@cosmo.app' };

  const today = new Date().toISOString().split('T')[0];

  const statCards = useMemo(() => {
    // KR helpers — count completion records per period (simple & reliable)
    const krCompletedInPeriod = (start: string, end: string) =>
      krCompletions.filter(c => {
        const d = c.completedAt.split('T')[0];
        return d >= start && d <= end;
      }).length;

    const krChartByDay = (days: string[]) =>
      days.map(date => ({
        date,
        value: krCompletions.filter(c => c.completedAt.split('T')[0] === date).length,
      }));

    if (viewMode === 'jour') {
      const days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
      }
      return [
        {
          label: 'Tâches complétées',
          color: '#3b82f6',
          value: tasks.filter(t => t.completed && t.completedAt?.startsWith(today)).length,
          chartData: days.map(date => ({ date, value: tasks.filter(t => t.completed && t.completedAt?.startsWith(date)).length })),
        },
        {
          label: 'Agenda',
          color: '#ef4444',
          value: events.filter(e => new Date(e.start).toISOString().split('T')[0] === today).length,
          chartData: days.map(date => ({ date, value: events.filter(e => new Date(e.start).toISOString().split('T')[0] === date).length })),
        },
        {
          label: 'KR réalisés',
          color: '#22c55e',
          value: krCompletedInPeriod(today, today),
          chartData: krChartByDay(days),
        },
        {
          label: 'Habitudes',
          color: '#eab308',
          value: habits.filter(h => h.completions[today]).length,
          chartData: days.map(date => ({ date, value: habits.filter(h => h.completions[date]).length })),
        },
      ];
    }

    if (viewMode === 'semaine') {
      const weeks: { start: string; end: string; label: string }[] = [];
      for (let i = 3; i >= 0; i--) {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        weeks.push({
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
          label: `S${4 - i}`,
        });
      }
      const thisWeek = weeks[weeks.length - 1];
      return [
        {
          label: 'Tâches complétées',
          color: '#3b82f6',
          value: tasks.filter(t => t.completed && t.completedAt && t.completedAt.split('T')[0] >= thisWeek.start && t.completedAt.split('T')[0] <= thisWeek.end).length,
          chartData: weeks.map(w => ({ date: w.label, value: tasks.filter(t => t.completed && t.completedAt && t.completedAt.split('T')[0] >= w.start && t.completedAt.split('T')[0] <= w.end).length })),
        },
        {
          label: 'Agenda',
          color: '#ef4444',
          value: events.filter(e => { const d = new Date(e.start).toISOString().split('T')[0]; return d >= thisWeek.start && d <= thisWeek.end; }).length,
          chartData: weeks.map(w => ({ date: w.label, value: events.filter(e => { const d = new Date(e.start).toISOString().split('T')[0]; return d >= w.start && d <= w.end; }).length })),
        },
        {
          label: 'KR réalisés',
          color: '#22c55e',
          value: krCompletedInPeriod(thisWeek.start, thisWeek.end),
          chartData: weeks.map(w => ({ date: w.label, value: krCompletedInPeriod(w.start, w.end) })),
        },
        {
          label: 'Habitudes',
          color: '#eab308',
          value: habits.reduce((sum, h) => sum + Object.keys(h.completions).filter(d => d >= thisWeek.start && d <= thisWeek.end).length, 0),
          chartData: weeks.map(w => ({ date: w.label, value: habits.reduce((sum, h) => sum + Object.keys(h.completions).filter(d => d >= w.start && d <= w.end).length, 0) })),
        },
      ];
    }

    // mois
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('fr-FR', { month: 'short' }) });
    }
    const thisMonth = months[months.length - 1];
    const monthRange = (m: { year: number; month: number }) => {
      const start = new Date(m.year, m.month, 1).toISOString().split('T')[0];
      const end = new Date(m.year, m.month + 1, 0).toISOString().split('T')[0];
      return { start, end };
    };
    const tasksByMonth = (m: { year: number; month: number }) => { const { start, end } = monthRange(m); return tasks.filter(t => t.completed && t.completedAt && t.completedAt.split('T')[0] >= start && t.completedAt.split('T')[0] <= end).length; };
    const eventsByMonth = (m: { year: number; month: number }) => events.filter(e => { const d = new Date(e.start); return d.getFullYear() === m.year && d.getMonth() === m.month; }).length;
    const habitsByMonth = (m: { year: number; month: number }) => { const { start, end } = monthRange(m); return habits.reduce((sum, h) => sum + Object.keys(h.completions).filter(d => d >= start && d <= end).length, 0); };

    const { start: thisMonthStart, end: thisMonthEnd } = monthRange(thisMonth);
    return [
      {
        label: 'Tâches complétées',
        color: '#3b82f6',
        value: tasksByMonth(thisMonth),
        chartData: months.map(m => ({ date: m.label, value: tasksByMonth(m) })),
      },
      {
        label: 'Agenda',
        color: '#ef4444',
        value: eventsByMonth(thisMonth),
        chartData: months.map(m => ({ date: m.label, value: eventsByMonth(m) })),
      },
      {
        label: 'KR réalisés',
        color: '#22c55e',
        value: krCompletedInPeriod(thisMonthStart, thisMonthEnd),
        chartData: months.map(m => { const { start, end } = monthRange(m); return { date: m.label, value: krCompletedInPeriod(start, end) }; }),
      },
      {
        label: 'Habitudes',
        color: '#eab308',
        value: habitsByMonth(thisMonth),
        chartData: months.map(m => ({ date: m.label, value: habitsByMonth(m) })),
      },
    ];
  }, [tasks, events, habits, krCompletions, viewMode, today]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };


  return (
    <div className="min-h-screen bg-[rgb(var(--color-background))] p-3 sm:p-6 lg:p-8 transition-colors duration-300">
      <motion.div
        className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6 lg:space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header avec salutation */}
          <motion.div
            variants={itemVariants}
          >
            <div className="flex-1">
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[rgb(var(--color-text-primary))] mb-1 sm:mb-2 lg:mb-3">
                  <span>Bonjour, </span>
                <TextType
                        text={displayUser.name}
                        typingSpeed={80}
                        pauseDuration={5000}
                        deletingSpeed={50}
                        loop={false}
                        showCursor={true}
                        cursorCharacter="|"
                        cursorClassName="text-blue-500 monochrome:text-white"
                        textClassName="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 dark:from-blue-400 dark:via-purple-400 dark:to-blue-400 monochrome:from-white monochrome:via-zinc-300 monochrome:to-white bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient"
                      />
                </h1>
              <motion.p
                className="text-[rgb(var(--color-text-secondary))] text-sm sm:text-base lg:text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Voici votre tableau de bord pour aujourd'hui
              </motion.p>
            </div>
          </motion.div>

        {/* Toggle vue + Statistiques rapides */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-stretch sm:justify-end mb-3 sm:mb-4">
            <div className="flex gap-1 p-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl w-full sm:w-auto">
              {(['jour', 'semaine', 'mois'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all duration-200 outline-none',
                    viewMode === mode
                      ? 'bg-[rgb(var(--color-accent))] text-white shadow-sm monochrome:bg-white monochrome:text-zinc-900'
                      : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
                  )}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {statCards.map((stat, index) => (
              <motion.div
                key={index}
                className="relative overflow-hidden group cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 100 }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                <div className="p-3 sm:p-5 lg:p-6 h-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl transition-all duration-300 group-hover:shadow-xl group-hover:border-[rgb(var(--color-accent)/0.5)] monochrome:group-hover:border-white/20">
                  <div className="space-y-0.5 sm:space-y-1 mb-2 sm:mb-3">
                    <p className="text-xs sm:text-sm text-[rgb(var(--color-text-secondary))] font-bold group-hover:text-[rgb(var(--color-accent))] transition-colors monochrome:group-hover:text-white truncate">
                      {stat.label}
                    </p>
                    <motion.p
                      key={`${stat.label}-${viewMode}`}
                      className="text-2xl sm:text-3xl lg:text-4xl font-black text-[rgb(var(--color-text-primary))]"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring' }}
                    >
                      {stat.value}
                    </motion.p>
                  </div>
                  <MiniBarChart data={stat.chartData} color={stat.color} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Contenu principal en grille */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8"
          variants={containerVariants}
        >
          {/* Colonne gauche - Graphiques + Tâches + OKR */}
          <motion.div
            className="lg:col-span-2 flex flex-col gap-4 sm:gap-6 lg:gap-8"
            variants={itemVariants}
          >
            <DashboardChart viewMode={viewMode} />
            <DashboardBarChart viewMode={viewMode} />
            <MobileCollapsible title="Tâches prioritaires" defaultOpen>
              <TodayTasks />
            </MobileCollapsible>
            <MobileCollapsible title="Tâches collaboratives">
              <CollaborativeTasks />
            </MobileCollapsible>
            <MobileCollapsible title="OKR en cours">
              <ActiveOKRs />
            </MobileCollapsible>
          </motion.div>

          {/* Colonne droite - Habitudes du jour + Demandes sociales */}
          <motion.div
            className="lg:col-span-1 flex flex-col gap-4 sm:gap-6 lg:gap-8"
            variants={itemVariants}
          >
            <MobileCollapsible title="Habitudes du jour">
              <TodayHabits />
            </MobileCollapsible>
            <MobileCollapsible title="Demandes sociales">
              <SocialRequests />
            </MobileCollapsible>
          </motion.div>
        </motion.div>

      </motion.div>
    </div>
  );
};

export default DashboardPage;

