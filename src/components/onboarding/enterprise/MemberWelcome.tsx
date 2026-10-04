import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { EMPHASIS_CLASS, withEmphasis } from '../onboarding-text';
import { ENT, fourPointStar, starField } from './constellation-geometry';
import { ENT_SCOPE } from './ent-onboarding';
import { ENT_PRIMARY, ENT_LABEL } from './ent-ui';
import { PlacesGrid } from './ent-places';

interface MemberWelcomeProps {
  orgName: string;
  isAdmin: boolean;
  onClose: () => void;
}

const BAND_STARS = starField(28, 19).map((s) => ({ ...s, y: Math.round(s.y / 4) }));

/**
 * Accueil d'une personne qui entre pour la première fois dans l'espace d'une
 * entreprise sans être passée par sa mise en place : invitée par lien,
 * acceptée après une demande par code. Elle n'a vu ni la constellation ni la
 * visite des lieux : on lui montre les quatre endroits où elle va vivre.
 *
 * Une fois par entreprise et par appareil (`ent-onboarding.ts`), jamais en
 * mode démo, jamais par-dessus un lien profond (`?task=` …) : la personne qui
 * arrive par un lien vers une tâche vient pour cette tâche. Montée par
 * `OrganizationPage`, qui en décide.
 */
const MemberWelcome = ({ orgName, isAdmin, onClose }: MemberWelcomeProps) => {
  const { t } = useT('onboarding');
  const reduce = useReducedMotion() ?? false;
  // Focus d'entrée sur « C'est parti » plutôt que sur la croix : Entrée
  // valide l'accueil au lieu de le fermer sans l'avoir lu.
  const ctaRef = useRef<HTMLButtonElement>(null);
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose,
    label: t('ent.member.dialogLabel'),
    initialFocusRef: ctaRef,
  });

  return (
    <div
      className="fixed inset-0 z-[150] overflow-y-auto bg-[#08090C]/80"
      style={ENT_SCOPE}
      onClick={onClose}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-6">
        <motion.div
          ref={ref}
          {...dialogProps}
          onClick={(e) => e.stopPropagation()}
          {...(reduce
            ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
            : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } })}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          // Pas d'`overflow-hidden` ici : il ferait de la carte un conteneur de
          // défilement, et la rangée d'action ne collerait plus en bas.
          className="relative w-full max-w-[720px] rounded-t-[28px] border border-[#1F2530] bg-[#08090C] text-[#EDF2F7] shadow-[0_40px_120px_-40px_rgba(34,211,238,0.35)] sm:rounded-[28px]"
        >
          {/* Bandeau : un coin de ciel, l'étoile polaire et le nom. */}
          <div className="relative h-[120px] overflow-hidden rounded-t-[28px] border-b border-[#14181F] bg-[#0A0C10]" aria-hidden="true">
            <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_55%_120%_at_50%_0%,rgba(34,211,238,0.16),transparent_70%)]" />
            <svg viewBox="0 0 560 140" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
              <defs>
                <radialGradient id="member-north-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={ENT.or} stopOpacity="0.45" />
                  <stop offset="100%" stopColor={ENT.or} stopOpacity="0" />
                </radialGradient>
              </defs>
              {BAND_STARS.map((s, i) => (
                <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={ENT.lune} opacity={s.o} />
              ))}
              <circle cx={280} cy={52} r={40} fill="url(#member-north-glow)" />
              <path d={fourPointStar(280, 52, 13, 3.6)} fill={ENT.or} />
              <line x1={280} y1={70} x2={280} y2={140} stroke={ENT.or} strokeOpacity={0.4} strokeDasharray="2 5" />
            </svg>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('ent.member.close')}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-[#8B96A8] transition-colors hover:bg-white/[0.06] hover:text-[#EDF2F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
          >
            <X size={18} aria-hidden="true" />
          </button>

          <div className="px-6 pb-6 pt-6 sm:px-9 sm:pb-9">
            <h2 className="text-3xl font-semibold leading-[1.06] tracking-[-0.035em] sm:text-4xl">
              {withEmphasis(t('ent.member.title', { org: orgName }), EMPHASIS_CLASS)}
            </h2>
            <p className="mt-3 max-w-[34rem] text-base leading-[1.6] text-[#8B96A8]">
              {isAdmin ? t('ent.member.roleAdmin') : t('ent.member.roleMember')}
            </p>
            <p className={`mt-6 ${ENT_LABEL}`}>{t('ent.member.placesLabel')}</p>
            <div className="mt-3">
              <PlacesGrid keys={['overview', 'tasks', 'projects', 'okr']} label={t('ent.member.placesLabel')} compact />
            </div>
            <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end border-t border-[#1F2530] bg-[#08090C] px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:mt-7 sm:border-0 sm:p-0">
              <button ref={ctaRef} type="button" onClick={onClose} className={`${ENT_PRIMARY} w-full sm:w-auto`}>
                {t('ent.member.cta')}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MemberWelcome;
