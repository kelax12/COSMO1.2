import React from 'react';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import AppShot from './AppShot';
import StepSection from './StepSection';
import { SHOTS } from './data';

/** Les trois arguments de l'étape, dans l'ordre où ils répondent à « qui bloque quoi ». */
const POINTS: { titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { titleKey: 'enterprise.execution.p1t', bodyKey: 'enterprise.execution.p1d' },
  { titleKey: 'enterprise.execution.p2t', bodyKey: 'enterprise.execution.p2d' },
  { titleKey: 'enterprise.execution.p3t', bodyKey: 'enterprise.execution.p3d' },
];

/**
 * Étape 3 : l'exécution. Le tableau de tâches transverse, les cinq statuts de
 * flux, les dépendances et le chemin critique.
 *
 * Deux VRAIES captures (2026-10-02), plus de mockup : l'onglet Tâches en vue
 * Tableau, une colonne par statut, et en surimpression la fiche d'une tâche
 * bloquée ouverte sur son onglet Dépendances. Les deux viennent de la même
 * démo : « Audit accessibilité WCAG », dans la colonne Bloquée du tableau, est
 * la tâche dont la fiche dit « Bloquée par Intégration du header responsive ».
 * Si le seed démo change cette chaîne (`DEMO_TASK_DEPENDENCIES`), recapturer.
 *
 * La fiche est une image à part et pas un recadrage du tableau : un détail lu
 * à 40 % de sa taille resterait illisible. Sous `sm`, elle passe sous le
 * tableau au lieu de le recouvrir.
 */
const ExecutionSection: React.FC = () => {
  const { t } = useT('landing');
  const deps = SHOTS.tasksDeps;

  return (
    <StepSection
      id="execution"
      step={3}
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

        <div className="relative sm:pb-24">
          <div className="aspect-[16/10]">
            <AppShot
              src={SHOTS.tasksBoard.image}
              alt={t(SHOTS.tasksBoard.altKey)}
              label={t(SHOTS.tasksBoard.labelKey)}
            />
          </div>

          {/* La fiche bloquée, posée sur les colonnes les plus vides du
              tableau (En relecture, Bloquée, Terminée). Liseré cyan : c'est
              l'élément sur lequel l'étape insiste. */}
          <figure className="mt-4 overflow-hidden rounded-xl border border-cyan-300/30 bg-[#0A0C11] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)] sm:absolute sm:bottom-0 sm:right-[-1rem] sm:mt-0 sm:w-[72%]">
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-white/10" />
                <span className="h-2 w-2 rounded-full bg-white/10" />
                <span className="h-2 w-2 rounded-full bg-cyan-400/60" />
              </span>
              <figcaption className="ml-1 truncate font-mono text-caption uppercase tracking-[0.2em] text-slate-500">
                {t(deps.labelKey)}
              </figcaption>
            </div>
            <img
              src={deps.image}
              alt={t(deps.altKey)}
              width={1152}
              height={516}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
          </figure>
        </div>
      </div>
    </StepSection>
  );
};

export default ExecutionSection;
