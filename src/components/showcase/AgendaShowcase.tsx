import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Clock, Bookmark, CheckCircle2, Calendar } from 'lucide-react';

// ─── Static data ────────────────────────────────────────────────────
const CATEGORIES: Record<string, { name: string; color: string }> = {
  'c1': { name: 'Travail',   color: '#8B5CF6' },
  'c2': { name: 'Projets',   color: '#F97316' },
  'c3': { name: 'Santé',     color: '#10B981' },
  'c4': { name: 'Personnel', color: '#3B82F6' },
};

const SIDEBAR_TASKS = [
  { id: 't1', name: 'Finaliser le rapport mensuel', priority: 5, category: 'c1', estimatedTime: 60,  deadline: '25/04/2026', bookmarked: false, placed: false },
  { id: 't2', name: 'Programme stretching quotidien', priority: 2, category: 'c3', estimatedTime: 20, deadline: '27/04/2026', bookmarked: false, placed: true  },
  { id: 't3', name: 'Réviser le pitch deck',         priority: 4, category: 'c2', estimatedTime: 60, deadline: '27/04/2026', bookmarked: true,  placed: false }, // ← dragged
  { id: 't4', name: 'Tester le prototype mobile',    priority: 3, category: 'c2', estimatedTime: 45, deadline: '29/04/2026', bookmarked: false, placed: false },
];

// Priority label
const P_COLORS: Record<number, string> = {
  5: 'bg-purple-200 text-purple-900',
  4: 'bg-blue-100 text-blue-800',
  3: 'bg-yellow-100 text-yellow-800',
  2: 'bg-orange-100 text-orange-800',
  1: 'bg-red-200   text-red-900',
};

// Calendar config: Mon–Sun, 08:00–18:00 (10 hours × 54px = 540px)
const DAYS = ['LUN. 20', 'MAR. 21', 'MER. 22', 'JEU. 23', 'VEN. 24', 'SAM. 25', 'DIM. 26'];
const START_HOUR = 8;
const END_HOUR   = 18;
const SLOT_H     = 54; // px per hour
const HEADER_H   = 40; // px

// Static events [ dayIndex (0=Mon), startHour (decimal), durationH, title, color ]
type CalEvent = { day: number; start: number; dur: number; title: string; color: string; id: string };
const STATIC_EVENTS: CalEvent[] = [
  { id:'e1', day:0, start:9,    dur:0.5,  title:'Courses épicerie',       color:'#3B82F6' },
  { id:'e2', day:0, start:14,   dur:1.5,  title:'Réunion équipe',         color:'#8B5CF6' },
  { id:'e3', day:1, start:9,    dur:2,    title:'Café avec amis',         color:'#F59E0B' },
  { id:'e4', day:2, start:10.5, dur:1,    title:'Cinéma',                 color:'#EF4444' },
  { id:'e5', day:3, start:14,   dur:2,    title:'Session de code',        color:'#06B6D4' },
  { id:'e6', day:4, start:10,   dur:1,    title:'Appel client',           color:'#22C55E' },
];

const DRAG_TASK = SIDEBAR_TASKS[2]; // "Réviser le pitch deck"
const DROP_EVENT: CalEvent = { id:'drop', day:2, start:13, dur:1, title:'Réviser le pitch deck', color:'#F97316' };
const SEL_DAY = 3;    // JEU — centre horizontal
const SEL_START = 12; // 12:00 — centre vertical, tooltip visible au-dessus
const SEL_DUR = 1.5;  // 1h30

// Helpers
const hourToY = (h: number) => HEADER_H + (h - START_HOUR) * SLOT_H;
const durToH  = (d: number) => d * SLOT_H;

// ─── Component ──────────────────────────────────────────────────────
type Phase = 'idle' | 'highlight' | 'dragging' | 'dropped' | 'selecting' | 'selected';

