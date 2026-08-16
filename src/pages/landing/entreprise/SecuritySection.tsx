import React from 'react';
import { Database, EyeOff, ScrollText, Undo2 } from 'lucide-react';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import { useT } from '@/i18n/useT';
import { SECURITY_POINTS } from './data';

const ICONS = [Database, EyeOff, ScrollText, Undo2];

/**
 * Section « confiance » — les quatre objections qui bloquent un déploiement.
 *
 * Placée juste avant les tarifs, à l'endroit exact où un décideur se demande
 * ce qu'il devra défendre en interne. Le curseur éclaire chaque carte : le
 * `SpotlightCard` de react-bits, repeint aux couleurs du track (cyan sur
 * graphite) plutôt qu'au neutre livré par défaut.
 */
const SecuritySection: React.FC = () => {
  const { t } = useT('landing');

  return (
    <section
      id="securite"
      className="relative scroll-mt-40 border-t border-white/[0.06] py-24 lg:py-32"
      aria-labelledby="security-title"
    >
      {/* Halo froid : la zone « sérieuse » de la page. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,rgba(34,211,238,0.06),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12 max-w-3xl">
          <span className="mb-4 block font-mono text-caption uppercase tracking-[0.3em] text-cyan-400/80">
            {t('enterprise.security.eyebrow')}
          </span>
          <h2
            id="security-title"
            className="mb-5 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl"
          >
            {t('enterprise.security.title')}
          </h2>
          <p className="text-base leading-relaxed text-slate-400 lg:text-lg">
            {t('enterprise.security.subtitle')}
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {SECURITY_POINTS.map(({ titleKey, bodyKey }, index) => {
            const Icon = ICONS[index];
            return (
              <SpotlightCard
                key={titleKey}
                spotlightColor="rgba(34, 211, 238, 0.12)"
                className="!rounded-xl !border-white/[0.08] !bg-[#0A0C11] !p-7 transition-colors duration-300 hover:!border-cyan-300/25"
              >
                <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08]">
                  <Icon size={17} className="text-cyan-300" aria-hidden="true" />
                </div>
                <h3 className="mb-2.5 text-base font-semibold text-white">{t(titleKey)}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{t(bodyKey)}</p>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SecuritySection;
