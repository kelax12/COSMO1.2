import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useInView } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, Calendar, Target, Repeat, BarChart2,
  Crown, Settings, Search, Bell, Clock, TrendingUp, AlertCircle, Check,
  Sun, Moon, MousePointer2,
} from 'lucide-react';

/**
 * AppWindowShowcase — démo produit animée « fenêtre d'app Cosmo » pour le hero
 * de la landing. Reproduit FIDÈLEMENT le vrai shell de l'app (Layout sidebar) +
 * le Dashboard (DashboardPage + TodayTasks + ActiveOKRs + TodayHabits) : même
 * sidebar large (logo Cosmo, ThemeToggle, recherche, items icône+libellé), mêmes
 * cartes stat à mini bar chart, même liste « Tâches prioritaires » (checkbox
 * carrée rouge), même carte OKR à barre horizontale, mêmes cartes d'habitude
 * bleues.
 *
 * Piloté par TOKENS de thème (valeurs exactes d'index.css :root clair & sombre)
 * → le mockup bascule clair↔sombre en boucle, exactement comme le ThemeToggle
 * réel. Un faux curseur rejoue les vraies interactions (cocher une tâche, valider
 * une habitude, faire progresser un OKR, basculer le thème) et les cartes stat
 * réagissent en direct.
 *
 * Perf : transform/opacity/height/color uniquement, boucle gated par useInView.
 * Motion informationnel → joué même sous prefers-reduced-motion. Zéro dépendance
 * nouvelle (framer-motion déjà dans vendor-animation).
 */

// Palettes = valeurs EXACTES d'index.css (:root clair / :root dark)
interface Palette {
  surface: string; bg: string; border: string; borderMuted: string; hover: string;
  text: string; sub: string; muted: string; accent: string; success: string;
  navBg: string; navBorder: string; navItemText: string; navActiveBg: string; navActiveText: string;
  // Habitude complétée (TodayHabits) — diffère par thème
  habitDoneBg: string; habitDoneBorder: string; habitDoneCircleBg: string; habitDoneCircleText: string;
  habitDoneTitle: string; habitDoneMeta: string;
}

const LIGHT: Palette = {
  surface: '#FFFFFF', bg: '#F8FAFC', border: '#E2E8F0', borderMuted: '#F1F5F9', hover: '#F1F5F9',
  text: '#0F172A', sub: '#475569', muted: '#94A3B8', accent: '#2563EB', success: '#22C55E',
  navBg: '#FFFFFF', navBorder: '#E2E8F0', navItemText: '#64748B', navActiveBg: '#E2E8F0', navActiveText: '#0F172A',
  habitDoneBg: '#2563EB', habitDoneBorder: '#60A5FA', habitDoneCircleBg: '#FFFFFF', habitDoneCircleText: '#2563EB',
  habitDoneTitle: '#FFFFFF', habitDoneMeta: '#DBEAFE',
};

const DARK: Palette = {
  surface: '#1E293B', bg: '#0F172A', border: '#334155', borderMuted: '#334155', hover: '#273347',
  text: '#F8FAFC', sub: '#CBD5E1', muted: '#94A3B8', accent: '#3B82F6', success: '#34D399',
  navBg: '#1E293B', navBorder: '#334155', navItemText: '#94A3B8', navActiveBg: '#475569', navActiveText: '#FFFFFF',
  habitDoneBg: '#1E3A8A', habitDoneBorder: '#1D4ED8', habitDoneCircleBg: '#3B82F6', habitDoneCircleText: '#FFFFFF',
  habitDoneTitle: '#93C5FD', habitDoneMeta: '#BFDBFE',
};

// Couleurs des 4 cartes stat = DashboardPage.statCards (identiques quel que soit le thème)
const STAT = { tasks: '#3B82F6', agenda: '#EF4444', kr: '#22C55E', habits: '#EAB308' };
const ERROR = '#EF4444'; // checkbox cochée (TodayTasks → color-error)

// Items de nav réels (Layout.tsx)
const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: CheckSquare, label: 'To do list' },
  { icon: Calendar, label: 'Agenda' },
  { icon: Target, label: 'OKR' },
  { icon: Repeat, label: 'Habitudes' },
  { icon: BarChart2, label: 'Statistiques' },
];

