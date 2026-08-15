import React, { useRef } from 'react';
import {
  motion,
  useReducedMotion,
  useTransform,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import { ArrowRight } from 'lucide-react';
import AppWindowShowcase from '@/components/showcase/AppWindowShowcase';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useMagnetic } from '@/lib/hooks/use-magnetic';
import { useT } from '@/i18n/useT';
import FeaturesSection from './FeaturesSection';
import SolutionsSection from './SolutionsSection';
import WhySection from './WhySection';
import FaqSection from './FaqSection';
import { pauseWhenOffscreen } from './pause-offscreen';
import TrackAnchors from './TrackAnchors';

interface PersoTrackProps {
  onDemo: () => void;
  onRegister: () => void;
  onFeatureClick: (path: string) => void;
}

/**
 * Le parcours « pour moi » — le contenu historique de la landing, extrait tel
 * quel de `LandingPage` quand la page a été scindée en deux tracks.
 *
 * Rien n'a changé ici sur le fond : mêmes textes, mêmes animations, même
 * direction artistique cosmique. Le seul déplacement est structurel — les
 * effets qui appartiennent à ce parcours (marquee, reveal de la CTA, halo
 * conique, hero) vivent désormais dans son propre scope GSAP, pour qu'ils
 * soient créés et nettoyés en même temps que lui.
 */
