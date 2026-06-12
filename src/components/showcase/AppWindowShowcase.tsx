import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useInView } from 'framer-motion';
import {
  LayoutDashboard, CheckCircle2, Calendar, Repeat, Target, BarChart3,
  Search, Bell, Plus, Flame, MousePointer2,
} from 'lucide-react';

/**
 * AppWindowShowcase — démo produit animée « fenêtre d'app Cosmo » pour le hero
 * de la landing. Un faux curseur rejoue en boucle les gestes réels de l'app
 * (cocher une tâche, créer une tâche, time-blocker l'agenda, faire avancer un
 * OKR, tenir un streak d'habitude) avec une légende pédagogique par scène.
 *
 * Perf : animations transform/opacity uniquement (+ height % sur un seul bloc
 * agenda), boucle gated par useInView (ne tourne que si visible), fallback
 * 100 % statique si prefers-reduced-motion. Zéro dépendance nouvelle —
 * framer-motion est déjà dans le critical path de la landing (vendor-animation).
 */

// Mêmes catégories/couleurs que les autres showcases pour la cohérence visuelle.
const TASKS = [
  { name: 'Finaliser le rapport Q2', color: '#EF4444', priority: 5, done: false },
  { name: 'Séance de sport (HIIT)', color: '#10B981', priority: 4, done: true },
  { name: 'Réviser la proposition', color: '#EF4444', priority: 4, done: false },
  { name: 'Lecture : Atomic Habits', color: '#3B82F6', priority: 2, done: false },
];

const NEW_TASK = { name: 'Préparer la réunion client', color: '#8B5CF6', priority: 3 };

const PRIORITY_BADGE: Record<number, string> = {
  5: 'bg-red-600/25 text-red-300 border-red-700/60',
  4: 'bg-orange-600/25 text-orange-300 border-orange-700/60',
  3: 'bg-yellow-700/20 text-yellow-300 border-yellow-800/60',
  2: 'bg-blue-700/20 text-blue-300 border-blue-800/60',
  1: 'bg-slate-700/40 text-slate-300 border-slate-600/60',
};

const NAV = [LayoutDashboard, CheckCircle2, Calendar, Repeat, Target, BarChart3];

// Mini-agenda : blocs d'événements en position absolue (style time-grid).
const EVENTS = [
  { label: 'Réunion équipe', color: '#8B5CF6', top: '4%', height: '26%', col: 0 },
  { label: 'Pitch deck', color: '#F97316', top: '40%', height: '34%', col: 1 },
  { label: 'Sport', color: '#10B981', top: '70%', height: '22%', col: 0 },
];

// Heatmap déterministe (pas de Math.random pour rester figé d'un rendu à l'autre).
const heatCell = (i: number) => {
  const seed = (i * 9301 + 49297) % 233280;
  const r = seed / 233280;
  if (r > 0.82) return 'rgba(16,185,129,0.95)';
  if (r > 0.62) return 'rgba(16,185,129,0.65)';
  if (r > 0.42) return 'rgba(16,185,129,0.38)';
  return 'rgba(148,163,184,0.10)';
};

const HEAT_COLS = 14;
const HEAT_ROWS = 5;
const TODAY_CELL = HEAT_COLS * HEAT_ROWS - 1;

interface AppWindowShowcaseProps {
  /** Variante condensée (mobile) : masque la sidebar et l'agenda, réduit le padding. */
  compact?: boolean;
}

/** Compteur animé (count-up) pour le % OKR. */
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return <>{display}</>;
};

const OkrRing: React.FC<{ value: number; size?: number }> = ({ value, size = 78 }) => {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#okrGrad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <defs>
        <linearGradient id="okrGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="fill-white font-bold" style={{ fontSize: 17 }}>
        <AnimatedNumber value={value} />%
      </text>
    </svg>
  );
};

/** État rejoué par la timeline de démo. */
interface DemoState {
  firstDone: boolean;
  showNewTask: boolean;
  ghostGrow: boolean;
  ghostSolid: boolean;
  okrValue: number;
  krCount: number;
  streak: number;
  todayHabit: boolean;
  activeNav: number;
  caption: string | null;
  resetting: boolean;
}

const INITIAL_DEMO: DemoState = {
  firstDone: false,
  showNewTask: false,
  ghostGrow: false,
  ghostSolid: false,
  okrValue: 68,
  krCount: 3,
  streak: 12,
  todayHabit: false,
  activeNav: 0,
  caption: null,
  resetting: false,
};

