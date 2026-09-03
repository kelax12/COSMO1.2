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
import TaskTableShowcase from '@/components/showcase/TaskTableShowcase';
import AgendaShowcase from '@/components/showcase/AgendaShowcase';
import OKRCardShowcase from '@/components/showcase/OKRCardShowcase';
import HabitHeatmapShowcase from '@/components/showcase/HabitHeatmapShowcase';
import {
  TaskCardMobileShowcase,
  AgendaMobileShowcase,
  HabitMobileShowcase,
  OKRMobileShowcase,
  StatsMobileShowcase,
} from '@/components/showcase/MobileShowcases';
import { useT } from '@/i18n/useT';
import WhenVisible from '@/components/showcase/WhenVisible';

// Audit perf 2026-05-29 — StatsShowcase pulls Recharts (≈ 320 kB). Landing
// page should never block on it: lazy-load with a lightweight skeleton so
// the page renders instantly and the chart streams in once Recharts arrives.
//
// ⚠️ **Corrigé le 2026-08-29, et l'intention d'origine n'était pas tenue.**
// `lazy()` découpe le code, il ne le diffère pas : ce composant était rendu
// immédiatement, donc son import partait au chargement de la page. Mesuré :
// `vendor-charts` (413 ko bruts, recharts + d3) était téléchargé sur `/`, alors
// que `PERFORMANCE.md` le décrivait comme « réellement lazy ». D'où
// `WhenVisible` : le panneau Statistiques est le cinquième d'une section
// défilante, la plupart des visiteurs ne l'atteignent jamais.
const StatsShowcase = lazy(() => import('@/components/showcase/StatsShowcase'));
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

/**
 * Les cinq modules mis en avant.
 *
 * 🔴 La COPIE n'est plus ici. Titres, description, puces et libellé de CTA
 * étaient écrits EN DUR EN FRANÇAIS et rendus tels quels, alors que
 * `landing.features.<id>.*` portait déjà les quarante clés traduites — que
 * plus rien ne consommait. Un visiteur anglophone lisait donc toute la section
 * en français (revue du 2026-09-02, point 7 : le scan ne voyait pas ces
 * formes, donc la gate certifiait un état qu'elle ne mesurait pas).
 *
 * `id` EST la clé de catalogue : `tasks` · `agenda` · `okr` · `habits` ·
 * `stats`. Ajouter un module sans sa section de catalogue ne compile pas.
 */
type FeatureId = 'tasks' | 'agenda' | 'okr' | 'habits' | 'stats';

interface Feature {
  id: FeatureId;
  path: string;
  icon: LucideIcon;
  /** classes tailwind du gradient d'accent (icône, puces, CTA) */
  gradient: string;
  shadow: string;
  glow: string;
  accentText: string;
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
    gradient: 'from-[rgb(var(--color-accent-solid))] to-cyan-500',
    shadow: 'shadow-blue-500/30',
    glow: 'from-[rgb(var(--color-accent-solid))]/20 to-cyan-500/20',
    accentText: 'from-[rgb(var(--color-accent-solid))] to-cyan-400',
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
    accentText: 'from-red-400 to-rose-400',
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
    accentText: 'from-green-400 to-emerald-400',
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
    accentText: 'from-yellow-400 to-amber-400',
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
    accentText: 'from-violet-400 to-purple-400',
    Desktop: () => (
      <WhenVisible fallback={<ShowcaseSkeleton />}>
        <Suspense fallback={<ShowcaseSkeleton />}>
          <StatsShowcase />
          <RefreshScrollTriggerOnMount />
        </Suspense>
      </WhenVisible>
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
  const { t } = useT('landing');
  const Icon = feature.icon;
  // Clé de section = `feature.id`. `t` est typée par le catalogue `fr`, d'où
  // le cast : la clé est construite, mais son existence est garantie par le
  // type `FeatureId` qui n'accepte que les cinq sections écrites au catalogue.
  const key = (suffix: string) => `features.${feature.id}.${suffix}` as Parameters<typeof t>[0];
  return (
    <div className="space-y-6">
      <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r ${feature.gradient} rounded-2xl shadow-lg ${feature.shadow}`}>
        <Icon size={28} className="text-white" />
      </div>
      <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
        {t(key('titleTop'))}
        <br />
        <span className={`bg-gradient-to-r ${feature.accentText} bg-clip-text text-transparent`}>
          {t(key('titleAccent'))}
        </span>
      </h3>
      <p className="text-lg text-slate-300 leading-relaxed">{t(key('description'))}</p>
      <div className="space-y-3">
        {(['b1', 'b2', 'b3', 'b4'] as const).map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-5 h-5 bg-gradient-to-r ${feature.gradient} rounded-full flex items-center justify-center flex-shrink-0`}>
              <CheckCircle size={11} className="text-white" />
            </div>
            <span className="text-slate-300 font-medium text-sm">{t(key(b))}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onCta}
        className={`group bg-gradient-to-r ${feature.gradient} hover:shadow-lg text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2`}
      >
        {t(key('cta'))} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
};

const FeaturesSection: React.FC<FeaturesSectionProps> = ({ isMobile, handleFeatureClick }) => {
  const { t } = useT('landing');
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
              {t('features.headingLine1')}
            </span>
            <br />
            <span className="bg-gradient-to-r from-[rgb(var(--color-accent-solid))] to-purple-400 bg-clip-text text-transparent">
              {t('features.headingLine2')}
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-400 max-w-3xl mx-auto"
          >
            {t('features.modulesSubtitle')}
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
