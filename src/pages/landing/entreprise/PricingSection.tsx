import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import {
  ENTERPRISE_PRICING_TIERS,
  displayedMonthlyEur,
  yearlyTotalEur,
} from '@/modules/billing/premium-config';
import type { OrgBillingInterval } from '@/modules/billing/premium-config';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import { useT } from '@/i18n/useT';
import { formatPrice } from '@/i18n/format';
import type { KeyOf } from '@/i18n/catalog';
import ScrollHighlight from './ScrollHighlight';
import { ENTERPRISE_FREE_OFFER } from './free-offer';
import { TAP_AREA_44_Y } from '@/components/mobile';

type Tier = (typeof ENTERPRISE_PRICING_TIERS)[number];

const INTERVALS: OrgBillingInterval[] = ['monthly', 'yearly'];

const INCLUDED: KeyOf<'landingEnterprise'>[] = [
  'enterprise.pricing.i1',
  'enterprise.pricing.i2',
  'enterprise.pricing.i3',
  'enterprise.pricing.i4',
  'enterprise.pricing.i5',
];

/**
 * Section tarifs : les six paliers, nommés comme dans l'app.
 *
 * Plus de curseur « combien êtes-vous ? » : le visiteur lit d'un coup d'œil
 * tous les paliers et se place lui-même. Les montants et les noms viennent de
 * `ENTERPRISE_PRICING_TIERS` et de `common.orgTier` : la landing et le produit
 * annoncent le même prix et le même nom.
 *
 * Une seule couleur d'accent, le bleu COSMO : plus de jaune. Le message clé est
 * dit avant les prix : toutes les fonctionnalités sont débloquées dans chaque
 * palier, seul l'effectif change.
 *
 * Pendant l'offre de lancement (`ENTERPRISE_FREE_OFFER`), chaque montant devient
 * « Gratuit » et le tarif d'après reste affiché, barré.
 */
