import React, { Suspense, lazy, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import CardSwap, { Card } from '@/components/reactbits/CardSwap';
import AppShot from './AppShot';
import { HERO_SHOTS } from './data';
import { useT } from '@/i18n/useT';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useMagnetic } from '@/lib/hooks/use-magnetic';

// `LightRays` embarque `ogl` (chunk `vendor-ogl`, cf. vite.config.ts). Il est
// chargé à la demande pour que le track perso, qui ne l'affiche jamais, ne
// paie pas le runtime WebGL.
const LightRays = lazy(() => import('@/components/reactbits/LightRays'));

interface EnterpriseHeroProps {
  onDemo: () => void;
}

/**
 * Hero du track entreprise — la première seconde doit dire « ce n'est plus le
 * même produit ». Rayons volumétriques cyan sur graphite, titre en trois
 * lignes masquées, et une pile qui fait défiler les VRAIES captures des trois
 * écrans qui intéressent un décideur : Projets, OKR, Statistiques.
 */
const EnterpriseHero: React.FC<EnterpriseHeroProps> = ({ onDemo }) => {
  const { t } = useT('landing');
  const isMobile = useIsMobile();
  const heroRef = useRef<HTMLElement>(null);
  const magneticDemo = useMagnetic<HTMLButtonElement>(0.16);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Les trois lignes du titre montent depuis leur masque.
        //
        // ⚠️ `bg-clip-text` ne survit pas au split : le dégradé reste sur le
        // span parent, les mots deviennent des enfants transparents, et la
        // troisième ligne disparaît purement et simplement. On recopie donc les
        // classes de couleur du parent sur chaque mot — même correctif que le
        // hero du track perso, cf. `PersoTrack`.
        SplitText.create('.ent-hero-line', {
          type: 'lines,words',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) => {
            self.words.forEach((word) => {
              const el = word as HTMLElement;
              const line = el.closest<HTMLElement>('.ent-hero-line');
              if (!line) return;
              const painted = Array.from(line.classList).filter(
                (name) => name !== 'ent-hero-line' && name !== 'block',
              );
              el.classList.add(...painted);
            });
            return gsap.from(self.words, {
              yPercent: 118,
              opacity: 0,
              rotation: 3,
              duration: 0.95,
              ease: 'expo.out',
              stagger: 0.04,
            });
          },
        });

        gsap.from('[data-ent-hero-fade]', {
          opacity: 0,
          y: 20,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.1,
          delay: 0.45,
        });

        // Le liseré cyan du bas se dessine une fois le titre posé.
        gsap.from('.ent-hero-rule', {
          scaleX: 0,
          transformOrigin: 'left center',
          duration: 1.2,
          ease: 'expo.out',
          delay: 0.6,
        });
      });
    },
    { scope: heroRef },
  );

  return (
    <section ref={heroRef} className="relative isolate overflow-hidden pb-20 pt-14 lg:pb-28 lg:pt-20">
      {/* ── Fond : rayons WebGL + grille d'ingénieur + halo cyan ── */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[#08090C]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.09) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 85% 70% at 40% 30%, #000 45%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 85% 70% at 40% 30%, #000 45%, transparent 100%)',
          }}
        />
        {/* Le shader ne tourne ni sur mobile ni en reduced-motion : la classe
            `motion-reduce:hidden` suffit ici, le fond dégradé tient tout seul. */}
        {!isMobile && (
          <div className="absolute inset-0 opacity-60 motion-reduce:hidden">
            <Suspense fallback={null}>
              <LightRays
                raysOrigin="top-center"
                raysColor="#22D3EE"
                raysSpeed={0.9}
                lightSpread={0.85}
                rayLength={1.35}
                followMouse
                mouseInfluence={0.08}
                noiseAmount={0.06}
                distortion={0.04}
              />
            </Suspense>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(34,211,238,0.16),transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#08090C]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          {/* ── Colonne gauche : la promesse ── */}
          <div className="flex flex-col items-start text-left">
            {/* Pas de pastille « disponible aujourd'hui » avec son point qui
                clignote : c'est le badge que porte toute page de SaaS générée,
                et il annonce une nouveauté là où la page doit annoncer un
                produit. Le titre commence directement. */}
            <h1 className="mb-7 text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.2rem]">
              <span className="ent-hero-line block text-white">{t('enterprise.hero.line1')}</span>
              <span className="ent-hero-line block text-slate-500">{t('enterprise.hero.line2')}</span>
              <span className="ent-hero-line block bg-gradient-to-r from-cyan-200 via-cyan-300 to-teal-200 bg-clip-text text-transparent">
                {t('enterprise.hero.line3')}
              </span>
            </h1>

            <div
              className="ent-hero-rule mb-7 h-px w-40 bg-gradient-to-r from-cyan-400/80 to-transparent"
              aria-hidden="true"
            />

            <p
              data-ent-hero-fade
              className="mb-10 max-w-xl text-base leading-relaxed text-slate-400 lg:text-lg"
            >
              {t('enterprise.hero.subtitle')}
            </p>

            <div data-ent-hero-fade className="flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row">
              <button
                ref={magneticDemo}
                onClick={onDemo}
                aria-label={t('enterprise.hero.ctaAria')}
                className="group relative flex items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-cyan-400 px-7 py-4 text-base font-bold text-[#04141A] shadow-[0_10px_40px_-10px_rgba(34,211,238,0.8)] transition-[box-shadow,background-color] duration-300 hover:bg-cyan-300 hover:shadow-[0_14px_48px_-8px_rgba(34,211,238,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090C]"
              >
                <span
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  aria-hidden="true"
                />
                <span className="relative">{t('enterprise.hero.cta')}</span>
                <ArrowRight size={18} className="relative transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </button>
              <a
                href="#tarifs"
                className="flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-7 py-4 text-base font-semibold text-white backdrop-blur-md transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {t('enterprise.hero.ctaSecondary')}
              </a>
            </div>

            <p data-ent-hero-fade className="mt-4 text-xs text-slate-600">
              {t('enterprise.hero.reassurance')}
            </p>
          </div>

          {/* ── Colonne droite : la pile de cartes qui tourne ── */}
          {/* `CardSwap` se place en `absolute bottom-0 right-0` et étale les
              cartes du dessous VERS LA DROITE (une par `cardDistance`). Sans
              marge, la dernière carte sortait de l'écran et on n'en voyait plus
              que ses barres cyan, lues comme un artefact. La marge droite rend
              la place que la pile réclame. */}
          <div
            className="relative hidden h-[26rem] w-full lg:mr-28 lg:block xl:mr-20"
            aria-hidden="true"
          >
            {/* Pas de `pauseOnHover` : la pile occupe tout le quart droit du
                hero, et `mouseenter` y arrête la rotation JUSQU'AU `mouseleave`.
                Un visiteur qui lit le hero avec la souris posée à droite — ou
                qui scrolle à la molette sans bouger le curseur — voit une pile
                définitivement figée. Ces cartes ne contiennent aucun lien, la
                mise en pause au survol n'apportait donc rien.

                `easing="linear"` (0,8 s) plutôt que l'élastique par défaut
                (~4,6 s) : au-delà de `delay`, deux timelines se chevauchent sur
                les mêmes éléments et se disputent leurs transforms. */}
            <CardSwap
              width={392}
              height={272}
              cardDistance={44}
              verticalDistance={54}
              delay={3800}
              skewAmount={5}
              easing="linear"
            >
              {HERO_SHOTS.map((tab, index) => (
                <Card key={tab.id} customClass="!border-0 !bg-transparent overflow-visible">
                  <AppShot
                    src={tab.image}
                    alt={t(tab.altKey)}
                    label={t(tab.labelKey)}
                    // La première carte de la pile est visible dès le premier
                    // paint du hero : la charger paresseusement la ferait
                    // apparaître en retard, au milieu de l'animation d'entrée.
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                </Card>
              ))}
            </CardSwap>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EnterpriseHero;
