import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Volume2, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { EMPHASIS_CLASS, withEmphasis } from '../onboarding-text';
import { ENT_SCOPE } from './ent-onboarding';
import { ENT_LINK, ENT_PRIMARY } from './ent-ui';

export const ORG_WELCOME_VIDEO = {
  src: '/videos/onboarding-entreprise-v2.mp4',
  poster: '/videos/onboarding-entreprise-v2-poster.webp',
  captionsFr: '/videos/onboarding-entreprise-v2.fr.vtt',
} as const;

interface OrgWelcomeVideoProps {
  orgName: string;
  onClose: () => void;
}

/**
 * Accueil vidéo du premier passage dans l'espace d'une entreprise (créateur
 * comme membre), sur le modèle de RemNote : le lecteur s'ouvre par-dessus
 * l'Aperçu et la vidéo démarre seule. Remplace le 2026-10-14 l'assistant de
 * mise en place (équipe, invitations, projet, cap) et la carte « lieux à
 * connaître » : la vidéo montre ce qu'ils demandaient de remplir.
 *
 * Lecture :
 *  · on tente AVEC le son (l'arrivée suit un clic, l'activation de la page
 *    l'autorise en général) ; si le navigateur refuse, on rejoue en muet et
 *    un bouton « Activer le son » s'affiche par-dessus ;
 *  · sous-titres FR actifs d'office quand l'appli n'est pas en français ;
 *  · `prefers-reduced-motion` : aucun démarrage automatique, l'affiche et le
 *    bouton de lecture natif suffisent.
 *
 * Fermer (croix, Échap, « Passer », fond) marque l'accueil comme vu : un
 * lecteur qu'on ne peut pas quitter est un mur, pas un accueil.
 *
 * ⚠️ Limite du lecteur NATIF (mesuré dans Chromium le 2026-10-16) : quand le
 * focus est dans ses commandes (lecture, volume…), aucune touche n'atteint la
 * page, Échap compris. Ce n'est pas un piège (Tab en ressort vers « Passer »),
 * mais Échap n'y ferme rien. Seules des commandes maison lèveraient la limite.
 */
const OrgWelcomeVideo = ({ orgName, onClose }: OrgWelcomeVideoProps) => {
  const { t, locale } = useT('onboarding');
  const reduce = useReducedMotion() ?? false;
  const videoRef = useRef<HTMLVideoElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [mutedFallback, setMutedFallback] = useState(false);
  const [ended, setEnded] = useState(false);
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose,
    label: t('ent.video.dialogLabel'),
    initialFocusRef: ctaRef,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduce) return;
    let cancelled = false;
    video.muted = false;
    video.play().catch(() => {
      if (cancelled) return;
      video.muted = true;
      setMutedFallback(true);
      video.play().catch(() => {
        // Lecture refusée même en muet (économiseur, politique stricte) :
        // l'affiche et le bouton de lecture natif restent là.
      });
    });
    return () => {
      cancelled = true;
      video.pause();
    };
  }, [reduce]);

  const unmute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMutedFallback(false);
    if (video.paused) void video.play().catch(() => undefined);
  };

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-[#08090C]/85 backdrop-blur-sm" style={ENT_SCOPE} onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <motion.div
          ref={ref}
          {...dialogProps}
          onClick={(e) => e.stopPropagation()}
          {...(reduce
            ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
            : { initial: { opacity: 0, y: 24, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 } })}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[1040px] rounded-[24px] border border-[#1F2530] bg-[#0A0C10] p-3 text-[#EDF2F7] shadow-[0_40px_120px_-40px_rgba(34,211,238,0.35)] sm:rounded-[28px] sm:p-5"
        >
          <div className="flex items-start justify-between gap-4 px-2 pb-3 pt-1 sm:px-2 sm:pb-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold leading-tight tracking-[-0.03em] sm:text-2xl">
                {withEmphasis(t('ent.video.title', { org: orgName }), EMPHASIS_CLASS)}
              </h2>
              <p className="mt-1 text-sm text-[#8B96A8]">{t('ent.video.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('ent.video.close')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8B96A8] transition-colors hover:bg-white/[0.06] hover:text-[#EDF2F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[16px] border border-[#14181F] bg-black">
            <video
              ref={videoRef}
              className="block aspect-video w-full bg-black"
              src={ORG_WELCOME_VIDEO.src}
              poster={ORG_WELCOME_VIDEO.poster}
              controls
              playsInline
              preload="auto"
              controlsList="nodownload"
              onEnded={() => {
                setEnded(true);
                ctaRef.current?.focus();
              }}
            >
              <track
                kind="subtitles"
                srcLang="fr"
                label={t('ent.video.captionsLabel')}
                src={ORG_WELCOME_VIDEO.captionsFr}
                default={locale !== 'fr'}
              />
            </video>
            {mutedFallback && (
              <button
                type="button"
                onClick={unmute}
                className="absolute left-1/2 top-4 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#08090C]/85 px-4 py-2 text-sm font-semibold text-[#EDF2F7] ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-[#08090C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
              >
                <Volume2 size={16} aria-hidden="true" />
                {t('ent.video.unmute')}
              </button>
            )}
          </div>

          <div className="flex flex-col-reverse items-stretch gap-2 px-1 pb-1 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-2">
            <button type="button" onClick={onClose} className={ENT_LINK}>
              {ended ? t('ent.video.close') : t('ent.video.skip')}
            </button>
            <button ref={ctaRef} type="button" onClick={onClose} className={`${ENT_PRIMARY} w-full sm:w-auto`}>
              {t('ent.video.cta')}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OrgWelcomeVideo;
