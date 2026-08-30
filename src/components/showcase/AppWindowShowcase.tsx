import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, type Variants } from 'framer-motion';
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
 * courte et sans chevauchement (cf. `slideVariants` : le pourquoi du
 * remplacement des effets « cube » et « portail » y est écrit).
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

// ═══════════════════════════════════════════════════════════════════
// UNE transition, courte, sans chevauchement. Ce qu'il y avait avant, et
// pourquoi ça a sauté (mesuré le 2026-08-30 sur la vraie page) :
//
//   • deux effets « lourds » alternés (cube 3D, puis portail : entrée à
//     `scale(0.18)` avec `blur(10px)`, sortie à `scale(2.4)`), joués en
//     `mode="sync"` avec des RESSORTS. Un ressort met plus d'une seconde à
//     se poser, la rotation tombe toutes les 2,5 s, et les sorties se
//     chevauchaient ;
//   • relevé dans le DOM : jusqu'à **trois diapositives simultanées**, dont
//     une restée bloquée à `opacity: 0.47` pendant plus d'une seconde.
//     Deux vues superposées en permanence — c'est ça que l'on voyait
//     « buguer » sur le passage Tâches → Agenda ;
//   • et pendant la transition, la barre d'adresse annonçait déjà la vue
//     suivante au-dessus du contenu précédent.
//
// La correction n'est pas un réglage de durée, c'est une garantie : en
// `mode="wait"`, il n'y a JAMAIS plus d'une diapositive à l'écran. La
// sortie se termine avant que l'entrée commence, donc rien ne peut
// s'empiler ni rester coincé. Deux tweens de 260 et 380 ms, soit 640 ms au
// total, très en dessous des 2 500 ms de rotation.
//
// L'effet est volontairement sobre : la fenêtre imite un changement d'onglet
// dans une application, ce qui est exactement le message du hero — quatre
// modules, une seule app. Un cube 3D racontait l'inverse : quatre choses
// différentes.
const slideVariants: Variants = {
  enter: { opacity: 0, y: 12 },
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.26, ease: [0.55, 0, 1, 0.45] },
  },
};


interface AppWindowShowcaseProps {
  /** Variante condensée (mobile) : utilise les showcases mobiles. */
  compact?: boolean;
  /**
   * Signale la vue affichée (`tasks` | `agenda` | `okr` | `habits`).
   *
   * Sert au hero de la landing : la puce du module correspondant s'allume en
   * même temps que la fenêtre change de vue. C'est ce qui transforme une
   * rangée de libellés en explication — le visiteur voit que les quatre
   * modules sont quatre vues de la MÊME application.
   *
   * Doit être stable (`useCallback`) : ce composant est mémoïsé.
   */
  onSlideChange?: (cle: string) => void;
}

const AppWindowShowcaseBase: React.FC<AppWindowShowcaseProps> = ({ compact = false, onSlideChange }) => {
  const slides = compact ? MOBILE_SLIDES : DESKTOP_SLIDES;
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.25 });

  const [index, setIndex] = useState(0);

  /**
   * Vue ANNONCÉE par la barre d'adresse, l'étiquette et la puce du hero.
   *
   * Elle est distincte de la vue active exprès. Avant, tout lisait `active`,
   * donc l'adresse affichait `cosmo.app/agenda` et l'étiquette « Agenda »
   * pendant que le tableau des tâches occupait encore toute la fenêtre : la
   * fenêtre se contredisait elle-même pendant une demi-seconde. Ici, le
   * changement d'annonce est déclenché par `onExitComplete`, c'est-à-dire à
   * l'instant précis où l'ancienne vue a fini de sortir et où la nouvelle
   * commence à entrer.
   */
  const [cleAnnoncee, setCleAnnoncee] = useState(slides[0].key);

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
  // Repli sur `active` si la clé annoncée n'existe pas dans ce jeu de vues
  // (bascule desktop ↔ mobile) : jamais d'annonce orpheline.
  const annonce = slides.find((s) => s.key === cleAnnoncee) ?? active;

  // Notifie APRÈS le rendu, jamais pendant : prévenir un parent en cours de
  // rendu déclencherait un rendu imbriqué à chaque rotation. Et on notifie
  // sur l'ANNONCE, pas sur l'active : la puce du hero doit s'allumer quand la
  // vue apparaît, pas une demi-seconde avant.
  useEffect(() => {
    onSlideChange?.(annonce.key);
  }, [annonce.key, onSlideChange]);

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
                key={annonce.path}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.3 }}
                className="text-[11px] text-slate-300 font-medium tracking-tight"
              >
                {annonce.path}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Scène : une seule vue à l écran, jamais deux (mode wait) */}
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 ${
            compact ? 'h-[460px] flex items-center justify-center p-4' : 'h-[540px] p-4 sm:p-5'
          }`}
        >
          <AnimatePresence
            initial={false}
            mode="wait"
            onExitComplete={() => setCleAnnoncee(active.key)}
          >
            <motion.div
              key={active.key}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={`absolute inset-0 ${compact ? 'flex items-center justify-center p-4' : 'p-4 sm:p-5 flex items-start'}`}
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
                key={annonce.key}
                initial={{ opacity: 0, y: -8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.9 }}
                transition={{ duration: 0.35 }}
                className="px-3 py-1 rounded-full bg-slate-950/85 border border-white/15 backdrop-blur-md shadow-lg"
              >
                <span className="text-[11px] font-semibold text-white">{annonce.label}</span>
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
