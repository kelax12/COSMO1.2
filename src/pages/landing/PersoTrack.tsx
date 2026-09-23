import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { gsap, useGSAP } from '@/lib/gsap';
import { ArrowRight } from 'lucide-react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useMagnetic } from '@/lib/hooks/use-magnetic';
import { useT } from '@/i18n/useT';
import FeaturesSection from './FeaturesSection';
import SolutionsSection from './SolutionsSection';
import WhySection from './WhySection';
import FaqSection from './FaqSection';
import { pauseWhenOffscreen } from './pause-offscreen';
import HeroModuleDock, { DELAI_ARRIMAGE_MS } from './HeroModuleDock';
import HeroAppIcon from './HeroAppIcon';
import HeroBackdrop from './HeroBackdrop';

interface PersoTrackProps {
  onDemo: () => void;
  onRegister: () => void;
  onFeatureClick: (path: string) => void;
  /** Rangée des CTA du hero : le header bascule son CTA quand elle sort de l'écran. */
  onHeroCtaRef?: (el: HTMLElement | null) => void;
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
const PersoTrack: React.FC<PersoTrackProps> = ({ onDemo, onRegister, onFeatureClick, onHeroCtaRef }) => {
  const { t } = useT('landing');
  const isMobile = useIsMobile();

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gridLayerRef = useRef<HTMLDivElement>(null);
  const auroraLayerRef = useRef<HTMLDivElement>(null);
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

        // Deux filets d'encre encadrent le titre de la CTA. Ils se
        // dessinent UNE FOIS, à l'arrivée de la carte, puis ne coûtent plus
        // rien — c'est la règle déjà écrite pour le hero (« le hero ne doit
        // rien coûter une fois l'entrée finie »), enfin appliquée ici.
        //
        // 🔴 Ils remplacent un `conic-gradient` en `filter: blur(60px)` mis en
        // ROTATION INFINIE. C'est exactement le motif que l'audit A-8 du
        // 2026-09-03 a fait retirer du hero, où neutraliser les seuls
        // `filter: blur` ramenait la page de 2 856 ms bloquées sur 4 000 à
        // 259. Il avait survécu dans cette carte, et la DA blanche l'a rendu
        // presque invisible : il ne restait que la facture. Ne jamais le
        // remettre, ici pas plus qu'ailleurs.
        gsap.from('.cta-rule', {
          scaleX: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: '.cta-card', start: 'top 80%', once: true },
        });
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

  // ── Hero : entrées secondaires, vie du fond, parallax multi-couches ──
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Boucles infinies du hero, mises en pause dès que le hero sort de
        // l'écran (perf : zéro tick offscreen).
        const heroLoops: gsap.core.Tween[] = [];
        // W1 — Le reveal du H1 est en CSS depuis le 2026-08-30 (masques par
        // ligne, cf. `src/index.css`). Il vivait ici, en SplitText : découpe
        // en mots, re-split au chargement des fontes, recopie des classes de
        // gradient sur chaque mot. Trois mécanismes fragiles, et surtout une
        // entrée qui ne pouvait jouer qu'une fois GSAP chargé — c'est-à-dire
        // après le fallback de page, donc jamais vue.

        // Entrées du reste du hero (remplace les motion.* retirés).
        gsap.from('[data-hero-fade]', {
          opacity: 0,
          y: 18,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.12,
          delay: 0.5,
        });

