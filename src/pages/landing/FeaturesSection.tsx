// Section « Fonctionnalités » de la LandingPage.
// Desktop (motion OK) : deck PINNÉ scrubbé GSAP — la section se fige et les
// 5 panneaux (Tâches → Agenda → OKR → Habitudes → Stats) se succèdent au
// scroll, avec un rail de progression. Mobile / prefers-reduced-motion :
// layout empilé classique (Framer whileInView), comme avant.
import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, CheckSquare, Calendar, ArrowRight, BarChart2 } from 'lucide-react';
import { HabitIcon, OkrIcon } from '@/components/icons/cosmo-icons';
import type { LucideIcon } from 'lucide-react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import TaskTableShowcase from '@/components/showcase/TaskTableShowcase';
import AgendaShowcase from '@/components/showcase/AgendaShowcase';
import OKRCardShowcase from '@/components/showcase/OKRCardShowcase';
import HabitHeatmapShowcase from '@/components/showcase/HabitHeatmapShowcase';
// Vitrines MOBILES chargées à la demande : 17,5 ko minifiés, le plus gros poste
// du chunk `LandingPage`. Elles ne sont rendues que sous `isMobile` ; l'import part
// au premier rendu de la section, bien avant que le défilement l'atteigne.
const vitrineMobile = (nom: 'TaskCardMobileShowcase' | 'AgendaMobileShowcase' | 'HabitMobileShowcase' | 'OKRMobileShowcase' | 'StatsMobileShowcase') =>
  lazy(() => import('@/components/showcase/MobileShowcases').then((m) => ({ default: m[nom] })));
const TaskCardMobileShowcase = vitrineMobile('TaskCardMobileShowcase');
const AgendaMobileShowcase = vitrineMobile('AgendaMobileShowcase');
const HabitMobileShowcase = vitrineMobile('HabitMobileShowcase');
const OKRMobileShowcase = vitrineMobile('OKRMobileShowcase');
const StatsMobileShowcase = vitrineMobile('StatsMobileShowcase');
import { useT } from '@/i18n/useT';
import WhenVisible from '@/components/showcase/WhenVisible';
import ShowcaseTheme from '@/components/showcase/ShowcaseTheme';
import { basisColonneAgenda } from '@/components/showcase/agenda-geometrie';

// StatsShowcase tire Recharts (≈ 320 kB) : il est lazy ET différé par
// `WhenVisible`. `lazy()` découpe le code sans le différer (rendu tout de suite, le
// composant faisait télécharger `vendor-charts` sur `/`) ; le panneau Statistiques
// est le cinquième d'une section défilante, la plupart des visiteurs ne
// l'atteignent jamais.
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
 * La COPIE n'est pas ici : titres, description, puces et libellé de CTA viennent
 * de `landing.features.<id>.*`, jamais écrits en dur en français.
 *
 * `id` EST la clé de catalogue : `tasks` · `agenda` · `okr` · `habits` ·
 * `stats`. Ajouter un module sans sa section de catalogue ne compile pas.
 */
type FeatureId = 'tasks' | 'agenda' | 'okr' | 'habits' | 'stats';

interface Feature {
  id: FeatureId;
  path: string;
  icon: LucideIcon;
  /** Aplat d'accent (icône, puces, CTA) : la couleur de la page dans l'app (`Layout.tsx`). */
  fond: string;
  /** Surlignage du mot clé du titre (teinte 300 de la couleur de page). */
  surligne: string;
  Desktop: React.ComponentType;
  Mobile: React.ComponentType;
  /** sens d'entrée du texte en mode empilé */
  fromRight?: boolean;
  /**
   * `flex-basis` de la colonne de la vitrine quand elle ne doit PAS prendre
   * la moitié de la rangée. Absent : les deux colonnes se partagent la place.
   */
  basisMaquette?: string;
}

/** `gap-16` : l'écart entre le texte et la vitrine, dans les deux mises en page. */
const ECART_COLONNES_PX = 64;

