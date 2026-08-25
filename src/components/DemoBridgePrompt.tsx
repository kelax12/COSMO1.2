import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useDemoBridge } from '@/lib/hooks/use-demo-bridge';
import { recordFallbackSource } from '@/lib/attribution';
import { useT } from '@/i18n/useT';
import { useSlideUpEntrance } from '@/lib/motion-safe';

/**
 * Pont démo → compte : propose la création de compte à un visiteur démo
 * ENGAGÉ (90 s d'usage, ou 3ᵉ création — cf. `demo-engagement.ts`).
 *
 * Distinct de `DemoConversionBanner`, qui est la mention permanente et neutre
 * « données locales à cet appareil ». Ici on sollicite, donc on attend que le
 * visiteur ait quelque chose à perdre, et on ne réinsiste pas avant 24 h.
 *
 * La copy est honnête : les données de démo ne sont PAS migrées vers le compte
 * réel (le transfert a été retiré en juillet, cf. commit 001ff23). On promet un
 * système à reconstruire, pas un système conservé.
 */
const DemoBridgePrompt: React.FC = () => {
  const { t } = useT('common');
  const navigate = useNavigate();
  const { visible, snooze } = useDemoBridge();
  const entrance = useSlideUpEntrance();

  const handleSignup = () => {
    // Canal d'acquisition « démo ». `recordFallbackSource` ne pose la valeur que
    // si aucune campagne n'a été captée : un visiteur venu de ?ref=tiktok reste
    // attribué à TikTok, la démo n'étant qu'une étape de son parcours.
    recordFallbackSource('demo');
    snooze();
    navigate('/signup');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          aria-label={t('demoBridge.aria')}
          {...entrance}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          // Même ancrage que CookieBanner : au-dessus de la MobileTabBar (64 px
          // + safe-area) sur mobile, carte en bas à droite sur desktop. z-[190]
          // pour rester SOUS la bannière cookies (z-[200]) — un consentement
          // légal passe avant une sollicitation commerciale.
          className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-[190]"
        >
          <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl shadow-xl shadow-gray-200/80 dark:shadow-black/40 overflow-hidden">
            <div className="flex items-start justify-between px-4 pt-4 pb-3 gap-2">
              <span className="text-[15px] font-semibold text-[rgb(var(--color-text-primary))]">
                {t('demoBridge.title')}
              </span>
              <button
                type="button"
                onClick={snooze}
                // Nom accessible distinct du bouton « Plus tard » plus bas :
                // deux contrôles au même nom rendent la carte illisible pour un
                // lecteur d'écran (et pour un test qui cible le libellé).
                aria-label={t('demoBridge.dismiss')}
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            <div className="h-px bg-[rgb(var(--color-border))] mx-4" />

            <div className="px-4 pt-3 pb-4">
              <p className="text-sm text-[rgb(var(--color-text-secondary))] leading-snug">
                {t('demoBridge.text')}
              </p>
              {/* Dit explicitement que la démo ne suit pas : mieux vaut une
                  conversion en moins qu'une promesse non tenue au 1er login. */}
              <p className="mt-1.5 text-xs text-[rgb(var(--color-text-muted))] leading-snug">
                {t('demoBridge.disclaimer')}
              </p>
              <div className="mt-3.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSignup}
                  className="flex-1 min-h-11 py-2.5 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] transition-colors"
                >
                  {t('demoBridge.cta')}
                </button>
                <button
                  type="button"
                  onClick={snooze}
                  className="px-3 min-h-11 py-2.5 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
                >
                  {t('demoBridge.later')}
                </button>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default DemoBridgePrompt;
