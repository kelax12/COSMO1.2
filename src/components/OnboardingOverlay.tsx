import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, CheckSquare, Repeat, ArrowRight, X } from 'lucide-react';
import { useIsDemo } from '@/lib/app-mode.store';

/**
 * OnboardingOverlay — tutoriel 3 étapes pour nouveaux utilisateurs (mode démo).
 *
 * Déclenché via localStorage flag "cosmo_onboarding_pending" posé dans
 * AuthContext.loginDemo(). L'overlay se monte sur DashboardPage et guide
 * l'utilisateur :
 *   1. "Bienvenue — voici votre dashboard"
 *   2. "Vos tâches sont là" (→ /tasks)
 *   3. "Activez une habitude" (→ /habits)
 *
 * Pas de dépendance externe (react-joyride etc.). Lourd ~3KB gzip.
 * Pattern : full-screen backdrop semi-opaque + carte centrée avec drag-handle
 * mobile + boutons Précédent/Suivant. Skip toujours disponible (X coin haut-droit).
 *
 * Le composant nettoie le flag dès qu'il est dismissé OU terminé.
 */

interface Step {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  title: string;
  description: string;
  highlight?: string; // CTA secondaire
  navigateTo?: string; // si défini, le bouton "Suivant" navigue vers cette route
  nextLabel: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    accent: '#8B5CF6',
    title: 'Bienvenue sur Cosmo 👋',
    description:
      "Vous êtes en mode démo : 100 tâches, 30 habitudes et 8 OKR pré-remplis pour explorer librement. Aucune donnée n'est envoyée à un serveur.",
    highlight: 'Tour rapide en 30 secondes',
    nextLabel: "C'est parti",
  },
  {
    icon: CheckSquare,
    accent: '#3B82F6',
    title: 'Vos tâches du jour',
    description:
      'Sur mobile, glissez à droite pour valider, à gauche pour révéler les actions (favori, partage, planification). Le bouton "…" affiche aussi tout.',
    highlight: 'Astuce : long-press = mêmes options',
    navigateTo: '/tasks',
    nextLabel: 'Voir mes tâches',
  },
  {
    icon: Repeat,
    accent: '#EAB308',
    title: 'Construisez vos habitudes',
    description:
      'Les habitudes sont le moteur du progrès quotidien. Cosmo enregistre votre série et la visualise. Activez-en une pour commencer.',
    highlight: 'Tip : 2 min par jour suffisent',
    navigateTo: '/habits',
    nextLabel: 'Découvrir les habitudes',
  },
];

const STORAGE_KEY = 'cosmo_onboarding_pending';

const OnboardingOverlay: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDemo = useIsDemo();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Détecte le flag à chaque (a) mount, (b) bascule en démo, (c) changement de route.
  // Sans (b)/(c), l'overlay est monté au niveau App AVANT que loginDemo() ne
  // pose le flag dans localStorage → un seul useEffect([]) raterait l'event.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1' && !isOpen) {
        // Petit délai pour laisser la page derrière finir son render
        const t = setTimeout(() => setIsOpen(true), 500);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, location.pathname]);

  // Verrou body scroll quand ouvert
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ESC pour fermer
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stepIndex]);

  const dismiss = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setIsOpen(false);
  };

  const handleSkip = () => {
    dismiss();
  };

  const handleNext = () => {
    const current = STEPS[stepIndex];
    if (stepIndex === STEPS.length - 1) {
      dismiss();
      if (current.navigateTo) navigate(current.navigateTo);
      return;
    }
    // Étapes intermédiaires : avancer sans naviguer (le user navigue lui-même via les ciblages)
    setStepIndex(i => i + 1);
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex(i => i - 1);
  };

  if (!isOpen) return null;

  const step = STEPS[stepIndex];
  const Icon = step.icon;

  return (
    <AnimatePresence>
      <motion.div
        key="onb-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[400] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-2xl shadow-2xl overflow-hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle mobile */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>

          {/* Skip button */}
          <button
            onClick={handleSkip}
            aria-label="Passer le tutoriel"
            className="absolute top-3 right-3 min-w-11 min-h-11 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={18} />
          </button>

          <div className="px-6 pt-6 pb-5 sm:pt-8 sm:pb-6">
            {/* Icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 monochrome:bg-white/10"
              style={{ backgroundColor: `${step.accent}18` }}
            >
              <Icon size={32} className="monochrome:text-white" />
            </div>

            {/* Title */}
            <h2
              id="onb-title"
              className="text-xl sm:text-2xl font-bold mb-2 text-slate-900 dark:text-white"
            >
              {step.title}
            </h2>

            {/* Description */}
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {step.description}
            </p>

            {/* Highlight pill */}
            {step.highlight && (
              <div
                className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${step.accent}15`, color: step.accent }}
              >
                {step.highlight}
              </div>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 pb-4">
            {STEPS.map((_, i) => (
              <span
                key={i}
                aria-hidden
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === stepIndex ? 24 : 8,
                  backgroundColor: i === stepIndex ? step.accent : 'rgb(203 213 225)',
                }}
              />
            ))}
          </div>

          {/* Footer buttons */}
          <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex-1 px-4 py-3 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Précédent
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-medium text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Passer
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 monochrome:bg-white monochrome:text-black"
              style={{ backgroundColor: step.accent }}
            >
              {step.nextLabel}
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingOverlay;
