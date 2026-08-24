import React from 'react';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import ScrollHighlight from './ScrollHighlight';

interface StepSectionProps {
  /** Ancre de la section, utilisée par `TRACK_ANCHORS`. */
  id: string;
  /** Rang affiché dans l'en-tête (1 → « 01 »). */
  step: number;
  titleKey: KeyOf<'landing'>;
  subtitleKey: KeyOf<'landing'>;
  children: React.ReactNode;
}

/**
 * Le cadre commun des quatre étapes de mise en place.
 *
 * La landing entreprise n'est pas un catalogue de fonctionnalités : elle suit
 * l'ordre dans lequel on met réellement Cosmo en place — on invite et on
 * structure, on crée des projets, on pose des objectifs, on regarde ce qui
 * avance. Le visiteur qui la lit jusqu'au bout a fait son onboarding avant
 * d'avoir créé son compte, et retrouve les mêmes écrans dans le produit.
 *
 * Le rang n'est pas décoratif : c'est lui qui promet une suite, et qui fait
 * lire la page comme une marche à suivre plutôt que comme une liste d'arguments.
 */
const StepSection: React.FC<StepSectionProps> = ({ id, step, titleKey, subtitleKey, children }) => {
  const { t } = useT('landing');

  return (
    <section
      id={id}
      className="relative scroll-mt-40 border-t border-white/[0.06] py-24 lg:py-32"
      aria-labelledby={`${id}-title`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-14 max-w-3xl">
          <p className="mb-5 flex items-center gap-3 font-mono text-caption uppercase tracking-[0.25em] text-cyan-400">
            <span className="h-px w-8 bg-cyan-400/40" aria-hidden="true" />
            {t('enterprise.steps.of', { step, total: 5 })}
          </p>
          <h2
            id={`${id}-title`}
            className="mb-5 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl"
          >
            {t(titleKey)}
          </h2>
          <p className="text-base leading-relaxed text-slate-400 lg:text-lg">
            <ScrollHighlight text={t(subtitleKey)} />
          </p>
        </header>

        {children}
      </div>
    </section>
  );
};

export default StepSection;
