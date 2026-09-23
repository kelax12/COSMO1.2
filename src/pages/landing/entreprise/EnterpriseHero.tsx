import React, { Suspense, lazy, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import HeroStack from './HeroStack';
import { HERO_SHOTS } from './data';
import { ENTERPRISE_FREE_OFFER } from './free-offer';
import { useT } from '@/i18n/useT';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useMagnetic } from '@/lib/hooks/use-magnetic';

// `LightRays` embarque `ogl` (chunk `vendor-ogl`, cf. vite.config.ts). Il est
// chargé à la demande pour que le track perso, qui ne l'affiche jamais, ne
// paie pas le runtime WebGL.
const LightRays = lazy(() => import('@/components/reactbits/LightRays'));

interface EnterpriseHeroProps {
  onDemo: () => void;
  /** Rangée des CTA, remontée au header (cf. `PersoTrack.onHeroCtaRef`). */
  onCtaRef?: (el: HTMLElement | null) => void;
}

/** Rend les segments `<hl>…</hl>` en encre appuyée — sans surligneur. */
const avecAppui = (texte: string) =>
  texte.split(/(<hl>.*?<\/hl>)/g).map((part, i) => {
    const m = part.match(/^<hl>(.*)<\/hl>$/);
    return m ? (
      <span key={i} className="font-medium text-ent-lune">
        {m[1]}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    );
  });

/**
 * Hero du track entreprise — refait le 2026-09-23 (maquettes 123 à 127,
 * `Documents/COSMO-maquettes/landing-entreprise-hero.html`). L'ancienne
 * version est archivée : `docs/archive/LANDING-HERO-ENTREPRISE-2026-09-23.md`.
 *
 * 🔴 UN SEUL AXE, CELUI DE LA LUMIÈRE. Le faisceau (`LightRays`, origine
 * `top-center`) tombait entre deux colonnes, sur du vide : la signature de la
 * page n'éclairait rien. Le titre, le CTA et la pile sont maintenant centrés
 * SOUS l'origine, et la pile remonte vers elle (`HeroStack`). Ne pas revenir à
 * une mise en page en deux colonnes sans déplacer l'origine du faisceau.
 *
 * ❌ Plus de titre en trois couleurs (blanc / gris / dégradé cyan), plus de
 * dégradé sur le texte, plus de liseré, plus de lueur sur le CTA : le cyan n'a
 * que deux rôles, la lumière et le bouton. C'était le gabarit des landings
 * générées, et deux sources de lumière qui se disputaient la page.
 */
const EnterpriseHero: React.FC<EnterpriseHeroProps> = ({ onDemo, onCtaRef }) => {
  const { t } = useT('landing');
  const isMobile = useIsMobile();
  const heroRef = useRef<HTMLElement>(null);
  const magneticDemo = useMagnetic<HTMLButtonElement>(0.16);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Les deux lignes du titre montent mot par mot depuis leur masque.
        // Plus de dégradé sur le texte, donc plus de classes à recopier sur
        // chaque mot : c'était le correctif qu'imposait `bg-clip-text`.
        SplitText.create('.ent-hero-line', {
          type: 'lines,words',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) => {
            // Une sérif italique DÉBORDE de sa boîte (l'attaque du « O », la
            // traîne du point final), et un masque en `overflow: clip` la
            // couperait : on élargit chaque masque sans rien déplacer.
            self.masks.forEach((mask) => {
              const el = mask as HTMLElement;
              el.style.padding = '0 0.14em 0.16em';
              el.style.margin = '0 -0.14em -0.16em';
            });
            return gsap.from(self.words, {
              yPercent: 118,
              opacity: 0,
              rotation: 3,
              duration: 0.95,
              ease: 'expo.out',
              stagger: 0.05,
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
      });
    },
    { scope: heroRef },
  );

  return (
    <section ref={heroRef} className="relative isolate overflow-hidden pb-16 pt-14 lg:pb-24 lg:pt-20">
      {/* ── Fond : rayons WebGL + grille d'ingénieur + halo cyan ── */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-ent-nuit" />
        <div
          className="absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            // Centrée sur l'axe du faisceau, comme tout le reste.
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 20%, #000 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 20%, #000 30%, transparent 100%)',
          }}
        />
        {/* Le shader ne tourne ni sur mobile ni en reduced-motion : la classe
            `motion-reduce:hidden` suffit ici, le halo fixe tient tout seul.
            Réglages INCHANGÉS, palier adaptatif C-68 compris : c'est la mise en
            page qui a bougé, pas la lumière. */}
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
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ent-nuit" />
      </div>

      {/* ── La promesse, centrée sous l'origine du faisceau ── */}
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-[3.15rem] font-normal leading-[0.98] tracking-[-0.012em] text-ent-lune sm:text-7xl lg:text-[5.75rem]">
          <span className="ent-hero-line block">{t('enterprise.hero.line1')}</span>
          <span className="ent-hero-line block italic">{t('enterprise.hero.line2')}</span>
        </h1>

        <p data-ent-hero-fade className="mx-auto mt-6 max-w-[38rem] text-base leading-relaxed text-ent-brume lg:text-lg">
          {avecAppui(t('enterprise.hero.subtitle'))}
        </p>

        <div
          ref={onCtaRef}
          data-ent-hero-fade
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-7"
        >
          <button
            ref={magneticDemo}
            onClick={onDemo}
            aria-label={t('enterprise.hero.ctaAria')}
            className="group flex w-full items-center justify-center gap-2.5 rounded-[11px] bg-ent-faisceau px-6 py-4 text-base font-semibold text-[#04141A] transition-colors duration-300 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ent-nuit sm:w-auto"
          >
            {t('enterprise.hero.cta')}
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </button>
          <a
            href="#tarifs"
            className="inline-flex min-h-11 items-center rounded-md px-1 text-base font-medium text-ent-lune underline decoration-ent-lune/30 underline-offset-[6px] transition-colors hover:decoration-ent-lune/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {t('enterprise.hero.ctaSecondary')}
          </a>
        </div>

        {/* « Jusqu'à 5 membres gratuitement » deviendrait faux pendant
            l'offre de lancement : il n'y a aucun plafond tant que rien
            n'est facturé.
            Brume (#8B96A8, 6,5:1) : c'était `slate-600`, 2,6:1 sur ce fond. */}
        <p data-ent-hero-fade className="mt-4 font-data text-xs text-ent-brume">
          {t(
            ENTERPRISE_FREE_OFFER
              ? 'enterprise.hero.reassuranceFree'
              : 'enterprise.hero.reassurance',
          )}
        </p>
      </div>

      {/* ── La pile, DANS le cône : elle remonte vers la lumière ── */}
      <div data-ent-hero-fade className="mx-auto mt-10 w-full max-w-[55rem] px-4 sm:px-6 lg:mt-14">
        <HeroStack shots={HERO_SHOTS} simple={isMobile} />
      </div>
    </section>
  );
};

export default EnterpriseHero;
