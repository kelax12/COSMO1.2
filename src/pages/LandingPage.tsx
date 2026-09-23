import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence, useReducedMotion, useScroll, useMotionValueEvent } from 'framer-motion';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import LoginModal from '@/components/LoginModal';
import { useFaqSchema } from './landing/faq-schema';
import LandingFooter from './landing/LandingFooter';
import TrackSwitcher from './landing/TrackSwitcher';
import TrackAnchors from './landing/TrackAnchors';
import PersoTrack from './landing/PersoTrack';
import { useActiveAnchor } from './landing/use-active-anchor';
import { useLandingTrack, type LandingTrack } from './landing/use-landing-track';
import { TRACK_ANCHORS } from './landing/anchors';
import { useT } from '@/i18n/useT';
import { useRootSeoMeta } from '@/lib/useSeoMeta';
import { buildOrgLink } from '@/components/organization/deep-link.helpers';
import { applyTheme, THEME_STORAGE_KEY } from '@/lib/theme';

// Le track entreprise est un parcours entier (10 sections, un shader WebGL) que
// la moitié des visiteurs ne verra jamais. Il est chargé à la demande, à la
// bascule — le track perso, lui, reste dans le chunk de la landing puisqu'il
// est servi par défaut sur `/`.
const EnterpriseTrack = lazy(() => import('./landing/entreprise/EnterpriseTrack'));

/**
 * La landing publique — un header, un aiguillage, et deux parcours exclusifs.
 *
 * Ce composant ne contient plus le contenu marketing : il orchestre. Le
 * contenu vit dans `landing/PersoTrack` et `landing/entreprise/EnterpriseTrack`,
 * choisis par le sélecteur du header (`TrackSwitcher`). Le parcours affiché
 * est dérivé de l'URL, pas d'un état local : cf. `useLandingTrack`.
 */