        // Vie permanente du fond, version ENCRE (2026-09-22).
        //
        // 🔴 Sur une page BLANCHE, un mouvement ne peut pas se faire par la
        // lumière. Les orbes floutés et les faisceaux translucides qui
        // vivaient ici avaient été dessinés pour le fond sombre : posés sur
        // du blanc ils n'émettent plus rien de visible, mais ils coûtent
        // toujours — un flou se rastérise à chaque frame, qu'on le voie ou
        // non. Un trait sombre, lui, se voit. Version archivée intégralement :
        // `docs/archive/LANDING-MOTION-DA-SOMBRE-2026-09-22.md`.
        //
        // Les NOEUDS respirent sur place (opacité + échelle) au lieu de
        // dériver : un point sombre qui glisse hors de la grille se lit
        // comme un défaut d'alignement, pas comme une animation.
        gsap.utils.toArray<HTMLElement>('.hero-node').forEach((node, i) => {
          heroLoops.push(
            gsap.to(node, {
              opacity: 0.9,
              scale: 1.5,
              duration: 1.6,
              ease: 'sine.inOut',
              repeat: -1,
              yoyo: true,
              delay: i * 1.3,
            }),
          );
        });
        // Les TRACES gardent la trajectoire des anciens faisceaux — elle est
        // éprouvée, et mise en pause hors écran. Seule leur matière change :
        // le dégradé va de transparent à l'encre, donc l'entrée et la sortie
        // restent portées par le dégradé lui-même, sans tween d'opacité.
        const traceH = heroRef.current?.querySelector<HTMLElement>('.hero-trace-h');
        if (traceH) {
          heroLoops.push(
            gsap.fromTo(
              traceH,
              { x: -220 },
              {
                x: () => (heroRef.current?.offsetWidth ?? window.innerWidth) + 220,
                duration: 5.5,
                ease: 'power1.inOut',
                repeat: -1,
                repeatDelay: 1.8,
                onRepeat: () => {
                  traceH.style.top = `${gsap.utils.random(14, 62)}%`;
                },
              },
            ),
          );
        }
        const traceV = heroRef.current?.querySelector<HTMLElement>('.hero-trace-v');
        if (traceV) {
          heroLoops.push(
            gsap.fromTo(
              traceV,
              { y: -220 },
              {
                y: () => (heroRef.current?.offsetHeight ?? window.innerHeight) + 220,
                duration: 6.5,
                ease: 'power1.inOut',
                repeat: -1,
                repeatDelay: 2.6,
                delay: 2.2,
                onRepeat: () => {
                  traceV.style.left = `${gsap.utils.random(20, 82)}%`;
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

        // W3 — Parallax de fond scrubbé : grille lente, aurores moyennes.
        // ease none obligatoire (scrub).
        //
        // La troisième couche — le mockup, qui remontait de 110 px — a disparu
        // avec la colonne de droite (hero centré, 2026-09-22). Un parallax sur
        // le bloc de texte lui-même serait un contresens : c'est la promesse de
        // la page, elle ne doit pas glisser par rapport à son propre fond.
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
          tl.to(gridLayerRef.current, { yPercent: 8 }, 0).to(auroraLayerRef.current, { yPercent: 18 }, 0);
        }
      });
    },
    { scope: heroRef },
  );

  // Vue affichée par la fenêtre du hero : la puce du module correspondant
  // s'allume en même temps. Callback stable, la fenêtre étant mémoïsée.
  const [moduleAffiche, setModuleAffiche] = useState('tasks');
  const onSlideChange = useCallback((cle: string) => setModuleAffiche(cle), []);

  // Le tilt 3D à la souris a été RETIRÉ le 2026-08-30 avec la refonte du hero.
  // Il coûtait deux ressorts Framer et un handler par mouvement de souris, pour
  // un effet qu'un visiteur sur mobile ne voit jamais et qui ne dit rien du
  // produit. Ce que le hero doit faire comprendre en deux secondes, c'est que
  // quatre outils tiennent dans une seule fenêtre : c'est HeroModuleDock qui
  // s'en charge, en CSS.

  return (
    <div ref={rootRef} className="bg-white text-slate-900">
      {/* Le sommaire du parcours vit dans le header de `LandingPage`. */}
      <section ref={heroRef} className="relative pt-10 pb-20 lg:pt-16 lg:pb-28 overflow-hidden">
        {/* Grille, bruit, aurores et encre : cf. HeroBackdrop. Les deux
            couches que la timeline translate arrivent par ref. */}
        <HeroBackdrop gridRef={gridLayerRef} auroraRef={auroraLayerRef} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Les quatre puces : rangee centree sous le sommaire jusqu'a `xl`,
              flottantes de part et d'autre du titre au-dela. Posees ICI et pas
              dans le bloc de texte : leurs positions sont en POURCENTAGE
              (`xl:left-[1%]`, `xl:right-[4%]`, cf. hero-modules.ts), donc leur
              ancetre positionne doit etre la pleine largeur, pas la colonne de
              lecture. */}
          <HeroModuleDock actif={moduleAffiche} />

          {/* La colonne de lecture est plus large que le texte n'en a besoin,
              et c'est le titre qui fixe sa largeur : `max-w-4xl` est la valeur
              a laquelle les deux phrases du H1 tiennent chacune sur UNE ligne,
              en francais comme en anglais. Un titre qui se casse en quatre
              lignes ne se lit plus comme une promesse, mais comme un
              paragraphe.
              ⚠️ Elle est aussi bornee par le haut : au-dela, le titre mordrait
              sur les puces flottantes, qui vivent dans les marges de ce meme
              conteneur `max-w-7xl`. Mesure a 1440 px : le titre s'arrete a
              1168 px, la puce « Agenda » commence a 1254. */}
          <div className="mx-auto max-w-4xl flex flex-col items-center text-center">
              {/* W1 — H1 révélé ligne par ligne, en CSS.
                  Ce bloc utilisait SplitText : découpe en mots, re-split au
                  chargement des fontes, et recopie des classes de gradient sur
                  chaque mot parce que `bg-clip-text` ne survit pas aux
                  transforms des ENFANTS. Trois mécanismes fragiles pour un
                  effet que personne ne voyait, l'entrée jouant derrière le
                  fallback de la page (mesuré le 2026-08-30).
                  Ici le gradient et le transform sont portés par le MÊME
                  élément, ce qui est le cas que `bg-clip-text` supporte, et le
                  masque est une simple div en `overflow: hidden`. */}
              {/* La tuile remplace la fenetre de 540 px : elle dit « une seule
                  app, quatre modules » sans repousser la promesse sous la ligne
                  de flottaison. Le meme retard d'entree que la fenetre d'avant,
                  pour que les puces se posent avant elle. */}
              <HeroAppIcon onModuleChange={onSlideChange} delaiEntree={DELAI_ARRIMAGE_MS + 120} />

