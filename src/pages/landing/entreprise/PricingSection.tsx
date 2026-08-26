import React, { useId, useMemo, useState } from 'react';
import { ArrowRight, Check, Users } from 'lucide-react';
import {
  ENTERPRISE_PRICING_TIERS,
  displayedMonthlyEur,
  yearlyTotalEur,
} from '@/modules/billing/premium-config';
import type { OrgBillingInterval } from '@/modules/billing/premium-config';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import ScrollHighlight from './ScrollHighlight';
import { ENTERPRISE_FREE_OFFER } from './free-offer';

type Tier = (typeof ENTERPRISE_PRICING_TIERS)[number];

/** Effectif maximum du curseur — au-delà, tout le monde est dans le dernier palier. */
const SLIDER_MAX = 80;
/**
 * Position de départ du curseur : dix membres.
 *
 * Ce n'est pas arbitraire — le titre de la section annonce « 20 € par mois pour
 * dix personnes », et dix membres tombent dans le palier 5-10 à 20 €. Le
 * curseur montre donc, au premier coup d'œil, exactement le cas énoncé par le
 * titre. Changer l'un sans l'autre ferait cohabiter deux prix à l'écran.
 */
const SLIDER_DEFAULT = 10;

const INTERVALS: OrgBillingInterval[] = ['monthly', 'yearly'];

const INCLUDED: KeyOf<'landing'>[] = [
  'enterprise.pricing.i1',
  'enterprise.pricing.i2',
  'enterprise.pricing.i3',
  'enterprise.pricing.i4',
  'enterprise.pricing.i5',
];

/**
 * Palier atteint par une organisation de `members` personnes.
 *
 * Les bornes des paliers se chevauchent (`0-5` puis `5-10`) : on retient le
 * PREMIER palier dont le plafond couvre l'effectif, ce qui range 5 membres
 * pile dans le palier gratuit. C'est la lecture que fait la landing
 * (« jusqu'à 5 membres gratuitement ») et il ne doit pas y en avoir deux.
 */
function tierFor(members: number): Tier {
  return (
    ENTERPRISE_PRICING_TIERS.find((tier) => tier.maxMembers === null || members <= tier.maxMembers) ??
    ENTERPRISE_PRICING_TIERS[ENTERPRISE_PRICING_TIERS.length - 1]
  );
}

/**
 * Section tarifs — le moment où l'on demande l'argent.
 *
 * Un curseur « combien êtes-vous ? » désigne le palier atteint, qui s'allume
 * et se cercle de cyan. Les montants viennent tous de
 * `ENTERPRISE_PRICING_TIERS` : la landing et le produit annoncent le même prix,
 * y compris le jour où le paywall sera activé.
 *
 * Pendant l'offre de lancement (`ENTERPRISE_FREE_OFFER`, cf. `free-offer.ts`),
 * chaque montant est remplacé par « Gratuit » — le tarif reste affiché juste
 * en dessous, barré, parce qu'une promo qui cache le prix d'après n'est pas une
 * promo, c'est une surprise à retardement.
 */
