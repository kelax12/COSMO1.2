import React, { useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useT } from '@/i18n/useT';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import AppShot from './AppShot';
import { COCKPIT_TABS } from './data';

/**
 * Section « cockpit » — les six onglets de l'espace entreprise, parcourus au
 * scroll dans une scène épinglée.
 *
 * Ce que le visiteur voit ici sont les **vraies captures** de l'application en
 * mode démo (cf. `AppShot`), pas des schémas : la démonstration ne vaut que si
 * l'écran montré est celui qu'il obtiendra en cliquant.
 *
 * Deux rendus, choisis à la volée :
 *   • épinglé (desktop, mouvement autorisé) — la scène reste fixe pendant que
 *     l'index progresse ; c'est le moment démonstratif de la page ;
 *   • déroulé (mobile ou `prefers-reduced-motion`) — les six onglets se
 *     suivent verticalement. Aucune information n'est perdue, et rien ne
 *     dépend d'un `transform` pour être à sa place.
 */
const CockpitSection: React.FC = () => {
  const { t } = useT('landing');
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const pinned = !isMobile && !reduceMotion;

  return (
    <section
      id="cockpit"
      className="relative scroll-mt-40 border-t border-white/[0.06] py-24 lg:py-32"
      aria-labelledby="cockpit-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-14 max-w-3xl">
          <span className="mb-4 block font-mono text-caption uppercase tracking-[0.3em] text-cyan-400/80">
            {t('enterprise.cockpit.eyebrow')}
          </span>
          <h2
            id="cockpit-title"
            className="mb-5 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl"
          >
            {t('enterprise.cockpit.title')}
          </h2>
          <p className="text-base leading-relaxed text-slate-400 lg:text-lg">
            {t('enterprise.cockpit.subtitle')}
          </p>
        </header>
      </div>

      {pinned ? <PinnedCockpit /> : <StackedCockpit />}
    </section>
  );
};

/** Rendu épinglé : une scène fixe, un index piloté par la progression. */
const PinnedCockpit: React.FC = () => {
  const { t } = useT('landing');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const steps = COCKPIT_TABS.length;
        ScrollTrigger.create({
          trigger: wrapperRef.current,
          start: 'top top',
          // Une hauteur d'écran par onglet : la cadence reste lisible même en
          // scroll rapide, et la section se termine sur le dernier onglet.
          end: () => `+=${steps * 100}%`,
          pin: '.cockpit-stage',
          pinSpacing: true,
          scrub: true,
          onUpdate: (self) => {
            const index = Math.min(steps - 1, Math.floor(self.progress * steps));
            setActive((current) => (current === index ? current : index));
          },
        });

        // Dérive lente de la pile de captures pendant toute la traversée : la
        // scène est épinglée, ce léger mouvement l'empêche de paraître figée.
        gsap.fromTo(
          '.cockpit-screens',
          { yPercent: 2.5 },
          {
            yPercent: -2.5,
            ease: 'none',
            scrollTrigger: {
              trigger: wrapperRef.current,
              start: 'top top',
              end: () => `+=${steps * 100}%`,
              scrub: true,
            },
          },
        );
      });
    },
    { scope: wrapperRef },
  );

  return (
    <div ref={wrapperRef}>
      {/* La scène épinglée occupe toute la hauteur d'écran et centre son
          contenu : épinglée à `top top`, un bloc plus court se collerait sous
          le header avec un grand vide en dessous. Le `pt-28` réserve la place
          du header flottant et de la barre d'ancres. */}
      <div className="cockpit-stage mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 pb-10 pt-28 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[0.58fr_1.42fr]">
          {/* Rail des onglets : l'onglet courant est éclairé, les autres restent
              lisibles pour montrer qu'il y en a six. */}
          <ol className="flex flex-col gap-1">
            {COCKPIT_TABS.map((item, index) => {
              const isActive = index === active;
              return (
                <li key={item.id}>
                  <div
                    className={`relative rounded-lg border-l-2 py-3 pl-5 pr-3 transition-colors duration-400 ${
                      isActive ? 'border-cyan-400 bg-white/[0.03]' : 'border-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        className={`font-mono text-caption tabular-nums transition-colors duration-400 ${
                          isActive ? 'text-cyan-400' : 'text-slate-600'
                        }`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`text-base font-semibold transition-colors duration-400 ${
                          isActive ? 'text-white' : 'text-slate-500'
                        }`}
                      >
                        {t(item.labelKey)}
                      </span>
                    </div>
                    {/* La description n'apparaît que pour l'onglet courant :
                        `grid-template-rows` 0fr→1fr anime la hauteur sans
                        transform, donc sans position finale à risque. */}
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-400 ease-out ${
                        isActive ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <p className="overflow-hidden text-sm leading-relaxed text-slate-400">
                        <span className="block pt-2">{t(item.descriptionKey)}</span>
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Scène : la capture de l'onglet courant, en fondu enchaîné. */}
          <div className="cockpit-screens relative aspect-[16/10]">
            <div
              className="pointer-events-none absolute -inset-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(34,211,238,0.12),transparent_70%)]"
              aria-hidden="true"
            />
            {COCKPIT_TABS.map((item, index) => (
              <div
                key={item.id}
                aria-hidden={index !== active}
                // Le zoom léger de la capture entrante donne le sentiment
                // qu'elle « arrive » ; l'inactive reste à l'échelle 1,01 pour
                // que la transition ne parte jamais de zéro.
                className={`absolute inset-0 transition-[opacity,transform] duration-500 ease-out ${
                  index === active
                    ? 'scale-100 opacity-100'
                    : 'pointer-events-none scale-[1.015] opacity-0'
                }`}
              >
                <AppShot
                  src={item.image}
                  alt={t(item.altKey)}
                  label={t(item.labelKey)}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Progression : six segments, celui de l'onglet courant est plein. */}
        <div className="mt-8 flex gap-1.5" aria-hidden="true">
          {COCKPIT_TABS.map((item, index) => (
            <span
              key={item.id}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-400 ${
                index <= active ? 'bg-cyan-400' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/** Rendu déroulé : mobile et `prefers-reduced-motion`. */
const StackedCockpit: React.FC = () => {
  const { t } = useT('landing');
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
      {COCKPIT_TABS.map((item, index) => (
        <article key={item.id} className="grid gap-5 sm:grid-cols-2 sm:items-center sm:gap-7">
          <div>
            <span className="font-mono text-caption tabular-nums text-cyan-400">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mb-2 mt-1 text-lg font-semibold text-white">{t(item.labelKey)}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{t(item.descriptionKey)}</p>
          </div>
          <div className="aspect-[16/10]">
            <AppShot src={item.image} alt={t(item.altKey)} label={t(item.labelKey)} />
          </div>
        </article>
      ))}
    </div>
  );
};

export default CockpitSection;
