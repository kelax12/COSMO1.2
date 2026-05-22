/**
 * Showcases mobiles pour la LandingPage.
 *
 * Ces composants miment les patterns UI MOBILE de l'app (TaskCard avec
 * swipe, vue agenda verticale, habit cards, OKR cards, stats compactes)
 * — par opposition aux showcases desktop existants qui montrent des
 * tableaux et grilles. Affichés sur la landing quand le viewport est
 * mobile pour que l'utilisateur voie EXACTEMENT ce qu'il aura sur son
 * téléphone.
 *
 * Animations Framer Motion en boucle : swipe droite, swipe gauche, tap
 * validation. Pas de logique métier — c'est de la démo visuelle pure.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark,
  CheckCircle2,
  Trash2,
  Users,
  UserPlus,
  Calendar,
  MoreHorizontal,
  Plus,
  Flame,
  Target,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 1 — TaskCardMobile (swipe droite = valider, gauche = actions)
// ═══════════════════════════════════════════════════════════════════
const SHOWCASE_TASKS = [
  { id: '1', name: 'Finaliser le rapport', meta: '12/04 · 90 min',  pri: 5, color: '#EF4444', bookmark: true },
  { id: '2', name: 'Séance de sport',      meta: 'Aujourd\'hui · 45 min', pri: 3, color: '#10B981', bookmark: false },
  { id: '3', name: 'Appel client',         meta: 'Demain · 20 min', pri: 4, color: '#F59E0B', bookmark: false },
];

export const TaskCardMobileShowcase: React.FC = () => {
  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur p-3 shadow-2xl">
      {/* Header mobile-style */}
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <span className="text-base font-bold text-white">Tâches</span>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Calendar size={14} className="text-blue-400" />
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
            <Plus size={14} className="text-slate-300" />
          </div>
        </div>
      </div>

      <div className="space-y-2 relative">
        {/* Card 1 — swipe droite VALIDATE (animation en boucle) */}
        <div className="relative overflow-hidden rounded-xl">
          {/* Reveal vert (validation) sous la card */}
          <div className="absolute inset-0 bg-green-500 rounded-xl flex items-center pl-5">
            <CheckCircle2 size={20} className="text-white" strokeWidth={2.5} />
            <span className="text-xs font-bold text-white ml-2">Valider</span>
          </div>
          <motion.div
            animate={{ x: [0, 0, 100, 100, 0] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.3, 0.55, 0.8, 1], ease: 'easeInOut' }}
            className="relative flex items-stretch gap-3 p-3 rounded-xl bg-slate-900 border border-slate-700"
          >
            <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: SHOWCASE_TASKS[0].color }} />
            <div className="w-5 h-5 rounded-full border-2 border-slate-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{SHOWCASE_TASKS[0].name}</p>
              <p className="text-[11px] text-slate-400">{SHOWCASE_TASKS[0].meta}</p>
            </div>
            <div className="self-center px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: SHOWCASE_TASKS[0].color + '30', color: SHOWCASE_TASKS[0].color }}>
              P{SHOWCASE_TASKS[0].pri}
            </div>
            <Bookmark size={14} className="self-center text-amber-500" fill="currentColor" />
          </motion.div>
        </div>

        {/* Card 2 — swipe gauche révèle les actions */}
        <div className="relative overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-slate-600 rounded-xl flex items-center justify-end pr-5">
            <MoreHorizontal size={20} className="text-white" strokeWidth={2.5} />
            <span className="text-xs font-bold text-white ml-2">Options</span>
          </div>
          <motion.div
            animate={{ x: [0, 0, -90, -90, 0] }}
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.4, 0.6, 0.85, 1], ease: 'easeInOut', delay: 1.5 }}
            className="relative flex items-stretch gap-3 p-3 rounded-xl bg-slate-900 border border-slate-700"
          >
            <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: SHOWCASE_TASKS[1].color }} />
            <div className="w-5 h-5 rounded-full border-2 border-slate-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{SHOWCASE_TASKS[1].name}</p>
              <p className="text-[11px] text-slate-400">{SHOWCASE_TASKS[1].meta}</p>
            </div>
            <div className="self-center px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: SHOWCASE_TASKS[1].color + '30', color: SHOWCASE_TASKS[1].color }}>
              P{SHOWCASE_TASKS[1].pri}
            </div>
          </motion.div>
        </div>

        {/* Card 3 — statique avec bouton "..." mis en avant */}
        <div className="relative flex items-stretch gap-3 p-3 rounded-xl bg-slate-900 border border-slate-700">
          <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: SHOWCASE_TASKS[2].color }} />
          <div className="w-5 h-5 rounded-full border-2 border-slate-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{SHOWCASE_TASKS[2].name}</p>
            <p className="text-[11px] text-slate-400">{SHOWCASE_TASKS[2].meta}</p>
          </div>
          <div className="self-center px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: SHOWCASE_TASKS[2].color + '30', color: SHOWCASE_TASKS[2].color }}>
            P{SHOWCASE_TASKS[2].pri}
          </div>
          <motion.button
            animate={{ scale: [1, 1.2, 1], color: ['#94a3b8', '#3b82f6', '#94a3b8'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="self-center p-1.5 rounded-lg"
          >
            <MoreHorizontal size={16} />
          </motion.button>
        </div>
      </div>

      {/* Hint au-dessous */}
      <p className="text-[11px] text-slate-500 text-center mt-3 font-medium">
        Glissez à droite pour valider · à gauche pour les options
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 2 — AgendaMobile (vue liste verticale + bandeau de dates)
// ═══════════════════════════════════════════════════════════════════
const AGENDA_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const AGENDA_EVENTS = [
  { time: '08:30', name: 'Réunion équipe',      color: '#3B82F6' },
  { time: '10:00', name: 'Sport — Course',      color: '#10B981' },
  { time: '13:00', name: 'Déjeuner client',     color: '#F59E0B' },
  { time: '15:30', name: 'Revue de code',       color: '#8B5CF6' },
];

export const AgendaMobileShowcase: React.FC = () => {
  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <ChevronLeft size={16} className="text-slate-400" />
          <span className="text-sm font-bold text-white">Avril 2025</span>
          <ChevronRight size={16} className="text-slate-400" />
        </div>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Plus size={14} className="text-white" />
        </div>
      </div>

      {/* Carrousel de dates */}
      <div className="flex justify-around px-2 py-3 border-b border-white/10">
        {AGENDA_DAYS.map((day, i) => (
          <motion.div
            key={i}
            animate={i === 2 ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className={`flex flex-col items-center justify-center w-9 h-12 rounded-lg ${
              i === 2 ? 'bg-blue-600 text-white' : 'text-slate-400'
            }`}
          >
            <span className="text-[10px] font-semibold opacity-70">{day}</span>
            <span className="text-sm font-bold">{10 + i}</span>
          </motion.div>
        ))}
      </div>

      {/* Liste verticale d'événements */}
      <div className="p-3 space-y-2">
        {AGENDA_EVENTS.map((event, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800"
          >
            <span className="text-xs font-mono text-slate-400 w-12 shrink-0">{event.time}</span>
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: event.color }} />
            <span className="text-sm font-medium text-white flex-1 truncate">{event.name}</span>
          </motion.div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 text-center py-2 border-t border-white/5">
        Vue agenda verticale · scroll au pouce
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 3 — HabitMobile (cards + tap validation + heatmap)
// ═══════════════════════════════════════════════════════════════════
const HABITS = [
  { name: 'Méditation', time: 10, streak: 12, color: '#8B5CF6' },
  { name: 'Lecture',    time: 30, streak: 7,  color: '#3B82F6' },
  { name: 'Sport',      time: 45, streak: 23, color: '#10B981' },
];

export const HabitMobileShowcase: React.FC = () => {
  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-bold text-white">Habitudes</span>
        <span className="text-[11px] font-semibold text-slate-400">2/3 aujourd'hui</span>
      </div>

      <div className="p-3 space-y-2">
        {HABITS.map((habit, i) => (
          <div
            key={i}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800 relative overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={i === 0 ? {
                  backgroundColor: ['transparent', habit.color, transparent(habit.color)],
                  borderColor: ['#64748B', habit.color, habit.color],
                } : {}}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                className="w-9 h-9 rounded-lg border-2 flex items-center justify-center shrink-0"
                style={{ borderColor: i === 0 ? habit.color : '#64748B' }}
              >
                <CheckCircle2 size={16} className={i === 0 ? 'text-white' : 'text-slate-500'} />
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{habit.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock size={10} className="text-slate-500" />
                  <span className="text-[11px] text-slate-400">{habit.time} min</span>
                  <Flame size={10} className="text-orange-500" />
                  <span className="text-[11px] text-slate-400">{habit.streak} j</span>
                </div>
              </div>
            </div>
            {/* Mini heatmap 14 jours */}
            <div className="flex gap-0.5 mt-3">
              {Array.from({ length: 14 }).map((_, j) => (
                <div
                  key={j}
                  className="flex-1 h-1.5 rounded-sm"
                  style={{
                    backgroundColor: (j + i) % 3 === 0 ? '#1e293b' : habit.color,
                    opacity: (j + i) % 3 === 0 ? 0.3 : (0.4 + ((j + i) % 4) * 0.15),
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* FAB simulé */}
      <div className="relative pb-4">
        <motion.div
          animate={{ scale: [1, 1.05, 1], boxShadow: ['0 4px 16px rgba(234,179,8,0.4)', '0 8px 24px rgba(234,179,8,0.6)', '0 4px 16px rgba(234,179,8,0.4)'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute right-4 -top-2 w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center"
        >
          <Plus size={20} className="text-white" strokeWidth={3} />
        </motion.div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 4 — OKRMobile (cards verticales + KR progress)
// ═══════════════════════════════════════════════════════════════════
export const OKRMobileShowcase: React.FC = () => {
  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-emerald-400" />
          <span className="text-sm font-bold text-white">Mes OKR</span>
        </div>
        <span className="text-[11px] font-semibold text-emerald-400">Q2 2025</span>
      </div>

      <div className="p-3 space-y-3">
        {[
          { cat: 'Travail', catColor: '#3B82F6', title: 'Atteindre 1000 utilisateurs', krs: [
            { name: 'Lancer la v2',          progress: 80 },
            { name: 'Campagne Product Hunt', progress: 45 },
          ]},
          { cat: 'Santé', catColor: '#10B981', title: 'Améliorer la forme physique', krs: [
            { name: 'Courir 50 km / mois', progress: 65 },
            { name: '3 séances de muscu / sem.', progress: 90 },
          ]},
        ].map((obj, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.2 }}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800"
          >
            {/* Catégorie chip */}
            <span
              className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2"
              style={{ backgroundColor: obj.catColor + '25', color: obj.catColor }}
            >
              {obj.cat}
            </span>
            <p className="text-sm font-bold text-white mb-3">{obj.title}</p>
            <div className="space-y-2">
              {obj.krs.map((kr, j) => (
                <div key={j}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-300 truncate flex-1">{kr.name}</span>
                    <span className="text-[11px] font-bold text-white ml-2">{kr.progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${kr.progress}%` }}
                      transition={{ duration: 1.2, delay: i * 0.2 + j * 0.15, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: obj.catColor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 5 — StatsMobile (mini cards + bar chart compact)
// ═══════════════════════════════════════════════════════════════════
export const StatsMobileShowcase: React.FC = () => {
  const stats = [
    { label: 'Tâches', value: 42, color: '#3B82F6', trend: '+8' },
    { label: 'Habitudes', value: 87, color: '#EAB308', trend: '+12%' },
    { label: 'KR', value: 6, color: '#22C55E', trend: '+2' },
    { label: 'Agenda', value: 14, color: '#EF4444', trend: '+3' },
  ];
  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-400" />
          <span className="text-sm font-bold text-white">Cette semaine</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800"
          >
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{stat.label}</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{stat.value}</span>
              <span className="text-[10px] font-semibold" style={{ color: stat.color }}>{stat.trend}</span>
            </div>
            {/* Mini sparkline */}
            <div className="flex items-end gap-0.5 h-6 mt-2">
              {[0.3, 0.5, 0.4, 0.7, 0.6, 0.9, 0.8].map((h, j) => (
                <motion.div
                  key={j}
                  initial={{ height: 0 }}
                  animate={{ height: `${h * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08 + j * 0.04 }}
                  className="flex-1 rounded-sm"
                  style={{ backgroundColor: stat.color, opacity: 0.85 }}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── Helper : assombrit légèrement une couleur hex (utile pour transitions)
function transparent(hex: string): string {
  return hex + '88';
}
