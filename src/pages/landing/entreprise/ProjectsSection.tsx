import React, { useRef, useState } from 'react';
import { LayoutList, SquareKanban, CalendarRange } from 'lucide-react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import AppShot from './AppShot';
import StepSection from './StepSection';
import { SHOTS, type AppShotRef } from './data';

/** Ce qu'on peut faire d'un projet une fois l'organisation en place. */
const POINTS: { titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { titleKey: 'enterprise.projects.p1t', bodyKey: 'enterprise.projects.p1d' },
  { titleKey: 'enterprise.projects.p2t', bodyKey: 'enterprise.projects.p2d' },
  { titleKey: 'enterprise.projects.p3t', bodyKey: 'enterprise.projects.p3d' },
];

/** Les trois lectures d'un même projet, dans l'ordre où le scroll les montre. */
const VIEWS: { shot: AppShotRef; labelKey: KeyOf<'landing'>; Icon: typeof LayoutList }[] = [
  { shot: SHOTS.projects, labelKey: 'enterprise.projects.viewList', Icon: LayoutList },
  { shot: SHOTS.projectsKanban, labelKey: 'enterprise.projects.viewKanban', Icon: SquareKanban },
  { shot: SHOTS.projectsPlanning, labelKey: 'enterprise.projects.viewPlanning', Icon: CalendarRange },
];

/**
 * Étape 2 — les projets, et surtout l'échelle à laquelle on les attribue.
 *
 * Le point que la page ne disait pas : une tâche de projet s'assigne à qui on
 * veut dans son périmètre, d'une personne à toute une équipe, et la personne
 * assignée la retrouve dans son propre Cosmo. C'est ce qui distingue le mode
 * entreprise d'un tableau partagé de plus.
 *
 * La capture change de vue AU SCROLL plutôt qu'au clic : la scène se pin
 * (`ScrollTrigger`, pas de `preventDefault` manuel sur `wheel`) le temps de
 * dérouler les trois lectures d'un même projet — Liste, Tableau, Planning —
 * puis rend la main au scroll normal une fois la 3ᵉ vue affichée. C'est la
 * même mécanique que « Colonnes » dans l'onglet Projets réel, montrée sans
 * qu'on ait à cliquer.
 */
const ProjectsSection: React.FC = () => {
  const { t } = useT('landing');
  const sceneRef = useRef<HTMLDivElement>(null);
  const [viewIndex, setViewIndex] = useState(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      // Le pin capture le scroll : sous `prefers-reduced-motion`, on ne le
      // pose pas — les trois vues restent accessibles via les onglets ci-dessous.
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        ScrollTrigger.create({
          trigger: sceneRef.current,
          start: 'top top+=88',
          end: '+=180%',
          pin: true,
          anticipatePin: 1,
          snap: { snapTo: [0, 0.5, 1], duration: 0.3, ease: 'power1.inOut' },
          onUpdate: (self) => setViewIndex(Math.round(self.progress * (VIEWS.length - 1))),
        });
      });
    },
    { scope: sceneRef },
  );

  return (
    <StepSection
      id="projets"
      step={2}
      titleKey="enterprise.projects.title"
      subtitleKey="enterprise.projects.subtitle"
    >
      <div ref={sceneRef} className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-14">
        <ul className="space-y-6">
          {POINTS.map(({ titleKey, bodyKey }) => (
            <li key={titleKey} className="border-l border-white/[0.12] pl-5">
              <h3 className="mb-1.5 text-base font-semibold text-white">{t(titleKey)}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{t(bodyKey)}</p>
            </li>
          ))}
        </ul>

        <div>
          <div className="relative aspect-[16/10]">
            {VIEWS.map(({ shot, labelKey }, index) => (
              <div
                key={shot.id}
                aria-hidden={index === viewIndex ? undefined : true}
                className="absolute inset-0 transition-opacity duration-500 ease-out"
                style={{ opacity: index === viewIndex ? 1 : 0 }}
              >
                <AppShot src={shot.image} alt={t(shot.altKey)} label={t(labelKey)} />
              </div>
            ))}
          </div>

          {/* Onglets de vue — mêmes trois mots que « Colonnes » dans l'onglet
              Projets réel. Cliquables : le scroll fait défiler les vues, mais
              rien n'oblige à scroller pour les voir toutes (clavier, lecteur
              d'écran, `prefers-reduced-motion`). */}
          <div
            role="tablist"
            aria-label={t('enterprise.projects.title')}
            className="mt-4 flex items-center justify-center gap-1.5"
          >
            {VIEWS.map(({ shot, labelKey, Icon }, index) => (
              <button
                key={shot.id}
                type="button"
                role="tab"
                aria-selected={index === viewIndex}
                onClick={() => setViewIndex(index)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-caption uppercase tracking-[0.16em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                  index === viewIndex
                    ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-200'
                    : 'border-white/[0.08] text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={12} aria-hidden="true" />
                {t(labelKey)}
              </button>
            ))}
          </div>

          <p className="motion-reduce:hidden mt-2 text-center font-mono text-caption uppercase tracking-[0.2em] text-slate-600">
            {t('enterprise.projects.scrollHint')}
          </p>
        </div>
      </div>
    </StepSection>
  );
};

export default ProjectsSection;
