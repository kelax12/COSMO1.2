import React from 'react';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import ScrollHighlight from './ScrollHighlight';
import { MORE_FEATURE_GROUPS } from './data';

/**
 * Section « Plus » : treize fonctionnalités que les cinq étapes ne montrent
 * pas, rangées par MOMENT d'usage (la semaine, le suivi, les arrivées et
 * départs, la mémoire), pas par famille technique.
 *
 * Chaque titre dit le bénéfice, chaque phrase montre la scène. ❌ Pas d'icône
 * ni de grille de cartes : quatre blocs à filets, le moment à gauche, ses
 * fonctionnalités à droite, comme l'étape 1.
 *
 * Placée APRÈS l'étape 5 et AVANT la sécurité, sans numéro d'étape.
 */
const MoreFeaturesSection: React.FC = () => {
  const { t } = useT('landingEnterprise');

  return (
    <section
      id="fonctionnalites"
      className="relative scroll-mt-40 border-t border-white/[0.06] py-16 lg:py-[85px]"
      aria-labelledby="more-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-14 max-w-3xl">
          <h2
            id="more-title"
            className="mb-5 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl"
          >
            {t('enterprise.more.title')}
          </h2>
          <p className="text-base leading-relaxed text-slate-400 lg:text-lg">
            <ScrollHighlight text={t('enterprise.more.subtitle')} />
          </p>
        </header>

        <div className="divide-y divide-white/[0.08] border-t border-white/[0.08]">
          {MORE_FEATURE_GROUPS.map(({ titleKey, features }) => (
            <div key={titleKey} className="grid gap-6 py-10 lg:grid-cols-[0.6fr_1.4fr] lg:gap-16">
              <h3 className="font-mono text-caption uppercase tracking-[0.2em] text-cosmo-300">{t(titleKey)}</h3>
              <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
                {features.map((n) => (
                  <li key={n}>
                    <h4 className="mb-1.5 text-base font-medium text-white">
                      {t(`enterprise.more.f${n}t` as KeyOf<'landingEnterprise'>)}
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {t(`enterprise.more.f${n}d` as KeyOf<'landingEnterprise'>)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MoreFeaturesSection;
