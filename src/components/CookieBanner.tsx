import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

type CookieConsent = 'accepted' | 'refused' | null;

const STORAGE_KEY = 'cosmo_cookie_consent';

const CookieBanner: React.FC = () => {
  const [consent, setConsent] = useState<CookieConsent>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as CookieConsent;
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
    setConsent(stored);
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setConsent('accepted');
    setVisible(false);
  };

  const handleRefuse = () => {
    localStorage.setItem(STORAGE_KEY, 'refused');
    setConsent('refused');
    setVisible(false);
  };

  if (consent !== null) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          aria-label="Bannière cookies"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-[200]"
        >
          {/* Card */}
          <div className="
            bg-[rgb(var(--color-surface))]
            border border-[rgb(var(--color-border))]
            rounded-2xl shadow-xl shadow-gray-200/80 dark:shadow-black/40
            overflow-hidden
          ">

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[8px] bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  <Cookie size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
                </div>
                <span className="text-[15px] font-semibold text-[rgb(var(--color-text-primary))]">
                  Cookies
                </span>
              </div>
              <button
                onClick={handleRefuse}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
                aria-label="Fermer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Separator */}
            <div className="h-px bg-[rgb(var(--color-border))] mx-4" />

            {/* Body */}
            <div className="px-4 pt-3 pb-4">
              {/* Trust badge */}
              <div className="flex items-center gap-2 mb-2.5">
                <ShieldCheck size={13} className="text-green-500 shrink-0" aria-hidden="true" />
                {/* A11y: text-green-600 (#16a34a) on white = 3.29:1 (WCAG AA fails).
                    text-green-700 (#15803d) = 4.78:1 → passes 4.5:1. */}
                <span className="text-[11px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                  Aucun tracking publicitaire
                </span>
              </div>

              <p className="text-[13px] text-[rgb(var(--color-text-muted))] leading-relaxed">
                Uniquement des cookies{' '}
                <strong className="text-[rgb(var(--color-text-primary))] font-semibold">strictement nécessaires</strong>
                {' '}au fonctionnement (session, préférences).{' '}
                {/* A11y: links inside text blocks need a non-color affordance
                    (WCAG 1.4.1). underline is always on, not only :hover. */}
                <Link
                  to="/politique-confidentialite"
                  className="text-blue-700 dark:text-blue-300 underline underline-offset-2"
                  onClick={handleRefuse}
                >
                  En savoir plus
                </Link>.
              </p>
            </div>

            {/* Footer actions */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={handleRefuse}
                className="
                  flex-1 h-[42px] rounded-xl
                  bg-[rgb(var(--color-hover))]
                  text-[rgb(var(--color-text-secondary))]
                  hover:bg-[rgb(var(--color-border))]
                  text-[13px] font-semibold
                  transition-colors active:scale-[0.97] transform-gpu
                "
              >
                Refuser
              </button>
              <button
                onClick={handleAccept}
                className="
                  flex-1 h-[42px] rounded-xl
                  bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))]
                  text-white
                  text-[13px] font-semibold
                  transition-colors active:scale-[0.97] transform-gpu
                  shadow-sm shadow-blue-500/30
                "
              >
                Accepter
              </button>
            </div>

          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;
