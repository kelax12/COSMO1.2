import React from 'react';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import AppShot from './AppShot';
import ScrollHighlight from './ScrollHighlight';
import StepSection from './StepSection';
import { SHOTS } from './data';

/** Les trois lectures que l'onglet Statistiques rend possibles. */
const POINTS: { titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { titleKey: 'enterprise.progress.p1t', bodyKey: 'enterprise.progress.p1d' },
  { titleKey: 'enterprise.progress.p2t', bodyKey: 'enterprise.progress.p2d' },
  { titleKey: 'enterprise.progress.p3t', bodyKey: 'enterprise.progress.p3d' },
];

/**
 * Étape 4 — ce qu'on regarde une fois que tout tourne.
 *
 * La boucle se referme ici : le périmètre posé à l'étape 1 est exactement ce
 * qui détermine ce que chacun voit dans les statistiques. Une direction lit
 * toute l'organisation, un manager lit son sous-arbre, et personne n'a eu à
 * configurer un droit pour ça.
 */
const ProgressSection: React.FC = () => {
  const { t } = useT('landing');

  return (
    <StepSection
      id="statistiques"
      step={4}
      titleKey="enterprise.progress.title"
      subtitleKey="enterprise.progress.subtitle"
    >
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-14">
        <div className="aspect-[16/10]">
          <AppShot
            src={SHOTS.stats.image}
            alt={t(SHOTS.stats.altKey)}
            label={t(SHOTS.stats.labelKey)}
          />
        </div>

        <ul className="space-y-6">
          {POINTS.map(({ titleKey, bodyKey }) => (
            <li key={titleKey} className="border-l border-white/[0.12] pl-5">
              <h3 className="mb-1.5 text-base font-semibold text-white">{t(titleKey)}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{t(bodyKey)}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* L'aperçu clôt le parcours : c'est l'écran d'accueil quotidien, celui
          sur lequel le visiteur retombera tous les matins. */}
      <div className="mt-10 grid gap-6 rounded-2xl border border-white/[0.08] bg-[#0A0C11] p-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:p-8">
        <div>
          <h3 className="mb-2 text-lg font-semibold text-white">{t('enterprise.progress.overviewTitle')}</h3>
          <p className="text-sm leading-relaxed text-slate-400">
            <ScrollHighlight text={t('enterprise.progress.overviewBody')} />
          </p>
        </div>
        <div className="aspect-[16/10]">
          <AppShot
            src={SHOTS.overview.image}
            alt={t(SHOTS.overview.altKey)}
            label={t(SHOTS.overview.labelKey)}
          />
        </div>
      </div>
    </StepSection>
  );
};

export default ProgressSection;
