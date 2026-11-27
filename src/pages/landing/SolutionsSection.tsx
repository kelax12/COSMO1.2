// Section « Solutions » (profils) de la LandingPage.
// Desktop (motion OK) : éventail de cartes épinglé, scrubbé par GSAP. Chaque
// cran de scroll fait partir la carte de devant ; les suivantes avancent d'une
// place dans l'éventail. Mobile / reduced-motion : cartes empilées, statiques.
import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BarChart2, Calendar, CheckSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HabitIcon, OkrIcon } from '@/components/icons/cosmo-icons';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { TAP_AREA_44_Y } from '@/components/mobile';
import { USE_CASES } from './data';
import { useT } from '@/i18n/useT';
import { useLandingTrack } from './use-landing-track';

interface SolutionsSectionProps {
  handleFeatureClick: (path: string) => void;
}

type UseCase = (typeof USE_CASES)[number];

/** Une puce par module, dans l'ordre des `featureKeys` : tâches, agenda, OKR, habitudes, stats. */
const MODULES: { icon: LucideIcon; fond: string }[] = [
  { icon: CheckSquare, fond: 'bg-blue-500' },
  { icon: Calendar, fond: 'bg-red-500' },
  { icon: OkrIcon, fond: 'bg-green-500' },
  { icon: HabitIcon, fond: 'bg-yellow-500' },
  { icon: BarChart2, fond: 'bg-violet-500' },
];

/** Places de l'éventail : 0 = devant. Valeurs reprises par GSAP et par le rendu initial. */
const SLOTS = [
  { x: 0, y: 0, rotate: 0, scale: 1 },
  { x: -170, y: 40, rotate: -8, scale: 0.92 },
  { x: 170, y: 40, rotate: 8, scale: 0.92 },
  { x: 0, y: 80, rotate: 0, scale: 0.86 },
];
/** Sortie de la carte de devant : elle part en haut à gauche, en tournant. */
const EXIT = { x: -760, y: -60, rotate: -18, scale: 0.9, opacity: 0 };

const TEAMS_PROFILE = 'useCases.teams.profile';

