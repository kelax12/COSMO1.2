import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/modules/auth/AuthContext';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence, useReducedMotion, useScroll, useMotionValueEvent } from 'framer-motion';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import LoginModal from '@/components/LoginModal';
import { useFaqSchema } from './landing/faq-schema';
import LandingFooter from './landing/LandingFooter';
import TrackSwitcher from './landing/TrackSwitcher';
import PersoTrack from './landing/PersoTrack';
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
      className={`min-h-[100dvh] text-white transition-colors duration-700 ${
        isEnterprise ? 'bg-[#08090C]' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      }`}
    >
      {/* Barre de progression de lecture (GSAP scrub) */}
      <div
        ref={progressRef}
        className={`fixed inset-x-0 top-0 z-[60] h-0.5 origin-left scale-x-0 transition-colors duration-500 ${
          isEnterprise ? 'bg-cyan-400' : 'bg-[rgb(var(--color-accent-solid))]'
        }`}
        aria-hidden="true"
      />
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        mode={loginMode}
        onSwitchMode={setLoginMode}
      />

      {/* ── Floating island navbar (style Linear / Arc / Raycast) ── */}
      <header className="sticky top-0 z-50 px-3 sm:px-4 pt-3 sm:pt-4">
        <motion.div
          initial={reduceMotion ? false : { y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`mx-auto max-w-5xl rounded-2xl transition-all duration-300 ${
            scrolled
              ? 'bg-slate-950/75 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]'
              : 'bg-white/[0.03] backdrop-blur-md border border-white/[0.06]'
          }`}
        >
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5">
            {/* Logo */}
            <button
              className="group flex items-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-xl pr-2"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label={t('nav.backToTop')}
            >
              <div className="relative">
                <div className="w-9 h-9 overflow-hidden rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[10deg]">
                  <img src="/logo-128.webp" alt="Logo Cosmo" width="36" height="36" className="w-full h-full object-contain bg-white/10" />
                </div>
                <div
                  className={`absolute inset-0 rounded-xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity ${
                    isEnterprise ? 'bg-cyan-400' : 'bg-[rgb(var(--color-accent-solid))]'
                  }`}
                  aria-hidden="true"
                />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                Cosmo
              </span>
            </button>

            {/* Sélecteur de parcours — le cœur de la navigation de cette page.
                Il remplace la nav d'ancres au centre, dont les cibles
                changeaient d'un track à l'autre. */}
            <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
              <TrackSwitcher track={track} onSelect={handleSelectTrack} className="w-[15.5rem]" />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <a
                href="/login"
                onClick={(e) => { e.preventDefault(); handleLoginClick(); }}
                className="hidden sm:block px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg"
              >
                {t('nav.login')}
              </a>
              <button
                onClick={handleRegisterClick}
                className={`group relative overflow-hidden px-4 py-2 lg:px-5 rounded-xl font-semibold transition-[box-shadow,color,background-color] duration-300 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  isEnterprise
                    ? 'bg-cyan-400 text-[#04141A] shadow-lg shadow-cyan-500/25 hover:bg-cyan-300 hover:shadow-cyan-400/50 focus-visible:ring-cyan-300'
                    : 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-blue-500/25 hover:shadow-blue-500/50 focus-visible:ring-blue-400'
                }`}
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700" aria-hidden="true" />
                <span className="relative lg:hidden">{t('nav.start')}</span>
                <span className="relative hidden lg:inline">{t('nav.startFree')}</span>
              </button>
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden inline-flex items-center justify-center w-11 h-11 text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg"
                aria-label={showMobileMenu ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={showMobileMenu}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showMobileMenu ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showMobileMenu && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden overflow-hidden border-t border-white/10"
              >
                <nav className="flex flex-col gap-1 px-3 py-3">
                  {/* Le sélecteur d'abord : sur mobile, c'est la seule façon de
                      changer de parcours une fois l'aiguillage dépassé. */}
                  <TrackSwitcher
                    track={track}
                    onSelect={(next) => {
                      handleSelectTrack(next);
                      setShowMobileMenu(false);
                    }}
                    className="mb-2"
                  />
                  {/* Le sommaire du parcours affiché — sur mobile la barre
                      d'ancres collante est masquée, ce menu la remplace. */}
                  {TRACK_ANCHORS[track].map(({ href, labelKey }) => (
                    <a
                      key={href}
                      href={href}
                      onClick={() => setShowMobileMenu(false)}
                      className="text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium transition-colors px-3 py-2.5 rounded-lg"
                    >
                      {t(labelKey)}
                    </a>
                  ))}
                  <a
                    href="/login"
                    onClick={(e) => { e.preventDefault(); handleLoginClick(); setShowMobileMenu(false); }}
                    className="text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium transition-colors px-3 py-2.5 rounded-lg text-left"
                  >
                    {t('nav.login')}
                  </a>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </header>

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
                isEnterprise ? 'bg-[#08090C]' : 'bg-slate-900'
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
              />
            </Suspense>
          ) : (
            <PersoTrack
              onDemo={handleDemo}
              onRegister={handleRegisterClick}
              onFeatureClick={handleFeatureClick}
            />
          )}
        </div>
      </main>

      <LandingFooter />
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
