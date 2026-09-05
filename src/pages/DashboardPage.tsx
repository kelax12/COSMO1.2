import React, { useMemo, useState, Suspense } from 'react';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader } from '@/components/mobile';
import { useRevealVariants } from '@/components/mobile/mobile-motion';
import { motion, useReducedMotion } from 'framer-motion';
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
const DashboardBarChart = React.lazy(() => import('@/components/DashboardBarChart'));
import TodayHabits from '@/components/TodayHabits';
import InboxMenu from '@/components/InboxMenu';
import TodayTasks from '@/components/TodayTasks';
import TodayUnified from '@/components/TodayUnified';
import TodayMoments from '@/components/TodayMoments';
import { useActiveOrganization } from '@/modules/organizations';
import CollaborativeTasks from '@/components/CollaborativeTasks';
import ActiveOKRs from '@/components/ActiveOKRs';
import MiniBarChart from '@/components/MiniBarChart';
import TextType from '@/components/TextType';
import MobileCollapsible from '@/components/MobileCollapsible';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import WeeklyCheckinModal, { useWeeklyCheckin } from '@/components/WeeklyCheckinModal';
import { formatDate, formatTime } from '@/i18n/format';
import { deadlineDayKey } from '@/lib/deadline';
import { useT } from '@/i18n/useT';
import { VIEW_MODES, type ViewMode } from '@/lib/view-mode';
// SocialRequests retiré du corps de page : les demandes d'amis ET les tâches
// partagées à accepter sont désormais regroupées dans InboxMenu (bouton boîte
// de réception en haut de page, avec pastille de notification).

// Affichage du graphique "Répartition du temps" (DashboardBarChart).
// Masqué pour l'instant — passer à true pour le réafficher.
const SHOW_REPARTITION_CHART = false;

