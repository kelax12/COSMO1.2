import React from 'react';
import {
  ArchiveRestore, BadgeCheck, BellRing, CalendarPlus, Copy, Download, Filter, KeyRound, Link2,
  ListChecks, Rocket, ScrollText, Search, Target, Timer, UserCog, UserMinus, UsersRound, Webhook, Zap,
  type LucideIcon,
} from 'lucide-react';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import ScrollHighlight from './ScrollHighlight';
import { MORE_FEATURE_GROUPS, type MoreFeatureIcon } from './data';

const ICONS: Record<MoreFeatureIcon, LucideIcon> = {
  ArchiveRestore, BadgeCheck, BellRing, CalendarPlus, Copy, Download, Filter, KeyRound, Link2,
  ListChecks, Rocket, ScrollText, Search, Target, Timer, UserCog, UserMinus, UsersRound, Webhook, Zap,
};

/**
 * Section « Plus » : vingt fonctionnalités que les cinq étapes ne montrent pas.
 *
 * Placée APRÈS l'étape 5 et AVANT la sécurité : les étapes restent la marche à
 * suivre (le visiteur y fait son onboarding), et cette grille répond à la
 * question suivante d'un décideur, « et pour le quotidien, il y a quoi ? »,
 * sans casser la numérotation « Étape n sur 5 ».
 *
 * Pas d'animation : vingt cartes qui bougent au scroll coûtent sur le fil
 * principal pour un contenu qui se lit, et ne se regarde pas.
 */
const MoreFeaturesSection: React.FC = () => {
  const { t } = useT('landingEnterprise');

  return (
    <section
      id="fonctionnalites"
      className="relative scroll-mt-40 border-t border-white/[0.06] py-24 lg:py-32"
      aria-labelledby="more-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-14 max-w-3xl">
          <p className="mb-5 flex items-center gap-3 font-mono text-caption uppercase tracking-[0.25em] text-cyan-400">
            <span className="h-px w-8 bg-cyan-400/40" aria-hidden="true" />
            {t('enterprise.more.eyebrow')}
          </p>
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

        <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-4">
          {MORE_FEATURE_GROUPS.map(({ titleKey, features }) => (
            <div key={titleKey}>
              <h3 className="mb-6 border-b border-white/[0.08] pb-3 font-mono text-caption uppercase tracking-[0.2em] text-slate-400">
                {t(titleKey)}
              </h3>
              <ul className="space-y-6">
                {features.map(({ n, icon }) => {
                  const Icon = ICONS[icon];
                  return (
                    <li key={n} className="flex gap-4">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-400/[0.06] text-cyan-300"
                        aria-hidden="true"
                      >
                        <Icon size={16} />
                      </span>
                      <div>
                        <h4 className="mb-1 text-sm font-semibold text-white">
                          {t(`enterprise.more.f${n}t` as KeyOf<'landingEnterprise'>)}
                        </h4>
                        <p className="text-sm leading-relaxed text-slate-400">
                          {t(`enterprise.more.f${n}d` as KeyOf<'landingEnterprise'>)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MoreFeaturesSection;