const PricingSection: React.FC<{ onRegister: () => void }> = ({ onRegister }) => {
  const { t } = useT('landingEnterprise');
  // Les noms de paliers vivent dans `common` : ceux de l'app.
  const { t: tc } = useT('common');
  const [billingInterval, setBillingInterval] = useState<OrgBillingInterval>('monthly');

  const tierRange = (tier: Tier) =>
    tier.maxMembers === null
      ? t('enterprise.pricing.tierOpen', { min: tier.minMembers })
      : t('enterprise.pricing.tierRange', { min: tier.minMembers, max: tier.maxMembers });

  return (
    <section
      id="tarifs"
      className="relative scroll-mt-40 border-t border-white/[0.06] py-16 lg:py-[85px]"
      aria-labelledby="pricing-title"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_45%_100%_at_50%_0%,rgba(31,111,235,0.08),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-3xl">
          {ENTERPRISE_FREE_OFFER && (
            <span className="mb-5 inline-flex items-center rounded-full border border-cosmo-300/40 bg-cosmo-400/10 px-3 py-1 font-mono text-caption uppercase tracking-[0.16em] text-cosmo-300">
              {t('enterprise.pricing.promoBadge')}
            </span>
          )}
          <h2
            id="pricing-title"
            className="mb-5 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl lg:text-5xl"
          >
            {t(ENTERPRISE_FREE_OFFER ? 'enterprise.pricing.promoTitle' : 'enterprise.pricing.title')}
          </h2>
          <p className="text-base leading-relaxed text-slate-400 lg:text-lg">
            <ScrollHighlight
              text={t(ENTERPRISE_FREE_OFFER ? 'enterprise.pricing.promoSubtitle' : 'enterprise.pricing.subtitle')}
            />
          </p>
        </header>

        {/* ── Le message clé, avant le premier prix ── */}
        <p className="mb-10 flex items-center gap-4 border-y border-white/[0.08] py-5 text-lg font-medium text-white lg:text-xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cosmo-400" aria-hidden="true">
            <Check size={18} className="text-white" strokeWidth={2.5} />
          </span>
          {t('enterprise.pricing.allUnlocked')}
        </p>

        {/* ── Périodicité, TTC ── */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div
            role="radiogroup"
            aria-label={t('enterprise.pricing.intervalAria')}
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#222428] p-1"
          >
            {INTERVALS.map((option) => {
              const isSelected = billingInterval === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setBillingInterval(option)}
                  className={`${TAP_AREA_44_Y} inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-[background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cosmo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#161719] ${
                    isSelected ? 'bg-cosmo-400/15 text-cosmo-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option === 'monthly' ? t('enterprise.pricing.intervalMonthly') : t('enterprise.pricing.intervalYearly')}
                  {option === 'yearly' && (
                    <span className="rounded-full bg-cosmo-400/20 px-2 py-0.5 font-mono text-caption tracking-[0.1em] text-cosmo-200">
                      {t('enterprise.pricing.intervalSave')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {billingInterval === 'yearly' && (
            <p className="text-sm text-slate-500">{t('enterprise.pricing.intervalYearlyNote')}</p>
          )}
          {/* Affichage TTC : obligation d'affichage au consommateur (L112-1),
              cohérent avec `tax_behavior: inclusive` des prix Stripe live. */}
          <p className="text-sm text-slate-500">{t('enterprise.pricing.vatIncluded')}</p>
        </div>

        {/* ── Les six paliers ── */}
        <ul className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ENTERPRISE_PRICING_TIERS.map((tier) => {
            const price = displayedMonthlyEur(tier.priceEurPerMonth, billingInterval);
            const isFree = tier.priceEurPerMonth === 0 || ENTERPRISE_FREE_OFFER;
            return (
              <li
                key={tier.key}
                className="flex flex-col rounded-xl border border-white/[0.08] bg-[#222428] p-6 transition-colors duration-300 hover:border-cosmo-300/40"
              >
                <span className="text-base font-semibold text-white">{tc(ORG_TIER_LABEL_KEYS[tier.key])}</span>
                <span className="mb-5 mt-1 text-sm text-slate-500">{tierRange(tier)}</span>
                {isFree ? (
                  <>
                    <span className="text-3xl font-bold text-cosmo-300">{t('enterprise.pricing.free')}</span>
                    {tier.priceEurPerMonth > 0 && (
                      <s className="mt-1 text-xs text-slate-500 decoration-slate-600">
                        {t('enterprise.pricing.insteadOfShort', { price: formatPrice(price) })}
                      </s>
                    )}
                  </>
                ) : (
                  <>
                    <span className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold tabular-nums text-white">{formatPrice(price)}</span>
                      <span className="text-2xl font-bold text-slate-500">€</span>
                      <span className="ml-1 text-sm text-slate-500">{t('enterprise.pricing.perMonth')}</span>
                    </span>
                    {billingInterval === 'yearly' && (
                      <span className="mt-1 text-xs text-slate-500">
                        {t('enterprise.pricing.billedYearly', { total: yearlyTotalEur(tier.priceEurPerMonth) })}
                      </span>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {/* ── Ce qui est inclus partout, et l'appel à l'action ── */}
        <div className="grid gap-4 rounded-2xl border border-white/[0.08] bg-[#222428] p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
          <div>
            <h3 className="mb-5 text-sm font-semibold text-white">{t('enterprise.pricing.includedTitle')}</h3>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {INCLUDED.map((key) => (
                <li key={key} className="flex gap-2.5 text-sm text-slate-400">
                  <Check size={15} className="mt-0.5 shrink-0 text-cosmo-300" aria-hidden="true" />
                  {t(key)}
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-white/[0.06] pt-5 text-sm leading-relaxed text-slate-500">
              <ScrollHighlight text={t('enterprise.pricing.autoAdjust')} />
            </p>
          </div>

          <div className="flex flex-col justify-center gap-3 lg:border-l lg:border-white/[0.06] lg:pl-10">
            <button
              onClick={onRegister}
              className="group flex items-center justify-center gap-2.5 rounded-xl bg-cosmo-400 px-6 py-4 text-base font-bold text-white transition-colors duration-300 hover:bg-[#388BFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cosmo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#222428]"
            >
              {t('enterprise.pricing.cta')}
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
            <p className="text-center text-xs leading-relaxed text-slate-500">
              {t(ENTERPRISE_FREE_OFFER ? 'enterprise.pricing.ctaNoteFree' : 'enterprise.pricing.ctaNote')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
