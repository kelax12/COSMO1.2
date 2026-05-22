/**
 * Showcases mobiles pour la LandingPage.
 *
 * Reproduisent fidèlement les composants UI MOBILE de l'app, pour que
 * le visiteur voie exactement ce qu'il aura sur son téléphone.
 *
 * Animations Framer Motion en boucle (swipe, scale, pulse). Pas de
 * logique métier — c'est de la démo visuelle.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Bookmark,
  CheckCircle2,
  CheckCircle,
  MoreHorizontal,
  Plus,
  Flame,
  Clock,
  Calendar,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 1 — TaskCardMobile (inchangé : l'utilisateur l'a validé)
// ═══════════════════════════════════════════════════════════════════
const SHOWCASE_TASKS = [
  { id: '1', name: 'Finaliser le rapport', meta: '12/04 · 90 min',          pri: 5, color: '#EF4444' },
  { id: '2', name: 'Séance de sport',      meta: 'Aujourd\'hui · 45 min',    pri: 3, color: '#10B981' },
  { id: '3', name: 'Appel client',         meta: 'Demain · 20 min',          pri: 4, color: '#F59E0B' },
];

export const TaskCardMobileShowcase: React.FC = () => {
  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur p-3 shadow-2xl">
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
        <div className="relative overflow-hidden rounded-xl">
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

      <p className="text-[11px] text-slate-500 text-center mt-3 font-medium">
        Glissez à droite pour valider · à gauche pour les options
      </p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 2 — Agenda mobile : MobileDayStrip + grille horaire timeGridDay
// ═══════════════════════════════════════════════════════════════════
// Reproduit fidèlement le pattern :
//   - Strip de dates en haut (lettre initiale + numéro), jour sélectionné en cercle noir
//   - Grille horaire verticale : axe heures 40px à gauche, slots de 20px
//   - Events positionnés en blocks colorés avec titre
// ═══════════════════════════════════════════════════════════════════
const AGENDA_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const AGENDA_NUMBERS  = [10, 11, 12, 13, 14, 15, 16];
const SELECTED_INDEX = 2; // mercredi

const TIMELINE_EVENTS = [
  { title: 'Réunion équipe',  startHour: 8,  durationH: 1.0, color: '#3B82F6' },
  { title: 'Sport',           startHour: 10, durationH: 0.75, color: '#10B981' },
  { title: 'Déjeuner client', startHour: 12.5, durationH: 1.25, color: '#F59E0B' },
  { title: 'Code review',     startHour: 15, durationH: 1.0, color: '#8B5CF6' },
];

export const AgendaMobileShowcase: React.FC = () => {
  const HOUR_HEIGHT = 28; // 28px par heure (compact)
  const START_HOUR = 7;
  const END_HOUR = 17;
  const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur shadow-2xl">
      {/* Header — navigation mois */}
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

      {/* MobileDayStrip — lettre initiale + numéro dans cercle */}
      <div className="flex justify-around px-3 py-3 border-b border-white/10">
        {AGENDA_INITIALS.map((initial, i) => {
          const selected = i === SELECTED_INDEX;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold uppercase text-slate-500">{initial}</span>
              <motion.div
                animate={selected ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 1.8, repeat: Infinity }}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  selected ? 'bg-white text-black' : 'text-slate-300'
                }`}
              >
                <span className="text-sm font-bold">{AGENDA_NUMBERS[i]}</span>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Label du jour sélectionné (équivalent mobileDayLabel) */}
      <p className="text-center py-2 text-xs font-medium text-slate-400 border-b border-white/10">
        Mercredi 12 avril
      </p>

      {/* Timeline — axe heures + events absolus */}
      <div className="relative" style={{ height: TIMELINE_HEIGHT + 16 }}>
        <div className="absolute inset-0 p-2 pr-3 flex">
          {/* Axe heures (40px wide) */}
          <div className="w-10 shrink-0 relative" style={{ height: TIMELINE_HEIGHT }}>
            {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
              <div
                key={i}
                className="absolute right-2 text-[10px] text-slate-500 font-mono"
                style={{ top: i * HOUR_HEIGHT - 4 }}
              >
                {String(START_HOUR + i).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Grille events */}
          <div className="flex-1 relative border-l border-slate-800" style={{ height: TIMELINE_HEIGHT }}>
            {/* Lignes horaires */}
            {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-t border-slate-800/60"
                style={{ top: i * HOUR_HEIGHT }}
              />
            ))}

            {/* Events colorés positionnés (motion entry staggered) */}
            {TIMELINE_EVENTS.map((event, i) => {
              const top = (event.startHour - START_HOUR) * HOUR_HEIGHT;
              const height = event.durationH * HOUR_HEIGHT;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.15 }}
                  className="absolute left-1 right-1 rounded-lg shadow-sm px-2 py-1 overflow-hidden"
                  style={{
                    top,
                    height,
                    backgroundColor: event.color,
                  }}
                >
                  <p className="text-[10px] font-semibold text-white leading-tight truncate">
                    {event.title}
                  </p>
                </motion.div>
              );
            })}

            {/* Now-indicator ligne rouge */}
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-x-0 h-[2px] bg-red-500 z-10"
              style={{ top: (10.5 - START_HOUR) * HOUR_HEIGHT }}
            >
              <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 3 — Habits mobile : HabitCard fidèle
// ═══════════════════════════════════════════════════════════════════
// Reproduit le HabitCard de l'app :
//   - Dot couleur + nom + (Clock+min, Flame+streak)
//   - 4 boutons à droite : Calendar (historique), Edit2, "...", Trash2
//   - "7 derniers jours" : 7 DayButtons carrés (bg-blue si completed)
// ═══════════════════════════════════════════════════════════════════
const HABITS = [
  { name: 'Méditation', time: 15, streak: 3,  color: '#8B5CF6' },
  { name: 'Lecture',    time: 30, streak: 12, color: '#3B82F6' },
];
const DAY_LABELS_FR = ['sam.', 'dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.'];
const DAY_NUMBERS   = [13, 14, 15, 16, 17, 18, 19];
// Pattern de complétions par habit (true = jour validé, animé pour la 1ère)
const COMPLETIONS_BY_HABIT = [
  [true, true, true, false, true, true, true],
  [true, false, true, true, true, false, true],
];

export const HabitMobileShowcase: React.FC = () => {
  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-bold text-white">Habitudes</span>
        <span className="text-[11px] font-semibold text-slate-400">2/3 aujourd'hui</span>
      </div>

      <div className="p-3 space-y-3">
        {HABITS.map((habit, hi) => (
          <div
            key={hi}
            className="p-3 rounded-xl bg-slate-900 border border-slate-800"
          >
            {/* Header : dot + nom + meta + 4 boutons */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{habit.name}</p>
                  <div className="flex items-center gap-2.5 mt-0.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock size={10} /> {habit.time} min
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Flame size={10} className="text-orange-500" /> {habit.streak} j
                    </span>
                  </div>
                </div>
              </div>
              {/* 4 boutons : Calendar, Edit2, "...", Trash2 (ordre fidèle à l'app) */}
              <div className="flex items-center gap-0.5 shrink-0">
                <div className="w-7 h-7 flex items-center justify-center text-slate-400">
                  <Calendar size={14} />
                </div>
                <div className="w-7 h-7 flex items-center justify-center text-slate-400">
                  <Edit2 size={14} />
                </div>
                <motion.div
                  animate={hi === 0 ? { color: ['#94a3b8', '#3b82f6', '#94a3b8'], scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-7 h-7 flex items-center justify-center"
                >
                  <MoreHorizontal size={14} />
                </motion.div>
                <div className="w-7 h-7 flex items-center justify-center text-slate-400">
                  <Trash2 size={14} />
                </div>
              </div>
            </div>

            {/* "7 derniers jours" header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-medium text-slate-400">7 derniers jours</span>
            </div>

            {/* 7 DayButtons */}
            <div className="flex gap-1.5">
              {DAY_LABELS_FR.map((label, di) => {
                const completed = COMPLETIONS_BY_HABIT[hi][di];
                const isToday = di === 6;
                // Anime la 1ère cellule du 1er habit pour montrer le tap validation
                const animateThis = hi === 0 && di === 3;
                return (
                  <div key={di} className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-[9px] text-slate-500">{label}</span>
                    <motion.div
                      animate={animateThis ? {
                        backgroundColor: ['transparent', habit.color, 'transparent'],
                      } : {}}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                      className={`w-7 h-7 rounded-md border-2 flex items-center justify-center ${
                        isToday ? 'border-slate-500' : 'border-slate-700'
                      }`}
                      style={{
                        backgroundColor: completed && !animateThis ? habit.color : undefined,
                      }}
                    >
                      {completed ? (
                        <CheckCircle size={12} className="text-white" />
                      ) : (
                        <span className="text-[10px] text-slate-500 font-medium">{DAY_NUMBERS[di]}</span>
                      )}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 4 — OKR mobile : carte fidèle au OKRPage
// ═══════════════════════════════════════════════════════════════════
// Reproduit la carte OKR :
//   - Chip catégorie (dot + nom) + dates start → end
//   - Titre + description courte
//   - Cercle SVG de progression + boutons Edit/Trash + badge "Xj restants"
//   - Liste de KR : nom + boutons (CheckCircle, Calendar) + min + input num/target
//     + barre de progression
// ═══════════════════════════════════════════════════════════════════
export const OKRMobileShowcase: React.FC = () => {
  const progress = 68;
  const krs = [
    { name: 'Lancer la v2',           current: 8,  target: 10, time: 120, color: '#3B82F6' },
    { name: 'Campagne Product Hunt',  current: 45, target: 100, time: 60,  color: '#3B82F6' },
  ];

  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur shadow-2xl">
      <div className="p-4 bg-slate-900">
        {/* Header : chip catégorie + boutons + badge jours restants */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Chip catégorie */}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium mb-1.5"
              style={{ backgroundColor: '#3B82F620', color: '#3B82F6' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
              <span>Travail</span>
            </span>
            {/* Dates */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
              <span>01/04/2025</span>
              <span>→</span>
              <span>30/06/2025</span>
            </div>
            {/* Titre + description */}
            <h3 className="text-sm font-semibold text-white mb-0.5 truncate">
              Atteindre 1000 utilisateurs
            </h3>
            <p className="text-[11px] text-slate-400 line-clamp-2">
              Lancer la v2, faire une campagne Product Hunt et multiplier les partenariats.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-0.5">
              <div className="p-1 text-slate-400"><Edit2 size={12} /></div>
              <div className="p-1 text-red-500/70"><Trash2 size={12} /></div>
            </div>
            {/* Badge "Xj restants" — couleur health (vert ici) */}
            <div
              className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border"
              style={{
                backgroundColor: 'hsla(120, 80%, 45%, 0.1)',
                borderColor: 'hsla(120, 80%, 45%, 0.2)',
                color: 'hsl(120, 80%, 40%)',
              }}
            >
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                47j restants
              </span>
            </div>
          </div>
        </div>

        {/* Progression : cercle SVG + barre globale */}
        <div className="flex items-center gap-3 mb-4">
          {/* Cercle SVG */}
          <div className="relative w-14 h-14 shrink-0">
            <svg className="transform -rotate-90" width="56" height="56" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" stroke="#334155" strokeWidth="8" fill="none" />
              <motion.circle
                cx="40" cy="40" r="32"
                stroke="#3B82F6" strokeWidth="8" fill="none" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 32}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - progress / 100) }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{progress}%</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] text-slate-400">Progression globale</span>
              <span className="text-[11px] font-bold text-white">{progress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="h-full bg-blue-500 rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Liste de KR */}
        <p className="text-[10px] font-medium text-slate-400 mb-2">Résultats Clés</p>
        <div className="space-y-2">
          {krs.map((kr, i) => {
            const krProgress = (kr.current / kr.target) * 100;
            return (
              <div key={i} className="p-2.5 rounded-lg bg-slate-800/60">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-medium text-white truncate flex-1">{kr.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <CheckCircle size={11} className="text-blue-400" />
                    <Calendar size={11} className="text-purple-400" />
                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                      <Clock size={9} />
                      {kr.time}min
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-slate-700 text-white font-mono text-[10px]">
                      {kr.current}
                    </span>
                    <span>/ {kr.target}</span>
                  </div>
                  <div className="flex-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${krProgress}%` }}
                      transition={{ duration: 1, delay: 0.4 + i * 0.15, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: kr.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SHOWCASE 5 — Stats mobile : grille 2x2 sobre fidèle à StatisticsPage
// ═══════════════════════════════════════════════════════════════════
// Reproduit le pattern de StatisticsPage :
//   - 4 stat cards en grille 2x2
//   - Chaque card : label muet en haut + valeur formatée (style "1h 30")
//   - Pas d'icône, pas de sparkline (l'original est sobre)
//   - + une mini grille heatmap "calendrier de complétion" en dessous
// ═══════════════════════════════════════════════════════════════════
export const StatsMobileShowcase: React.FC = () => {
  const stats = [
    { label: "Aujourd'hui",   val: '2h 15' },
    { label: 'Cette semaine', val: '14h 30' },
    { label: 'Ce mois',       val: '52h 45' },
    { label: 'Cette année',   val: '210h' },
  ];

  // Mini heatmap 6 semaines × 7 jours (style StatisticsPage HabitGlobalTracking)
  const heatmapWeeks = 6;
  const heatmapDays = 7;

  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-950/40 backdrop-blur shadow-2xl">
      <div className="px-4 py-3 border-b border-white/10">
        <span className="text-sm font-bold text-white">Statistiques</span>
        <p className="text-[11px] text-slate-400 mt-0.5">Analysez votre productivité</p>
      </div>

      {/* Grille 2x2 — fidèle au design StatisticsPage (sobre, sans icône) */}
      <div className="grid grid-cols-2 gap-3 p-3">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="p-4 rounded-xl bg-slate-900 border border-slate-800"
          >
            <p className="text-[10px] font-medium text-slate-500">{stat.label}</p>
            <p className="text-lg font-bold text-white mt-1">{stat.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Mini heatmap "Calendrier de complétion" */}
      <div className="px-4 pb-4">
        <p className="text-[11px] font-semibold text-slate-300 mb-2">Calendrier de complétion</p>
        {/* Day labels */}
        <div className="flex gap-1 ml-7 mb-1">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <span key={i} className="w-3 text-[8px] text-slate-500 text-center font-medium">{d}</span>
          ))}
        </div>
        {/* Weeks (rows) */}
        <div className="flex flex-col gap-1">
          {Array.from({ length: heatmapWeeks }).map((_, wi) => (
            <div key={wi} className="flex items-center gap-1">
              {/* Month label (1 sur 4) */}
              <span className="w-6 text-[8px] text-slate-500 font-semibold">
                {wi === 0 ? 'Avr' : wi === 4 ? 'Mai' : ''}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: heatmapDays }).map((_, di) => {
                  // Génère un pattern reproductible
                  const seed = (wi * 7 + di) % 11;
                  const opacity = seed < 3 ? 0.15 : seed < 6 ? 0.35 : seed < 9 ? 0.6 : 0.9;
                  return (
                    <motion.div
                      key={di}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: (wi * 7 + di) * 0.015 }}
                      className="w-3 h-3 rounded-[2px]"
                      style={{ backgroundColor: `rgba(234, 179, 8, ${opacity})` }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {/* Légende */}
        <div className="flex items-center justify-end gap-1 mt-2">
          <span className="text-[8px] text-slate-500">Moins</span>
          {[0.15, 0.35, 0.6, 0.9].map((o, i) => (
            <div key={i} className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: `rgba(234, 179, 8, ${o})` }} />
          ))}
          <span className="text-[8px] text-slate-500">Plus</span>
        </div>
      </div>
    </div>
  );
};