const AgendaShowcase: React.FC = () => {
  const containerRef  = useRef<HTMLDivElement>(null);
  const sourceCardRef = useRef<HTMLDivElement>(null);  // "Réviser le pitch deck" in sidebar
  const dropSlotRef   = useRef<HTMLDivElement>(null);   // LUN 11:00 in calendar
  const selSlotRef    = useRef<HTMLDivElement>(null);   // MER 14:00 in calendar

  const [phase, setPhase] = useState<Phase>('idle');
  const [taskPlaced, setTaskPlaced] = useState(false);

  // Ghost positions (relative to container)
  const [ghostFrom, setGhostFrom] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [ghostTo,   setGhostTo]   = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [selPos,    setSelPos]     = useState({ x: 0, y: 0, w: 0, h: 0 });

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };

  const runCycle = useCallback(() => {
    const el = containerRef.current;
    const src = sourceCardRef.current;
    const drop = dropSlotRef.current;
    const sel = selSlotRef.current;
    if (!el || !src || !drop || !sel) return;

    const cr   = el.getBoundingClientRect();
    const srcR = src.getBoundingClientRect();
    const dstR = drop.getBoundingClientRect();
    const selR = sel.getBoundingClientRect();

    setGhostFrom({ x: srcR.left - cr.left, y: srcR.top - cr.top, w: srcR.width, h: srcR.height });
    setGhostTo  ({ x: dstR.left - cr.left, y: dstR.top - cr.top, w: dstR.width, h: dstR.height });
    setSelPos   ({ x: selR.left - cr.left, y: selR.top - cr.top, w: selR.width, h: SEL_DUR * SLOT_H });

    setTaskPlaced(false);
    after(400,  () => setPhase('highlight'));
    after(1000, () => setPhase('dragging'));
    after(2100, () => { setPhase('dropped'); setTaskPlaced(true); });
    after(3400, () => setPhase('selecting'));    // +1.3s after drop
    after(4400, () => setPhase('selected'));
    after(6200, () => { setPhase('idle'); setTaskPlaced(false); });
    after(7000, () => runCycle());
  }, []);

  useEffect(() => {
    const t = setTimeout(runCycle, 1200);
    return () => {
      clearTimeout(t);
      timers.current.forEach(clearTimeout);
    };
  }, [runCycle]);

  const ghostVisible  = phase === 'highlight' || phase === 'dragging';
  const dropVisible   = phase === 'dropped' || phase === 'selecting' || phase === 'selected';
  const selVisible    = phase === 'selecting' || phase === 'selected';
  const tooltipVisible = phase === 'selected';

  const ghostX = phase === 'dragging' ? ghostTo.x - ghostFrom.x : 0;
  const ghostY = phase === 'dragging' ? ghostTo.y - ghostFrom.y : 0;

  return (
    <div
      ref={containerRef}
      className="relative flex overflow-hidden rounded-2xl border border-white/10 shadow-2xl select-none"
      style={{ height: 520, backgroundColor: '#0F172A' }}
    >

      {/* ══════════ SIDEBAR ══════════ */}
      <div
        className="flex flex-col border-r border-white/10 shrink-0"
        style={{ width: 218, backgroundColor: '#0F172A' }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white">Tâches disponibles</span>
          </div>
          {/* Search */}
          <div className="relative mb-2.5">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <div className="w-full pl-9 pr-3 py-1.5 bg-slate-800/70 border border-slate-700/60 rounded-lg text-xs text-slate-500">
              Rechercher une tâche...
            </div>
          </div>
        </div>

        {/* Tasks list */}
        <div className="flex-1 overflow-y-hidden p-3 space-y-2.5">
          {SIDEBAR_TASKS.map(task => {
            const cat = CATEGORIES[task.category];
            const isAnimated = task.id === DRAG_TASK.id;
            const isPlaced = task.placed || (isAnimated && taskPlaced);

            return (
              <div
                key={task.id}
                ref={isAnimated ? sourceCardRef : undefined}
                className={`rounded-lg p-2.5 border relative transition-all ${
                  isPlaced ? 'opacity-50' : ''
                } ${isAnimated && phase === 'highlight' ? 'ring-2 ring-orange-400/70' : ''}`}
                style={{
                  backgroundColor: '#1E293B',
                  borderColor: 'rgba(255,255,255,0.08)',
                  borderLeft: `4px solid ${cat.color}`,
                }}
              >
                {/* "Placed" overlay */}
                {isPlaced && (
                  <div className="absolute inset-0 rounded-lg bg-black/20 flex items-center justify-center">
                    <div className="bg-slate-800 rounded-full p-1.5 shadow-lg">
                      <CheckCircle2 size={16} className="text-green-400" />
                    </div>
                  </div>
                )}

                {/* Task name row */}
                <div className="flex items-center justify-between mb-1.5 gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className={`text-xs font-medium text-white truncate ${isPlaced ? 'line-through' : ''}`}>
                      {task.name}
                    </span>
                    {task.bookmarked && <Bookmark size={11} className="text-yellow-400 fill-yellow-400 shrink-0" />}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${P_COLORS[task.priority]}`}>
                    P{task.priority}
                  </span>
                </div>

                {/* Meta row */}
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock size={9} />
                    <span>{task.estimatedTime} min</span>
                  </div>
                  <span
                    className="px-1.5 py-0.5 rounded border text-[10px]"
                    style={{ backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.08)', color: '#94A3B8' }}
                  >
                    {cat.name}
                  </span>
                </div>

                <div className="mt-1 text-[10px] text-slate-500">
                  Deadline: {task.deadline}
                </div>

                {isPlaced ? (
                  <div className="mt-1 text-[10px] font-semibold text-green-400">✓ Déjà planifiée</div>
                ) : (
                  <div className="mt-1 text-[10px] text-orange-400/60">
                    {isAnimated && phase === 'highlight' ? '↗ Glisser vers le calendrier' : '↗ Glisser vers le calendrier'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* ══════════ CALENDAR ══════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Calendar grid */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className="h-full overflow-y-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            <div
              className="relative"
              style={{ height: HEADER_H + (END_HOUR - START_HOUR) * SLOT_H }}
            >
              {/* ── Day headers ── */}
              <div
                className="sticky top-0 z-20 flex border-b border-white/10"
                style={{ height: HEADER_H, backgroundColor: '#0F172A' }}
              >
                {/* Time gutter */}
                <div className="shrink-0 border-r border-white/10" style={{ width: 48 }} />
                {DAYS.map((d, i) => (
                  <div
                    key={i}
                    className={`flex-1 flex items-center justify-center text-[11px] font-semibold border-r border-white/5 ${
                      i === 4 ? 'text-blue-400' : 'text-slate-400'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* ── Hour rows ── */}
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <div
                  key={i}
                  className="absolute flex w-full"
                  style={{ top: HEADER_H + i * SLOT_H, height: SLOT_H }}
                >
                  {/* Time label */}
                  <div
                    className="shrink-0 flex items-start justify-end pr-2 pt-0.5 text-[10px] text-slate-600 border-r border-white/5"
                    style={{ width: 48 }}
                  >
                    {`${String(START_HOUR + i).padStart(2,'0')}:00`}
                  </div>
                  {/* Day cells */}
                  {DAYS.map((_, di) => (
                    <div
                      key={di}
                      className="flex-1 border-r border-white/5 border-b border-white/[0.04]"
                      style={{ position: 'relative' }}
                    />
                  ))}
                </div>
              ))}

              {/* ── Current time indicator (VEN col = index 4) ── */}
              <div
                className="absolute z-10 flex items-center pointer-events-none"
                style={{
                  top: HEADER_H + (10 - START_HOUR) * SLOT_H,
                  left: 48 + (4 * 0), // will be overridden by translateX
                  width: '100%',
                  transform: `translateX(${48 + 4 * (100/7)}%)`,
                }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                <div className="flex-1 h-[1.5px] bg-red-500" />
              </div>

              {/* ── Drop zone ref (MER 13:00) ── */}
              <div
                ref={dropSlotRef}
                className="absolute pointer-events-none"
                style={{
                  left: `calc(48px + ${DROP_EVENT.day} * ((100% - 48px) / 7))`,
                  top: hourToY(DROP_EVENT.start),
                  width: `calc((100% - 48px) / 7)`,
                  height: durToH(DROP_EVENT.dur),
                }}
              />

              {/* ── Selection ref anchor (MER 14:00) ── */}
              <div
                ref={selSlotRef}
                className="absolute pointer-events-none"
                style={{
                  left: `calc(48px + 2 * ((100% - 48px) / 7))`,
                  top: hourToY(SEL_START),
                  width: `calc((100% - 48px) / 7)`,
                  height: SLOT_H,
                }}
              />

              {/* ── Static events ── */}
              {STATIC_EVENTS.map(ev => (
                <div
                  key={ev.id}
                  className="absolute z-10 rounded-md px-1.5 py-1 text-white text-[10px] font-semibold overflow-hidden"
                  style={{
                    left: `calc(48px + ${ev.day} * ((100% - 48px) / 7) + 2px)`,
                    top: hourToY(ev.start) + 1,
                    width: `calc((100% - 48px) / 7 - 4px)`,
                    height: durToH(ev.dur) - 2,
                    backgroundColor: ev.color,
                  }}
                >
                  {ev.title}
                </div>
              ))}

              {/* ── Dropped event (appears after drag) ── */}
              <AnimatePresence>
                {dropVisible && (
                  <motion.div
                    key="drop-event"
                    initial={{ opacity: 0, scaleY: 0.5 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute z-20 rounded-md px-1.5 py-1 text-white text-[10px] font-semibold overflow-hidden"
                    style={{
                      left: `calc(48px + ${DROP_EVENT.day} * ((100% - 48px) / 7) + 2px)`,
                      top: hourToY(DROP_EVENT.start) + 1,
                      width: `calc((100% - 48px) / 7 - 4px)`,
                      height: durToH(DROP_EVENT.dur) - 2,
                      backgroundColor: DROP_EVENT.color,
                      transformOrigin: 'top',
                    }}
                  >
                    {DROP_EVENT.title}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Selection rectangle (JEU 12:00–13:30) ── */}
              <AnimatePresence>
                {selVisible && (
                  <motion.div
                    key="selection"
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    transition={{ type: 'tween', duration: 1.1, ease: 'easeOut' }}
                    className="absolute z-30 rounded-md overflow-hidden"
                    style={{
                      left: `calc(48px + ${SEL_DAY} * ((100% - 48px) / 7) + 2px)`,
                      top: hourToY(SEL_START) + 1,
                      width: `calc((100% - 48px) / 7 - 4px)`,
                      height: durToH(SEL_DUR) - 2,
                      backgroundColor: 'rgba(59,130,246,0.55)',
                      border: '2px solid #3B82F6',
                      boxShadow: '0 0 0 1px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                      transformOrigin: 'top',
                    }}
                  >
                    {/* Event label inside the selection */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6, duration: 0.4 }}
                      className="px-1.5 pt-1 text-white text-[10px] font-semibold truncate"
                    >
                      Nouvel événement
                    </motion.div>

                    {/* Tooltip above */}
                    <AnimatePresence>
                      {tooltipVisible && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35 }}
                          className="absolute -top-8 left-0 right-0 flex justify-center"
                        >
                          <div className="flex items-center gap-1.5 bg-blue-600 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-lg whitespace-nowrap">
                            <Calendar size={10} /> Créer un événement
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>{/* end grid */}
          </div>{/* end scroll */}
        </div>{/* end calendar */}
      </div>{/* end right panel */}

      {/* ══════════ GHOST TASK (absolute over full container) ══════════ */}
      <AnimatePresence>
        {ghostVisible && (
          <motion.div
            key="ghost"
            initial={{ opacity: 0, scale: 1, x: 0, y: 0 }}
            animate={{
              opacity: phase === 'highlight' ? 0.85 : 1,
              scale: phase === 'dragging' ? 1.06 : 1,
              x: ghostX,
              y: ghostY,
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={
              phase === 'dragging'
                ? { type: 'spring', stiffness: 90, damping: 16, mass: 0.8 }
                : { duration: 0.25 }
            }
            className="absolute z-50 rounded-lg p-2.5 border pointer-events-none shadow-2xl"
            style={{
              left: ghostFrom.x,
              top: ghostFrom.y,
              width: ghostFrom.w,
              backgroundColor: '#1E293B',
              borderColor: CATEGORIES['c2'].color,
              borderLeft: `4px solid ${CATEGORIES['c2'].color}`,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.3)',
            }}
          >
            <div className="flex items-center justify-between mb-1.5 gap-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-orange-500" />
                <span className="text-xs font-medium text-white">{DRAG_TASK.name}</span>
                <Bookmark size={11} className="text-yellow-400 fill-yellow-400" />
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${P_COLORS[DRAG_TASK.priority]}`}>
                P{DRAG_TASK.priority}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-1"><Clock size={9} />{DRAG_TASK.estimatedTime} min</div>
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-slate-400 bg-slate-900">
                Projets
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">Deadline: {DRAG_TASK.deadline}</div>
            <div className="mt-1 text-[10px] text-orange-400/60">↗ Glisser vers le calendrier</div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AgendaShowcase;
