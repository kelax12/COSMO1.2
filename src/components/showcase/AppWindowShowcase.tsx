import React from 'react';
import {
  LayoutDashboard, CheckCircle2, Calendar, Repeat, Target, BarChart3,
  Search, Bell, Plus, Flame,
} from 'lucide-react';

/**
 * AppWindowShowcase — mockup statique « fenêtre d'app Cosmo » pour le hero
 * de la landing. Reproduit fidèlement (mais en figé) un aperçu du dashboard
 * combinant plusieurs modules (tâches, OKR, habitudes, agenda) afin que le
 * visiteur comprenne en 2 s ce qu'est le produit.
 *
 * 100 % statique + mémoïsé → zéro dépendance lourde, n'entre pas dans le
 * critical path runtime (cf. audit-perf). Palette dark alignée sur les autres
 * showcases (TaskTableShowcase).
 */

// Mêmes catégories/couleurs que les autres showcases pour la cohérence visuelle.
const TASKS = [
  { name: 'Finaliser le rapport Q2', color: '#EF4444', priority: 5, done: false },
  { name: 'Séance de sport (HIIT)', color: '#10B981', priority: 4, done: true },
  { name: 'Réviser la proposition', color: '#EF4444', priority: 4, done: false },
  { name: 'Lecture : Atomic Habits', color: '#3B82F6', priority: 2, done: false },
];

const PRIORITY_BADGE: Record<number, string> = {
  5: 'bg-red-600/25 text-red-300 border-red-700/60',
  4: 'bg-orange-600/25 text-orange-300 border-orange-700/60',
  3: 'bg-yellow-700/20 text-yellow-300 border-yellow-800/60',
  2: 'bg-blue-700/20 text-blue-300 border-blue-800/60',
  1: 'bg-slate-700/40 text-slate-300 border-slate-600/60',
};

const NAV = [
  { icon: LayoutDashboard, active: true },
  { icon: CheckCircle2, active: false },
  { icon: Calendar, active: false },
  { icon: Repeat, active: false },
  { icon: Target, active: false },
  { icon: BarChart3, active: false },
];

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

interface AppWindowShowcaseProps {
  /** Variante condensée (mobile) : masque la sidebar, réduit le padding. */
  compact?: boolean;
}

const OkrRing: React.FC<{ value: number; size?: number }> = ({ value, size = 78 }) => {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#okrGrad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <defs>
        <linearGradient id="okrGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="fill-white font-bold" style={{ fontSize: 17 }}>
        {value}%
      </text>
    </svg>
  );
};

const AppWindowShowcaseBase: React.FC<AppWindowShowcaseProps> = ({ compact = false }) => {
  return (
    <div className="w-full select-none" aria-hidden="true">
      {/* ── Browser frame ── */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-950/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-sm monochrome:bg-black monochrome:border-white/30">
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
        <div className="flex bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950">
          {/* Sidebar */}
          {!compact && (
            <div className="hidden sm:flex flex-col items-center gap-1.5 w-14 py-4 border-r border-white/10 bg-slate-950/60">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              {NAV.map(({ icon: Icon, active }, i) => (
                <div
                  key={i}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    active
                      ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/30'
                      : 'text-slate-500'
                  }`}
                >
                  <Icon size={17} />
                </div>
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
                <div className="h-8 px-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 flex items-center gap-1.5 text-white text-xs font-semibold shadow-lg shadow-blue-500/25">
                  <Plus size={13} /> Nouvelle
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {/* Tâches du jour */}
              <div className="sm:col-span-3 rounded-xl border border-white/10 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-white">Tâches du jour</span>
                  <span className="text-[10px] text-slate-500 font-medium">3 restantes</span>
                </div>
                <div className="space-y-1.5">
                  {TASKS.map((t, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                        t.done ? 'opacity-50' : 'bg-white/[0.02]'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          t.done ? 'bg-blue-500 border-blue-500' : 'border-slate-600'
                        }`}
                      >
                        {t.done && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="w-1.5 h-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <span className={`flex-1 text-xs font-medium truncate ${t.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                        {t.name}
                      </span>
                      <span className={`text-[10px] font-bold w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${PRIORITY_BADGE[t.priority]}`}>
                        {t.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* OKR + Streak */}
              <div className="sm:col-span-2 flex flex-col gap-3">
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 flex items-center gap-3">
                  <OkrRing value={68} />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Objectif Q2</p>
                    <p className="text-xs font-semibold text-white leading-tight mt-0.5 truncate">Lancer la v2</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">3 / 5 résultats clés</p>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-white">Habitudes</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                      <Flame size={11} /> 12 j
                    </span>
                  </div>
                  <div className="flex gap-[3px]">
                    {Array.from({ length: 14 }).map((_, w) => (
                      <div key={w} className="flex flex-col gap-[3px]">
                        {Array.from({ length: 5 }).map((_, d) => (
                          <span
                            key={d}
                            className="w-2 h-2 rounded-[2px]"
                            style={{ backgroundColor: heatCell(w * 5 + d) }}
                          />
                        ))}
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
                    <div key={col} className="relative rounded-lg bg-white/[0.02] border border-white/5">
                      {EVENTS.filter((e) => e.col === col).map((e, i) => (
                        <div
                          key={i}
                          className="absolute left-1 right-1 rounded-md px-2 py-1 text-[9px] font-semibold text-white/95 overflow-hidden"
                          style={{ backgroundColor: e.color, top: e.top, height: e.height }}
                        >
                          {e.label}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AppWindowShowcase = React.memo(AppWindowShowcaseBase);
AppWindowShowcase.displayName = 'AppWindowShowcase';

export default AppWindowShowcase;
