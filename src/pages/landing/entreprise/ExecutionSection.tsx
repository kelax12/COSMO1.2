import React from 'react';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import AppShot from './AppShot';
import StepSection from './StepSection';
import { SHOTS } from './data';

/** Les trois arguments de l'étape, dans l'ordre où ils répondent à « qui bloque quoi ». */
const POINTS: { titleKey: KeyOf<'landingEnterprise'>; bodyKey: KeyOf<'landingEnterprise'> }[] = [
  { titleKey: 'enterprise.execution.p1t', bodyKey: 'enterprise.execution.p1d' },
  { titleKey: 'enterprise.execution.p2t', bodyKey: 'enterprise.execution.p2d' },
  { titleKey: 'enterprise.execution.p3t', bodyKey: 'enterprise.execution.p3d' },
];

/**
 * Étape 2 : l'exécution. Le tableau de tâches transverse, les cinq statuts de
 * flux, les dépendances et le chemin critique.
 *
 * Une VRAIE capture : l'onglet Tâches en vue Tableau, une colonne par statut.
 */
const ExecutionSection: React.FC = () => {
  const { t } = useT('landingEnterprise');

  return (
    <StepSection
      id="execution"
      step={2}
      titleKey="enterprise.execution.title"
      subtitleKey="enterprise.execution.subtitle"
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

        <div className="relative">
          <div className="aspect-[16/10]">
            <AppShot
              src={SHOTS.tasksBoard.image}
              alt={t(SHOTS.tasksBoard.altKey)}
              label={t(SHOTS.tasksBoard.labelKey)}
            />
          </div>
        </div>
      </div>
    </StepSection>
  );
};

export default ExecutionSection;
