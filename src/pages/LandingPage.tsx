import React, { useState, Suspense, lazy } from 'react';
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
import {
  CheckCircle,
  Calendar,
  Target,
  Repeat,
  ArrowRight,
  BarChart2,
  ChevronDown,
  Star
} from 'lucide-react';
import LoginModal from '@/components/LoginModal';
import AppWindowShowcase from '../components/showcase/AppWindowShowcase';
import TaskTableShowcase from '../components/showcase/TaskTableShowcase';
import AgendaShowcase from '../components/showcase/AgendaShowcase';
import OKRCardShowcase from '../components/showcase/OKRCardShowcase';
import HabitHeatmapShowcase from '../components/showcase/HabitHeatmapShowcase';
// Audit perf 2026-05-29 — StatsShowcase pulls Recharts (≈ 320 kB). Landing
// page should never block on it: lazy-load with a lightweight skeleton so
// the page renders instantly and the chart streams in once Recharts arrives.
const StatsShowcase = lazy(() => import('../components/showcase/StatsShowcase'));
const ShowcaseSkeleton = () => (
  <div className="w-full rounded-2xl bg-slate-800/80 border border-white/10 shadow-2xl p-5 h-[340px] animate-pulse" />
);
import {
  TaskCardMobileShowcase,
  AgendaMobileShowcase,
  HabitMobileShowcase,
  OKRMobileShowcase,
  StatsMobileShowcase,
} from '../components/showcase/MobileShowcases';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { USE_CASES, ENTRY_OFFSETS, FAQ_ITEMS } from './landing/data';
import { useFaqSchema } from './landing/faq-schema';

