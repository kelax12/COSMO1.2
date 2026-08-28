import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useSlideUpEntrance } from '@/lib/motion-safe';
import { currentRelease, shouldCheckNow, shouldOfferReload } from '@/lib/app-version';

/**
 * Propose de recharger quand le serveur sert un build plus récent que celui
 * qui tourne dans cet onglet. Logique de décision dans `@/lib/app-version`.
 *
 * ⚠️ **Ne jamais transformer ça en rechargement automatique.** Un onglet resté
 * ouvert contient souvent une saisie en cours — une tâche à moitié écrite, un
 * commentaire. Recharger d'autorité ferait perdre ce travail pour un gain qui
 * n'appartient qu'à nous. On propose, l'utilisateur décide, et il peut refuser.
 *
 * ⚠️ La position vient du CSS (`fixed bottom-4`), jamais d'une animation de
 * transform : sous `prefers-reduced-motion`, `MotionConfig reducedMotion="user"`
 * ne joue pas les transforms et la valeur `initial` RESTE appliquée. C'est
 * exactement le bug qui avait sorti `CookieBanner` de l'écran le 2026-08-14.
 * `useSlideUpEntrance` porte déjà ce garde-fou.
 */
const NewVersionBanner: React.FC = () => {
  const { t } = useT('common');
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastCheckedAt = useRef<number | null>(null);
  const entrance = useSlideUpEntrance();

  const check = useCallback(async () => {
    if (!shouldCheckNow(lastCheckedAt.current, Date.now())) return;
    lastCheckedAt.current = Date.now();
    try {
      // `no-store` : sans lui, le navigateur peut resservir sa propre copie et
      // la vérification ne verrait jamais le nouveau build.
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const body: unknown = await res.json();
      const served = (body as { release?: unknown } | null)?.release;
      if (shouldOfferReload(currentRelease(), served)) setAvailable(true);
    } catch {
      // Hors ligne, fichier absent, réponse illisible : on ne dérange pas.
    }
  }, []);

  useEffect(() => {
    // Déclenché par un retour d'onglet, jamais par un minuteur permanent.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [check]);

  if (!available || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        {...entrance}
        role="status"
        // ⚠️ Centré par `left-4 right-4 mx-auto`, PAS par `-translate-x-1/2` :
        // l'entrée anime `y`, donc écrit `transform`, et écraserait la
        // translation horizontale de Tailwind — le bandeau partirait à droite.
        // Deux mécanismes ne peuvent pas se partager `transform`.
        //
        // `z-[190]` : cran « surfaces système » de l'échelle publiée, et
        // délibérément SOUS `CookieBanner` (200). Si les deux s'affichaient, le
        // consentement doit rester au-dessus — c'est lui qui est obligatoire.
        //
        // Décalage bas : la MobileTabBar occupe les 64 premiers pixels, comme
        // pour `CookieBanner`.
        className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] sm:bottom-6 left-4 right-4 mx-auto z-[190] max-w-md"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-3 shadow-2xl">
          <RefreshCw size={18} className="shrink-0 text-blue-400" aria-hidden="true" />
          <p className="flex-1 text-sm text-[rgb(var(--color-text-primary))]">
            {t('appVersion.available')}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            {t('appVersion.reload')}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={t('appVersion.dismiss')}
            className="shrink-0 rounded-lg p-2 text-[rgb(var(--color-text-muted))] transition-colors hover:text-[rgb(var(--color-text-primary))]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewVersionBanner;
