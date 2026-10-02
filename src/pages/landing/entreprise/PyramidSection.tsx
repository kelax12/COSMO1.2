import React from 'react';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { SHOTS } from './data';
import AppShot from './AppShot';
import StepSection from './StepSection';

/**
 * Ce que la hiérarchie permet, une fois qu'elle est posée.
 *
 * L'organigramme n'est pas un trombinoscope : c'est depuis lui qu'on manage
 * chaque personne. Les deux premières cartes disent la règle (périmètre,
 * réorganisation), les deux suivantes disent les gestes quotidiens qu'elle
 * autorise.
 */
const PYRAMID_BENEFITS: { titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { titleKey: 'enterprise.pyramid.b1t', bodyKey: 'enterprise.pyramid.b1d' },
  { titleKey: 'enterprise.pyramid.b2t', bodyKey: 'enterprise.pyramid.b2d' },
  { titleKey: 'enterprise.pyramid.b3t', bodyKey: 'enterprise.pyramid.b3d' },
  { titleKey: 'enterprise.pyramid.b4t', bodyKey: 'enterprise.pyramid.b4d' },
];

/**
 * Étape 1 : inviter, rattacher, regrouper.
 *
 * C'est le premier geste réel : sans personne dans l'organisation, aucune des
 * étapes suivantes n'existe. La section montre le seul argument qu'on ne
 * trouve nulle part ailleurs : le périmètre de chacun est DÉDUIT de la
 * hiérarchie, et c'est depuis l'organigramme qu'on suit chaque personne.
 *
 * 2026-10-02 : la reproduction interactive de l'organigramme (cartes, liens
 * SVG animés, menu par membre) est remplacée par une CAPTURE du vrai onglet
 * Organigramme, charge affichée. Une reproduction dérive du produit sans que
 * rien ne le signale ; une capture se refait en une commande
 * (`scripts/capture-entreprise-shots.mjs`, `SHOTS_ONLY=pyramide`).
 */
const PyramidSection: React.FC = () => {
  const { t } = useT('landing');

  return (
    <StepSection
      id="equipes"
      step={1}
      titleKey="enterprise.pyramid.title"
      subtitleKey="enterprise.pyramid.subtitle"
    >
      {/* Comment on démarre, avant de montrer le résultat : on invite, on
          rattache, on regroupe. Trois gestes, pas une configuration. */}
      <ol className="mb-8 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-3">
        {(['g1', 'g2', 'g3'] as const).map((key, index) => (
          <li key={key} className="bg-[#0A0C11] p-6">
            <span className="mb-3 block font-mono text-caption tabular-nums text-slate-600">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mb-2 text-sm font-semibold text-white">
              {t(`enterprise.pyramid.${key}t` as 'enterprise.pyramid.g1t')}
            </h3>
            <p className="text-sm leading-relaxed text-slate-500">
              {t(`enterprise.pyramid.${key}d` as 'enterprise.pyramid.g1d')}
            </p>
          </li>
        ))}
      </ol>

      {/* Le vrai organigramme de la démo, en bandeau : l'arbre tient dans la
          moitié haute de l'écran, un cadre 16/10 serait à moitié vide. */}
      <div className="aspect-[12/5]">
        <AppShot
          src={SHOTS.pyramid.image}
          alt={t(SHOTS.pyramid.altKey)}
          label={t(SHOTS.pyramid.labelKey)}
        />
      </div>

      {/* ── Ce que l'organigramme vous permet de faire, concrètement ── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PYRAMID_BENEFITS.map(({ titleKey, bodyKey }) => (
          <div
            key={titleKey}
            className="rounded-xl border border-white/[0.08] bg-[#0A0C11] p-6 transition-colors duration-300 hover:border-cyan-300/25"
          >
            <h3 className="mb-2 text-sm font-semibold text-white">{t(titleKey)}</h3>
            <p className="text-sm leading-relaxed text-slate-500">{t(bodyKey)}</p>
          </div>
        ))}
      </div>

      {/* L'annuaire ferme l'étape : après la hiérarchie, les personnes. */}
      <div className="mt-8 aspect-[16/10] max-w-4xl">
        <AppShot
          src={SHOTS.members.image}
          alt={t(SHOTS.members.altKey)}
          label={t(SHOTS.members.labelKey)}
        />
      </div>
    </StepSection>
  );
};

export default PyramidSection;
