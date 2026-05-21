import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Repeat, Target, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
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
import SharedTasksHistory from '../components/SharedTasksHistory';

type ViewMode = 'jour' | 'semaine' | 'mois';

const MiniBarChart: React.FC<{ data: { value: number; label?: string; date?: string }[]; color?: string }> = ({ data, color = '#2563EB' }) => {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const max = Math.max(...data.map(d => d.value), 1);

  React.useEffect(() => {
    if (hovered === null) return;
    const handler = () => setHovered(null);
    window.addEventListener('touchstart', handler, { passive: true });
    return () => window.removeEventListener('touchstart', handler);
  }, [hovered]);

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
            onTouchStart={(e) => {
              e.stopPropagation();
              setHovered(prev => prev === i ? null : i);
            }}
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
  const navigate = useNavigate();
  // Refonte v2 : par défaut sur 'semaine' (vue plus actionnable que 'jour')
  const [viewMode, setViewMode] = useState<ViewMode>('semaine');
  // Section "Plus" repliée par défaut (CollaborativeTasks, SocialRequests, etc.)
  const [moreOpen, setMoreOpen] = useState(false);

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


  // Refonte v2 — 3 zones : Today / This week / Quick actions + section "Plus" repliable
  const quickActions = [
    { label: 'Mes tâches',     icon: CheckSquare, color: '#3B82F6', path: '/tasks',    desc: 'Voir & créer des tâches' },
    { label: 'Mes habitudes',  icon: Repeat,      color: '#EAB308', path: '/habits',   desc: 'Suivre la régularité' },
    { label: 'Mes OKR',        icon: Target,      color: '#22C55E', path: '/okr',      desc: 'Définir les objectifs' },
    { label: 'Mon agenda',     icon: Calendar,    color: '#EF4444', path: '/agenda',   desc: 'Planifier la semaine' },
  ];

  return (
    <div className="min-h-[100dvh] bg-[rgb(var(--color-background))] p-3 sm:p-6 lg:p-8 pb-[calc(64px+env(safe-area-inset-bottom)+24px)] md:pb-8 transition-colors duration-300">
      <motion.div
        className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ────────────────────────────────────────────────────────
            HEADER — salutation seule, plus aérée
           ──────────────────────────────────────────────────────── */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-[rgb(var(--color-text-primary))] mb-1 sm:mb-2">
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
          <p className="text-[rgb(var(--color-text-secondary))] text-sm sm:text-base">
            Votre productivité, à l'essentiel.
          </p>
        </motion.div>

        {/* ────────────────────────────────────────────────────────
            ZONE 1 — TODAY : tâches + habitudes du jour, côte à côte
           ──────────────────────────────────────────────────────── */}
        <motion.section variants={itemVariants} aria-labelledby="zone-today">
          <h2 id="zone-today" className="text-lg sm:text-xl font-bold text-[rgb(var(--color-text-primary))] mb-3 sm:mb-4 flex items-center gap-2">
            <span className="inline-block w-1.5 h-5 bg-blue-500 rounded-full" aria-hidden />
            Aujourd'hui
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <TodayTasks />
            <TodayHabits />
          </div>
        </motion.section>

        {/* ────────────────────────────────────────────────────────
            ZONE 2 — THIS WEEK : 1 graphique unifié + stats agrégées
           ──────────────────────────────────────────────────────── */}
        <motion.section variants={itemVariants} aria-labelledby="zone-week">
          <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4 flex-wrap">
            <h2 id="zone-week" className="text-lg sm:text-xl font-bold text-[rgb(var(--color-text-primary))] flex items-center gap-2">
              <span className="inline-block w-1.5 h-5 bg-purple-500 rounded-full" aria-hidden />
              Vue d'ensemble
            </h2>
            {/* Toggle déplacé près du titre de la section qu'il contrôle */}
            <div className="flex gap-1 p-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl">
              {(['jour', 'semaine', 'mois'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium capitalize transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
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

          {/* Stats cards compactes (4 colonnes desktop, 2 mobile) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {statCards.map((stat, index) => (
              <motion.div
                key={index}
                className="relative overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <div className="p-3 sm:p-4 h-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl">
                  <p className="text-[11px] sm:text-xs text-[rgb(var(--color-text-secondary))] font-semibold truncate uppercase tracking-wide">
                    {stat.label}
                  </p>
                  <motion.p
                    key={`${stat.label}-${viewMode}`}
                    className="text-2xl sm:text-3xl font-black text-[rgb(var(--color-text-primary))] mt-0.5 mb-2"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring' }}
                  >
                    {stat.value}
                  </motion.p>
                  <MiniBarChart data={stat.chartData} color={stat.color} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Un seul graphique unifié (au lieu des 2 empilés DashboardChart + BarChart) */}
          <DashboardChart viewMode={viewMode} />
        </motion.section>

        {/* ────────────────────────────────────────────────────────
            ZONE 3 — QUICK ACTIONS : raccourcis vers les modules
           ──────────────────────────────────────────────────────── */}
        <motion.section variants={itemVariants} aria-labelledby="zone-actions">
          <h2 id="zone-actions" className="text-lg sm:text-xl font-bold text-[rgb(var(--color-text-primary))] mb-3 sm:mb-4 flex items-center gap-2">
            <span className="inline-block w-1.5 h-5 bg-emerald-500 rounded-full" aria-hidden />
            Accès rapide
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="group p-4 sm:p-5 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`${action.label} — ${action.desc}`}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 monochrome:bg-white/10"
                    style={{ backgroundColor: `${action.color}18` }}
                  >
                    <Icon size={22} style={{ color: action.color }} className="monochrome:text-white" />
                  </div>
                  <p className="font-bold text-sm sm:text-base text-[rgb(var(--color-text-primary))]">{action.label}</p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5 truncate">{action.desc}</p>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* ────────────────────────────────────────────────────────
            SECTION "PLUS" — collaborative, social, historique
            Repliée par défaut pour ne pas surcharger
           ──────────────────────────────────────────────────────── */}
        <motion.section variants={itemVariants}>
          <button
            type="button"
            onClick={() => setMoreOpen(v => !v)}
            aria-expanded={moreOpen}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="font-semibold text-sm sm:text-base text-[rgb(var(--color-text-primary))]">
              {moreOpen ? 'Masquer' : 'Afficher'} : OKR actifs, collaboration, historique
            </span>
            {moreOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {moreOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4"
            >
              <ActiveOKRs />
              <CollaborativeTasks />
              <SocialRequests />
              <SharedTasksHistory />
              <div className="lg:col-span-2">
                <DashboardBarChart viewMode={viewMode} />
              </div>
            </motion.div>
          )}
        </motion.section>

      </motion.div>
    </div>
  );
};

export default DashboardPage;