const UseCaseCard: React.FC<{ useCase: UseCase; onClick: () => void }> = ({ useCase, onClick }) => {
  const { t } = useT('landing');
  const { selectTrack } = useLandingTrack();
  // Équipes : le CTA bascule vers le parcours entreprise, comme le sélecteur du header.
  const isTeams = useCase.profileKey === TEAMS_PROFILE;
  return (
    <>
      <div className="h-2 rounded-full mb-6" style={{ backgroundColor: useCase.accent }} />
      <p className="text-sm font-semibold" style={{ color: useCase.accent }}>
        {t(useCase.profileKey)}
      </p>
      <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mt-2 mb-3">
        {t(useCase.titleKey)}
      </h3>
      <p className="text-[15px] text-slate-600 leading-relaxed mb-5">{t(useCase.descriptionKey)}</p>
      <ul className="space-y-1">
        {useCase.featureKeys.map((featureKey, i) => {
          const { icon: Icon, fond } = MODULES[i] ?? MODULES[0];
          return (
            <li key={featureKey} className="flex items-center gap-3 py-1.5 text-[15px] font-medium text-slate-800">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${fond}`}>
                <Icon size={16} className="text-white" aria-hidden="true" />
              </span>
              {t(featureKey)}
            </li>
          );
        })}
      </ul>
      {/* `TAP_AREA_44_Y` (C-80) : le lien est large, il ne lui manque que de la hauteur. */}
      <button
        onClick={isTeams ? () => selectTrack('entreprise') : onClick}
        className={`${TAP_AREA_44_Y} mt-6 inline-flex items-center gap-2 text-sm font-semibold transition-all duration-300 hover:gap-3`}
        style={{ color: useCase.accent }}
      >
        {isTeams ? t('useCases.teams.cta') : t('solutions.learnMore')}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );
};

const CARD_CLASS = 'rounded-[36px] bg-white border border-slate-900/[0.08] p-8';

const SolutionsSection: React.FC<SolutionsSectionProps> = ({ handleFeatureClick }) => {
  const { t } = useT('landing');
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const stacked = isMobile || !!reduceMotion;

  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const fanRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const titleMM = gsap.matchMedia();
      titleMM.add('(prefers-reduced-motion: no-preference)', () => {
        const title = sectionRef.current?.querySelector<HTMLElement>('.solutions-title');
        if (!title) return;
        SplitText.create(title, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              duration: 0.85,
              ease: 'power3.out',
              stagger: 0.12,
              scrollTrigger: { trigger: title, start: 'top 85%', once: true },
            }),
        });
      });

      if (stacked || !pinRef.current || !fanRef.current) return;
      const cards = gsap.utils.toArray<HTMLElement>('.solution-card', fanRef.current);
      const n = cards.length;
      // `xPercent: -50` remplace le `translateX(-50%)` du rendu initial : GSAP possède le transform.
      cards.forEach((card, i) => gsap.set(card, { ...SLOTS[i], zIndex: 10 - i, opacity: 1, xPercent: -50 }));

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut', duration: 1 },
        scrollTrigger: {
          trigger: pinRef.current,
          pin: true,
          // Sous le header collant : sa hauteur mesurée (`--landing-header-h`, posée par
          // LandingPage), jamais une valeur en dur.
          start: () => {
            const host = sectionRef.current?.closest<HTMLElement>('[style*="--landing-header-h"]');
            const h = host ? parseFloat(host.style.getPropertyValue('--landing-header-h')) : 0;
            return `top top+=${Number.isFinite(h) ? h : 0}`;
          },
          end: () => `+=${window.innerHeight * (n - 1) * 0.9}`,
          scrub: 0.7,
          invalidateOnRefresh: true,
        },
      });
      for (let step = 0; step < n - 1; step++) {
        tl.addLabel(`s${step}`);
        tl.to(cards[step], { ...EXIT, xPercent: -50, zIndex: 20 }, `s${step}`);
        for (let j = step + 1; j < n; j++) {
          tl.to(cards[j], { ...SLOTS[j - step - 1], zIndex: 10 - (j - step - 1) }, `s${step}`);
        }
      }
    },
    { scope: sectionRef, dependencies: [stacked], revertOnUpdate: true },
  );

  // ⚠️ Pas de backdrop-blur/filter/transform sur cette section : elle contient
  // un PIN ScrollTrigger (position:fixed), qu'un filter sur un ancêtre casse.
  return (
    <section ref={sectionRef} id="solutions" className="py-16 bg-white overflow-hidden">
      <div ref={pinRef} className={stacked ? undefined : 'min-h-screen flex flex-col justify-center'}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center mb-10">
            <h2 className="solutions-title text-4xl lg:text-5xl font-bold mb-6 text-slate-900 tracking-tight">
              {t('features.heading')}
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">{t('features.subtitle')}</p>
          </div>
        </div>

        {stacked ? (
          <div className="max-w-xl mx-auto px-4 space-y-6">
            {USE_CASES.map((useCase) => (
              <motion.div
                key={useCase.profileKey}
                // Entrée VERTICALE seule : un décalage horizontal (±400 px)
                // sortait la carte de la section `overflow-hidden` sur un
                // téléphone, l'observateur ne la voyait jamais entrer et elle
                // restait à opacité 0 (grand vide).
                initial={reduceMotion ? false : { opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ type: 'spring', stiffness: 65, damping: 14, mass: 1 }}
                className={CARD_CLASS}
              >
                <UseCaseCard useCase={useCase} onClick={() => handleFeatureClick(useCase.path)} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div ref={fanRef} className="relative mx-auto h-[640px] w-full max-w-5xl">
            {USE_CASES.map((useCase, index) => (
              <div
                key={useCase.profileKey}
                className={`solution-card absolute left-1/2 top-0 w-[min(30rem,86vw)] origin-[50%_120%] shadow-[0_30px_60px_-34px_rgba(15,23,42,0.35)] ${CARD_CLASS}`}
                style={{
                  zIndex: 10 - index,
                  transform: `translateX(calc(-50% + ${SLOTS[index].x}px)) translateY(${SLOTS[index].y}px) rotate(${SLOTS[index].rotate}deg) scale(${SLOTS[index].scale})`,
                }}
              >
                <UseCaseCard useCase={useCase} onClick={() => handleFeatureClick(useCase.path)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default SolutionsSection;
