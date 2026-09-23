import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useT } from '@/i18n/useT';
import { useSlideUpEntrance } from '@/lib/motion-safe';
import {
  readConsent,
  setConsent as persistConsent,
  type CookieConsent,
} from '@/lib/cookie-consent';
import { mountAudienceScript } from '@/lib/audience';
import { useLocalizedPath } from '@/i18n/useLocalizedPath';

const CookieBanner: React.FC = () => {
  const { t } = useT('common');
  // Slugs localisés : un `to=` en dur rend une 404 hors du français (voir
  // `useLocalizedPath`). C'est le seul chemin vers les pages contractuelles.
  const localizedPath = useLocalizedPath();
  const [consent, setConsent] = useState<CookieConsent>(null);
  const [visible, setVisible] = useState(false);
  const entrance = useSlideUpEntrance();
  // Sur `/` (landing perso, BLANCHE depuis le 2026-09-22), le bandeau ne suit
  // pas le thème du visiteur : en thème sombre il posait une carte noire sur
  // une page blanche. Les couleurs y sont écrites en clair, sans `dark:` (la
  // classe `.dark` reste posée sur `<html>`) ni `--color-accent-solid` (blanc
  // en thème `noir`), cf. `src/pages/landing/CLAUDE.md`. Aucune logique de
  // consentement ne change. Sans barre d'onglets mobile ici, il se pose en bas.
  const light = useLocation().pathname === '/';
  const pick = (onLanding: string, themed: string) => (light ? onLanding : themed);

  useEffect(() => {
    const stored = readConsent();
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
    setConsent(stored);
  }, []);

  const handleAccept = () => {
    persistConsent('accepted');
    setConsent('accepted');
    setVisible(false);
    // Monte MAINTENANT ce qui n'avait pas pu l'être au démarrage. Sans cet
    // appel, accepter ne produirait aucune mesure avant le prochain
    // rechargement — l'utilisateur dirait oui, et il ne se passerait rien.
    try {
      mountAudienceScript(document, {
        pathname: window.location.pathname,
        storage: window.localStorage,
      });
    } catch { /* la mesure ne doit jamais casser un clic de l'utilisateur */ }
  };

  const handleRefuse = () => {
    persistConsent('refused');
    setConsent('refused');
    setVisible(false);
    // Rien à démonter : le script n'a jamais été injecté, faute de
    // consentement au démarrage. C'est tout l'intérêt de ne charger qu'après
    // acceptation plutôt que de charger puis regretter — on ne décharge pas
    // du JavaScript déjà évalué.
  };

  if (consent !== null) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          aria-label={t('cookies.banner')}
          {...entrance}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed ${pick('bottom-[calc(env(safe-area-inset-bottom)+16px)]', 'bottom-[calc(64px+env(safe-area-inset-bottom)+16px)]')} left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-[200]`}
        >
          {/* Card */}
          <div className={`rounded-2xl shadow-xl overflow-hidden border ${pick(
            'bg-white border-slate-200 shadow-slate-900/10',
            'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] shadow-gray-200/80 dark:shadow-black/40',
          )}`}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${pick('bg-blue-50', 'bg-blue-50 dark:bg-blue-900/40')}`}>
                  <Cookie size={16} className={pick('text-blue-600', 'text-blue-600 dark:text-blue-400')} aria-hidden="true" />
                </div>
                <span className={`text-[15px] font-semibold ${pick('text-slate-900', 'text-[rgb(var(--color-text-primary))]')}`}>
                  {t('cookies.title')}
                </span>
              </div>
              <button
                onClick={handleRefuse}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${pick(
                  'bg-slate-100 text-slate-500 hover:text-slate-700',
                  'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]',
                )}`}
                aria-label="Fermer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Separator */}
            <div className={`h-px mx-4 ${pick('bg-slate-200', 'bg-[rgb(var(--color-border))]')}`} />

            {/* Body */}
            <div className="px-4 pt-3 pb-4">
              {/* Trust badge */}
              <div className="flex items-center gap-2 mb-2.5">
                <ShieldCheck size={13} className="text-green-500 shrink-0" aria-hidden="true" />
                {/* A11y: text-green-600 (#16a34a) on white = 3.29:1 (WCAG AA fails).
                    text-green-700 (#15803d) = 4.78:1 → passes 4.5:1. */}
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${pick('text-green-700', 'text-green-700 dark:text-green-400')}`}>
                  {t('cookies.noTracking')}
                </span>
              </div>

              {/* 🔴 Ce texte est la surface de RECUEIL du consentement : il doit
                  décrire ce que « Accepter » déclenche, sinon le consentement
                  n'est pas éclairé (art. 82 loi I&L, art. 4.11 RGPD).
                  Il annonçait « uniquement des cookies strictement nécessaires »
                  alors qu'accepter charge Vesk et Vercel Analytics, et dépose un
                  identifiant persistant : la phrase décrivait le cas du REFUS et
                  la proposait comme description de l'acceptation.
                  Une clé = une phrase complète : l'ancienne version concaténait
                  trois fragments traduits, ce qui rend toute relecture juridique
                  impossible dans une autre langue. */}
              <p className={`text-[13px] leading-relaxed ${pick('text-slate-600', 'text-[rgb(var(--color-text-muted))]')}`}>
                {t('cookies.body')}{' '}
                {t('cookies.ifYouRefuse')}{' '}
                {/* A11y: links inside text blocks need a non-color affordance
                    (WCAG 1.4.1). underline is always on, not only :hover. */}
                <Link
                  to={localizedPath('privacy')}
                  className={`underline underline-offset-2 ${pick('text-blue-700', 'text-blue-700 dark:text-blue-300')}`}
                  onClick={handleRefuse}
                >
                  {t('cookies.learnMore')}
                </Link>.
              </p>
            </div>

            {/* Footer actions */}
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={handleRefuse}
                className={`flex-1 h-11 rounded-xl text-[13px] font-semibold transition-colors active:scale-[0.97] transform-gpu ${pick(
                  'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-border))]',
                )}`}
              >
                {t('cookies.decline')}
              </button>
              <button
                onClick={handleAccept}
                className={`flex-1 h-11 rounded-xl text-[13px] font-semibold transition-colors active:scale-[0.97] transform-gpu shadow-sm shadow-blue-500/30 ${pick(
                  'bg-blue-600 hover:bg-blue-700 text-white',
                  'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))]',
                )}`}
              >
                {t('cookies.accept')}
              </button>
            </div>

          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;
