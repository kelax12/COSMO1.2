// Section « Fonctionnalités » de la LandingPage.
// Desktop (motion OK) : deck PINNÉ scrubbé GSAP — la section se fige et les
// 5 panneaux (Tâches → Agenda → OKR → Habitudes → Stats) se succèdent au
// scroll, avec un rail de progression. Mobile / prefers-reduced-motion :
// layout empilé classique (Framer whileInView), comme avant.
import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, Calendar, Target, Repeat, ArrowRight, BarChart2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import TaskTableShowcase from '../../components/showcase/TaskTableShowcase';
import AgendaShowcase from '../../components/showcase/AgendaShowcase';
import OKRCardShowcase from '../../components/showcase/OKRCardShowcase';
import HabitHeatmapShowcase from '../../components/showcase/HabitHeatmapShowcase';
import {
  TaskCardMobileShowcase,
  AgendaMobileShowcase,
  HabitMobileShowcase,
  OKRMobileShowcase,
  StatsMobileShowcase,
} from '../../components/showcase/MobileShowcases';

// Audit perf 2026-05-29 — StatsShowcase pulls Recharts (≈ 320 kB). Landing
// page should never block on it: lazy-load with a lightweight skeleton so
// the page renders instantly and the chart streams in once Recharts arrives.
const StatsShowcase = lazy(() => import('../../components/showcase/StatsShowcase'));
const ShowcaseSkeleton = () => (
  <div className="w-full rounded-2xl bg-slate-800/80 border border-white/10 shadow-2xl p-5 h-[340px] animate-pulse" />
);

// Monté uniquement quand le Suspense de StatsShowcase se résout : la hauteur
// du document change (Recharts arrive) → recalcule les positions de pin.
const RefreshScrollTriggerOnMount: React.FC = () => {
  useEffect(() => {
    ScrollTrigger.refresh();
  }, []);
  return null;
};

interface Feature {
  id: string;
  path: string;
  icon: LucideIcon;
  /** classes tailwind du gradient d'accent (icône, puces, CTA) */
  gradient: string;
  shadow: string;
  glow: string;
  titleTop: string;
  titleAccent: string;
  accentText: string;
  description: string;
  bullets: string[];
  cta: string;
  Desktop: React.ComponentType;
  Mobile: React.ComponentType;
  /** sens d'entrée du texte en mode empilé */
  fromRight?: boolean;
}