const PersoTrack: React.FC<PersoTrackProps> = ({ onDemo, onRegister, onFeatureClick }) => {
  const { t } = useT('landing');
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gridLayerRef = useRef<HTMLDivElement>(null);
  const auroraLayerRef = useRef<HTMLDivElement>(null);
  const mockupLayerRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLElement>(null);

  // W7 — CTAs magnétiques (no-op tactile / reduced-motion, cf. hook).
  const magneticHeroDemo = useMagnetic<HTMLButtonElement>(0.16);
  const magneticHeroSignup = useMagnetic<HTMLButtonElement>(0.16);

  // ── Effets de parcours : marquee infini, reveal + halo de la CTA finale ──
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Marquee infini : la piste contient 2 copies identiques,
        // xPercent -50 = boucle parfaitement seamless. En pause hors écran.
        const marqueeTrack = rootRef.current?.querySelector('.marquee-track');
        if (marqueeTrack) {
          const marqueeLoop = gsap.to(marqueeTrack, {
            xPercent: -50,
            ease: 'none',
            duration: 30,
            repeat: -1,
          });
          pauseWhenOffscreen(marqueeTrack.parentElement ?? marqueeTrack, [marqueeLoop]);
        }

        // Reveal des 2 lignes de la CTA finale (masquées, montée décalée).
        gsap.from('.cta-line', {
          yPercent: 110,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.14,
          scrollTrigger: { trigger: '.cta-card', start: 'top 80%', once: true },
        });

        // Halo conique qui tourne en continu derrière le contenu de la CTA.
        // En pause hors écran (blur 60px qui tourne = cher en GPU).
        const ctaHalo = rootRef.current?.querySelector('.cta-halo');
        if (ctaHalo) {
          const haloLoop = gsap.to(ctaHalo, { rotation: 360, ease: 'none', duration: 16, repeat: -1 });
          pauseWhenOffscreen(ctaHalo, [haloLoop]);
        }
      });
    },
    { scope: rootRef },
  );

  // W6 — Count-ups de la CTA finale : les chiffres montent de 0 à leur
  // valeur (déjà présente dans le markup = fallback reduced-motion).
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.utils.toArray<HTMLElement>('[data-countup]').forEach((el) => {
          const end = Number(el.dataset.countup);
          if (!Number.isFinite(end)) return;
          const counter = { v: 0 };
          gsap.to(counter, {
            v: end,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = String(Math.round(counter.v));
            },
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
        });
      });
    },
    { scope: ctaRef },
  );

  // ── Hero : SplitText, entrées, vie du fond, parallax multi-couches ──
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Boucles infinies du hero, mises en pause dès que le hero sort de
        // l'écran (perf : zéro tick offscreen).
        const heroLoops: gsap.core.Tween[] = [];
        // Tween du gradient accent : recréé à chaque re-split (fonts),
        // il faut tuer l'ancien pour ne pas accumuler de tweens fantômes.
        let accentTween: gsap.core.Tween | null = null;

        // W1 — Reveal du H1 : split lignes/mots, chaque ligne masquée,
        // les mots montent avec un léger stagger (autoSplit = re-split
        // propre quand les fontes finissent de charger).
        if (headingRef.current) {
          SplitText.create('.hero-line', {
            type: 'lines,words',
            mask: 'lines',
            autoSplit: true,
            wordsClass: 'hero-word',
            onSplit: (self) => {
              // bg-clip-text ne survit pas aux transforms des enfants :
              // on recopie le gradient du span parent sur chaque mot.
              self.words.forEach((word) => {
                const el = word as HTMLElement;
                const line = el.closest<HTMLElement>('.hero-line');
                if (line) {
                  const copied = Array.from(line.classList).filter(
                    (c) => c !== 'hero-line' && c !== 'hero-line-accent' && c !== 'block',
                  );
                  el.classList.add(...copied);
                  if (line.classList.contains('hero-line-accent')) {
                    el.classList.add('hero-word-accent');
                    el.style.backgroundSize = line.style.backgroundSize;
                  }
                }
              });
              // Gradient animé de la 2e ligne (ex-Framer backgroundPosition).
              if (accentTween) {
                heroLoops.splice(heroLoops.indexOf(accentTween), 1);
                accentTween.kill();
              }
              accentTween = gsap.to('.hero-word-accent', {
                backgroundPosition: '100% 50%',
                duration: 4,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
              });
              heroLoops.push(accentTween);
              return gsap.from(self.words, {
                yPercent: 115,
                rotation: 4,
                opacity: 0,
                duration: 0.9,
                ease: 'expo.out',
                stagger: 0.045,
                delay: 0.1,
              });
            },
          });
        }

        // Entrées du reste du hero (remplace les motion.* retirés).
        gsap.from('[data-hero-fade]', {
          opacity: 0,
          y: 18,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.12,
          delay: 0.5,
        });

        // Vie permanente du fond : orbes qui dérivent (yoyo aléatoire
        // re-tiré à chaque cycle) + traceurs lumineux qui balayent la
        // grille à une hauteur/position aléatoire à chaque passage.
        gsap.utils.toArray<HTMLElement>('.hero-orb').forEach((orb, i) => {
          heroLoops.push(
            gsap.to(orb, {
              x: () => gsap.utils.random(-70, 70),
              y: () => gsap.utils.random(-50, 50),
              duration: () => gsap.utils.random(4, 7),
              ease: 'sine.inOut',
              repeat: -1,
              yoyo: true,
              repeatRefresh: true,
              delay: i * 0.9,
            }),
          );
        });
        const beamH = heroRef.current?.querySelector<HTMLElement>('.hero-beam-h');
        if (beamH) {
          heroLoops.push(
            gsap.fromTo(
              beamH,
              { x: -220 },
              {
                x: () => (heroRef.current?.offsetWidth ?? window.innerWidth) + 220,
                duration: 5.5,
                ease: 'power1.inOut',
                repeat: -1,
                repeatDelay: 1.8,
                onRepeat: () => {
                  beamH.style.top = `${gsap.utils.random(15, 72)}%`;
                },
              },
            ),
          );
        }
        const beamV = heroRef.current?.querySelector<HTMLElement>('.hero-beam-v');
        if (beamV) {
          heroLoops.push(
            gsap.fromTo(
              beamV,
              { y: -220 },
              {
                y: () => (heroRef.current?.offsetHeight ?? window.innerHeight) + 220,
                duration: 6.5,
                ease: 'power1.inOut',
                repeat: -1,
                repeatDelay: 2.6,
                delay: 2.2,
                onRepeat: () => {
                  beamV.style.left = `${gsap.utils.random(20, 82)}%`;
                },
              },
            ),
          );
        }

        // Indicateur de scroll : le chevron rebondit en boucle, et tout
        // l'indicateur s'efface dès que l'utilisateur commence à scroller.
        heroLoops.push(
          gsap.to('.scroll-cue-arrow', {
            y: 8,
            repeat: -1,
            yoyo: true,
            duration: 0.9,
            ease: 'sine.inOut',
          }),
        );

        if (heroRef.current) pauseWhenOffscreen(heroRef.current, heroLoops);
        gsap.to('.scroll-cue', {
          autoAlpha: 0,
          ease: 'none',
          scrollTrigger: { trigger: heroRef.current, start: 'top top', end: '+=200', scrub: true },
        });

        // W3 — Parallax multi-couches scrubbé : grille lente, aurores
        // moyennes, mockup rapide. ease none obligatoire (scrub).
        if (heroRef.current) {
          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: heroRef.current,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          });
          tl.to(gridLayerRef.current, { yPercent: 8 }, 0)
            .to(auroraLayerRef.current, { yPercent: 18 }, 0)
            .to(mockupLayerRef.current, { y: -110 }, 0);
        }
      });
    },
    { scope: heroRef },
  );

  // Tilt 3D du mockup suivant la souris (désactivé mobile / reduced-motion).
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [7, -7]), { stiffness: 150, damping: 18 });
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-9, 9]), { stiffness: 150, damping: 18 });

  const handleMockupPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointerX.set((e.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const resetMockupPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div ref={rootRef} className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sommaire du parcours — les ancres qui vivaient dans le header avant
          que le sélecteur de parcours n'en prenne le centre. */}
      <TrackAnchors track="perso" label={t('enterprise.gateway.perso.title')} />

      <section ref={heroRef} className="relative pt-10 pb-20 lg:pt-16 lg:pb-28 overflow-hidden">
        {/* ── Fond ambiant : grille masquée + noise + aurores + halo conique ── */}
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          {/* Grille fine type Linear/Vercel, fondue — couche parallax lente (GSAP) */}
          <div
            ref={gridLayerRef}
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse 80% 70% at 60% 35%, #000 50%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 60% 35%, #000 50%, transparent 100%)',
            }}
          />
          {/* Vie permanente : traceurs lumineux qui balayent la grille +
              orbes qui dérivent en continu (GSAP, gaté reduced-motion) */}
          <div className="hero-beam-h absolute top-[28%] left-0 h-px w-52 bg-gradient-to-r from-transparent via-blue-400/80 to-transparent" />
          <div className="hero-beam-v absolute left-[68%] top-0 w-px h-52 bg-gradient-to-b from-transparent via-violet-400/70 to-transparent" />
          <div className="hero-orb absolute top-[20%] left-[10%] h-3 w-3 rounded-full bg-[rgb(var(--color-accent-solid))]/60 blur-[2px]" />
          <div className="hero-orb absolute top-[64%] left-[80%] h-2 w-2 rounded-full bg-violet-400/60 blur-[1px]" />
          <div className="hero-orb absolute top-[40%] left-[52%] h-2.5 w-2.5 rounded-full bg-cyan-300/50 blur-[2px]" />

          {/* Couche parallax moyenne (GSAP) : halo + aurores. Les loops
              d'opacité/scale restent en Framer sur les enfants ; GSAP ne
              translate que ce wrapper (pas de conflit de transform). */}
          <div ref={auroraLayerRef} className="absolute inset-0">
            {/* Halo conique lumineux animé (rotation lente) */}
            <motion.div
              className="absolute left-1/2 top-[-10%] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full opacity-50"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(59,130,246,0.18), rgba(139,92,246,0.16), rgba(217,70,239,0.14), rgba(34,211,238,0.16), rgba(59,130,246,0.18))',
                filter: 'blur(90px)',
              }}
              whileInView={reduceMotion ? undefined : { rotate: 360 }}
              transition={reduceMotion ? undefined : { duration: 40, repeat: Infinity, ease: 'linear' }}
            />
            {/* Aurores */}
            <motion.div
              className="absolute -top-24 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] via-violet-600/20 to-fuchsia-600/20 blur-[110px]"
              whileInView={reduceMotion ? undefined : { opacity: [0.55, 0.8, 0.55], scale: [1, 1.06, 1] }}
              transition={reduceMotion ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute top-10 -left-20 h-80 w-80 rounded-full bg-cyan-500/15 blur-[100px]"
              whileInView={reduceMotion ? undefined : { opacity: [0.4, 0.65, 0.4] }}
              transition={reduceMotion ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />
            <motion.div
              className="absolute top-24 -right-16 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-[100px]"
              whileInView={reduceMotion ? undefined : { opacity: [0.4, 0.7, 0.4] }}
              transition={reduceMotion ? undefined : { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            />
          </div>
          {/* Texture noise (SVG feTurbulence, ultra-léger) */}
          <div
            className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
          {/* Fondu vers la section suivante */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-slate-900" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* ── Colonne gauche : copy ── */}
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              {/* W1 — H1 révélé par SplitText (lignes masquées, mots staggerés).
                  Les gradients restent sur les spans (fallback reduced-motion /
                  no-JS) et sont recopiés sur chaque mot au split, car
                  bg-clip-text ne survit pas aux transforms des enfants. */}
              <h1
                ref={headingRef}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 leading-[1.05]"
              >
                <span className="hero-line block bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                  {t('hero.line1')}
                </span>
                <span
                  className="hero-line hero-line-accent block bg-[rgb(var(--color-accent-solid))] via-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
                  style={{ backgroundSize: '200% auto' }}
                >
                  {t('hero.line2')}
                </span>
              </h1>

              <p
                data-hero-fade
                className="text-lg lg:text-xl text-slate-400 mb-12 lg:mb-16 max-w-xl leading-relaxed"
              >
                {t('hero.subtitle')}
              </p>

              <div data-hero-fade className="flex flex-col sm:flex-row gap-3.5 w-full sm:w-auto">
                {/* CTA principal : démo sans inscription (friction zéro) */}
                <button
                  ref={magneticHeroDemo}
                  onClick={onDemo}
                  className="group relative overflow-hidden bg-[rgb(var(--color-accent-solid))] to-violet-600 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:to-violet-500 text-[rgb(var(--color-accent-solid-foreground))] px-8 py-4 rounded-2xl font-bold text-base transition-[box-shadow,color,background-color] duration-300 shadow-[0_8px_30px_-6px_rgba(79,70,229,0.6)] hover:shadow-[0_12px_40px_-6px_rgba(79,70,229,0.75)] flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                  aria-label={t('hero.demoAria')}
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700" aria-hidden="true" />
                  <span className="relative">{t('hero.demoCta')}</span>
                  <ArrowRight size={18} className="relative group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </button>
                <button
                  ref={magneticHeroSignup}
                  onClick={onRegister}
                  className="group bg-white/5 hover:bg-white/10 text-white border border-white/15 px-8 py-4 rounded-2xl font-semibold text-base backdrop-blur-md transition-[box-shadow,color,background-color] duration-300 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  {t('hero.signupCta')}
                </button>
              </div>

              {/* Micro-preuve sous les CTAs */}
              <p data-hero-fade className="mt-4 text-xs text-slate-500">
                {t('hero.reassurance')}
              </p>
            </div>

            {/* ── Colonne droite : mockup produit ──
                Wrapper externe = couche parallax rapide (GSAP, scroll) ;
                le motion.div interne garde l'entrée + le tilt Framer
                (1 élément = 1 propriétaire de transform). */}
            <div ref={mockupLayerRef} className="relative w-full">
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full"
                style={{ perspective: 1400 }}
              >
                {/* Glow derrière le frame */}
                <div className="absolute -inset-6 bg-gradient-to-tr bg-[rgb(var(--color-accent-solid))] via-violet-600/20 to-fuchsia-500/20 rounded-[2rem] blur-3xl" aria-hidden="true" />

                <motion.div
                  onPointerMove={isMobile || reduceMotion ? undefined : handleMockupPointer}
                  onPointerLeave={isMobile || reduceMotion ? undefined : resetMockupPointer}
                  style={isMobile || reduceMotion ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
                  whileInView={isMobile || reduceMotion ? undefined : { y: [0, -10, 0] }}
                  transition={isMobile || reduceMotion ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative max-w-[34rem] mx-auto lg:max-w-none lg:ml-auto"
                >
                  <AppWindowShowcase compact={isMobile} />
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* Indicateur de scroll : chevron qui rebondit + fond au scroll */}
          <div
            data-hero-fade
            className="scroll-cue mt-14 hidden lg:flex flex-col items-center gap-2 text-slate-500"
            aria-hidden="true"
          >
            <span className="text-[10px] font-mono uppercase tracking-[0.3em]">{t('hero.scroll')}</span>
            <svg className="scroll-cue-arrow h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Marquee infini : les modules défilent en continu (GSAP) ── */}
      <div
        className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.02] py-3.5"
        aria-hidden="true"
      >
        {/* Fondu latéral pour une entrée/sortie douce des mots */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-900 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-slate-900 to-transparent z-10" />
        <div className="marquee-track flex w-max whitespace-nowrap text-sm font-mono uppercase tracking-[0.25em] text-slate-500">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center gap-10 pr-10">
              {[
                t('marquee.tasks'),
                t('marquee.agenda'),
                t('marquee.timeBlocking'),
                t('marquee.okr'),
                t('marquee.habits'),
                t('marquee.stats'),
                t('marquee.demo'),
              ].map((word) => (
                <span key={word} className="flex items-center gap-10">
                  <span>{word}</span>
                  <span className="text-blue-400/60">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <FeaturesSection isMobile={isMobile} handleFeatureClick={onFeatureClick} />

      <SolutionsSection handleFeatureClick={onFeatureClick} />

      <WhySection />

      {/* ── Section FAQ ── */}
      <FaqSection />

      <section ref={ctaRef} className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="cta-card bg-[rgb(var(--color-accent-solid))] to-purple-600/20 backdrop-blur-xl border border-[rgb(var(--color-accent-solid))]/30 rounded-3xl p-12 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] to-purple-500/5 z-0"></div>
            {/* Halo conique rotatif (GSAP) — mouvement ambiant permanent */}
            <div
              className="cta-halo absolute -inset-[45%] opacity-25 pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(59,130,246,0.35), transparent 30%, rgba(139,92,246,0.3) 50%, transparent 70%, rgba(59,130,246,0.35))',
                filter: 'blur(60px)',
              }}
              aria-hidden="true"
            />

            <div className="relative z-10">
              {/* Lignes masquées : révélées par montée décalée (GSAP) */}
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                <span className="block overflow-hidden">
                  <span className="cta-line block bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                    {t('cta.line1')}
                  </span>
                </span>
                <span className="block overflow-hidden">
                  <span className="cta-line block bg-[rgb(var(--color-accent-solid))] to-purple-400 bg-clip-text text-transparent">
                    {t('cta.line2')}
                  </span>
                </span>
              </h2>
              <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
                {t('cta.subtitle')}
              </p>
              {/* Count-ups : la démo est pré-remplie, chiffres animés (GSAP) */}
              <div className="flex items-center justify-center gap-8 mb-10 text-slate-300" aria-label={t('cta.statsAria')}>
                {[
                  { value: 100, label: t('cta.tasks') },
                  { value: 100, label: t('cta.habits') },
                  { value: 150, label: t('cta.events') },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center">
                    <span data-countup={value} className="text-3xl lg:text-4xl font-bold tabular-nums bg-[rgb(var(--color-accent-solid))] to-purple-400 bg-clip-text text-transparent" aria-hidden="true">
                      {value}
                    </span>
                    <span className="text-xs uppercase tracking-widest text-slate-500" aria-hidden="true">{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={onDemo}
                  className="group bg-slate-200 hover:bg-slate-300 text-slate-900 px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform flex items-center justify-center gap-3"
                >
                  {t('cta.tryDemo')}
                </button>
                <button
                  onClick={onRegister}
                  className="group bg-[rgb(var(--color-accent-solid))] to-purple-600 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:to-purple-700 text-[rgb(var(--color-accent-solid-foreground))] px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transform flex items-center justify-center"
                >
                  {t('cta.startNow')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default PersoTrack;
