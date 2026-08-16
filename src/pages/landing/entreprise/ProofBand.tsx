import React from 'react';
import CountUp from '@/components/reactbits/CountUp';
import { useT } from '@/i18n/useT';
import { PROOF_METRICS } from './data';

/**
 * Bandeau de preuve sous le hero.
 *
 * Des chiffres qui décrivent le PRODUIT, pas une clientèle : la landing ne
 * revendique aucun logo client ni aucun volume d'utilisateurs qu'on ne pourrait
 * pas montrer. Un chiffre invérifiable coûte plus cher qu'il ne rapporte — et
 * un chiffre rhétorique mis dans un compteur animé aussi (cf. `PROOF_METRICS`).
 */
const ProofBand: React.FC = () => {
  const { t } = useT('landing');

  return (
    <div className="border-y border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-white/[0.06] px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
        {PROOF_METRICS.map(({ value, suffix, labelKey }) => (
          <div key={labelKey} className="flex flex-col gap-1.5 px-4 py-8 sm:px-6">
            <span className="flex items-baseline text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
              <CountUp to={value} duration={1.6} className="tabular-nums" />
              {suffix && <span className="text-cyan-400">{suffix}</span>}
            </span>
            <span className="text-xs leading-snug text-slate-500 sm:text-sm">{t(labelKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProofBand;
