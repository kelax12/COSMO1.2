import React, { useMemo, useState, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/ui/typography';
import { Search } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/auth/AuthContext';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useKRCompletions } from '@/modules/kr-completions';
import { useEvents } from '@/modules/events';
// Lazy : DashboardBarChart importe recharts (vendor-charts ~365 kB). Un import
// statique le ferait retomber dans le chunk de DashboardPage (page post-login)
// dès que SHOW_REPARTITION_CHART repasserait à true. Lazy = recharts payé
// uniquement si le graphique est réellement rendu (audit perf P-2 / TOP-9).
const DashboardBarChart = React.lazy(() => import('../components/DashboardBarChart'));
import TodayHabits from '../components/TodayHabits';
import InboxMenu from '../components/InboxMenu';
import TodayTasks from '../components/TodayTasks';
import CollaborativeTasks from '../components/CollaborativeTasks';
import ActiveOKRs from '../components/ActiveOKRs';
import TextType from '../components/TextType';
import MobileCollapsible from '../components/MobileCollapsible';
import WeeklyCheckinModal, { useWeeklyCheckin } from '../components/WeeklyCheckinModal';
// SocialRequests retiré du corps de page : les demandes d'amis ET les tâches
// partagées à accepter sont désormais regroupées dans InboxMenu (bouton boîte
// de réception en haut de page, avec pastille de notification).

type ViewMode = 'jour' | 'semaine' | 'mois';

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const formatBarDate = (raw: string): string => {
  // Only format yyyy-mm-dd strings (7 days view)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (raw === todayStr) return "Aujourd'hui";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (raw === yesterday.toLocaleDateString('en-CA')) return 'Hier';
  const [, m, d] = raw.split('-');
  return `${d} ${MONTHS_FR[parseInt(m, 10) - 1]}`;
};

const MiniBarChart: React.FC<{ data: { value: number; label?: string; date?: string }[]; color?: string; ariaLabel?: string }> = ({ data, color = '#2563EB', ariaLabel }) => {
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

  // #35 — résumé textuel : les valeurs ne sont sinon exposées qu'au hover/touch,
  // invisibles au clavier et aux lecteurs d'écran (WCAG/EAA).
  const summary = ariaLabel
    ? `${ariaLabel} : ${data.map(d => d.value).join(', ')}`
    : undefined;

  return (
    <div
      className="flex items-end gap-[3px] h-[56px] w-full pt-1 relative"
      role="img"
      aria-label={summary}>
      {data.map((d, i) => {
        const tooltipLabel = d.label ? d.label : d.date ? formatBarDate(d.date) : '';
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

// Affichage du graphique "Répartition du temps" (DashboardBarChart).
// Masqué pour l'instant — passer à true pour le réafficher.
const SHOW_REPARTITION_CHART = false;

// TextType 1×/jour (#33) : l'animation machine à écrire ne joue qu'à la
// première visite du jour — le dashboard est la page la plus visitée, chaque
// seconde avant lisibilité y est multipliée. Flag daté, pattern useDailyAdGate.
const TYPING_SEEN_KEY = 'cosmo_dashboard_typing_seen';
const shouldPlayTypingToday = (): boolean => {
  const today = new Date().toLocaleDateString('en-CA');
  try {
    if (localStorage.getItem(TYPING_SEEN_KEY) === today) return false;
    localStorage.setItem(TYPING_SEEN_KEY, today);
    return true;
  } catch {
    return true;
  }
};

const DashboardPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('jour');
  const weeklyCheckin = useWeeklyCheckin();
  const [checkinOpen, setCheckinOpen] = useState(false);
  // #31 — plus d'auto-ouverture du modal check-in : une carte inline
  // dismissible invite à le faire volontairement (l'interstitiel d'entrée est
  // l'anti-pattern rétention n°1 — le réflexe devient « fermer sans lire »).
  const [playTyping] = useState(shouldPlayTypingToday);

  const { data: tasks = [] } = useTasks();
  const { data: krCompletions = [] } = useKRCompletions();
  const { data: events = [] } = useEvents();
  const { user: authUser } = useAuth();
  const { data: habits = [] } = useHabits();

  const displayUser = authUser || { id: 'demo', name: 'Utilisateur', email: 'demo@cosmo.app' };

  // Date LOCALE ('en-CA' → YYYY-MM-DD) — les complétions d'habitudes sont
  // keyées en date locale et les timestamps ISO (completedAt, e.start) sont en
  // UTC : tout passe par toLocaleDateString pour attribuer chaque item au bon
  // jour calendaire local (l'ancien toISOString décalait d'un jour la nuit).
  const today = new Date().toLocaleDateString('en-CA');

  const statCards = useMemo(() => {
    const localDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

    // KR helpers — count completion records per period (simple & reliable)
    const krCompletedInPeriod = (start: string, end: string) =>
      krCompletions.filter(c => {
        const d = localDay(c.completedAt);
        return d >= start && d <= end;
      }).length;

    const krChartByDay = (days: string[]) =>
      days.map(date => ({
        date,
        value: krCompletions.filter(c => localDay(c.completedAt) === date).length,
      }));

    if (viewMode === 'jour') {
      const days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toLocaleDateString('en-CA'));
      }
      // #32 — format « objectif du jour » (x/N) plutôt que compteur brut :
      // quatre zéros le matin sont du renforcement négatif ; « 0/5 » crée une
      // tension de complétion (Zeigarnik) et guide la décision.
      const dueToday = tasks.filter(t => t.deadline && localDay(t.deadline) === today);
      const doneDueToday = dueToday.filter(t => t.completed).length;
      const completedToday = tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) === today).length;
      const habitsDoneToday = habits.filter(h => h.completions[today]).length;
      return [
        {
          label: dueToday.length > 0 ? 'Tâches du jour' : 'Tâches complétées',
          color: '#3b82f6',
          value: dueToday.length > 0 ? `${doneDueToday}/${dueToday.length}` : completedToday,
          chartData: days.map(date => ({ date, value: tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) === date).length })),
        },
        {
          label: 'Agenda',
          color: '#ef4444',
          value: events.filter(e => localDay(e.start) === today).length,
          chartData: days.map(date => ({ date, value: events.filter(e => localDay(e.start) === date).length })),
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
          value: habits.length > 0 ? `${habitsDoneToday}/${habits.length}` : 0,
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
          start: start.toLocaleDateString('en-CA'),
          end: end.toLocaleDateString('en-CA'),
          label: `S${4 - i}`,
        });
      }
      const thisWeek = weeks[weeks.length - 1];
      return [
        {
          label: 'Tâches complétées',
          color: '#3b82f6',
          value: tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) >= thisWeek.start && localDay(t.completedAt) <= thisWeek.end).length,
          chartData: weeks.map(w => ({ date: w.label, value: tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) >= w.start && localDay(t.completedAt) <= w.end).length })),
        },
        {
          label: 'Agenda',
          color: '#ef4444',
          value: events.filter(e => { const d = localDay(e.start); return d >= thisWeek.start && d <= thisWeek.end; }).length,
          chartData: weeks.map(w => ({ date: w.label, value: events.filter(e => { const d = localDay(e.start); return d >= w.start && d <= w.end; }).length })),
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
      // toLocaleDateString (pas toISOString) : new Date(y, m, 1) est à minuit
      // LOCAL — converti en UTC il retombait sur le dernier jour du mois
      // précédent, excluant systématiquement le dernier jour de chaque mois.
      const start = new Date(m.year, m.month, 1).toLocaleDateString('en-CA');
      const end = new Date(m.year, m.month + 1, 0).toLocaleDateString('en-CA');
      return { start, end };
    };
    const tasksByMonth = (m: { year: number; month: number }) => { const { start, end } = monthRange(m); return tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) >= start && localDay(t.completedAt) <= end).length; };
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
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants: Variants = {
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
    <div className="min-h-[100dvh] bg-[rgb(var(--color-background))] p-3 sm:p-6 lg:p-8 pb-[calc(64px+env(safe-area-inset-bottom)+24px)] md:pb-8 transition-colors duration-300">
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
            <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
                <PageHeading variant="hero" className="mb-1 sm:mb-2 lg:mb-3">
                  <span>Bonjour, </span>
                {playTyping ? (
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
                ) : (
                  <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 dark:from-blue-400 dark:via-purple-400 dark:to-blue-400 monochrome:from-white monochrome:via-zinc-300 monochrome:to-white bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                    {displayUser.name}
                  </span>
                )}
                </PageHeading>
              {/* Résumé contextuel cliquable (#38) + « Journée bouclée » (#39) */}
              <motion.p
                className="text-[rgb(var(--color-text-secondary))] text-sm sm:text-base lg:text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {(() => {
                  const remainingTasks = tasks.filter(t => !t.completed && t.deadline && new Date(t.deadline).toLocaleDateString('en-CA') === today).length;
                  const now = new Date();
                  const nextEvent = events
                    .filter(e => new Date(e.start).toLocaleDateString('en-CA') === today && new Date(e.start) >= now)
                    .sort((a, b) => a.start.localeCompare(b.start))[0];
                  const remainingHabits = habits.filter(h => !h.completions[today]).length;

                  if (remainingTasks === 0 && !nextEvent && remainingHabits === 0 && (tasks.length > 0 || habits.length > 0)) {
                    return <span className="font-medium text-emerald-600 dark:text-emerald-400">Journée bouclée 🎉 Tout est fait pour aujourd'hui.</span>;
                  }

                  const parts: React.ReactNode[] = [];
                  parts.push(
                    <Link key="tasks" to="/tasks" className="hover:underline underline-offset-2">
                      {remainingTasks === 0 ? 'aucune tâche restante' : `${remainingTasks} tâche${remainingTasks > 1 ? 's' : ''} aujourd'hui`}
                    </Link>
                  );
                  if (nextEvent) {
                    parts.push(
                      <Link key="event" to="/agenda" className="hover:underline underline-offset-2">
                        « {nextEvent.title} » à {new Date(nextEvent.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Link>
                    );
                  }
                  if (remainingHabits > 0) {
                    parts.push(
                      <Link key="habits" to="/habits" className="hover:underline underline-offset-2">
                        {remainingHabits} habitude{remainingHabits > 1 ? 's' : ''} restante{remainingHabits > 1 ? 's' : ''}
                      </Link>
                    );
                  }
                  return parts.flatMap((p, i) => (i === 0 ? [p] : [<span key={`sep-${i}`}> · </span>, p]));
                })()}
              </motion.p>
            </div>
            {/* Boîte de réception : demandes d'amis + tâches partagées à accepter */}
            <div className="shrink-0 pt-1 flex items-center gap-2">
              {/* Recherche globale (#41) — mobile uniquement (desktop : loupe sidebar) */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
                aria-label="Recherche globale"
                className="md:hidden flex items-center justify-center rounded-xl min-w-11 min-h-11 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] shadow-sm"
              >
                <Search size={18} aria-hidden="true" />
              </button>
              <InboxMenu />
            </div>
            </div>
          </motion.div>

        {/* Carte check-in hebdo (#31) — invitation inline, jamais imposée */}
        {weeklyCheckin.shouldShow && !checkinOpen && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 p-4 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl">
              <span className="text-xl" aria-hidden="true">📋</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Votre semaine vous attend</p>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">Faites le point sur vos objectifs — 2 minutes suffisent.</p>
              </div>
              <button
                type="button"
                onClick={() => setCheckinOpen(true)}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Faire le point
              </button>
              <button
                type="button"
                onClick={() => weeklyCheckin.dismiss()}
                aria-label="Ignorer le check-in cette semaine"
                className="shrink-0 p-2 rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}

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
                  <MiniBarChart data={stat.chartData} color={stat.color} ariaLabel={`${stat.label}, évolution récente`} />
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
          {/* Colonne gauche - Tâches prioritaires (gros format) + Graphiques + OKR */}
          <motion.div
            className="lg:col-span-2 flex flex-col gap-4 sm:gap-6 lg:gap-8"
            variants={itemVariants}
          >
            <MobileCollapsible title="Tâches prioritaires" defaultOpen>
              <TodayTasks />
            </MobileCollapsible>
            {/* Graphique "Répartition du temps" masqué (conservé dans le code,
                réactivable en repassant SHOW_REPARTITION_CHART à true). */}
            {SHOW_REPARTITION_CHART && (
              <Suspense fallback={null}>
                <DashboardBarChart viewMode={viewMode} />
              </Suspense>
            )}
            <MobileCollapsible title="Tâches collaboratives">
              <CollaborativeTasks />
            </MobileCollapsible>
            <MobileCollapsible title="OKR en cours">
              <ActiveOKRs />
            </MobileCollapsible>
          </motion.div>

          {/* Colonne droite - Habitudes du jour */}
          <motion.div
            className="lg:col-span-1 flex flex-col gap-4 sm:gap-6 lg:gap-8"
            variants={itemVariants}
          >
            <MobileCollapsible title="Habitudes du jour">
              <TodayHabits />
            </MobileCollapsible>
          </motion.div>
        </motion.div>

      </motion.div>

      {/* Modal check-in hebdo OKR — auto-déclenché lundi/mardi, 1×/semaine */}
      <WeeklyCheckinModal
        isOpen={checkinOpen}
        onClose={() => {
          setCheckinOpen(false);
          weeklyCheckin.dismiss();
        }}
      />
    </div>
  );
};

export default DashboardPage;

