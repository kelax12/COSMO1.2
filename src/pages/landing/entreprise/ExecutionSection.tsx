import React from 'react';
import { useT } from '@/i18n/useT';
import AppShot from './AppShot';
import StepSection from './StepSection';
import { SHOTS } from './data';

/**
 * Étape 2 : l'exécution. Trois points, chacun avec SON image :
 *   · l'état déclaré d'une tâche (mig. 204), menu reproduit en HTML : une
 *     capture de 220 px serait floue, et le menu se traduit ;
 *   · les cinq statuts : la vraie capture du Tableau ;
 *   · les dépendances : la vraie capture de la fiche, onglet Dépendances.
 *
 * Une rangée par point, texte à gauche et image à droite : le visiteur lit
 * une affirmation, puis la voit dans le produit.
 */

/** Les quatre états, couleurs et libellés du menu « État » de l'app. */
const HEALTH = [
  { key: 'healthOnTrack', dot: 'bg-emerald-500' },
  { key: 'healthAtRisk', dot: 'bg-amber-500' },
  { key: 'healthOffTrack', dot: 'bg-red-500' },
  { key: 'healthDone', dot: 'bg-cosmo-400' },
] as const;

const ExecutionSection: React.FC = () => {
  const { t } = useT('landingEnterprise');
  const k = (suffix: string) => t(`enterprise.execution.${suffix}` as 'enterprise.execution.title');

  const healthMenu = (
    <figure
      className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-white/[0.08] bg-[#1C1D20] p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
      aria-label={k('healthAria')}
    >
      <p className="px-3 pb-1 pt-2 text-sm font-medium text-white">{k('healthLabel')}</p>
      <ul>
        {HEALTH.map(({ key, dot }) => (
          <li key={key} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-200">
            <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
            {k(key)}
          </li>
        ))}
      </ul>
    </figure>
  );

  const rows: { id: string; visual: React.ReactNode }[] = [
    { id: 'p1', visual: healthMenu },
    {
      id: 'p2',
      visual: (
        <div className="aspect-[16/10]">
          <AppShot
            src={SHOTS.tasksBoard.image}
            alt={t(SHOTS.tasksBoard.altKey)}
            label={t(SHOTS.tasksBoard.labelKey)}
          />
        </div>
      ),
    },
    {
      id: 'p3',
      visual: (
        <AppShot
          src={SHOTS.tasksDeps.image}
          alt={t(SHOTS.tasksDeps.altKey)}
          label={t(SHOTS.tasksDeps.labelKey)}
        />
      ),
    },
  ];

  return (
    <StepSection
      id="execution"
      step={2}
      titleKey="enterprise.execution.title"
      subtitleKey="enterprise.execution.subtitle"
    >
      <ol className="divide-y divide-white/[0.08] border-t border-white/[0.08]">
        {rows.map(({ id, visual }, index) => (
          <li key={id} className="grid items-center gap-8 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <h3 className="flex items-baseline gap-4 text-xl font-medium text-white">
                <span className="font-mono text-caption tabular-nums text-cosmo-300">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {k(`${id}t`)}
              </h3>
              <p className="mt-3 pl-9 text-base leading-relaxed text-slate-400">{k(`${id}d`)}</p>
            </div>
            <div>{visual}</div>
          </li>
        ))}
      </ol>
    </StepSection>
  );
};

export default ExecutionSection;