const PricingSection: React.FC<{ onRegister: () => void }> = ({ onRegister }) => {
  const { t } = useT('landing');
  // Les noms de paliers vivent dans `common` : la landing et le produit doivent
  // annoncer le même nom, comme ils annoncent déjà le même montant.
  const { t: tc } = useT('common');
  const sliderId = useId();
  const [members, setMembers] = useState(SLIDER_DEFAULT);
  // Periodicite affichee. Le mensuel reste le defaut : c'est le tarif que le
  // titre de la section annonce, et un visiteur doit retrouver a l'ecran le
  // chiffre qu'il vient de lire.
  const [billingInterval, setBillingInterval] = useState<OrgBillingInterval>('monthly');

  const activeTier = useMemo(() => tierFor(members), [members]);
  // Le gros chiffre est TOUJOURS un tarif mensuel : en annuel c'est
  // l'equivalent mensuel remise, et le debit reel est dit juste en dessous.
  // Afficher 168 EUR la ou le palier voisin affiche 50 EUR ne se compare pas.
  const activePrice = displayedMonthlyEur(activeTier.priceEurPerMonth, billingInterval);

  const tierLabel = (tier: Tier) =>
    tier.maxMembers === null
      ? t('enterprise.pricing.tierOpen', { min: tier.minMembers })
      : t('enterprise.pricing.tierRange', { min: tier.minMembers, max: tier.maxMembers });

  return (
    <section
      id="tarifs"
      className="relative scroll-mt-40 border-t border-white/[0.06] py-24 lg:py-32"
      aria-labelledby="pricing-title"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_45%_100%_at_50%_0%,rgba(245,185,66,0.07),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12 max-w-3xl">
          {/* Le badge annonce la nature temporaire AVANT le premier prix lu :
              après, il ne ferait que corriger une impression déjà formée. */}
          {ENTERPRISE_FREE_OFFER && (
            <span className="mb-5 inline-flex items-center rounded-full border border-[#F5B942]/40 bg-[#F5B942]/10 px-3 py-1 font-mono text-caption uppercase tracking-[0.16em] text-[#F5B942]">
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
              text={t(
                ENTERPRISE_FREE_OFFER
                  ? 'enterprise.pricing.promoSubtitle'
                  : 'enterprise.pricing.subtitle',
              )}
            />
          </p>
        </header>

        {/* ── Le selecteur de periodicite ──
            Place AVANT le curseur, donc avant le premier prix lu : arriver
            apres reviendrait a corriger un montant deja memorise, exactement la
            raison qui met deja le badge d'offre en tete de section. */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div
            role="radiogroup"
            aria-label={t('enterprise.pricing.intervalAria')}
            className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#0A0C11] p-1"
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
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-[background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090C] ${
                    isSelected ? 'bg-cyan-400/15 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option === 'monthly'
                    ? t('enterprise.pricing.intervalMonthly')
                    : t('enterprise.pricing.intervalYearly')}
                  {/* La remise reste affichee meme une fois l'annuel choisi :
                      elle explique le prix montre, ce n'est pas qu'un appat. */}
                  {option === 'yearly' && (
                    <span className="rounded-full bg-[#F5B942]/15 px-2 py-0.5 font-mono text-caption tracking-[0.1em] text-[#F5B942]">
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
          {/* Affichage TTC — obligation d'affichage au consommateur (Code de la
              consommation art. L112-1), et pas une coquetterie : rien ne vérifie
              qu'un acheteur est un professionnel, donc tout acheteur peut en être
              un. Cohérent avec `tax_behavior: inclusive` posé sur les 8 prix
              Stripe live, qui est DÉFINITIF. Voir docs/LEGAL.md ligne E7. */}
          <p className="text-sm text-slate-500">{t('enterprise.pricing.vatIncluded')}</p>
        </div>

        {/* ── Le curseur : « combien êtes-vous ? » ── */}
        <div className="mb-10 rounded-2xl border border-white/[0.08] bg-[#0A0C11] p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <label htmlFor={sliderId} className="text-sm font-medium text-slate-300">
              {t('enterprise.pricing.sliderLabel')}
            </label>
            <div className="flex items-baseline gap-2">
              <Users size={16} className="self-center text-cyan-400" aria-hidden="true" />
              <span className="text-3xl font-bold tabular-nums text-white">
                {members}
                {members >= SLIDER_MAX && '+'}
              </span>
              <span className="text-sm text-slate-500">{t('enterprise.pricing.membersUnit')}</span>
            </div>
          </div>

          <input
            id={sliderId}
            type="range"
            min={1}
            max={SLIDER_MAX}
            value={members}
            onChange={(event) => setMembers(Number(event.target.value))}
            aria-label={t('enterprise.pricing.sliderAria')}
            aria-valuetext={`${members} ${t('enterprise.pricing.membersUnit')}`}
            className="ent-range w-full cursor-pointer"
          />

          {/* Verdict : le prix du palier atteint, recalculé à chaque cran. */}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-6">
            <div>
              <span className="block font-mono text-caption uppercase tracking-[0.22em] text-slate-500">
                {t('enterprise.pricing.yourTier')}
              </span>
              {activeTier.priceEurPerMonth > 0 && (
                <span className="block text-lg font-bold text-white">
                  {tc(ORG_TIER_LABEL_KEYS[activeTier.key])}
                </span>
              )}
              <span className="text-sm text-slate-400">{tierLabel(activeTier)}</span>
            </div>
            {/* Le montant n'est PAS animé par un compteur : un ressort passe par
                des valeurs intermédiaires (48 € avant de se poser sur 50 €), et
                un prix faux, même pendant une seconde, n'est pas un détail. Le
                changement est signalé par une pulsation de la couleur. */}
            <div
              key={`${activeTier.minMembers}-${billingInterval}`}
              className="ent-price flex flex-col items-end"
            >
              {activeTier.priceEurPerMonth === 0 || ENTERPRISE_FREE_OFFER ? (
                <>
                  <span className="text-4xl font-bold text-[#F5B942]">{t('enterprise.pricing.free')}</span>
                  {/* Le tarif d'après reste lisible, barré : c'est ce qui fait
                      la différence entre « gratuit » et « gratuit pour le
                      moment ». Rien à afficher pour le palier qui est gratuit
                      de toute façon. */}
                  {activeTier.priceEurPerMonth > 0 && (
                    <s className="mt-1 text-sm text-slate-500 decoration-slate-600">
                      {t(
                        billingInterval === 'yearly'
                          ? 'enterprise.pricing.insteadOfYearly'
                          : 'enterprise.pricing.insteadOf',
                        { price: activePrice },
                      )}
                    </s>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-end">
                  <span className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tabular-nums text-white">{activePrice}</span>
                    <span className="text-3xl font-bold text-slate-500">€</span>
                    <span className="ml-1 text-sm text-slate-500">
                      {t('enterprise.pricing.perMonth')}
                    </span>
                  </span>
                  {/* Le debit reel, dit sous le prix et jamais a sa place : un
                      visiteur doit pouvoir verifier lui-meme que 14 x 12 font
                      bien les 168 EUR qu'on lui prelevera. */}
                  {billingInterval === 'yearly' && (
                    <span className="mt-1 text-sm text-slate-500">
                      {t('enterprise.pricing.billedYearly', {
                        total: yearlyTotalEur(activeTier.priceEurPerMonth),
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Les cinq paliers ── */}
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ENTERPRISE_PRICING_TIERS.map((tier) => {
            const isActive = tier.minMembers === activeTier.minMembers;
            const price = displayedMonthlyEur(tier.priceEurPerMonth, billingInterval);
            return (
              <div
                key={tier.minMembers}
                className={`flex h-full flex-col rounded-xl border p-5 transition-[border-color,box-shadow,background-color] duration-300 ${
                  isActive
                    ? 'border-cyan-300/60 bg-[#0D1117] shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_36px_-8px_rgba(34,211,238,0.55)]'
                    : 'border-white/[0.08] bg-[#0A0C11] hover:border-white/15'
                }`}
              >
                {/* Le palier gratuit n'a pas de ligne de nom : « Gratuit » est
                    déjà le prix, en gros, juste dessous. */}
                {tier.priceEurPerMonth > 0 && (
                  <span className={`mb-1 text-sm font-bold ${isActive ? 'text-white' : 'text-slate-200'}`}>
                    {tc(ORG_TIER_LABEL_KEYS[tier.key])}
                  </span>
                )}
                <span className="mb-4 flex items-center gap-1.5 font-mono text-caption uppercase tracking-[0.16em] text-slate-500">
                  <Users size={11} aria-hidden="true" />
                  {tierLabel(tier)}
                </span>
                {tier.priceEurPerMonth === 0 || ENTERPRISE_FREE_OFFER ? (
                  <>
                    <span className={`text-2xl font-bold ${isActive ? 'text-[#F5B942]' : 'text-white'}`}>
                      {t('enterprise.pricing.free')}
                    </span>
                    {tier.priceEurPerMonth > 0 && (
                      <s className="mt-1 text-xs text-slate-600 decoration-slate-700">
                        {t('enterprise.pricing.insteadOfShort', { price })}
                      </s>
                    )}
                  </>
                ) : (
                  <>
                    <span className="flex items-baseline gap-0.5">
                      <span className={`text-2xl font-bold tabular-nums ${isActive ? 'text-cyan-300' : 'text-white'}`}>
                        {price}
                      </span>
                      <span className="text-xl font-bold text-slate-600">€</span>
                      <span className="ml-1 text-xs text-slate-600">{t('enterprise.pricing.perMonth')}</span>
                    </span>
                    {billingInterval === 'yearly' && (
                      <span className="mt-1 text-xs text-slate-600">
                        {t('enterprise.pricing.billedYearly', {
                          total: yearlyTotalEur(tier.priceEurPerMonth),
                        })}
                      </span>
                    )}
                  </>
                )}
                {isActive && (
                  <span className="mt-4 inline-flex w-fit rounded-full bg-cyan-400/15 px-2.5 py-1 font-mono text-caption uppercase tracking-[0.16em] text-cyan-300">
                    {t('enterprise.pricing.yourTier')}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Ce qui est inclus partout, et l'appel à l'action ── */}
        <div className="grid gap-4 rounded-2xl border border-white/[0.08] bg-[#0A0C11] p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
          <div>
            <h3 className="mb-5 text-sm font-semibold text-white">{t('enterprise.pricing.includedTitle')}</h3>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {INCLUDED.map((key) => (
                <li key={key} className="flex gap-2.5 text-sm text-slate-400">
                  <Check size={15} className="mt-0.5 shrink-0 text-cyan-400" aria-hidden="true" />
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
              className="group flex items-center justify-center gap-2.5 rounded-xl bg-[#F5B942] px-6 py-4 text-base font-bold text-[#1A1204] shadow-[0_10px_36px_-10px_rgba(245,185,66,0.75)] transition-[background-color,box-shadow] duration-300 hover:bg-[#FFC95C] hover:shadow-[0_14px_44px_-8px_rgba(245,185,66,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5B942] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0C11]"
            >
              {t('enterprise.pricing.cta')}
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
            <p className="text-center text-xs leading-relaxed text-slate-500">
              {t(
                ENTERPRISE_FREE_OFFER
                  ? 'enterprise.pricing.ctaNoteFree'
                  : 'enterprise.pricing.ctaNote',
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
