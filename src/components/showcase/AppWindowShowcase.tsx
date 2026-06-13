import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import TaskTableShowcase from './TaskTableShowcase';
import AgendaShowcase from './AgendaShowcase';
import OKRCardShowcase from './OKRCardShowcase';
import HabitTableShowcase from './HabitHeatmapShowcase';
import {
  TaskCardMobileShowcase,
  AgendaMobileShowcase,
  HabitMobileShowcase,
  OKRMobileShowcase,
} from './MobileShowcases';

/**
 * AppWindowShowcase — vitrine produit du hero de la landing.
 *
 * Plutôt qu'un mockup custom, on RÉUTILISE les showcases existants (déjà
 * fidèles à l'app et déjà animés en interne) et on les fait TOURNER : un
 * showcase visible à la fois, rotation toutes les 2,5 s, avec une transition
 * 3D très marquée entre chaque (slide + rotateY + scale + blur + fade).
 *
 * - Desktop : TaskTable / Agenda / OKR / Habitudes.
 * - Mobile (`compact`) : versions mobiles correspondantes.
 * - StatsShowcase est volontairement EXCLU du hero : il embarque Recharts
 *   (vendor-charts ~374 kB) qui doit rester lazy/hors critical path (audit
 *   perf P-2). Il reste présenté dans FeaturesSection (lazy + Suspense).
 *
 * Perf : les showcases sont déjà importés (eager) par FeaturesSection → même
 * chunk landing, coût bundle neutre. La rotation est gated par useInView
 * (l'intervalle ne tourne pas hors écran). Seul le showcase actif est monté
 * (+ celui qui sort pendant la transition), donc un seul intervalle interne
 * tourne à la fois.
 */

interface ShowcaseSlide {
  key: string;
  label: string;
  path: string;
  Comp: React.ComponentType;
}

const DESKTOP_SLIDES: ShowcaseSlide[] = [
  { key: 'tasks', label: 'Tâches', path: 'tasks', Comp: TaskTableShowcase },
  { key: 'agenda', label: 'Agenda', path: 'agenda', Comp: AgendaShowcase },
  { key: 'okr', label: 'OKR', path: 'okr', Comp: OKRCardShowcase },
  { key: 'habits', label: 'Habitudes', path: 'habits', Comp: HabitTableShowcase },
];

const MOBILE_SLIDES: ShowcaseSlide[] = [
  { key: 'tasks', label: 'Tâches', path: 'tasks', Comp: TaskCardMobileShowcase },
  { key: 'agenda', label: 'Agenda', path: 'agenda', Comp: AgendaMobileShowcase },
  { key: 'okr', label: 'OKR', path: 'okr', Comp: OKRMobileShowcase },
  { key: 'habits', label: 'Habitudes', path: 'habits', Comp: HabitMobileShowcase },
];

const ROTATE_MS = 2500;

interface AppWindowShowcaseProps {
  /** Variante condensée (mobile) : utilise les showcases mobiles. */
  compact?: boolean;
}

const AppWindowShowcaseBase: React.FC<AppWindowShowcaseProps> = ({ compact = false }) => {
  const slides = compact ? MOBILE_SLIDES : DESKTOP_SLIDES;
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.25 });

  const [index, setIndex] = useState(0);

  // Rotation auto, uniquement quand le hero est visible (perf).
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [inView, slides.length]);

  const active = slides[index];
  const ActiveComp = active.Comp;

  return (
    <div ref={containerRef} className="w-full select-none" aria-hidden="true">
      {/* Cadre fenêtre commun (chrome) — unifie la rotation */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-950/80 backdrop-blur-sm shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)]">
        {/* Chrome bar : l'URL change selon le showcase */}
        <div className="flex items-center gap-2 px-4 h-10 bg-slate-900/90 border-b border-white/10">
          <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          <div className="ml-3 flex-1 max-w-[260px] h-6 rounded-md bg-slate-800/70 border border-white/10 flex items-center px-2.5 overflow-hidden">
            <span className="text-[11px] text-slate-500 font-medium tracking-tight shrink-0">cosmo.app/</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={active.path}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.3 }}
                className="text-[11px] text-slate-300 font-medium tracking-tight"
              >
                {active.path}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Scène : un showcase visible, rotation 3D très marquée */}
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 ${
            compact ? 'h-[460px] flex items-center justify-center p-4' : 'h-[540px] p-4 sm:p-5'
          }`}
          style={{ perspective: 1600 }}
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={active.key}
              className={`absolute inset-0 ${compact ? 'flex items-center justify-center p-4' : 'p-4 sm:p-5 flex items-start'}`}
              initial={{ opacity: 0, x: 90, rotateY: 42, scale: 0.82, filter: 'blur(7px)' }}
              animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -90, rotateY: -42, scale: 0.82, filter: 'blur(7px)' }}
              transition={{ type: 'tween', duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformStyle: 'preserve-3d', transformOrigin: 'center' }}
            >
              <div className="w-full">
                <ActiveComp />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Étiquette de feature (haut-gauche) */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={active.key}
                initial={{ opacity: 0, y: -8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.9 }}
                transition={{ duration: 0.35 }}
                className="px-3 py-1 rounded-full bg-slate-950/85 border border-white/15 backdrop-blur-md shadow-lg"
              >
                <span className="text-[11px] font-semibold text-white">{active.label}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Indicateurs de rotation (dots) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {slides.map((sl, i) => (
            <motion.span
              key={sl.key}
              className="h-1.5 rounded-full"
              animate={{
                width: i === index ? 20 : 6,
                backgroundColor: i === index ? '#60A5FA' : 'rgba(148,163,184,0.4)',
              }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const AppWindowShowcase = React.memo(AppWindowShowcaseBase);
AppWindowShowcase.displayName = 'AppWindowShowcase';

export default AppWindowShowcase;
