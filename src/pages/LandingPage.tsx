import React, { useState } from 'react';
import { useAuth } from '../modules/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
} from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import LoginModal from '@/components/LoginModal';
import AppWindowShowcase from '../components/showcase/AppWindowShowcase';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useFaqSchema } from './landing/faq-schema';
import FeaturesSection from './landing/FeaturesSection';
import SolutionsSection from './landing/SolutionsSection';
import WhySection from './landing/WhySection';
import FaqSection from './landing/FaqSection';
import LandingFooter from './landing/LandingFooter';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginDemo } = useAuth();
  const reduceMotion = useReducedMotion();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Header en verre dépoli évolutif : transparent en haut, opacifié au scroll.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 12);
  });

  // Parallax léger du mockup hero au scroll.
  const mockupParallax = useTransform(scrollY, [0, 600], [0, -60]);

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

  useFaqSchema();
  // Sur viewport mobile, on affiche des showcases qui miment l'UI mobile
  // de l'app (swipe TaskCard, vue agenda liste, FAB, etc.) au lieu des
  // tableaux et grilles desktop — pour que ce que le visiteur voit dans
  // la landing soit cohérent avec ce qu'il aura sur son téléphone.
  const isMobile = useIsMobile();

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

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden scroll-smooth">
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
              ? 'bg-slate-950/75 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] monochrome:bg-black/90 monochrome:border-white/30'
              : 'bg-white/[0.03] backdrop-blur-md border border-white/[0.06]'
          }`}
        >
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5">
            {/* Logo */}
            <button
              className="group flex items-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-xl pr-2"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Retour en haut de la page"
            >
              <div className="relative">
                <div className="w-9 h-9 overflow-hidden rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[10deg]">
                  <img src="/logo.png" alt="Logo Cosmo" width="36" height="36" className="w-full h-full object-contain bg-white/10" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-violet-600 rounded-xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity" aria-hidden="true" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent monochrome:text-white">
                Cosmo
              </span>
            </button>

            {/* Nav centrale */}
            <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2" aria-label="Navigation principale">
              {[
                { href: '#features', label: 'Fonctionnalités' },
                { href: '#solutions', label: 'Solutions' },
                { href: '#faq', label: 'FAQ' },
                { href: '/guide', label: 'Guide' },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="group relative px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap"
                >
                  {label}
                  <span className="pointer-events-none absolute inset-x-3.5 bottom-1 h-px bg-gradient-to-r from-blue-400 to-violet-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                </a>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoginClick}
                className="hidden sm:block px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg"
              >
                Se connecter
              </button>
              <button
                onClick={handleRegisterClick}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-violet-600 text-white px-4 py-2 lg:px-5 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/50 hover:-translate-y-0.5 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 monochrome:bg-white monochrome:text-black"
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700" aria-hidden="true" />
                <span className="relative lg:hidden">Commencer</span>
                <span className="relative hidden lg:inline">Commencer gratuitement</span>
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
                <nav className="flex flex-col px-3 py-3">
                  {[
                    { href: '#features', label: 'Fonctionnalités' },
                    { href: '#solutions', label: 'Solutions' },
                    { href: '#faq', label: 'FAQ' },
                    { href: '/guide', label: 'Guide' },
                  ].map(({ href, label }) => (
                    <a
                      key={href}
                      href={href}
                      onClick={() => setShowMobileMenu(false)}
                      className="text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium transition-colors px-3 py-2.5 rounded-lg"
                    >
                      {label}
                    </a>
                  ))}
                  <button
                    onClick={() => { handleLoginClick(); setShowMobileMenu(false); }}
                    className="text-slate-300 hover:text-white hover:bg-white/[0.06] font-medium transition-colors px-3 py-2.5 rounded-lg text-left"
                  >
                    Se connecter
                  </button>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </header>

      {/* A11y: wrap entire content in <main> landmark — axe-core flagged
          162 nodes "not contained by landmarks" on this page. */}
      <main>
      <section className="relative pt-10 pb-20 lg:pt-16 lg:pb-28 overflow-hidden">
        {/* ── Fond ambiant : grille masquée + noise + aurores + halo conique ── */}
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          {/* Grille fine type Linear/Vercel, fondue */}
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse 80% 70% at 60% 35%, #000 50%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 60% 35%, #000 50%, transparent 100%)',
            }}
          />
          {/* Halo conique lumineux animé (rotation lente) */}
          <motion.div
            className="absolute left-1/2 top-[-10%] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full opacity-50"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(59,130,246,0.18), rgba(139,92,246,0.16), rgba(217,70,239,0.14), rgba(34,211,238,0.16), rgba(59,130,246,0.18))',
              filter: 'blur(90px)',
            }}
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={reduceMotion ? undefined : { duration: 40, repeat: Infinity, ease: 'linear' }}
          />
          {/* Aurores */}
          <motion.div
            className="absolute -top-24 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-600/25 via-violet-600/20 to-fuchsia-600/20 blur-[110px]"
            animate={reduceMotion ? undefined : { opacity: [0.55, 0.8, 0.55], scale: [1, 1.06, 1] }}
            transition={reduceMotion ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-10 -left-20 h-80 w-80 rounded-full bg-cyan-500/15 blur-[100px]"
            animate={reduceMotion ? undefined : { opacity: [0.4, 0.65, 0.4] }}
            transition={reduceMotion ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <motion.div
            className="absolute top-24 -right-16 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-[100px]"
            animate={reduceMotion ? undefined : { opacity: [0.4, 0.7, 0.4] }}
            transition={reduceMotion ? undefined : { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
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
              <motion.h1
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.05 }}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 leading-[1.05]"
              >
                <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent monochrome:text-white">
                  Toute votre productivité,
                </span>
                <br />
                {/* Gradient animé sur la 2e ligne (background-position) */}
                <motion.span
                  className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent monochrome:text-white"
                  style={{ backgroundSize: '200% auto' }}
                  animate={reduceMotion ? undefined : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                  transition={reduceMotion ? undefined : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                >
                  réunie dans une seule app.
                </motion.span>
              </motion.h1>

              <motion.p
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.8 }}
                className="text-lg lg:text-xl text-slate-400 mb-12 lg:mb-16 max-w-xl leading-relaxed"
              >
                Tâches, habitudes, agenda avec time-blocking et méthode OKR —
                connectés dans un seul outil pensé pour vous faire avancer. Sans friction.
              </motion.p>

              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-3.5 w-full sm:w-auto"
              >
                {/* CTA principal : démo sans inscription (friction zéro) */}
                <button
                  onClick={() => {
                    loginDemo();
                    setTimeout(() => navigate('/dashboard'), 0);
                  }}
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-[0_8px_30px_-6px_rgba(79,70,229,0.6)] hover:shadow-[0_12px_40px_-6px_rgba(79,70,229,0.75)] hover:-translate-y-0.5 flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 monochrome:bg-white monochrome:text-black"
                  aria-label="Essayer la démo sans inscription"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700" aria-hidden="true" />
                  <span className="relative">Essayer la démo gratuite</span>
                  <ArrowRight size={18} className="relative group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </button>
                <button
                  onClick={handleRegisterClick}
                  className="group bg-white/5 hover:bg-white/10 text-white border border-white/15 px-8 py-4 rounded-2xl font-semibold text-base backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 monochrome:border-white/40"
                >
                  Créer un compte gratuit
                </button>
              </motion.div>

              {/* Micro-preuve sous les CTAs */}
              <motion.p
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="mt-4 text-xs text-slate-500"
              >
                Démo pré-remplie de 100 tâches · aucune installation · prêt en 1 clic
              </motion.p>
            </div>

            {/* ── Colonne droite : mockup produit ── */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full"
              style={{ perspective: 1400, y: reduceMotion ? undefined : mockupParallax }}
            >
              {/* Glow derrière le frame */}
              <div className="absolute -inset-6 bg-gradient-to-tr from-blue-600/25 via-violet-600/20 to-fuchsia-500/20 rounded-[2rem] blur-3xl" aria-hidden="true" />

              <motion.div
                onPointerMove={isMobile || reduceMotion ? undefined : handleMockupPointer}
                onPointerLeave={isMobile || reduceMotion ? undefined : resetMockupPointer}
                style={isMobile || reduceMotion ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
                animate={isMobile || reduceMotion ? undefined : { y: [0, -10, 0] }}
                transition={isMobile || reduceMotion ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="relative max-w-[34rem] mx-auto lg:max-w-none lg:ml-auto"
              >
                <AppWindowShowcase compact={isMobile} />
              </motion.div>
            </motion.div>

          </div>
        </div>
      </section>

      <FeaturesSection isMobile={isMobile} handleFeatureClick={handleFeatureClick} />

      <SolutionsSection handleFeatureClick={handleFeatureClick} />

      <WhySection />

      {/* ── Section FAQ ── */}
      <FaqSection />

      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-12 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 to-purple-500/5 z-0"></div>
            
            <div className="relative z-10">
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  Prêt à révolutionner
                </span>
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  votre productivité ?
                </span>
              </h2>
              <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
                Rejoignez des milliers de professionnels qui ont déjà transformé leur façon de travailler avec Cosmo
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => {
                    loginDemo();
                    setTimeout(() => navigate('/dashboard'), 0);
                  }}
                  className="group bg-slate-200 hover:bg-slate-300 text-slate-900 px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform flex items-center justify-center gap-3"
                >
                  Essayer la démo
                </button>
                <button
                  onClick={handleRegisterClick}
                  className="group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-bold text-base transition-all duration-300 shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 transform flex items-center justify-center"
                >
                  Commencer maintenant
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      </main>

      <LandingFooter />
    </div>
  );
};

export default LandingPage;
