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
 *   · les dépendances : une chaîne de trois tâches reproduite en HTML
 *     (terminée → en cours → bloquée), plus lisible qu'une capture de fiche.
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

/** La chaîne de dépendances illustrée : terminée, en cours, bloquée. */
const DEPS = [
  {
    key: 'deps1',
    status: 'statusDone',
    tone: { ring: 'border-emerald-500/50', dot: 'bg-emerald-500', text: 'text-slate-400 line-through decoration-slate-600', pill: 'bg-emerald-500/10 text-emerald-300' },
  },
  {
    key: 'deps2',
    status: 'statusDoing',
    tone: { ring: 'border-cosmo-300/60', dot: 'bg-cosmo-400', text: 'text-white', pill: 'bg-cosmo-400/15 text-cosmo-200' },
  },
  {
    key: 'deps3',
    status: 'statusBlocked',
    tone: { ring: 'border-red-500/50', dot: 'bg-red-500', text: 'text-white', pill: 'bg-red-500/10 text-red-300' },
  },
] as const;

const ExecutionSection: React.FC = () => {
  const { t } = useT('landingEnterprise');
  const k = (suffix: string) => t(`enterprise.execution.${suffix}` as 'enterprise.execution.title');

  const healthMenu = (
    <figure
      className="mx-auto w-full max-w-xs overflow-hidden [zoom:0.85] rounded-xl border border-white/[0.08] bg-[#1C1D20] p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
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

  // La chaîne : chaque tâche attend celle du dessus. La dernière est bloquée
  // tant que la deuxième n'est pas terminée : c'est tout ce que la règle dit.
  const depsChain = (
    <figure
      className="mx-auto w-full max-w-md rounded-xl border border-white/[0.08] bg-[#1C1D20] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
      aria-label={k('depsAria')}
    >
      <ol>
        {DEPS.map(({ key, status, tone }, index) => (
          <li key={key} className="relative pb-6 pl-8 last:pb-0">
            {index < DEPS.length - 1 && (
              <span className="absolute left-[7px] top-5 h-[calc(100%-0.75rem)] w-px bg-white/15" aria-hidden="true" />
            )}
            <span
              className={`absolute left-0 top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full border ${tone.ring}`}
              aria-hidden="true"
            >
              <span className={`h-[7px] w-[7px] rounded-full ${tone.dot}`} />
            </span>
            <div className="flex items-baseline justify-between gap-4">
              <span className={`text-sm ${tone.text}`}>{k(key)}</span>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${tone.pill}`}>{k(status)}</span>
            </div>
            {index > 0 && <p className="mt-1 text-xs text-slate-500">{k('depsWaits')}</p>}
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-white/[0.06] pt-4 text-xs text-amber-400">{k('depsBlocked')}</p>
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
    { id: 'p3', visual: depsChain },
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