const FEATURES: Feature[] = [
  {
    id: 'tasks',
    path: '/tasks',
    icon: CheckCircle,
    gradient: 'bg-[rgb(var(--color-accent-solid))] to-cyan-500',
    shadow: 'shadow-blue-500/30',
    glow: 'bg-[rgb(var(--color-accent-solid))] to-cyan-500/20',
    titleTop: 'Gestion de tâches',
    titleAccent: 'nouvelle génération',
    accentText: 'bg-[rgb(var(--color-accent-solid))] to-cyan-400',
    description:
      "Centralisez toutes vos tâches avec priorités, catégories colorées et deadlines. Filtrez en un clic pour vous concentrer sur l'essentiel.",
    bullets: [
      'Filtrez par priorité, catégorie, deadline en un clic',
      "Ajoutez des catégories pour visualiser votre travail en un coup d'œil",
      'Créez des listes de tâches pour mieux vous organiser',
      'Partagez vos tâches en équipe',
    ],
    cta: 'Essayer les tâches',
    Desktop: TaskTableShowcase,
    Mobile: TaskCardMobileShowcase,
  },
  {
    id: 'agenda',
    path: '/agenda',
    icon: Calendar,
    gradient: 'from-red-500 to-rose-500',
    shadow: 'shadow-red-500/30',
    glow: 'from-red-500/20 to-rose-500/20',
    titleTop: 'Agenda intégré',
    titleAccent: 'avec time-blocking',
    accentText: 'from-red-400 to-rose-400',
    description:
      'Glissez vos tâches directement dans votre calendrier pour bloquer du temps. Vues jour, semaine, mois avec zoom granulaire.',
    bullets: [
      'Glissez une tâche depuis la sidebar vers un créneau : un événement est créé instantanément',
      "Couleur de l'événement = couleur de la catégorie de la tâche, pour repérer vos priorités d'un coup d'œil",
      'Créez, déplacez ou redimensionnez les événements à la souris : la tâche associée se met à jour automatiquement',
      'Vues jour / semaine / mois avec basculement en un clic et navigation rapide entre les périodes',
    ],
    cta: "Ouvrir l'agenda",
    Desktop: AgendaShowcase,
    Mobile: AgendaMobileShowcase,
    fromRight: true,
  },
  {
    id: 'okr',
    path: '/okr',
    icon: Target,
    gradient: 'from-green-500 to-emerald-500',
    shadow: 'shadow-green-500/30',
    glow: 'from-green-500/20 to-emerald-500/20',
    titleTop: 'OKR & Objectifs',
    titleAccent: 'à la Google',
    accentText: 'from-green-400 to-emerald-400',
    description:
      'La méthode OKR utilisée par Google, Intel et Netflix — maintenant dans votre poche. Définissez des objectifs ambitieux et mesurez chaque résultat clé.',
    bullets: [
      'Définissez des objectifs ambitieux avec des résultats clés chiffrés',
      'Votre progression est calculée automatiquement',
      "Visualisez l'avancée de vos objectifs en temps réel",
      'Découpez vos objectifs en résultats clés pour passer de "un jour" à "maintenant"',
    ],
    cta: 'Voir les OKRs',
    Desktop: OKRCardShowcase,
    Mobile: OKRMobileShowcase,
  },
  {
    id: 'habits',
    path: '/habits',
    icon: Repeat,
    gradient: 'from-yellow-500 to-amber-500',
    shadow: 'shadow-yellow-500/30',
    glow: 'from-yellow-500/20 to-amber-500/20',
    titleTop: 'Habitudes & Streaks',
    titleAccent: 'visualisés en heatmap',
    accentText: 'from-yellow-400 to-amber-400',
    description:
      'Construisez des routines durables avec un suivi complet. La heatmap 26 semaines révèle vos patterns et récompense votre régularité.',
    bullets: [
      'Mesurez votre régularité grâce au système de tableau de suivi.',
      "Restez motivé avec le système de série de jours d'affilée (streak)",
      "Tableau de suivi global : visualisez toutes vos habitudes en un coup d'œil",
      'Taux de complétion et temps investi : mesurez votre régularité réelle',
    ],
    cta: 'Suivre mes habitudes',
    Desktop: HabitHeatmapShowcase,
    Mobile: HabitMobileShowcase,
    fromRight: true,
  },
  {
    id: 'stats',
    path: '/statistics',
    icon: BarChart2,
    gradient: 'from-violet-500 to-purple-600',
    shadow: 'shadow-violet-500/30',
    glow: 'from-violet-500/20 to-purple-600/20',
    titleTop: 'Statistiques',
    titleAccent: 'multi-modules',
    accentText: 'from-violet-400 to-purple-400',
    description:
      'Analysez votre temps investi sur tous vos modules — tâches, agenda, OKR, habitudes. Des données précises pour des décisions éclairées.',
    bullets: [
      'Répartition du temps sur tâches, agenda, OKR et habitudes pour une meilleure clarté',
      'Vues jour, semaine, mois, année — zoomez où vous voulez',
      'Suivez vos progrès depuis une unique page',
      "Visualisez votre productivité en un coup d'œil",
    ],
    cta: 'Voir mes stats',
    Desktop: () => (
      <Suspense fallback={<ShowcaseSkeleton />}>
        <StatsShowcase />
        <RefreshScrollTriggerOnMount />
      </Suspense>
    ),
    Mobile: StatsMobileShowcase,
  },
];

interface FeaturesSectionProps {
  isMobile: boolean;
  handleFeatureClick: (path: string) => void;
}

/** Colonne texte d'un panneau (partagée entre les deux layouts). */
const FeatureCopy: React.FC<{ feature: Feature; onCta: () => void }> = ({ feature, onCta }) => {
  const Icon = feature.icon;
  return (
    <div className="space-y-6">
      <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r ${feature.gradient} rounded-2xl shadow-lg ${feature.shadow}`}>
        <Icon size={28} className="text-white" />
      </div>
      <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
        {feature.titleTop}
        <br />
        <span className={`bg-gradient-to-r ${feature.accentText} bg-clip-text text-transparent`}>
          {feature.titleAccent}
        </span>
      </h3>
      <p className="text-lg text-slate-300 leading-relaxed">{feature.description}</p>
      <div className="space-y-3">
        {feature.bullets.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-5 h-5 bg-gradient-to-r ${feature.gradient} rounded-full flex items-center justify-center flex-shrink-0`}>
              <CheckCircle size={11} className="text-white" />
            </div>
            <span className="text-slate-300 font-medium text-sm">{b}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onCta}
        className={`group bg-gradient-to-r ${feature.gradient} hover:shadow-lg text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2`}
      >
        {feature.cta} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
};