              {/* ── Typographie de la refonte centree (2026-09-22) ──
                  Le titre est la seule chose que le premier ecran doit reussir,
                  et son reglage vient de trois valeurs, pas d'une taille :
                  · `tracking-[-0.045em]` — un display serre. Inter s'espace
                    pour du corps de texte ; a 80 px, l'espacement par defaut
                    fait flotter les mots et casse le bloc.
                  · `leading-[0.98]` — les deux lignes forment UN bloc. Au-dela
                    de 1,0 elles se lisent comme deux phrases empilees.
                  🔴 LES QUATRE TAILLES SONT ARBITRAIRES, ET C'EST OBLIGATOIRE.
                  Les classes nommees de Tailwind (`text-6xl`, `text-7xl`…)
                  posent AUSSI un `line-height`, et leurs variantes responsives
                  sont emises APRES `leading-[…]` dans la feuille : a poids egal,
                  la derniere gagne. Ecrit `lg:text-6xl`, le titre rendait donc
                  `line-height: 1` a partir de 1024 px — mesure dans le
                  navigateur a 68 px pour 68 px de corps, la ou 0,98 en demande
                  66,6. Aucune erreur, aucun avertissement : la classe existe
                  bien dans la feuille, elle est simplement recouverte. Une
                  taille arbitraire ne pose que `font-size`, donc `leading`
                  reste le seul a decider.
                  · `font-bold` (700) — et pas davantage : les deux `@font-face`
                    d'Inter declarent `font-weight: 300 700`. Demander 800
                    ferait SYNTHETISER le gras par le navigateur, qui epaissit
                    les jambages sans redessiner la lettre.
                  ⚠️ `leading` < 1 rogne les jambages descendants dans un
                  `overflow: hidden` : c'est `.hero-line-mask` qui compense, par
                  son `padding-bottom` de 0,14em. Ne pas le retirer. */}
              <h1
                ref={headingRef}
                className="text-[2.35rem] sm:text-[3.25rem] lg:text-[3.75rem] xl:text-[4.25rem] font-bold tracking-[-0.045em] mb-5 leading-[0.98]"
              >
                <span className="hero-line-mask">
                  <span
                    className="hero-line-in block bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent"
                    style={{ ['--d' as string]: '80ms' }}
                  >
                    {t('hero.line1')}
                  </span>
                </span>
                <span className="hero-line-mask">
                  <span
                    className="hero-line-in block bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent"
                    style={{ ['--d' as string]: '200ms' }}
                  >
                    {t('hero.line2')}
                  </span>
                </span>
              </h1>

              {/* Le sous-titre est en RETRAIT du titre, pas en continuite :
                  plus petit, plus gris, et surtout plus ETROIT que lui
                  (`max-w-xl` sous un titre en `max-w-3xl`). C'est ce
                  retrecissement qui fait lire les deux blocs comme un titre et
                  sa legende, et non comme deux paragraphes.
                  ⚠️ `slate-500` sur blanc vaut 4,76:1 — au-dessus du 4,5:1 exige
                  pour du texte courant. Ne pas descendre a `slate-400` (3,03:1),
                  qui echouerait a cette taille. */}
              <p
                data-hero-fade
                className="text-[1rem] sm:text-[1.125rem] text-slate-500 mb-9 max-w-xl leading-[1.55]"
              >
                {t('hero.subtitle')}
              </p>