// TextType 1×/jour (#33) : l'animation machine à écrire ne joue qu'à la
// première visite du jour — le dashboard est la page la plus visitée, chaque
// seconde avant lisibilité y est multipliée. Flag localStorage daté.
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
  const { t, tp } = useT('dashboard');
  // La vue « Aujourd'hui » unifiee (#29) n'a de sens qu'avec une DEUXIEME
  // source de taches : le titre de section lui-meme est donc conditionne, pas
  // seulement son contenu.
  const { activeOrg } = useActiveOrganization();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
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

  const displayUser = authUser || { id: 'demo', name: t('userFallback'), email: 'demo@cosmo.app' };

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

    if (viewMode === 'day') {
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
          label: dueToday.length > 0 ? t('stats.tasksToday') : t('stats.tasksCompleted'),
          color: '#3b82f6',
          value: dueToday.length > 0 ? `${doneDueToday}/${dueToday.length}` : completedToday,
          chartData: days.map(date => ({ date, value: tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) === date).length })),
        },
        {
          label: t('stats.agenda'),
          color: '#ef4444',
          value: events.filter(e => localDay(e.start) === today).length,
          chartData: days.map(date => ({ date, value: events.filter(e => localDay(e.start) === date).length })),
        },
        {
          label: t('stats.krCompleted'),
          color: '#22c55e',
          value: krCompletedInPeriod(today, today),
          chartData: krChartByDay(days),
        },
        {
          label: t('stats.habits'),
          color: '#eab308',
          value: habits.length > 0 ? `${habitsDoneToday}/${habits.length}` : 0,
          chartData: days.map(date => ({ date, value: habits.filter(h => h.completions[date]).length })),
        },
      ];
    }

    if (viewMode === 'week') {
      const weeks: { start: string; end: string; label: string }[] = [];
      for (let i = 3; i >= 0; i--) {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        weeks.push({
          start: start.toLocaleDateString('en-CA'),
          end: end.toLocaleDateString('en-CA'),
          // « S1 » en français, « W1 » en anglais : l'abréviation de « semaine »
          // n'est pas universelle, elle appartient au catalogue.
          label: t('chart.weekAbbr', { number: 4 - i }),
        });
      }
      const thisWeek = weeks[weeks.length - 1];
      return [
        {
          label: t('stats.tasksCompleted'),
          color: '#3b82f6',
          value: tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) >= thisWeek.start && localDay(t.completedAt) <= thisWeek.end).length,
          chartData: weeks.map(w => ({ date: w.label, value: tasks.filter(t => t.completed && t.completedAt && localDay(t.completedAt) >= w.start && localDay(t.completedAt) <= w.end).length })),
        },
        {
          label: t('stats.agenda'),
          color: '#ef4444',
          value: events.filter(e => { const d = localDay(e.start); return d >= thisWeek.start && d <= thisWeek.end; }).length,
          chartData: weeks.map(w => ({ date: w.label, value: events.filter(e => { const d = localDay(e.start); return d >= w.start && d <= w.end; }).length })),
        },
        {
          label: t('stats.krCompleted'),
          color: '#22c55e',
          value: krCompletedInPeriod(thisWeek.start, thisWeek.end),
          chartData: weeks.map(w => ({ date: w.label, value: krCompletedInPeriod(w.start, w.end) })),
        },
        {
          label: t('stats.habits'),
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
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: formatDate(d, { month: 'short' }) });
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
        label: t('stats.tasksCompleted'),
        color: '#3b82f6',
        value: tasksByMonth(thisMonth),
        chartData: months.map(m => ({ date: m.label, value: tasksByMonth(m) })),
      },
      {
        label: t('stats.agenda'),
        color: '#ef4444',
        value: eventsByMonth(thisMonth),
        chartData: months.map(m => ({ date: m.label, value: eventsByMonth(m) })),
      },
      {
        label: t('stats.krCompleted'),
        color: '#22c55e',
        value: krCompletedInPeriod(thisMonthStart, thisMonthEnd),
        chartData: months.map(m => { const { start, end } = monthRange(m); return { date: m.label, value: krCompletedInPeriod(start, end) }; }),
      },
      {
        label: t('stats.habits'),
        color: '#eab308',
        value: habitsByMonth(thisMonth),
        chartData: months.map(m => ({ date: m.label, value: habitsByMonth(m) })),
      },
    ];
    // `t` en dépendance : les libellés des cartes ET les noms de mois abrégés
    // (`formatDate`) sont calculés ici, donc ce mémo doit être recalculé au
    // changement de langue — sinon un tableau de bord déjà monté garderait ses
    // libellés dans l'ancienne langue.
  }, [tasks, events, habits, krCompletions, viewMode, today, t]);

  // Animation variants
  // ⚠️ Variantes derivees de `useRevealVariants` et NON ecrites en dur : sous
  // `prefers-reduced-motion`, les enfants d une cascade restent sur leur
  // variante `hidden`. Mesure ici meme le 2026-08-24 : DIX blocs du tableau de
  // bord etaient figes a `matrix(1, 0, 0, 1, 0, 20)` — 20 px trop bas, pour
  // toujours. Cf. `src/components/mobile/mobile-motion.ts`.
  const { container: containerVariants, item: itemVariants } = useRevealVariants(20);
  const reduceMotion = useReducedMotion();


  return (
    <div className="min-h-[100dvh] bg-[rgb(var(--color-background))] p-3 sm:p-6 lg:p-8 pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8 transition-colors duration-300">
      {/* ── Mobile : en-tête canonique (cf. docs/MOBILE.md) ──
          Maquette 02, « Le même écran, sans la coque » : plus de salutation.
          Elle occupait la ligne la plus haute et la plus grande de l'écran
          pour dire quelque chose que la personne sait déjà — son propre
          prénom. À la place, la date du jour, qui est le seul repère dont la
          liste a besoin.

          Le résumé contextuel juste en dessous n'est PAS passé en
          `subtitle` : il contient des liens cliquables, et un `subtitle`
          disparaît quand l'en-tête se compacte. On perdrait des points
          d'entrée au premier scroll.

          🔴 Rendu HORS du `motion.div variants={containerVariants}` : `position:
          sticky` reste collé tant que son PARENT direct reste dans le
          viewport, pas au-delà. Le bloc salutation ne fait que ~150 px — mesuré
          dans le navigateur, le header sortait par le HAUT dès 150 px de
          scroll au lieu de rester collé. Sorti à ce niveau (le `<div
          min-h-[100dvh]>`, qui fait toute la hauteur de la page), il reste
          collé sur tout le scroll, comme `TasksHeader` sur `/tasks`.
          🔴 Sorti du `space-y-4` du conteneur, PAS juste posé en premier
          enfant à l'intérieur : `space-y-*` de Tailwind marge le second
          enfant même si le premier est `md:hidden` (il ne matche pas
          `:not([hidden])`, c'est un `display:none` par media query, pas
          l'attribut `hidden`). Le laisser dedans ajoutait un espacement de
          16 px entre la date et le résumé qui n'existait pas avant — mesuré
          dans le navigateur — et un espace fantôme identique tout en haut du
          rendu desktop, où le header est invisible mais compte encore comme
          premier enfant. */}
      <MobileHeader
        title={formatDate(new Date(), {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        })}
        actions={<InboxMenu />}
      />
      <motion.div
        className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6 lg:space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Salutation (desktop) + résumé contextuel (desktop ET mobile,
            directement sous la date).
            ⚠️ Un `-mt-*` a été essayé ici pour compenser la hauteur du
            bouton de la boîte de réception (44px vs 32px de texte), mais un
            margin négatif qui fait chevaucher ce bloc sur la boîte du header
            sticky juste au-dessus est exactement le genre de construction
            qui casse le scroll tactile sur certains navigateurs mobiles
            (zone de chevauchement qui intercepte le geste). Retiré : mieux
            vaut un petit espace visible qu'un scroll cassé. */}
          <motion.div
            variants={itemVariants}
          >
            {/* ⚠️ Le titre est la DATE, pas le mot « Aujourd'hui » de la
                maquette : ce mot nomme déjà la section dépliable juste en
                dessous (`sections.today`, vue unifiée perso + équipe). Mesuré
                dans le navigateur en 375 px — deux « Aujourd'hui » à 100 px
                d'écart, l'un en h1 l'autre en h2. La date remplit la même
                fonction de repère et ne double aucun libellé. */}
            <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
                <PageHeading variant="hero" className="mb-1 sm:mb-2 lg:mb-3 hidden md:block">
                  <span>{t('greeting')}</span>
                {playTyping ? (
                  <TextType
                        text={displayUser.name}
                        typingSpeed={80}
                        pauseDuration={5000}
                        deletingSpeed={50}
                        loop={false}
                        showCursor={true}
                        cursorCharacter="|"
                        cursorClassName="text-[rgb(var(--color-accent-solid))]"
                        textClassName="text-[rgb(var(--color-accent-solid))]"
                      />
                ) : (
                  <span className="text-[rgb(var(--color-accent-solid))]">
                    {displayUser.name}
                  </span>
                )}
                </PageHeading>
              {/* Résumé contextuel cliquable (#38) + « Journée bouclée » (#39) */}
              <motion.p
                className="text-[rgb(var(--color-text-secondary))] text-label sm:text-base lg:text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {(() => {
                  // `<=` et non `===` : une tâche en retard reste à faire
                  // aujourd'hui. Avec l'égalité stricte, l'accueil affichait
                  // « aucune tâche restante aujourd'hui » directement au-dessus
                  // de trois tâches en retard listées par la section du dessous
                  // (vu en 375 px le 2026-09-05). C'est aussi la règle de
                  // périmètre déjà tranchée pour le fil unifié :
                  // « échéance ≤ aujourd'hui, ou en retard, et non terminée ».
                  const remainingTasks = tasks.filter(t => !t.completed && t.deadline && deadlineDayKey(t.deadline) <= today).length;
                  const now = new Date();
                  const nextEvent = events
                    .filter(e => new Date(e.start).toLocaleDateString('en-CA') === today && new Date(e.start) >= now)
                    .sort((a, b) => a.start.localeCompare(b.start))[0];
                  const remainingHabits = habits.filter(h => !h.completions[today]).length;

                  if (remainingTasks === 0 && !nextEvent && remainingHabits === 0 && (tasks.length > 0 || habits.length > 0)) {
                    return <span className="font-medium text-emerald-600 dark:text-emerald-400">{t('summary.allDone')}</span>;
                  }

                  const parts: React.ReactNode[] = [];
                  // `tp` et non un `${n > 1 ? 's' : ''}` : la règle codée en dur
                  // ici était la règle FRANÇAISE (0 au singulier). En anglais
                  // « 0 task » est faux — il faut « 0 tasks ». `Intl.PluralRules`
                  // donne la bonne catégorie pour chaque langue, y compris
                  // celles à plus de deux formes.
                  parts.push(
                    <Link key="tasks" to="/tasks" className="hover:underline underline-offset-2">
                      {remainingTasks === 0 ? t('summary.noTaskLeft') : tp('summary.taskLeft', remainingTasks)}
                    </Link>
                  );
                  if (nextEvent) {
                    parts.push(
                      <Link key="event" to="/agenda" className="hover:underline underline-offset-2">
                        {t('summary.nextEvent', {
                          title: nextEvent.title,
                          time: formatTime(new Date(nextEvent.start), { hour: '2-digit', minute: '2-digit' }),
                        })}
                      </Link>
                    );
                  }
                  if (remainingHabits > 0) {
                    parts.push(
                      <Link key="habits" to="/habits" className="hover:underline underline-offset-2">
                        {tp('summary.habitLeft', remainingHabits)}
                      </Link>
                    );
                  }
                  return parts.flatMap((p, i) => (i === 0 ? [p] : [<span key={`sep-${i}`}> · </span>, p]));
                })()}
              </motion.p>
            </div>
            {/* Boîte de réception : demandes d'amis + tâches partagées à accepter.
                Sur mobile elle est désormais dans `MobileHeader.actions`, alignée
                avec la date (elle occupait sinon la ligne du résumé, plus bas et
                dépareillée du reste de l'en-tête). */}
            <div className="hidden md:flex shrink-0 pt-1 items-center gap-2">
              <InboxMenu />
            </div>
            </div>
          </motion.div>

        {/* Carte check-in hebdo (#31) — invitation inline, jamais imposée */}
        {weeklyCheckin.shouldShow && !checkinOpen && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-3 p-4 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl">
              <div className="flex-1 min-w-0">
                <p className="text-label sm:text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('checkin.title')}</p>
                <p className="text-caption sm:text-xs text-[rgb(var(--color-text-muted))]">{t('checkin.subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setCheckinOpen(true)}
                className="shrink-0 min-h-touch sm:min-h-0 px-4 py-2 rounded-xl text-label sm:text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-colors"
              >
                {t('checkin.cta')}
              </button>
              <button
                type="button"
                onClick={() => weeklyCheckin.dismiss()}
                aria-label={t('checkin.dismiss')}
                className="shrink-0 min-w-touch min-h-touch sm:min-w-0 sm:min-h-0 sm:p-2 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors"
              >
                <X size={16} className="md:hidden" aria-hidden="true" />
                <span className="hidden md:inline">✕</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Toggle vue + Statistiques rapides — DESKTOP UNIQUEMENT.
            Maquette 02 : sur mobile, ces quatre tuiles et leur sélecteur de
            période occupaient tout le premier écran, au-dessus de la première
            chose à faire. Un compteur ne se fait pas ; il se consulte, et il
            se consulte depuis Statistiques. Le rendu desktop est inchangé. */}
        {/* Les quatre tuiles et leurs mini-graphiques ne sont plus RENDUS sur
            téléphone (maquette 02, puis arbitrage du 2026-09-05). `hidden`
            suffisait à les cacher, pas à les décharger : quatre sparklines et
            leurs 28 barres restaient calculées et montées dans le DOM d'un
            écran qui ne les montre jamais. Desktop strictement inchangé. */}
        {!isMobile && (
        <motion.div variants={itemVariants} className="hidden md:block">
          <div className="flex items-center justify-stretch sm:justify-end mb-3 sm:mb-4">
            <div className="flex gap-1 p-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-xl w-full sm:w-auto">
              {VIEW_MODES.map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'flex-1 sm:flex-none px-4 min-h-touch sm:min-h-0 sm:py-1.5 rounded-lg text-label sm:text-sm font-medium transition-all duration-200 outline-none',
                    viewMode === mode
                      ? 'bg-[#1f6feb] text-white shadow-sm' // bleu foncé dédié : --color-accent (#58a6ff) ne passe pas le contraste AA (2.5:1) avec du texte blanc
                      : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
                  )}
                >
                  {/* `capitalize` retiré de la classe : la casse d'un libellé
                      appartient à sa langue (l'allemand capitalise les noms,
                      l'espagnol non), elle est portée par le catalogue. */}
                  {t(`viewMode.${mode}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {statCards.map((stat, index) => (
              <motion.div
                key={index}
                className="relative overflow-hidden"
                // Meme regle que les variantes ci-dessus : sous mouvement
                // reduit, AUCUNE cle de transform — sinon les quatre cartes
                // restent figees a `y: 20` (mesure le 2026-08-24).
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={
                  reduceMotion
                    ? { duration: 0.18 }
                    : { delay: index * 0.05, type: 'spring', stiffness: 100 }
                }
              >
                <div className="p-3 sm:p-5 lg:p-6 h-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl">
                  <div className="space-y-0.5 sm:space-y-1 mb-2 sm:mb-3">
                    <p className="text-caption sm:text-sm text-[rgb(var(--color-text-secondary))] font-bold truncate">
                      {stat.label}
                    </p>
                    <motion.p
                      key={`${stat.label}-${viewMode}`}
                      className="text-title sm:text-3xl lg:text-4xl font-black text-[rgb(var(--color-text-primary))]"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring' }}
                    >
                      {stat.value}
                    </motion.p>
                  </div>
                  <MiniBarChart data={stat.chartData} color={stat.color} ariaLabel={t('stats.trendLabel', { label: stat.label })} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
        )}

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
            {/* Vue « Aujourd'hui » unifiee (#29) — perso + equipe. Reservee aux
                membres d'une organisation : sans deuxieme source, elle ferait
                doublon avec « Taches prioritaires ». */}
            {/* ── Mobile : le fil découpé en trois moments (maquette 28) ──
                Rendez-vous et tâches mélangés, et rendu pour TOUT LE MONDE :
                `TodayUnified` était réservé aux membres d'une organisation
                parce que sans deuxième source de tâches il faisait doublon
                avec « Tâches prioritaires ». Ce fil-ci porte aussi l'agenda,
                donc il dit quelque chose qu'aucune autre section ne dit, même
                sans organisation. */}
            <div className="md:hidden">
              <TodayMoments />
            </div>

            {/* ── Desktop (inchangé) ── */}
            {activeOrg && (
              <div className="hidden md:block">
                <MobileCollapsible title={t('sections.today')} defaultOpen>
                  <TodayUnified />
                </MobileCollapsible>
              </div>
            )}
            <MobileCollapsible title={t('sections.priorityTasks')} defaultOpen>
              <TodayTasks />
            </MobileCollapsible>
            {/* Graphique "Répartition du temps" masqué (conservé dans le code,
                réactivable en repassant SHOW_REPARTITION_CHART à true). */}
            {SHOW_REPARTITION_CHART && (
              <Suspense fallback={null}>
                <DashboardBarChart viewMode={viewMode} />
              </Suspense>
            )}
            <MobileCollapsible title={t('sections.collaborativeTasks')}>
              <CollaborativeTasks />
            </MobileCollapsible>
            <MobileCollapsible title={t('sections.activeOkrs')}>
              <ActiveOKRs />
            </MobileCollapsible>
          </motion.div>

          {/* Colonne droite - Habitudes du jour */}
          <motion.div
            className="lg:col-span-1 flex flex-col gap-4 sm:gap-6 lg:gap-8"
            variants={itemVariants}
          >
            <MobileCollapsible title={t('sections.todayHabits')}>
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