// ── FAQ item accordion ────────────────────────────────────────────────────
const FaqItem: React.FC<{ question: string; answer: string; index: number }> = ({ question, answer, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/8 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-white group-hover:text-blue-200 transition-colors leading-snug">
          {question}
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-slate-400 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={`faq-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm text-slate-400 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], ['7deg', '-7deg']), { stiffness: 150, damping: 18 });
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], ['-9deg', '9deg']), { stiffness: 150, damping: 18 });

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
              {/* Badge d'annonce */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="group mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-300 backdrop-blur-md monochrome:border-white/30"
              >
                <span className="relative flex h-2 w-2">
                  {!reduceMotion && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-medium text-white">100% gratuit</span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span className="hidden sm:inline">sans carte bancaire, sans inscription</span>
                <span className="sm:hidden">sans inscription</span>
              </motion.div>

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
                className="text-lg lg:text-xl text-slate-400 mb-8 max-w-xl leading-relaxed"
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

              {/* Barre de social proof */}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="mt-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-4"
              >
                <div className="flex -space-x-2.5" aria-hidden="true">
                  {['from-blue-400 to-blue-600', 'from-violet-400 to-violet-600', 'from-emerald-400 to-emerald-600', 'from-amber-400 to-amber-600', 'from-fuchsia-400 to-fuchsia-600'].map((g, i) => (
                    <span key={i} className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} ring-2 ring-slate-900`} />
                  ))}
                </div>
                <div className="flex flex-col items-center sm:items-start">
                  <div className="flex items-center gap-0.5" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">4,9/5</span> · rejoint par des milliers d'utilisateurs
                  </span>
                </div>
              </motion.div>
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

      <section id="features" className="py-24 overflow-hidden">
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
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
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

          <div className="space-y-36">

            {/* ── Section 1 : Tâches ── */}
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              <motion.div
                className="flex-1 space-y-6 px-4 lg:px-0"
                initial={{ opacity: 0, x: -60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl shadow-lg shadow-blue-500/30">
                  <CheckCircle size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Gestion de tâches<br /><span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">nouvelle génération</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">Centralisez toutes vos tâches avec priorités, catégories colorées et deadlines. Filtrez en un clic pour vous concentrer sur l'essentiel.</p>
                <div className="space-y-3">
                  {['Filtrez par priorité, catégorie, deadline en un clic', "Ajoutez des catégories pour visualiser votre travail en un coup d'œil", 'Créez des listes de tâches pour mieux vous organiser', 'Partagez vos tâches en équipe'].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/tasks')} className="group bg-gradient-to-r from-blue-600 to-cyan-600 hover:shadow-lg hover:shadow-blue-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Essayer les tâches <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="flex-1 w-full px-4 lg:px-0" style={{ perspective: 1200 }}>
                <motion.div
                  initial={{ rotateY: 48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <TaskCardMobileShowcase /> : <TaskTableShowcase />}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Section 2 : Agenda ── */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-10 lg:gap-16">
              <motion.div
                className="space-y-6 px-4 lg:px-0"
                style={{ flex: '0 1 45%' }}
                initial={{ opacity: 0, x: 60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-red-500 to-rose-500 rounded-2xl shadow-lg shadow-red-500/30">
                  <Calendar size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Agenda intégré<br /><span className="bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">avec time-blocking</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">Glissez vos tâches directement dans votre calendrier pour bloquer du temps. Vues jour, semaine, mois avec zoom granulaire.</p>
                <div className="space-y-3">
                  {[
                    'Glissez une tâche depuis la sidebar vers un créneau : un événement est créé instantanément',
                    'Couleur de l\'événement = couleur de la catégorie de la tâche, pour repérer vos priorités d\'un coup d\'œil',
                    'Créez, déplacez ou redimensionnez les événements à la souris : la tâche associée se met à jour automatiquement',
                    'Vues jour / semaine / mois avec basculement en un clic et navigation rapide entre les périodes',
                  ].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-red-500 to-rose-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/agenda')} className="group bg-gradient-to-r from-red-600 to-rose-600 hover:shadow-lg hover:shadow-red-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Ouvrir l'agenda <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="w-full px-4 lg:px-0" style={{ perspective: 1200, flex: '0 1 55%' }}>
                <motion.div
                  initial={{ rotateY: -48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <AgendaMobileShowcase /> : <AgendaShowcase />}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Section 3 : OKR ── */}
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              <motion.div
                className="flex-1 space-y-6 px-4 lg:px-0"
                initial={{ opacity: 0, x: -60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl shadow-lg shadow-green-500/30">
                  <Target size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">OKR & Objectifs<br /><span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">à la Google</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">La méthode OKR utilisée par Google, Intel et Netflix — maintenant dans votre poche. Définissez des objectifs ambitieux et mesurez chaque résultat clé.</p>
                <div className="space-y-3">
                  {["Définissez des objectifs ambitieux avec des résultats clés chiffrés", "Votre progression est calculée automatiquement", "Visualisez l'avancée de vos objectifs en temps réel", 'Découpez vos objectifs en résultats clés pour passer de "un jour" à "maintenant"'].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/okr')} className="group bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-lg hover:shadow-green-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Voir les OKRs <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="flex-1 w-full px-4 lg:px-0" style={{ perspective: 1200 }}>
                <motion.div
                  initial={{ rotateY: 48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <OKRMobileShowcase /> : <OKRCardShowcase />}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Section 4 : Habitudes ── */}
            <div className="flex flex-col lg:flex-row-reverse items-center gap-10 lg:gap-16">
              <motion.div
                className="flex-1 space-y-6 px-4 lg:px-0"
                initial={{ opacity: 0, x: 60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl shadow-lg shadow-yellow-500/30">
                  <Repeat size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Habitudes & Streaks<br /><span className="bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">visualisés en heatmap</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">Construisez des routines durables avec un suivi complet. La heatmap 26 semaines révèle vos patterns et récompense votre régularité.</p>
                <div className="space-y-3">
                  {["Mesurez votre régularité grâce au système de tableau de suivi.", "Restez motivé avec le système de série de jours d'affilée (streak)", "Tableau de suivi global : visualisez toutes vos habitudes en un coup d'œil", "Taux de complétion et temps investi : mesurez votre régularité réelle"].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/habits')} className="group bg-gradient-to-r from-yellow-500 to-amber-500 hover:shadow-lg hover:shadow-yellow-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Suivre mes habitudes <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="flex-1 w-full px-4 lg:px-0" style={{ perspective: 1200 }}>
                <motion.div
                  initial={{ rotateY: -48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <HabitMobileShowcase /> : <HabitHeatmapShowcase />}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Section 5 : Statistiques ── */}
            <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
              <motion.div
                className="flex-1 space-y-6 px-4 lg:px-0"
                initial={{ opacity: 0, x: -60, y: 20 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl shadow-lg shadow-violet-500/30">
                  <BarChart2 size={28} className="text-white" />
                </div>
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Statistiques<br /><span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">multi-modules</span></h3>
                <p className="text-lg text-slate-300 leading-relaxed">Analysez votre temps investi sur tous vos modules — tâches, agenda, OKR, habitudes. Des données précises pour des décisions éclairées.</p>
                <div className="space-y-3">
                  {["Répartition du temps sur tâches, agenda, OKR et habitudes pour une meilleure clarté", "Vues jour, semaine, mois, année — zoomez où vous voulez", "Suivez vos progrès depuis une unique page", "Visualisez votre productivité en un coup d'œil"].map((b, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={11} className="text-white" />
                      </div>
                      <span className="text-slate-300 font-medium text-sm">{b}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleFeatureClick('/statistics')} className="group bg-gradient-to-r from-violet-600 to-purple-600 hover:shadow-lg hover:shadow-violet-500/25 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:scale-105 transform flex items-center gap-2">
                  Voir mes stats <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>

              <div className="flex-1 w-full px-4 lg:px-0" style={{ perspective: 1200 }}>
                <motion.div
                  initial={{ rotateY: 48, opacity: 0, scale: 0.78, y: 50 }}
                  whileInView={{ rotateY: 0, opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 55, damping: 13, mass: 0.9 }}
                  className="relative"
                >
                  <div className="absolute -inset-3 bg-gradient-to-r from-violet-500/20 to-purple-600/20 rounded-3xl blur-2xl" />
                  <div className="relative">
                    {isMobile ? <StatsMobileShowcase /> : (
                      <Suspense fallback={<ShowcaseSkeleton />}>
                        <StatsShowcase />
                      </Suspense>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section id="solutions" className="py-24 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Application productivité pour chaque profil
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Étudiant, professionnel, entrepreneur ou équipe — Cosmo adapte la gestion de tâches, le suivi d'habitudes et les OKR à vos besoins spécifiques
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {USE_CASES.map((useCase, index) => {
              const num = String(index + 1).padStart(2, '0');
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.6, ...ENTRY_OFFSETS[index] }}
                  whileInView={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{
                    type: 'spring',
                    stiffness: 65,
                    damping: 14,
                    mass: 1,
                    delay: 0.1 + index * 0.05,
                  }}
                  whileHover={{ y: -4 }}
                  className="group relative overflow-hidden p-8 lg:p-10"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.55)',
                    border: '1px solid rgba(148, 163, 184, 0.12)',
                  }}
                >
                  {/* Top hairline accent */}
                  <div
                    className="absolute top-0 left-0 right-0 h-px transition-all duration-500 group-hover:h-[3px]"
                    style={{ backgroundColor: useCase.accent, opacity: 0.6 }}
                  />

                  {/* Watermark index */}
                  <div
                    className="absolute -top-2 -right-2 select-none pointer-events-none font-bold tabular-nums leading-none transition-colors duration-500"
                    style={{
                      fontSize: '8rem',
                      color: 'rgba(148, 163, 184, 0.06)',
                      letterSpacing: '-0.05em',
                    }}
                  >
                    {num}
                  </div>

                  {/* Kicker row */}
                  <div className="relative flex items-baseline gap-3 mb-6">
                    <span
                      className="text-xs font-mono tabular-nums tracking-widest"
                      style={{ color: useCase.accent }}
                    >
                      {num}
                    </span>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: useCase.accent }}
                    >
                      {useCase.profile}
                    </span>
                    <span
                      className="flex-1 h-px"
                      style={{ backgroundColor: useCase.accent, opacity: 0.25 }}
                    />
                  </div>

                  {/* Title */}
                  <h3 className="relative text-3xl lg:text-4xl font-semibold text-white mb-5 leading-[1.1] tracking-tight">
                    {useCase.title}
                  </h3>

                  {/* Description */}
                  <p className="relative text-base text-slate-400 leading-relaxed mb-8 max-w-md">
                    {useCase.description}
                  </p>

                  {/* Features as em-dash list */}
                  <ul className="relative space-y-2.5 mb-10">
                    {useCase.features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed"
                      >
                        <span
                          className="select-none mt-[2px]"
                          style={{ color: useCase.accent }}
                        >
                          —
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Editorial link */}
                  <button
                    onClick={() => handleFeatureClick(useCase.path)}
                    className="relative inline-flex items-center gap-2 text-sm font-semibold tracking-wide transition-all duration-300 hover:gap-3"
                    style={{ color: useCase.accent }}
                  >
                    En savoir plus
                    <ArrowRight size={14} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="why" className="py-24 bg-black/20 backdrop-blur-xl relative overflow-hidden">
        {/* Ambient blobs */}
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <span className="text-xs font-mono tracking-[0.3em] uppercase text-blue-400 mb-5 block">
              — Ce qui change tout —
            </span>
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 leading-[1.05] tracking-tight">
              <span className="text-white">Pas une app de plus.</span>
              <br />
              <span className="text-slate-500">Un système connecté.</span>
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              Là où les autres apps font une chose, Cosmo fait dialoguer vos tâches, votre agenda,
              vos objectifs et vos habitudes. Une seule boucle, plus de copier-coller mental.
            </p>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[minmax(220px,auto)]">

            {/* HERO 1 — Time blocking (col-span-4) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.05 }}
              whileHover={{ y: -3 }}
              className="md:col-span-4 md:row-span-2 relative overflow-hidden p-8 lg:p-10 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-blue-400/40 group-hover:h-[3px] transition-all duration-500" />

              {/* Mini agenda visual */}
              <div className="absolute bottom-0 right-0 w-[70%] h-[55%] opacity-90 pointer-events-none" style={{ maskImage: 'linear-gradient(to top left, black 40%, transparent 90%)' }}>
                <div className="absolute inset-4 grid grid-cols-5 grid-rows-6 gap-[2px]">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="border border-white/[0.04] rounded-[2px]" />
                  ))}
                  {/* Existing event */}
                  <motion.div
                    className="absolute rounded-md text-[9px] font-semibold text-white/90 px-1.5 py-1"
                    style={{
                      backgroundColor: '#8B5CF6',
                      left: '20%',
                      top: '16.66%',
                      width: '20%',
                      height: '33%',
                    }}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                  >
                    Réunion
                  </motion.div>
                  {/* Dropped task */}
                  <motion.div
                    className="absolute rounded-md text-[9px] font-semibold text-white px-1.5 py-1 shadow-2xl"
                    style={{
                      backgroundColor: '#F97316',
                      left: '60%',
                      top: '50%',
                      width: '20%',
                      height: '25%',
                    }}
                    initial={{ opacity: 0, x: -200, y: -120, scale: 1.1 }}
                    whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 0.8 }}
                  >
                    Pitch deck
                  </motion.div>
                </div>
              </div>

              <div className="relative z-10 max-w-md">
                <span className="text-[10px] font-mono tracking-[0.25em] text-blue-400 uppercase">// 01 · Time blocking</span>
                <h3 className="text-3xl lg:text-4xl font-semibold text-white mt-4 mb-4 leading-[1.1] tracking-tight">
                  Glissez. Bloquez.<br />Avancez.
                </h3>
                <p className="text-slate-400 leading-relaxed text-base">
                  Glissez une tâche dans votre calendrier — l'événement se crée, la tâche reste liée.
                  Plus de double saisie, plus de blocs orphelins. Votre planification devient une vraie
                  intention de temps.
                </p>
              </div>
            </motion.div>

            {/* TILE — Heatmap (col-span-2) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.15 }}
              whileHover={{ y: -3 }}
              className="md:col-span-2 relative overflow-hidden p-7 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-amber-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-amber-400 uppercase">// 02 · Discipline</span>
              <h3 className="text-xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                Vos habitudes,<br />sur 26 semaines.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">
                Une case par jour. Un streak par victoire. Le pattern se révèle tout seul.
              </p>
              {/* Mini heatmap */}
              <div className="flex gap-[3px]">
                {Array.from({ length: 14 }).map((_, w) => (
                  <div key={w} className="flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }).map((_, d) => {
                      const seed = (w * 7 + d) * 9301 + 49297;
                      const r = ((seed % 233280) / 233280);
                      const intensity = r > 0.55 ? (r > 0.85 ? 1 : r > 0.7 ? 0.7 : 0.4) : 0;
                      return (
                        <div
                          key={d}
                          className="w-2.5 h-2.5 rounded-[2px]"
                          style={{
                            backgroundColor: intensity > 0
                              ? `rgba(245, 158, 11, ${intensity})`
                              : 'rgba(255,255,255,0.05)',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* TILE — OKR (col-span-2) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.25 }}
              whileHover={{ y: -3 }}
              className="md:col-span-2 relative overflow-hidden p-7 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-emerald-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-emerald-400 uppercase">// 03 · OKR</span>
              <h3 className="text-xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                La méthode Google,<br />sans le tableur.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">
                Objectifs ambitieux, résultats clés mesurables. La progression se calcule pendant que vous travaillez.
              </p>
              {/* Mini circular progress */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="transform -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                    <motion.circle
                      cx="32" cy="32" r="26"
                      stroke="#34D399" strokeWidth="6" fill="none" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 26}
                      initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                      whileInView={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - 0.68) }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, ease: 'easeOut', delay: 0.4 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">68%</div>
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="truncate">3 200 / 10 000 users</span></div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="truncate">NPS 38 → 50</span></div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="truncate">Rétention 71%</span></div>
                </div>
              </div>
            </motion.div>

            {/* HERO 2 — Stats consolidées (col-span-3) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.35 }}
              whileHover={{ y: -3 }}
              className="md:col-span-3 relative overflow-hidden p-8 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-violet-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-violet-400 uppercase">// 04 · Vue consolidée</span>
              <h3 className="text-2xl lg:text-3xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                Où passe votre temps ?
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-md">
                Tâches, agenda, OKR, habitudes — tout converge dans une seule vue.
                Vous arrêtez de deviner. Vous voyez.
              </p>
              {/* Mini bar chart */}
              <div className="flex items-end gap-2 h-20">
                {[
                  { label: 'Tâches', h: 75, c: '#3B82F6' },
                  { label: 'Agenda', h: 95, c: '#EF4444' },
                  { label: 'OKR', h: 55, c: '#10B981' },
                  { label: 'Habitudes', h: 70, c: '#F59E0B' },
                  { label: 'Lecture', h: 35, c: '#8B5CF6' },
                  { label: 'Autres', h: 25, c: '#64748B' },
                ].map((bar, i) => (
                  <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5">
                    <motion.div
                      className="w-full rounded-t-sm origin-bottom"
                      style={{ backgroundColor: bar.c }}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${bar.h}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.5 + i * 0.07 }}
                    />
                    <span className="text-[9px] text-slate-500 tracking-wider truncate w-full text-center">{bar.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* TILE — Mode démo (col-span-3) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: 0.45 }}
              whileHover={{ y: -3 }}
              className="md:col-span-3 relative overflow-hidden p-8 group"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.12)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-cyan-400/40 group-hover:h-[3px] transition-all duration-500" />
              <span className="text-[10px] font-mono tracking-[0.25em] text-cyan-400 uppercase">// 05 · Zéro friction</span>
              <h3 className="text-2xl lg:text-3xl font-semibold text-white mt-3 mb-3 leading-tight tracking-tight">
                Pas d'inscription.<br />Juste essayer.
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-5 max-w-md">
                Un mode démo pré-rempli avec 12 mois de données réalistes. Vous testez
                le vrai Cosmo, pas une vidéo. Pas un email demandé.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono" style={{ backgroundColor: 'rgba(34, 211, 238, 0.08)', color: '#67E8F9', border: '1px solid rgba(34, 211, 238, 0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  100 tâches · 100 habitudes · 150 events
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── Section FAQ ── */}
      <section id="faq" className="py-24 bg-black/20 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-xs font-mono tracking-[0.3em] uppercase text-blue-400 mb-4 block"
            >
              — Questions fréquentes —
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl lg:text-4xl font-bold text-white mb-4"
            >
              Tout ce que vous voulez savoir
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                sur Cosmo
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="text-slate-400 text-lg"
            >
              Méthode OKR, habitudes, time-blocking, mode démo, sécurité... on répond à tout.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900/60 border border-white/8 rounded-2xl px-6 sm:px-8"
          >
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={i} question={item.question} answer={item.answer} index={i} />
            ))}
          </motion.div>

          <p className="text-center text-slate-500 text-sm mt-8">
            Une question non listée ?{' '}
            <a
              href="mailto:contact@cosmo.app"
              className="text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
            >
              Écrivez-nous
            </a>
          </p>
        </div>
      </section>

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

      <footer className="bg-black/40 backdrop-blur-xl border-t border-white/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 overflow-hidden rounded-xl flex items-center justify-center">
                <img src="/logo.png" alt="Logo Cosmo" width="36" height="36" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg font-bold text-white">Cosmo</span>
              <span className="text-slate-600 hidden sm:inline">—</span>
              <span className="text-slate-400 text-sm hidden sm:inline">© 2026 Tous droits réservés.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400 flex-wrap justify-center md:justify-end">
              <a href="/guide" className="hover:text-white transition-colors">Guide d'utilisation</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
              <a href="/signup" className="hover:text-white transition-colors">Inscription gratuite</a>
              <a href="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</a>
              <a href="/politique-confidentialite" className="hover:text-white transition-colors">Confidentialité</a>
              <a href="/cgu" className="hover:text-white transition-colors">CGU</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