const FEATURES: Feature[] = [
  {
    id: 'tasks',
    path: '/tasks',
    icon: CheckSquare,
    fond: 'bg-blue-500',
    surligne: '#93c5fd',
    Desktop: TaskTableShowcase,
    Mobile: TaskCardMobileShowcase,
  },
  {
    id: 'agenda',
    path: '/agenda',
    icon: Calendar,
    fond: 'bg-red-500',
    surligne: '#fca5a5',
    Desktop: AgendaShowcase,
    Mobile: AgendaMobileShowcase,
    fromRight: true,
    // Le calendrier est 30 % plus large ; la barre des tâches garde sa taille.
    // C'est le texte d'à côté qui cède la place (cf. `agenda-geometrie.ts`).
    basisMaquette: basisColonneAgenda(ECART_COLONNES_PX),
  },
  {
    id: 'okr',
    path: '/okr',
    icon: OkrIcon,
    fond: 'bg-green-500',
    surligne: '#86efac',
    Desktop: OKRCardShowcase,
    Mobile: OKRMobileShowcase,
  },
  {
    id: 'habits',
    path: '/habits',
    icon: HabitIcon,
    fond: 'bg-yellow-500',
    surligne: '#fde047',
    Desktop: HabitHeatmapShowcase,
    Mobile: HabitMobileShowcase,
    fromRight: true,
  },
  {
    id: 'stats',
    path: '/statistics',
    icon: BarChart2,
    fond: 'bg-violet-500',
    surligne: '#c4b5fd',
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
  const reduceMotion = useReducedMotion();
  // Clé de section = `feature.id`. `t` est typée par le catalogue `fr`, d'où
  // le cast : la clé est construite, mais son existence est garantie par le
  // type `FeatureId` qui n'accepte que les cinq sections écrites au catalogue.
  const key = (suffix: string) => `features.${feature.id}.${suffix}` as Parameters<typeof t>[0];
  return (
    <div className="space-y-6">
      {/* Icône DEVANT le titre, centrée sur ses deux lignes. */}
      <div className="flex items-center gap-4 lg:gap-5">
      {/* Même flottement que les tuiles du hero (`.hero-tile-idle`, src/index.css). */}
      <div
        className="hero-tile-idle flex-shrink-0"
        style={{ ['--r' as string]: '0deg', ['--dur' as string]: '8s' }}
      >
        <div className={`flex items-center justify-center w-14 h-14 ${feature.fond} rounded-2xl ring-1 ring-slate-900/10`}>
          <Icon size={28} className="text-white" />
        </div>
      </div>
      <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
        {t(key('titleTop'))}
        <br />
        {/* Surlignage dessiné au scroll : une bande d'aplat qui s'étend de 0 à 100 %. */}
        <motion.span
          className="bg-no-repeat"
          style={{
            backgroundImage: `linear-gradient(${feature.surligne}, ${feature.surligne})`,
            backgroundPosition: '0 88%',
          }}
          initial={reduceMotion ? false : { backgroundSize: '0% 0.34em' }}
          whileInView={{ backgroundSize: '100% 0.34em' }}
          viewport={{ once: true, amount: 'some' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        >
          {t(key('titleAccent'))}
        </motion.span>
      </h3>
      </div>
      <p className="text-lg text-slate-600 leading-relaxed">{t(key('description'))}</p>
      <div className="space-y-3">
        {(['b1', 'b2', 'b3', 'b4'] as const).map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-5 h-5 ${feature.fond} rounded-full flex items-center justify-center flex-shrink-0`}>
              <Check size={12} strokeWidth={3} className="text-white" />
            </div>
            <span className="text-slate-700 font-medium text-sm">{t(key(b))}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onCta}
        className={`group ${feature.fond} hover:brightness-95 text-white pl-4 pr-5 py-3 rounded-full font-semibold text-[15px] transition-[filter] duration-300 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}
      >
        <Icon size={16} aria-hidden="true" />
        {t(key('cta'))} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
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
          dot.classList.toggle('bg-blue-600', i === index);
          dot.classList.toggle('scale-125', i === index);
          dot.classList.toggle('bg-slate-900/20', i !== index);
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
            <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              {t('features.headingLine1')}
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              {t('features.headingLine2')}
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-600 max-w-3xl mx-auto"
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
                  <div
                    className={`flex-1 w-full px-4 lg:px-0 ${feature.basisMaquette ? 'lg:flex-none lg:basis-[var(--basis-maquette)]' : ''}`}
                    style={{ perspective: 1200, ['--basis-maquette' as string]: feature.basisMaquette }}
                  >
                    <motion.div
                      initial={reduceMotion ? false : { rotateY: feature.fromRight ? -48 : 48, opacity: 0, scale: 0.78, y: 50 }}
                      whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true, margin: '-60px' }}
                      transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                      className="relative"
                    >
                      <div className="relative">
                        {/* Parcours perso BLANC : les vitrines passent en clair.
                            Sans ce fournisseur elles restent sombres, comme sur
                            `/guide`. */}
                        <ShowcaseTheme theme="light">
                          <Suspense fallback={null}>
                            <Showcase />
                          </Suspense>
                        </ShowcaseTheme>
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
                  className="feature-dot w-2 h-2 rounded-full bg-slate-900/20 transition-all duration-300"
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
                    // Quinconce : même ordre que le layout empilé, vitrine à gauche
                    // pour Agenda et Habitudes (`fromRight`). `pl-10` reste : c'est la
                    // place du rail de points, toujours à gauche.
                    className={`feature-panel col-start-1 row-start-1 flex ${feature.fromRight ? 'flex-row-reverse' : 'flex-row'} items-center gap-16 pl-10 ${i > 0 ? 'opacity-0' : ''}`}
                  >
                    <div className="flex-1">
                      <FeatureCopy feature={feature} onCta={() => handleFeatureClick(feature.path)} />
                    </div>
                    <div
                      className="flex-1 w-full"
                      style={{ perspective: 1200, ...(feature.basisMaquette ? { flex: `0 0 ${feature.basisMaquette}` } : {}) }}
                    >
                      <div className="feature-mockup relative">
                        <div className="relative">
                          <ShowcaseTheme theme="light">
                            <Showcase />
                          </ShowcaseTheme>
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
