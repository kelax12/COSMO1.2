import React from 'react';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import AppShot from './AppShot';
import StepSection from './StepSection';
import { SHOTS } from './data';

/** Ce qu'on peut faire d'un projet une fois l'organisation en place. */
const POINTS: { titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { titleKey: 'enterprise.projects.p1t', bodyKey: 'enterprise.projects.p1d' },
  { titleKey: 'enterprise.projects.p2t', bodyKey: 'enterprise.projects.p2d' },
  { titleKey: 'enterprise.projects.p3t', bodyKey: 'enterprise.projects.p3d' },
];

/**
 * Étape 2 — les projets, et surtout l'échelle à laquelle on les attribue.
 *
 * Le point que la page ne disait pas : une tâche de projet s'assigne à qui on
 * veut dans son périmètre, d'une personne à toute une équipe, et la personne
 * assignée la retrouve dans son propre Cosmo. C'est ce qui distingue le mode
 * entreprise d'un tableau partagé de plus.
 */
const ProjectsSection: React.FC = () => {
  const { t } = useT('landing');

  return (
    <StepSection
      id="projets"
      step={2}
      titleKey="enterprise.projects.title"
      subtitleKey="enterprise.projects.subtitle"
    >
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-14">
        <ul className="space-y-6">
          {POINTS.map(({ titleKey, bodyKey }) => (
            <li key={titleKey} className="border-l border-white/[0.12] pl-5">
              <h3 className="mb-1.5 text-base font-semibold text-white">{t(titleKey)}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{t(bodyKey)}</p>
            </li>
          ))}
        </ul>

        <div className="aspect-[16/10]">
          <AppShot
            src={SHOTS.projects.image}
            alt={t(SHOTS.projects.altKey)}
            label={t(SHOTS.projects.labelKey)}
          />
        </div>
      </div>
    </StepSection>
  );
};

export default ProjectsSection;