const FeaturesSection: React.FC<FeaturesSectionProps> = ({ isMobile, handleFeatureClick }) => {
  const reduceMotion = useReducedMotion();
  // Layout empilé = mobile OU reduced-motion (le deck pinné n'a de sens
  // qu'avec les animations scrubbées).
  const stacked = isMobile || !!reduceMotion;

  const sectionRef = useRef<HTMLElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (stacked || !deckRef.current) return;

      const panels = gsap.utils.toArray<HTMLElement>('.feature-panel');
      const dots = gsap.utils.toArray<HTMLElement>('.feature-dot');
      if (panels.length < 2) return;

      // État initial : seul le panneau 0 est visible.
      gsap.set(panels.slice(1), { autoAlpha: 0 });

      const setActiveDot = (index: number) => {
        dots.forEach((dot, i) => {
          dot.classList.toggle('bg-white', i === index);
          dot.classList.toggle('scale-125', i === index);
          dot.classList.toggle('bg-white/25', i !== index);
        });
      };
      setActiveDot(0);

      // 1 segment de crossfade entre chaque paire + 1 temps de pause par
      // panneau. ease none partout : la timeline est scrubbée.
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: deckRef.current,
          start: 'top top',
          end: `+=${panels.length * 100}%`,
          pin: true,
          scrub: 0.8,
          onUpdate: (self) => {
            setActiveDot(Math.min(panels.length - 1, Math.round(self.progress * (panels.length - 1))));
          },
        },
      });

      panels.forEach((panel, i) => {
        if (i === 0) return;
        const prev = panels[i - 1];
        const at = i; // position (1 unité par transition, pauses implicites)
        tl.to(prev, { autoAlpha: 0, y: -60, duration: 0.45 }, at)
          .fromTo(
            panel,
            { autoAlpha: 0, y: 60 },
            { autoAlpha: 1, y: 0, duration: 0.45 },
            at + 0.25,
          )
          .fromTo(
            panel.querySelector('.feature-mockup'),
            { rotateY: i % 2 === 0 ? 24 : -24, scale: 0.92 },
            { rotateY: 0, scale: 1, duration: 0.6 },
            at + 0.25,
          );
        // pause implicite : la transition suivante démarre à i+1
      });
    },
    { scope: sectionRef, dependencies: [stacked], revertOnUpdate: true },
  );

  return (
    <section ref={sectionRef} id="features" className="py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl lg:text-5xl font-bold mb-6"
          >
            <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Tâches, habitudes, agenda et OKR
            </span>
            <br />
            <span className="bg-[rgb(var(--color-accent-solid))] to-purple-400 bg-clip-text text-transparent">
              dans un seul outil
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-400 max-w-3xl mx-auto"
          >
            Chaque module est conçu pour être puissant et intuitif — gestionnaire de tâches, tracker d'habitudes, agenda avec time-blocking et méthode OKR réunis
          </motion.p>
        </div>

        {stacked ? (
          /* ── Layout empilé (mobile / reduced-motion) ── */
          <div className="space-y-36">
            {FEATURES.map((feature) => {
              const Showcase = isMobile ? feature.Mobile : feature.Desktop;
              return (
                <div
                  key={feature.id}
                  className={`flex flex-col ${feature.fromRight ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-10 lg:gap-16`}
                >
                  <motion.div
                    className="flex-1 px-4 lg:px-0"
                    initial={reduceMotion ? false : { opacity: 0, x: feature.fromRight ? 60 : -60, y: 20 }}
                    whileInView={{ opacity: 1, x: 0, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                  >
                    <FeatureCopy feature={feature} onCta={() => handleFeatureClick(feature.path)} />
                  </motion.div>
                  <div className="flex-1 w-full px-4 lg:px-0" style={{ perspective: 1200 }}>
                    <motion.div
                      initial={reduceMotion ? false : { rotateY: feature.fromRight ? -48 : 48, opacity: 0, scale: 0.78, y: 50 }}
                      whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true, margin: '-60px' }}
                      transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                      className="relative"
                    >
                      <div className={`absolute -inset-3 bg-gradient-to-r ${feature.glow} rounded-3xl blur-2xl`} />
                      <div className="relative">
                        <Showcase />
                      </div>
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Deck pinné scrubbé (desktop) : les 5 panneaux se superposent
                dans la même cellule de grid et se succèdent au scroll ── */
          <div ref={deckRef} className="relative min-h-[calc(100vh-6rem)] flex items-center">
            {/* Rail de progression */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10"
              aria-hidden="true"
            >
              {FEATURES.map((f) => (
                <span
                  key={f.id}
                  className="feature-dot w-2 h-2 rounded-full bg-white/25 transition-all duration-300"
                />
              ))}
            </div>

            <div className="grid w-full">
              {FEATURES.map((feature, i) => {
                const Showcase = feature.Desktop;
                return (
                  <div
                    key={feature.id}
                    // Panneaux 2-5 masqués dès le rendu (les 5 partagent la
                    // même cellule de grid) : sans ça, ils se chevauchent
                    // visiblement pendant la frame avant le gsap.set.
                    className={`feature-panel col-start-1 row-start-1 flex flex-row items-center gap-16 pl-10 ${i > 0 ? 'opacity-0' : ''}`}
                  >
                    <div className="flex-1">
                      <FeatureCopy feature={feature} onCta={() => handleFeatureClick(feature.path)} />
                    </div>
                    <div className="flex-1 w-full" style={{ perspective: 1200 }}>
                      <div className="feature-mockup relative">
                        <div className={`absolute -inset-3 bg-gradient-to-r ${feature.glow} rounded-3xl blur-2xl`} />
                        <div className="relative">
                          <Showcase />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturesSection;