              {/* Deux pastilles, et une seule fleche. La fleche vit sur l'action
                  SECONDAIRE : elle y annonce un deplacement (creer un compte),
                  alors que l'action principale se joue sur place. En mettre une
                  sur les deux annulerait la hierarchie que la couleur etablit. */}
              <div ref={onHeroCtaRef} data-hero-fade className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {/* CTA principal : démo sans inscription (friction zéro) */}
                <button
                  ref={magneticHeroDemo}
                  onClick={onDemo}
                  className="group relative overflow-hidden bg-blue-600 hover:bg-blue-700 text-white px-7 py-3.5 rounded-full font-semibold text-[15px] tracking-[-0.01em] transition-[box-shadow,color,background-color] duration-300 shadow-[0_8px_30px_-8px_rgba(37,99,235,0.55)] hover:shadow-[0_12px_38px_-8px_rgba(37,99,235,0.7)] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  aria-label={t('hero.demoAria')}
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700" aria-hidden="true" />
                  <span className="relative">{t('hero.demoCta')}</span>
                </button>
                <button
                  ref={magneticHeroSignup}
                  onClick={onRegister}
                  className="group bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 px-7 py-3.5 rounded-full font-semibold text-[15px] tracking-[-0.01em] shadow-sm transition-[box-shadow,color,background-color] duration-300 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {t('hero.signupCta')}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </button>
              </div>

              {/* Micro-preuve sous les CTAs */}
              <p data-hero-fade className="mt-5 text-xs text-slate-500">
                {t('hero.reassurance')}
              </p>
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
        className="relative overflow-hidden border-y border-slate-200 bg-slate-50 py-3.5"
        aria-hidden="true"
      >
        {/* Fondu latéral pour une entrée/sortie douce des mots */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-slate-50 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-slate-50 to-transparent z-10" />
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
                  <span className="text-blue-500/70">✦</span>
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
            className="cta-card bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 shadow-[0_24px_60px_-30px_rgba(37,99,235,0.45)] rounded-3xl p-12 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/[0.04] to-violet-500/[0.04] z-0"></div>
            {/* Filets d'encre : ils se dessinent avec la carte, une fois.
                ⚠️ Le centrage passe par `inset-x-0 mx-auto`, jamais par
                `-translate-x-1/2` : GSAP anime `scaleX` sur ces éléments, et
                il fige alors le centrage en pixels — la ligne se décalerait au
                premier redimensionnement. */}
            <span
              className="cta-rule pointer-events-none absolute inset-x-0 top-6 mx-auto h-px w-2/3 origin-center bg-gradient-to-r from-transparent via-blue-600/45 to-transparent"
              aria-hidden="true"
            />
            <span
              className="cta-rule pointer-events-none absolute inset-x-0 bottom-6 mx-auto h-px w-2/3 origin-center bg-gradient-to-r from-transparent via-violet-600/40 to-transparent"
              aria-hidden="true"
            />

            <div className="relative z-10">
              {/* Lignes masquées : révélées par montée décalée (GSAP) */}
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                <span className="block overflow-hidden">
                  <span className="cta-line block bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    {t('cta.line1')}
                  </span>
                </span>
                <span className="block overflow-hidden">
                  <span className="cta-line block bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                    {t('cta.line2')}
                  </span>
                </span>
              </h2>
              <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
                {t('cta.subtitle')}
              </p>
              {/*
                Count-ups : la démo est pré-remplie, chiffres animés (GSAP).

                🔴 `role="img"` n'est pas décoratif : les enfants sont
                `aria-hidden` (ils sont animés), donc le sens ne tient qu'à
                l'`aria-label`. Sans rôle, `aria-label` est INTERDIT sur un
                `div` (axe `aria-prohibited-attr`, `serious`) : le bloc était
                entièrement muet pour un lecteur d'écran. Mesuré le 2026-09-04.
              */}
              <div
                role="img"
                className="flex items-center justify-center gap-8 mb-10 text-slate-600"
                aria-label={t('cta.statsAria')}
              >
                {[
                  { value: 100, label: t('cta.tasks') },
                  { value: 100, label: t('cta.habits') },
                  { value: 150, label: t('cta.events') },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center">
                    <span data-countup={value} className="text-3xl lg:text-4xl font-bold tabular-nums bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent" aria-hidden="true">
                      {value}
                    </span>
                    <span className="text-xs uppercase tracking-widest text-slate-500" aria-hidden="true">{label}</span>
                  </div>
                ))}
              </div>
              {/* Même hiérarchie que le hero : la démo en bleu plein, l'inscription
                  en blanc avec la seule flèche. Cette carte l'inversait, et un
                  `hover:scale-105` sur les deux faisait bouger le texte au survol. */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={onDemo}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold text-base tracking-[-0.01em] transition-[box-shadow,background-color] duration-300 shadow-[0_8px_30px_-8px_rgba(37,99,235,0.55)] hover:shadow-[0_12px_38px_-8px_rgba(37,99,235,0.7)] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  {t('cta.tryDemo')}
                </button>
                <button
                  onClick={onRegister}
                  className="group bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 px-8 py-4 rounded-full font-semibold text-base tracking-[-0.01em] shadow-sm transition-[box-shadow,background-color] duration-300 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {t('cta.startNow')}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
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
