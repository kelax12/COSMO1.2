import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X } from 'lucide-react';
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
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[200]"
        >
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Cookie size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <h3 className="font-semibold text-white text-sm">Cookies</h3>
              </div>
              <button
                onClick={handleRefuse}
                className="text-slate-500 hover:text-white transition-colors shrink-0"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed mb-4">
              Nous utilisons uniquement des cookies <strong className="text-white">strictement nécessaires</strong> au fonctionnement de l'application (session, préférences). Aucun cookie publicitaire ni de tracking. Consultez notre{' '}
              <Link to="/politique-confidentialite" className="text-blue-400 hover:underline">
                politique de confidentialité
              </Link>.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleRefuse}
                className="flex-1 px-3 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:border-white/20 text-xs font-medium transition-all"
              >
                Refuser
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all"
              >
                Accepter
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;