const PRIORITY_TASKS = [
  { name: 'Finaliser le rapport Q2', cat: '#EF4444', prio: 5, time: 45, date: '01/06/2026' },
  { name: 'Réviser la proposition', cat: '#F59E0B', prio: 4, time: 30, date: '01/06/2026' },
  { name: 'Lecture : Atomic Habits', cat: '#3B82F6', prio: 2, time: 20, date: '02/06/2026' },
];

// Transition douce des couleurs lors du basculement de thème (style ThemeToggle réel).
const THEME_TX = 'background-color .45s ease, border-color .45s ease, color .45s ease';

interface AppWindowShowcaseProps {
  /** Variante condensée (mobile) : masque la sidebar + la carte OKR, réduit le padding. */
  compact?: boolean;
}

/** Compteur animé (count-up) pour les valeurs de stat. */
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.8, ease: 'easeOut', onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return <>{display}</>;
};

/** Mini bar chart fidèle à DashboardPage.MiniBarChart (7 barres rounded-t, dernière = aujourd'hui). */
const MiniBars: React.FC<{ heights: number[]; color: string }> = ({ heights, color }) => (
  <div className="flex items-end gap-[3px] h-10 w-full pt-1">
    {heights.map((h, i) => (
      <motion.div
        key={i}
        className="flex-1 rounded-t-[3px]"
        style={{ backgroundColor: color }}
        initial={false}
        animate={{ height: `${Math.max(h, 8)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    ))}
  </div>
);

const StatCard: React.FC<{
  T: Palette; label: string; value: number; color: string; heights: number[]; active: boolean;
}> = ({ T, label, value, color, heights, active }) => (
  <motion.div
    className="rounded-2xl border p-2.5 sm:p-3 flex flex-col"
    style={{ backgroundColor: T.surface, borderColor: active ? color : T.border, transition: THEME_TX }}
    animate={active ? { scale: [1, 1.035, 1] } : { scale: 1 }}
    transition={{ duration: 0.5 }}
  >
    <p className="text-[10px] sm:text-[11px] font-bold truncate" style={{ color: active ? color : T.sub, transition: THEME_TX }}>{label}</p>
    <p className="text-xl sm:text-2xl font-black leading-tight mb-1" style={{ color: T.text, transition: THEME_TX }}>
      <AnimatedNumber value={value} />
    </p>
    <MiniBars heights={heights} color={color} />
  </motion.div>
);

interface DemoState {
  taskChecked: boolean;
  habitDone: boolean;
  okrProgress: number;
  streak: number;
  theme: 'light' | 'dark';
  hintIcon: number | null;
  caption: string | null;
  resetting: boolean;
}

const INITIAL: DemoState = {
  taskChecked: false, habitDone: false, okrProgress: 60, streak: 12,
  theme: 'light', hintIcon: null, caption: null, resetting: false,
};

const AppWindowShowcaseBase: React.FC<AppWindowShowcaseProps> = ({ compact = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.3 });

  const targets = useRef<Record<string, HTMLElement | null>>({});
  const setTarget = (key: string) => (el: HTMLElement | null) => { targets.current[key] = el; };

  const [s, setS] = useState<DemoState>(INITIAL);
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false, pressed: false, duration: 0.6 });
  const [clickTick, setClickTick] = useState(0);

  // Motion INFORMATIONNEL → joué même sous prefers-reduced-motion (faible
  // amplitude, confiné au mockup). Seule condition : être visible.
  const animating = inView;

  useEffect(() => {
    if (!animating) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

    const posIn = (key: string, fx = 0.5, fy = 0.5) => {
      const c = containerRef.current;
      const el = targets.current[key];
      if (!c || !el) return null;
      const cr = c.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: r.left - cr.left + r.width * fx, y: r.top - cr.top + r.height * fy };
    };
    const moveTo = (key: string, fx = 0.5, fy = 0.5, duration = 0.65) => {
      const p = posIn(key, fx, fy);
      if (p) setCursor((c) => ({ ...c, x: p.x, y: p.y, visible: true, duration }));
    };
    const click = () => {
      setCursor((c) => ({ ...c, pressed: true }));
      setClickTick((t) => t + 1);
      setTimeout(() => setCursor((c) => ({ ...c, pressed: false })), 240);
    };
    const patch = (p: Partial<DemoState>) => setS((d) => ({ ...d, ...p }));

    const run = async () => {
      moveTo('window', 0.5, 0.65, 0);
      await sleep(800);

      while (!cancelled) {
        // ── Scène 1 : cocher une tâche → carte « Tâches complétées » ──
        patch({ hintIcon: 1, caption: 'Cochez une tâche — votre tableau de bord se met à jour.' });
        moveTo('check0', 0.5, 0.5, 0.7);
        await sleep(900); if (cancelled) return;
        click();
        await sleep(160);
        patch({ taskChecked: true });
        await sleep(1900); if (cancelled) return;

        // ── Scène 2 : valider une habitude → carte « Habitudes » + streak ──
        patch({ hintIcon: 4, caption: 'Validez une habitude, gardez la flamme.' });
        moveTo('habit0', 0.5, 0.5, 0.7);
        await sleep(900); if (cancelled) return;
        click();
        await sleep(160);
        patch({ habitDone: true, streak: 13 });
        await sleep(1900); if (cancelled) return;

        // ── Scène 3 : faire progresser un OKR → carte « KR réalisés » ──
        if (!compact) {
          patch({ hintIcon: 3, caption: 'Chaque résultat clé fait avancer vos OKR.' });
          moveTo('okrCard', 0.5, 0.5, 0.7);
          await sleep(900); if (cancelled) return;
          click();
          await sleep(160);
          animate(60, 80, {
            duration: 1, ease: 'easeOut',
            onUpdate: (v) => setS((d) => ({ ...d, okrProgress: Math.round(v) })),
          });
          await sleep(2000); if (cancelled) return;
        }

        // ── Scène 4 : basculer le thème (ThemeToggle réel) ──
        patch({ hintIcon: null, caption: 'Mode clair ou sombre, comme vous voulez.' });
        moveTo('themeToggle', 0.5, 0.5, 0.7);
        await sleep(900); if (cancelled) return;
        click();
        await sleep(120);
        patch({ theme: 'dark' });
        await sleep(2100); if (cancelled) return;

        // ── Outro : fondu doux puis reset (thème repart clair pour reboucler) ──
        patch({ caption: null, hintIcon: null });
        moveTo('window', 0.5, 0.65, 0.8);
        await sleep(900); if (cancelled) return;
        patch({ resetting: true });
        await sleep(420); if (cancelled) return;
        setS({ ...INITIAL, resetting: true });
        await sleep(60); if (cancelled) return;
        patch({ resetting: false });
        await sleep(800);
      }
    };

    run();
    return () => {
      cancelled = true;
      setCursor((c) => ({ ...c, visible: false, pressed: false }));
      setS(INITIAL);
    };
  }, [animating, compact]);

  const T = s.theme === 'dark' ? DARK : LIGHT;

  // Valeurs réactives des cartes stat
  const okrDone = s.okrProgress >= 80;
  const statValues = { tasks: s.taskChecked ? 3 : 2, agenda: 4, kr: okrDone ? 2 : 1, habits: s.habitDone ? 4 : 3 };
  const heights = {
    tasks: [45, 65, 35, 80, 55, 60, s.taskChecked ? 96 : 58],
    agenda: [55, 35, 70, 45, 60, 40, 52],
    kr: [25, 45, 15, 35, 55, 30, okrDone ? 82 : 28],
    habits: [60, 40, 80, 50, 90, 55, s.habitDone ? 100 : 62],
  };

  return (
    <div className="w-full select-none" aria-hidden="true" ref={containerRef}>
      <div
        ref={setTarget('window')}
        className="relative rounded-2xl overflow-hidden border shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
        style={{ backgroundColor: T.bg, borderColor: 'rgba(255,255,255,0.12)', transition: THEME_TX }}
      >
        {/* Chrome bar */}
        <div className="flex items-center gap-2 px-4 h-10 border-b" style={{ backgroundColor: T.navBg, borderColor: T.navBorder, transition: THEME_TX }}>
          <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          <div className="ml-3 flex-1 max-w-[260px] h-6 rounded-md flex items-center gap-2 px-2.5 border" style={{ backgroundColor: T.bg, borderColor: T.border, transition: THEME_TX }}>
            <Search size={11} style={{ color: T.muted }} />
            <span className="text-[11px] font-medium tracking-tight" style={{ color: T.sub, transition: THEME_TX }}>cosmo.app/dashboard</span>
          </div>
        </div>

        {/* App shell */}
        <motion.div
          className="flex"
          style={{ backgroundColor: T.bg, transition: THEME_TX }}
          animate={{ opacity: s.resetting ? 0.25 : 1 }}
          transition={{ duration: 0.35 }}
        >
          {/* ── Sidebar réelle (Layout.tsx) ── */}
          {!compact && (
            <div className="hidden sm:flex flex-col w-44 lg:w-52 shrink-0 border-r" style={{ backgroundColor: T.navBg, borderColor: T.navBorder, transition: THEME_TX }}>
              {/* Header : logo + ThemeToggle + recherche */}
              <div className="px-4 py-4 border-b flex flex-col items-center gap-3" style={{ borderColor: T.navBorder, transition: THEME_TX }}>
                <div className="flex items-center gap-2.5 self-start">
                  <div className="shrink-0 rounded-xl overflow-hidden w-9 h-9 flex items-center justify-center" style={{ backgroundColor: T.navActiveBg, transition: THEME_TX }}>
                    <img src="/logo.png" alt="" className="w-7 h-7 object-contain" />
                  </div>
                  <span className="text-base font-bold" style={{ color: T.text, transition: THEME_TX }}>Cosmo</span>
                </div>
                <div className="flex items-center gap-2 self-stretch justify-center mt-1">
                  {/* ThemeToggle réel — cible de la scène 4 */}
                  <div
                    ref={setTarget('themeToggle')}
                    className="w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: T.surface, borderColor: T.border, color: T.sub, transition: THEME_TX }}
                  >
                    {s.theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                  </div>
                  <div className="w-8 h-8 rounded-xl border flex items-center justify-center shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border, color: T.sub, transition: THEME_TX }}>
                    <Search size={15} />
                  </div>
                </div>
              </div>

              {/* Nav items (icône + libellé) */}
              <div className="flex-1 px-2.5 py-3 space-y-1">
                {NAV.map(({ icon: Icon, label }, i) => {
                  const active = i === 0; // Dashboard toujours actif
                  const hinted = s.hintIcon === i;
                  return (
                    <motion.div
                      key={label}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                      style={{
                        backgroundColor: active ? T.navActiveBg : 'transparent',
                        color: active ? T.navActiveText : (hinted ? T.accent : T.navItemText),
                        boxShadow: active ? '0 4px 6px -1px rgba(0,0,0,0.1)' : undefined,
                        transition: THEME_TX,
                      }}
                      animate={{ scale: hinted ? [1, 1.06, 1] : 1, x: hinted ? [0, 4, 0] : 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Icon size={17} className="shrink-0" />
                      <span className="text-[12px] font-medium truncate">{label}</span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Section AUTRE */}
              <div className="px-2.5 py-3 border-t space-y-1" style={{ borderColor: T.navBorder, transition: THEME_TX }}>
                <p className="text-[9px] font-semibold uppercase tracking-wider px-3 mb-1.5" style={{ color: T.sub }}>Autre</p>
                {[{ icon: Crown, label: 'Premium' }, { icon: Settings, label: 'Paramètres' }].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ color: T.navItemText, transition: THEME_TX }}>
                    <Icon size={17} className="shrink-0" />
                    <span className="text-[12px] font-medium truncate">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Contenu Dashboard ── */}
          <div className={`flex-1 min-w-0 ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3.5">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold leading-tight bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 dark:from-blue-400 dark:via-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                  Bonjour, Axel
                </h3>
                <p className="text-[11px]" style={{ color: T.muted, transition: THEME_TX }}>Voici votre tableau de bord pour aujourd'hui</p>
              </div>
              <div className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0" style={{ backgroundColor: T.surface, borderColor: T.border, color: T.sub, transition: THEME_TX }}>
                <Bell size={14} />
              </div>
            </div>

            {/* Toggle jour / semaine / mois */}
            <div className="flex justify-end mb-3">
              <div className="flex gap-1 p-1 rounded-xl border" style={{ backgroundColor: T.surface, borderColor: T.border, transition: THEME_TX }}>
                {['Jour', 'Semaine', 'Mois'].map((m, i) => (
                  <span key={m} className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
                    style={i === 0 ? { backgroundColor: T.accent, color: '#fff' } : { color: T.sub, transition: THEME_TX }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* 4 cartes stat */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-3">
              <StatCard T={T} label="Tâches complétées" value={statValues.tasks} color={STAT.tasks} heights={heights.tasks} active={s.taskChecked} />
              <StatCard T={T} label="Agenda" value={statValues.agenda} color={STAT.agenda} heights={heights.agenda} active={false} />
              <StatCard T={T} label="KR réalisés" value={statValues.kr} color={STAT.kr} heights={heights.kr} active={okrDone} />
              <StatCard T={T} label="Habitudes" value={statValues.habits} color={STAT.habits} heights={heights.habits} active={s.habitDone} />
            </div>

            {/* Grille principale */}
            <div className={`grid gap-2.5 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
              {/* Colonne gauche : Tâches prioritaires + OKR */}
              <div className={`flex flex-col gap-2.5 ${compact ? '' : 'sm:col-span-2'}`}>
                <div className="rounded-2xl border p-3" style={{ backgroundColor: T.surface, borderColor: T.border, transition: THEME_TX }}>
                  <div className="mb-2.5">
                    <h4 className="text-sm font-bold" style={{ color: T.text, transition: THEME_TX }}>Tâches prioritaires</h4>
                    <p className="text-[11px]" style={{ color: T.sub, transition: THEME_TX }}>3 tâches • 1h35min</p>
                  </div>
                  <div className="space-y-2">
                    {PRIORITY_TASKS.map((t, i) => {
                      const done = i === 0 && s.taskChecked;
                      return (
                        <motion.div
                          key={t.name}
                          className="flex items-center gap-3 rounded-xl border p-2.5"
                          style={{ borderColor: T.border, transition: THEME_TX }}
                          animate={{ opacity: done ? 0.55 : 1 }}
                          transition={{ duration: 0.4 }}
                        >
                          {/* Checkbox carrée rouge (TodayTasks) */}
                          <motion.span
                            ref={i === 0 ? setTarget('check0') : undefined}
                            className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: done ? ERROR : T.surface,
                              borderColor: done ? ERROR : T.border,
                              transition: 'background-color .3s, border-color .3s',
                            }}
                            animate={done ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                            transition={{ duration: 0.45 }}
                          >
                            {done && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <motion.path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.1 }} />
                              </svg>
                            )}
                          </motion.span>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="relative text-[13px] font-semibold truncate" style={{ color: T.text, transition: THEME_TX }}>
                                {t.name}
                                <motion.span className="absolute left-0 top-1/2 h-px" style={{ backgroundColor: T.muted }}
                                  initial={false} animate={{ width: done ? '100%' : '0%' }} transition={{ duration: 0.4, delay: i === 0 ? 0.15 : 0 }} />
                              </span>
                              {t.prio <= 2 && <AlertCircle size={13} className="shrink-0" style={{ color: ERROR }} />}
                            </div>
                            <div className="flex items-center gap-x-3 gap-y-0.5 text-[11px] flex-wrap" style={{ color: T.sub, transition: THEME_TX }}>
                              <span className="flex items-center gap-1"><Clock size={12} /> {t.time} min</span>
                              <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.cat }} /> Priorité {t.prio}
                              </span>
                              <span className="text-[10px]">{t.date}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* OKR en cours (ActiveOKRs — barre horizontale) */}
                {!compact && (
                  <div className="rounded-2xl border p-3" style={{ backgroundColor: T.surface, borderColor: T.border, transition: THEME_TX }}>
                    <div className="mb-2.5">
                      <h4 className="text-sm font-bold" style={{ color: T.text, transition: THEME_TX }}>OKR en cours</h4>
                      <p className="text-[11px]" style={{ color: T.sub, transition: THEME_TX }}>1 objectif actif</p>
                    </div>
                    <motion.div
                      ref={setTarget('okrCard')}
                      className="rounded-xl border p-3"
                      style={{ backgroundColor: T.hover, borderColor: T.border, transition: THEME_TX }}
                      animate={okrDone ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[13px] font-semibold" style={{ color: T.text, transition: THEME_TX }}>Lancer la v2</span>
                        <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: T.success }}>
                          <TrendingUp size={15} /> {s.okrProgress}%
                        </span>
                      </div>
                      <div className="w-full rounded-full h-1.5 mb-2.5" style={{ backgroundColor: T.borderMuted, transition: THEME_TX }}>
                        <motion.div className="h-1.5 rounded-full" style={{ backgroundColor: T.success }}
                          initial={false} animate={{ width: `${s.okrProgress}%` }} transition={{ duration: 0.3 }} />
                      </div>
                      <div className="text-[11px] space-y-1" style={{ color: T.sub, transition: THEME_TX }}>
                        <span className="flex items-center gap-1.5"><Clock size={12} style={{ color: T.muted }} /> 320 / 480 min</span>
                        <p>{okrDone ? '4' : '3'} résultats clés</p>
                        <p>Échéance: 30 juin 2026</p>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>

              {/* Colonne droite : Habitudes du jour (TodayHabits — cartes bleues) */}
              <div className="rounded-2xl border p-3" style={{ backgroundColor: T.surface, borderColor: T.border, transition: THEME_TX }}>
                <div className="mb-2.5">
                  <h4 className="text-sm font-bold" style={{ color: T.text, transition: THEME_TX }}>Habitudes du jour</h4>
                  <p className="text-[11px]" style={{ color: T.sub, transition: THEME_TX }}>{s.habitDone ? '1' : '0'}/2 complétées</p>
                </div>
                <div className="space-y-2.5">
                  {[
                    { name: 'Méditation', time: 10, base: 12, target: true },
                    { name: 'Lecture', time: 20, base: 8, target: false },
                  ].map((h) => {
                    const done = h.target && s.habitDone;
                    return (
                      <motion.div
                        key={h.name}
                        ref={h.target ? setTarget('habit0') : undefined}
                        className="rounded-2xl border-2 p-3"
                        style={{
                          backgroundColor: done ? T.habitDoneBg : T.surface,
                          borderColor: done ? T.habitDoneBorder : T.border,
                          transition: THEME_TX,
                        }}
                        animate={done ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                        transition={{ duration: 0.4 }}
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            className="h-7 w-7 rounded-full border flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: done ? T.habitDoneCircleBg : T.hover,
                              borderColor: done ? T.habitDoneCircleBg : T.border,
                              color: done ? T.habitDoneCircleText : 'transparent',
                              transition: 'background-color .3s, border-color .3s',
                            }}
                            animate={done ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                            transition={{ duration: 0.4 }}
                          >
                            <Check size={15} strokeWidth={4} />
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <span className="relative text-[13px] font-bold truncate block" style={{ color: done ? T.habitDoneTitle : T.text, transition: THEME_TX }}>
                              {h.name}
                              <motion.span className="absolute left-0 top-1/2 h-px" style={{ backgroundColor: T.habitDoneTitle }}
                                initial={false} animate={{ width: done ? '100%' : '0%' }} transition={{ duration: 0.4 }} />
                            </span>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px]">
                              <span className="flex items-center gap-1" style={{ color: done ? T.habitDoneMeta : T.sub, transition: THEME_TX }}>
                                <Clock size={12} /> {h.time} min
                              </span>
                              <span className="flex items-center gap-1 font-medium text-orange-500">
                                <motion.span animate={done ? { scale: [1, 1.5, 1], rotate: [0, -12, 0] } : { scale: 1 }} transition={{ duration: 0.5 }} className="inline-flex">🔥</motion.span>
                                <AnimatePresence mode="popLayout" initial={false}>
                                  <motion.span key={h.target ? s.streak : h.base}
                                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="inline-block">
                                    {h.target ? s.streak : h.base} jours
                                  </motion.span>
                                </AnimatePresence>
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Légende pédagogique de la scène en cours */}
        <AnimatePresence>
          {s.caption && (
            <motion.div
              key={s.caption}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full border backdrop-blur-md shadow-xl whitespace-nowrap"
              style={{ backgroundColor: 'rgba(2,6,23,0.92)', borderColor: 'rgba(255,255,255,0.15)' }}
            >
              <span className="text-[11px] font-medium text-white">{s.caption}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Faux curseur + ripple de clic */}
        <motion.div
          className="absolute top-0 left-0 z-30 pointer-events-none"
          initial={false}
          animate={{ x: cursor.x, y: cursor.y, opacity: cursor.visible ? 1 : 0, scale: cursor.pressed ? 0.85 : 1 }}
          transition={{
            x: { type: 'tween', duration: cursor.duration, ease: 'easeInOut' },
            y: { type: 'tween', duration: cursor.duration, ease: 'easeInOut' },
            scale: { duration: 0.15 },
          }}
        >
          <AnimatePresence>
            {clickTick > 0 && (
              <motion.span
                key={clickTick}
                className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full border-2 border-blue-400/80"
                initial={{ scale: 0.3, opacity: 0.9 }}
                animate={{ scale: 1.7, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>
          <MousePointer2 size={20} fill="white" className="text-slate-900 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
        </motion.div>
      </div>
    </div>
  );
};

const AppWindowShowcase = React.memo(AppWindowShowcaseBase);
AppWindowShowcase.displayName = 'AppWindowShowcase';

export default AppWindowShowcase;