const LandingPage: React.FC = () => {
  const { t } = useT('landing');
  useRootSeoMeta();
  const navigate = useNavigate();
  const { loginDemo } = useAuth();
  const reduceMotion = useReducedMotion();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { track, selectTrack, transitionKey } = useLandingTrack();
  const isEnterprise = track === 'entreprise';

  // Header en verre dépoli évolutif : transparent en haut, opacifié au scroll.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 12);
  });

  // Hauteur RÉELLE du header, exposée en `--landing-header-h`. La capsule de
  // sommaire se cale dessus au lieu d'un `top-[4.5rem]` en dur, qui la faisait
  // passer 9,6 px sous l'îlot (mesuré le 2026-09-23). Elle sert aussi de ligne
  // de lecture au suivi de section.
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(80);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderH(Math.round(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const anchorIds = TRACK_ANCHORS[track]
    .filter(({ href }) => href.startsWith('#'))
    .map(({ href }) => href.slice(1));
  const activeAnchor = useActiveAnchor(anchorIds, headerH + 48);

  // Le CTA du header suit le visiteur : tant que les boutons du hero sont à
  // l'écran, il propose l'inscription ; une fois le hero dépassé, il propose
  // la démo, qui est l'action SANS friction et qui n'était plus offerte nulle
  // part avant la CTA de fin. Callback ref : le hero entreprise est lazy.
  const [heroCtaEl, setHeroCtaEl] = useState<HTMLElement | null>(null);
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    if (!heroCtaEl) {
      setPastHero(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: `-${headerH}px 0px 0px 0px` },
    );
    io.observe(heroCtaEl);
    return () => io.disconnect();
  }, [heroCtaEl, headerH]);

  // Menu mobile : Échap, clic à l'extérieur et passage en `md` le ferment ; le
  // focus y entre à l'ouverture et revient au bouton à la fermeture clavier.
  const burgerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showMobileMenu) return;
    const frame = requestAnimationFrame(() => {
      mobileMenuRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowMobileMenu(false);
      burgerRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setShowMobileMenu(false);
    };
    const mq = window.matchMedia('(min-width: 768px)');
    const onWide = () => {
      if (mq.matches) setShowMobileMenu(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    mq.addEventListener('change', onWide);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      mq.removeEventListener('change', onWide);
    };
  }, [showMobileMenu]);

  // Effets « page » : barre de progression de scroll et reveal du footer. Tout
  // ce qui appartient à un parcours vit dans le composant de ce parcours.
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Refresh de sécurité une fois la page complètement chargée (fonts,
      // images, chunk Recharts) : si un refresh précoce a mesuré la page
      // avant sa mise en page finale, les pins restent figés en état
      // « reverted » (sections qui défilent les unes sur les autres).
      const healRefresh = () => ScrollTrigger.refresh();
      if (document.readyState === 'complete') {
        gsap.delayedCall(0.2, healRefresh);
      } else {
        window.addEventListener('load', () => gsap.delayedCall(0.2, healRefresh), { once: true });
      }

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Barre de progression de lecture (scrub sur toute la page).
        if (progressRef.current) {
          gsap.to(progressRef.current, {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: document.documentElement,
              start: 0,
              end: 'max',
              scrub: 0.4,
            },
          });
        }

        // Footer : montée douce.
        gsap.from('footer > div', {
          y: 28,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: 'footer', start: 'top 95%', once: true },
        });
      });
    },
    { scope: rootRef },
  );

  // Changer de track remplace tout le contenu sous l'aiguillage : les hauteurs
  // mesurées par les ScrollTrigger du parcours précédent sont caduques. Sans ce
  // refresh, les sections épinglées du track entreprise restent « reverted » et
  // défilent les unes sur les autres.
  useEffect(() => {
    const call = gsap.delayedCall(0.35, () => ScrollTrigger.refresh());
    return () => {
      call.kill();
    };
  }, [track]);

  useFaqSchema();

  // La démo entreprise ouvre toujours en noir (OLED), quel que soit le thème
  // choisi par le visiteur sur la landing : c'est la DA du track entreprise
  // (graphite `#08090C`, cyan, or) qui se poursuit dans le produit, pas une
  // préférence système qui pourrait rouvrir sur `light`.
  const forceNoirTheme = () => {
    applyTheme(document.documentElement, 'noir');
    localStorage.setItem(THEME_STORAGE_KEY, 'noir');
  };

  const handleDemo = () => {
    if (isEnterprise) forceNoirTheme();
    loginDemo();
    setTimeout(() => navigate(isEnterprise ? '/entreprise' : '/dashboard'), 0);
  };

  // Un clic sur « Voir ses tâches / son agenda / sa contribution » depuis la
  // pyramide de démonstration doit retomber sur EXACTEMENT le même écran que
  // le même clic depuis la vraie pyramide de l'espace entreprise : le
  // deep-link `?member=&memberTab=` que `PyramidTab` sait déjà lire (cf.
  // `src/components/organization/deep-link.helpers.ts`).
  const handlePyramidMemberDemo = (demoUserId: string, tab: 'tasks' | 'agenda' | 'contribution') => {
    forceNoirTheme();
    loginDemo();
    setTimeout(
      () => navigate(buildOrgLink('pyramid', { member: demoUserId }, { memberTab: tab })),
      0,
    );
  };

  const handleFeatureClick = (path: string) => {
    loginDemo();
    navigate(path);
  };

  const handleLoginClick = () => {
    setLoginMode('login');
    setShowLoginModal(true);
  };

  const handleRegisterClick = () => {
    setLoginMode('register');
    setShowLoginModal(true);
  };

  const handleSelectTrack = (next: LandingTrack) => {
    selectTrack(next);
    // On repart sous l'aiguillage : le visiteur voit immédiatement le contenu
    // qu'il vient de demander, sans avoir à scroller lui-même.
    requestAnimationFrame(() => {
      document.getElementById('track')?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  };

  // Pas d'overflow-hidden ni scroll-smooth sur la racine : casse le pinning
  // ScrollTrigger et les ancres au milieu des sections pinnées. Chaque
  // section gère son propre overflow.
  return (
    <div
      ref={rootRef}
      className={`min-h-[100dvh] transition-colors duration-700 ${
        isEnterprise ? 'bg-[#08090C] text-white' : 'bg-white text-slate-900'
      }`}
      style={{ ['--landing-header-h' as string]: `${headerH}px` }}
    >
      {/* Barre de progression de lecture (GSAP scrub) */}
      <div
        ref={progressRef}
        className={`fixed inset-x-0 top-0 z-[60] h-0.5 origin-left scale-x-0 transition-colors duration-500 ${
          isEnterprise ? 'bg-cyan-400' : 'bg-blue-600'
        }`}
        aria-hidden="true"
      />
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        mode={loginMode}
        onSwitchMode={setLoginMode}
      />

      {/* ── Floating island navbar (style Linear / Arc / Raycast) ──
          UNE seule rangée : logo, sélecteur de parcours, sommaire, actions.
          Le sommaire vivait dans une seconde capsule collée dessous, qui
          passait sous l'îlot au scroll (cf. `TrackAnchors`). */}
      <header ref={headerRef} className="sticky top-0 z-50 px-3 sm:px-4 pt-3 sm:pt-4">
        <motion.div
          initial={reduceMotion ? false : { y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`mx-auto max-w-6xl rounded-2xl transition-all duration-300 ${
            scrolled
              ? isEnterprise
                ? 'bg-slate-950/75 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]'
                : 'bg-white/85 backdrop-blur-2xl border border-slate-900/10 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.35)]'
              : isEnterprise
                ? 'bg-white/[0.03] backdrop-blur-md border border-white/[0.06]'
                : 'bg-white/60 backdrop-blur-md border border-slate-900/[0.06]'
          }`}
        >
          <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5">
            {/* Logo. Le halo `blur-lg` et le mot en dégradé sont partis avec
                la DA blanche (« le mouvement par le trait, jamais par la
                lumière », cf. `landing/CLAUDE.md`) : le survol dessine un
                filet sous le mot. */}
            <button
              /* `min-h-touch` : la cible faisait 116 x 36 px (C-80). Elle ne
                 change PAS la hauteur de l'en-tête, le CTA « Commencer » de la
                 même rangée étant déjà à 44 px. */
              className={`group flex shrink-0 items-center gap-2.5 min-h-touch cursor-pointer focus-visible:outline-none focus-visible:ring-2 rounded-xl pr-2 ${
                isEnterprise ? 'focus-visible:ring-cyan-300' : 'focus-visible:ring-blue-500'
              }`}
              onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })}
              aria-label={t('nav.backToTop')}
            >
              <div className="w-9 h-9 overflow-hidden rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[10deg] motion-reduce:transition-none">
                <img src="/logo-128.webp" alt="Logo Cosmo" width="36" height="36" className="w-full h-full object-contain bg-white/10" />
              </div>
              <span
                className={`relative text-lg font-bold tracking-[-0.02em] ${
                  isEnterprise ? 'text-white' : 'text-slate-900'
                }`}
              >
                Cosmo
                <span
                  className={`absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none ${
                    isEnterprise ? 'bg-cyan-300' : 'bg-blue-600'
                  }`}
                  aria-hidden="true"
                />
              </span>
            </button>

            {/* Sélecteur de parcours — la garantie de ne jamais rester coincé
                dans un parcours. Dans le flux, après le logo, pour laisser le
                centre au sommaire. */}
            <TrackSwitcher
              track={track}
              onSelect={handleSelectTrack}
              className="hidden md:flex w-[13.5rem] shrink-0"
            />

            {/* Sommaire du parcours perso, dans la rangée dès `lg`. Les sept
                ancres entreprise n'y tiennent pas (mesuré à 1440 px : « Équipes »
                mordait sur le sélecteur) : elles vivent dans la capsule collée
                sous le header, plus bas. */}
            {!isEnterprise && (
              <TrackAnchors
                track={track}
                label={t('enterprise.gateway.perso.title')}
                active={activeAnchor}
                variant="inline"
                className="hidden min-w-0 flex-1 justify-center lg:flex"
              />
            )}

            {/* Actions */}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <a
                href="/login"
                onClick={(e) => { e.preventDefault(); handleLoginClick(); }}
                className={`hidden sm:block px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 rounded-lg ${
                  isEnterprise
                    ? 'text-slate-300 hover:text-white focus-visible:ring-cyan-300'
                    : 'text-slate-600 hover:text-slate-900 focus-visible:ring-blue-500'
                }`}
              >
                {t('nav.login')}
              </a>
              <button
                onClick={pastHero ? handleDemo : handleRegisterClick}
                /* `min-h-touch` (44 px) et pas `py-3` : la hauteur de la CIBLE
                   monte au plancher WCAG 2.5.5 sans que le dessin bouge, le
                   texte restant centré par `inline-flex items-center`. Mesuré
                   le 2026-09-14 contre la production, WebKit / iPhone 12 :
                   115 x 36 px, soit 8 px sous le plancher, pour le CTA le plus
                   visible du produit, JUSTE A COTE d'un bouton de menu déjà en
                   `w-11 h-11`. La cible tactile avait été traitée pour le menu
                   et pas pour lui (C-80). */
                className={`group relative inline-flex items-center justify-center overflow-hidden px-4 py-2 min-h-touch xl:px-5 rounded-xl font-semibold transition-[box-shadow,color,background-color] duration-300 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isEnterprise
                    ? 'bg-cyan-400 text-[#04141A] shadow-lg shadow-cyan-500/25 hover:bg-cyan-300 hover:shadow-cyan-400/50 focus-visible:ring-cyan-300 focus-visible:ring-offset-slate-900'
                    : 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:shadow-blue-600/40 focus-visible:ring-blue-500 focus-visible:ring-offset-white'
                }`}
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700" aria-hidden="true" />
                {/* Les deux libellés occupent la MÊME cellule de grille : la
                    largeur est réservée par le plus long, la barre ne saute
                    pas à la bascule. Le fondu ne porte que sur l'opacité. */}
                <span className="relative grid">
                  <span
                    aria-hidden={pastHero}
                    className={`[grid-area:1/1] text-center transition-opacity duration-300 motion-reduce:transition-none ${pastHero ? 'opacity-0' : 'opacity-100'}`}
                  >
                    <span className="xl:hidden">{t('nav.start')}</span>
                    <span className="hidden xl:inline">{t('nav.startFree')}</span>
                  </span>
                  <span
                    aria-hidden={!pastHero}
                    className={`[grid-area:1/1] text-center transition-opacity duration-300 motion-reduce:transition-none ${pastHero ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {t('nav.demo')}
                  </span>
                </span>
              </button>
              <button
                ref={burgerRef}
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className={`md:hidden inline-flex items-center justify-center w-11 h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 rounded-lg ${
                  isEnterprise
                    ? 'text-slate-300 hover:text-white focus-visible:ring-cyan-300'
                    : 'text-slate-600 hover:text-slate-900 focus-visible:ring-blue-500'
                }`}
                aria-label={showMobileMenu ? t('nav.closeMenu') : t('nav.openMenu')}
                aria-expanded={showMobileMenu}
                aria-controls="landing-mobile-menu"
              >
                {/* Trois traits qui se croisent : l'état final est posé par le
                    CSS, seule la transition disparaît en mouvement réduit. */}
                <span className="relative block h-4 w-5" aria-hidden="true">
                  <span className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-300 motion-reduce:transition-none ${showMobileMenu ? 'translate-y-[7px] rotate-45' : ''}`} />
                  <span className={`absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-current transition-opacity duration-200 motion-reduce:transition-none ${showMobileMenu ? 'opacity-0' : ''}`} />
                  <span className={`absolute left-0 top-[14px] h-0.5 w-5 rounded-full bg-current transition-transform duration-300 motion-reduce:transition-none ${showMobileMenu ? '-translate-y-[7px] -rotate-45' : ''}`} />
                </span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showMobileMenu && (
              <motion.div
                id="landing-mobile-menu"
                ref={mobileMenuRef}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={`md:hidden overflow-hidden border-t ${
                  isEnterprise ? 'border-white/10' : 'border-slate-900/10'
                }`}
              >
                <nav className="flex flex-col gap-1 px-3 py-3">
                  {/* Le sélecteur d'abord : une fois la rangée du haut de page
                      dépassée, c'est la seule façon de changer de parcours. */}
                  <TrackSwitcher
                    track={track}
                    onSelect={(next) => {
                      handleSelectTrack(next);
                      setShowMobileMenu(false);
                    }}
                    size="touch"
                    className="mb-2"
                  />
                  {/* Le sommaire du parcours affiché — sous `lg` il n'est pas
                      dans la rangée du header, ce menu le remplace. */}
                  {TRACK_ANCHORS[track].map(({ href, labelKey }) => (
                    <a
                      key={href}
                      href={href}
                      onClick={() => setShowMobileMenu(false)}
                      aria-current={href === `#${activeAnchor}` ? 'location' : undefined}
                      className={`font-medium transition-colors px-3 py-2.5 rounded-lg ${
                        isEnterprise
                          ? 'text-slate-300 hover:text-white hover:bg-white/[0.06] aria-[current=location]:text-white aria-[current=location]:bg-white/[0.06]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-900/[0.04] aria-[current=location]:text-slate-900 aria-[current=location]:bg-slate-900/[0.04]'
                      }`}
                    >
                      {t(labelKey)}
                    </a>
                  ))}
                  <a
                    href="/login"
                    onClick={(e) => { e.preventDefault(); handleLoginClick(); setShowMobileMenu(false); }}
                    className={`mt-2 flex min-h-touch items-center justify-center rounded-xl border font-semibold transition-colors ${
                      isEnterprise
                        ? 'border-white/15 text-white hover:bg-white/[0.06]'
                        : 'border-slate-300 text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {t('nav.login')}
                  </a>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </header>

      {/* Sur mobile, le sélecteur de parcours était caché dans le burger : un
          visiteur de `/` ne pouvait pas savoir que l'offre Entreprise existe.
          Cette rangée est dans le FLUX, pas dans le header collant : elle
          défile avec la page au lieu de le faire changer de hauteur, ce qui
          ferait sauter le contenu au premier scroll. */}
      <div className="md:hidden px-3 pt-2">
        <TrackSwitcher track={track} onSelect={handleSelectTrack} size="touch" />
      </div>

      {/* Entreprise : sept ancres ne tiennent pas dans la rangée, elles se
          collent SOUS le header, calées sur sa hauteur mesurée. */}
      {isEnterprise && (
        <TrackAnchors
          track={track}
          label={t('enterprise.gateway.entreprise.title')}
          active={activeAnchor}
          variant="bar"
          className="hidden lg:flex"
        />
      )}

      {/* A11y: wrap entire content in <main> landmark — axe-core flagged
          162 nodes "not contained by landmarks" on this page. */}
      <main>
        {/* Le parcours choisi. */}
        <div id="track" className="relative scroll-mt-20">
          {/* Voile de transition : couvre la bascule d'un parcours à l'autre.
              Il n'anime QUE l'opacité — un voile porté par un transform
              resterait à l'écran en `prefers-reduced-motion`. */}
          <AnimatePresence>
            <motion.div
              key={transitionKey}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className={`pointer-events-none absolute inset-0 z-40 ${
                isEnterprise ? 'bg-[#08090C]' : 'bg-white'
              }`}
              aria-hidden="true"
            />
          </AnimatePresence>

          {isEnterprise ? (
            <Suspense fallback={<TrackFallback />}>
              <EnterpriseTrack
                onDemo={handleDemo}
                onMemberDemo={handlePyramidMemberDemo}
                onRegister={handleRegisterClick}
                onHeroCtaRef={setHeroCtaEl}
              />
            </Suspense>
          ) : (
            <PersoTrack
              onDemo={handleDemo}
              onRegister={handleRegisterClick}
              onFeatureClick={handleFeatureClick}
              onHeroCtaRef={setHeroCtaEl}
            />
          )}
        </div>
      </main>

      <LandingFooter track={track} />
    </div>
  );
};

/**
 * Réserve la hauteur d'un écran pendant le chargement du chunk entreprise.
 *
 * Sans réserve, la page se replie sur la hauteur du header et le navigateur
 * remonte le scroll — le visiteur qui vient de cliquer « Entreprise » se
 * retrouverait projeté en haut, puis en bas, à l'arrivée du chunk.
 */
const TrackFallback: React.FC = () => (
  <div className="min-h-[100dvh] bg-[#08090C]" aria-hidden="true" />
);

export default LandingPage;