const AppWindowShowcaseBase: React.FC<AppWindowShowcaseProps> = ({ compact = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.3 });

  const targets = useRef<Record<string, HTMLElement | null>>({});
  const setTarget = (key: string) => (el: HTMLElement | null) => { targets.current[key] = el; };

  const [demo, setDemo] = useState<DemoState>(INITIAL_DEMO);
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false, pressed: false, duration: 0.6 });
  const [clickTick, setClickTick] = useState(0);

  // Démo produit = motion INFORMATIONNEL (elle explique ce que fait l'app).
  // On l'anime même sous prefers-reduced-motion : c'est une demande explicite
  // (« que l'user comprenne tout ») et les mouvements sont de faible amplitude,
  // confinés au mockup — pas de parallax vestibulaire (celui-ci reste géré et
  // gaté côté LandingPage). Seule condition : être visible à l'écran.
  const animating = inView;

  useEffect(() => {
    if (!animating) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

    /** Coordonnées d'un point (fraction fx/fy) d'une cible, relatives au container. */
    const posIn = (key: string, fx = 0.5, fy = 0.5) => {
      const c = containerRef.current;
      const el = targets.current[key];
      if (!c || !el) return null;
      const cr = c.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: r.left - cr.left + r.width * fx, y: r.top - cr.top + r.height * fy };
    };

    const moveTo = (key: string, fx = 0.5, fy = 0.5, duration = 0.6) => {
      const p = posIn(key, fx, fy);
      if (p) setCursor((c) => ({ ...c, x: p.x, y: p.y, visible: true, duration }));
    };

    const click = () => {
      setCursor((c) => ({ ...c, pressed: true }));
      setClickTick((t) => t + 1);
      setTimeout(() => setCursor((c) => ({ ...c, pressed: false })), 240);
    };

    const patch = (p: Partial<DemoState>) => setDemo((d) => ({ ...d, ...p }));

    const run = async () => {
      // Point de départ : curseur posé au centre-bas de la fenêtre.
      moveTo('window', 0.55, 0.7, 0);
      await sleep(800);

      while (!cancelled) {
        // ── Scène 1 : cocher une tâche ──
        patch({ activeNav: 1, caption: 'Cochez : la tâche est faite, le compteur suit.' });
        moveTo('check0', 0.5, 0.5, 0.7);
        await sleep(850);
        if (cancelled) return;
        click();
        await sleep(180);
        patch({ firstDone: true });
        await sleep(1700);
        if (cancelled) return;

        // ── Scène 2 : créer une tâche ──
        patch({ caption: 'Créez une tâche en 2 secondes.' });
        moveTo('newBtn', 0.5, 0.5, 0.7);
        await sleep(850);
        if (cancelled) return;
        click();
        await sleep(220);
        patch({ showNewTask: true });
        await sleep(1800);
        if (cancelled) return;

        // ── Scène 3 : time-blocking par glisser (desktop uniquement) ──
        if (!compact) {
          patch({ activeNav: 2, caption: 'Glissez sur l’agenda pour bloquer un créneau.' });
          moveTo('agendaCol0', 0.5, 0.36, 0.7);
          await sleep(850);
          if (cancelled) return;
          click();
          setCursor((c) => ({ ...c, pressed: true }));
          patch({ ghostGrow: true });
          // Le curseur suit la croissance du bloc (geste de drag réel).
          moveTo('agendaCol0', 0.5, 0.62, 1.1);
          await sleep(1150);
          if (cancelled) return;
          setCursor((c) => ({ ...c, pressed: false }));
          patch({ ghostSolid: true });
          await sleep(1500);
          if (cancelled) return;
        }

        // ── Scène 4 : OKR qui avance ──
        patch({ activeNav: 4, caption: 'Chaque résultat clé fait avancer votre objectif.' });
        moveTo('okrCard', 0.5, 0.5, 0.7);
        await sleep(850);
        if (cancelled) return;
        click();
        await sleep(200);
        patch({ okrValue: 80, krCount: 4 });
        await sleep(1900);
        if (cancelled) return;

        // ── Scène 5 : streak d'habitude ──
        patch({ activeNav: 3, caption: 'Tenez vos habitudes, gardez la flamme.' });
        moveTo('habitToday', 0.5, 0.5, 0.7);
        await sleep(850);
        if (cancelled) return;
        click();
        await sleep(200);
        patch({ todayHabit: true, streak: 13 });
        await sleep(2100);
        if (cancelled) return;

        // ── Outro : fondu doux puis reset pour reboucler ──
        patch({ caption: null, activeNav: 0 });
        moveTo('window', 0.55, 0.7, 0.8);
        await sleep(900);
        if (cancelled) return;
        patch({ resetting: true });
        await sleep(420);
        if (cancelled) return;
        setDemo({ ...INITIAL_DEMO, resetting: true });
        await sleep(60);
        if (cancelled) return;
        patch({ resetting: false });
        await sleep(900);
      }
    };

    run();
    return () => {
      cancelled = true;
      setCursor((c) => ({ ...c, visible: false, pressed: false }));
      setDemo(INITIAL_DEMO);
    };
  }, [animating, compact]);

  const state = demo;

  const tasksDone = (t: { done: boolean }, i: number) => (i === 0 ? state.firstDone || t.done : t.done);
  const remaining = TASKS.filter((t, i) => !tasksDone(t, i)).length + (state.showNewTask ? 1 : 0);

  return (
    <div className="w-full select-none" aria-hidden="true" ref={containerRef}>
      {/* ── Browser frame ── */}
      <div
        ref={setTarget('window')}
        className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-950/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-sm monochrome:bg-black monochrome:border-white/30"
      >
        {/* Chrome bar */}
        <div className="flex items-center gap-2 px-4 h-10 bg-slate-900/90 border-b border-white/10">
          <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          <div className="ml-3 flex-1 max-w-[260px] h-6 rounded-md bg-slate-800/70 border border-white/10 flex items-center gap-2 px-2.5">
            <Search size={11} className="text-slate-500" />
            <span className="text-[11px] text-slate-400 font-medium tracking-tight">cosmo.app/dashboard</span>
          </div>
        </div>

        {/* App body */}
        <motion.div
          className="flex bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950"
          animate={{ opacity: state.resetting ? 0.25 : 1 }}
          transition={{ duration: 0.35 }}
        >
          {/* Sidebar — l'icône active suit la scène en cours */}
          {!compact && (
            <div className="hidden sm:flex flex-col items-center gap-1.5 w-14 py-4 border-r border-white/10 bg-slate-950/60">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              {NAV.map((Icon, i) => (
                <motion.div
                  key={i}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    state.activeNav === i ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/30' : 'text-slate-500'
                  }`}
                  animate={{ scale: state.activeNav === i ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                >
                  <Icon size={17} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Content */}
          <div className={`flex-1 min-w-0 ${compact ? 'p-3.5' : 'p-4 sm:p-5'}`}>
            {/* Top bar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Mardi 1 juin</p>
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">Bonjour, Axel</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-800/70 border border-white/10 flex items-center justify-center text-slate-400">
                  <Bell size={14} />
                </div>
                <motion.div
                  ref={setTarget('newBtn')}
                  className="h-8 px-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 flex items-center gap-1.5 text-white text-xs font-semibold shadow-lg shadow-blue-500/25"
                  animate={{ scale: cursor.pressed ? 0.96 : 1 }}
                >
                  <Plus size={13} /> Nouvelle
                </motion.div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {/* Tâches du jour */}
              <div className="sm:col-span-3 rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-white">Tâches du jour</span>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={remaining}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="text-[10px] text-slate-500 font-medium"
                    >
                      {remaining} restantes
                    </motion.span>
                  </AnimatePresence>
                </div>
                <div className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {state.showNewTask && (
                      <motion.div
                        key="new-task"
                        layout
                        initial={{ opacity: 0, y: -10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 bg-blue-500/10 ring-1 ring-blue-400/25"
                      >
                        <span className="w-4 h-4 rounded-full border-2 border-slate-600 shrink-0" />
                        <span className="w-1.5 h-4 rounded-full shrink-0" style={{ backgroundColor: NEW_TASK.color }} />
                        <span className="flex-1 text-xs font-medium truncate text-slate-200">{NEW_TASK.name}</span>
                        <span className={`text-[10px] font-bold w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${PRIORITY_BADGE[NEW_TASK.priority]}`}>
                          {NEW_TASK.priority}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {TASKS.map((t, i) => {
                    const done = tasksDone(t, i);
                    return (
                      <motion.div
                        key={t.name}
                        layout
                        className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${done ? '' : 'bg-white/[0.02]'}`}
                        animate={{ opacity: done ? 0.5 : 1 }}
                        transition={{ duration: 0.4 }}
                      >
                        <motion.span
                          ref={i === 0 ? setTarget('check0') : undefined}
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            done ? 'bg-blue-500 border-blue-500' : 'border-slate-600'
                          }`}
                          animate={i === 0 && state.firstDone ? { scale: [1, 1.45, 1] } : { scale: 1 }}
                          transition={{ duration: 0.45 }}
                        >
                          {done && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                              <motion.path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                                initial={i === 0 ? { pathLength: 0 } : false}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.35, delay: 0.1 }}
                              />
                            </svg>
                          )}
                        </motion.span>
                        <span className="w-1.5 h-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        <span className={`relative flex-1 text-xs font-medium truncate ${done ? 'text-slate-500' : 'text-slate-200'}`}>
                          {t.name}
                          {/* Barré animé (gauche → droite) au lieu d'un line-through sec */}
                          <motion.span
                            className="absolute left-0 top-1/2 h-px bg-slate-500"
                            initial={false}
                            animate={{ width: done ? '100%' : '0%' }}
                            transition={{ duration: 0.4, delay: i === 0 ? 0.15 : 0 }}
                          />
                        </span>
                        <span className={`text-[10px] font-bold w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${PRIORITY_BADGE[t.priority]}`}>
                          {t.priority}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* OKR + Streak */}
              <div className="sm:col-span-2 flex flex-col gap-3">
                <motion.div
                  ref={setTarget('okrCard')}
                  className="rounded-xl border border-white/10 bg-slate-900/60 p-3 flex items-center gap-3"
                  animate={state.krCount === 4 ? { scale: [1, 1.025, 1] } : { scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <OkrRing value={state.okrValue} />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Objectif Q2</p>
                    <p className="text-xs font-semibold text-white leading-tight mt-0.5 truncate">Lancer la v2</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={state.krCount}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="inline-block font-semibold text-slate-400"
                        >
                          {state.krCount}
                        </motion.span>
                      </AnimatePresence>
                      {' '}/ 5 résultats clés
                    </p>
                  </div>
                </motion.div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white">Habitudes</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                      <motion.span
                        animate={state.todayHabit ? { scale: [1, 1.5, 1], rotate: [0, -12, 0] } : { scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex"
                      >
                        <Flame size={11} />
                      </motion.span>
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={state.streak}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="inline-block"
                        >
                          {state.streak} j
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </div>
                  <div className="flex gap-[3px]">
                    {Array.from({ length: HEAT_COLS }).map((_, w) => (
                      <div key={w} className="flex flex-col gap-[3px]">
                        {Array.from({ length: HEAT_ROWS }).map((_, d) => {
                          const idx = w * HEAT_ROWS + d;
                          const isToday = idx === TODAY_CELL;
                          return (
                            <motion.span
                              key={d}
                              ref={isToday ? setTarget('habitToday') : undefined}
                              className={`w-2 h-2 rounded-[2px] ${isToday && state.todayHabit ? 'ring-1 ring-emerald-300' : ''}`}
                              style={{
                                backgroundColor: isToday
                                  ? state.todayHabit
                                    ? 'rgba(16,185,129,0.95)'
                                    : 'rgba(148,163,184,0.18)'
                                  : heatCell(idx),
                              }}
                              animate={isToday && state.todayHabit ? { scale: [1, 1.8, 1] } : { scale: 1 }}
                              transition={{ duration: 0.45 }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mini agenda */}
            {!compact && (
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">Agenda · time-blocking</span>
                  <span className="text-[10px] text-slate-500 font-medium">Aujourd'hui</span>
                </div>
                <div className="relative grid grid-cols-2 gap-2 h-20">
                  {[0, 1].map((col) => (
                    <div
                      key={col}
                      ref={col === 0 ? setTarget('agendaCol0') : undefined}
                      className="relative rounded-lg bg-white/[0.02] border border-white/5"
                    >
                      {EVENTS.filter((e) => e.col === col).map((e, i) => (
                        <div
                          key={i}
                          className="absolute left-1 right-1 rounded-md px-2 py-1 text-[9px] font-semibold text-white/95 overflow-hidden"
                          style={{ backgroundColor: e.color, top: e.top, height: e.height }}
                        >
                          {e.label}
                        </div>
                      ))}
                      {/* Bloc « Deep work » dessiné par le drag du curseur (scène 3) */}
                      {col === 0 && (
                        <motion.div
                          className={`absolute left-1 right-1 rounded-md px-2 py-1 text-[9px] font-semibold overflow-hidden ${
                            state.ghostSolid
                              ? 'text-white/95'
                              : 'border border-dashed border-blue-400/70 text-blue-200'
                          }`}
                          style={{
                            top: '34%',
                            backgroundColor: state.ghostSolid ? '#3B82F6' : 'rgba(59,130,246,0.15)',
                          }}
                          initial={false}
                          animate={{ height: state.ghostGrow ? '30%' : '0%', opacity: state.ghostGrow ? 1 : 0 }}
                          transition={{ height: { duration: 1.1, ease: 'easeInOut' }, opacity: { duration: 0.2 } }}
                        >
                          Deep work
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Légende pédagogique de la scène en cours ── */}
        <AnimatePresence>
          {state.caption && (
            <motion.div
              key={state.caption}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-950/90 border border-white/15 backdrop-blur-md shadow-xl whitespace-nowrap"
            >
              <span className="text-[11px] font-medium text-slate-200">{state.caption}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Faux curseur + ripple de clic ── */}
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
