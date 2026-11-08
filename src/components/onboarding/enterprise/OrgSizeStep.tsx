import { useId, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatCurrency } from '@/i18n/format';
import { ENTERPRISE_PRICING_TIERS, type OrgTierKey } from '@/modules/billing/premium-config';
import { onboardingTier } from '@/modules/billing/org-billing.logic';

interface Props {
  /** Palier payant choisi : ouvre le récapitulatif de paiement. `free` : l'espace. */
  onContinue: (tierKey: OrgTierKey) => void;
  /** « Plus tard » : l'espace en gratuit, sans rien choisir. */
  onSkip: () => void;
}

const MIN = 1;
const MAX = 150;
const DEFAULT_COUNT = 10;

/**
 * Étape « Combien serez-vous ? » de la création d'entreprise (maquette 2,
 * choisie par Axel) : un curseur, et les six paliers qui
 * s'allument selon l'effectif annoncé. Le palier proposé suit `onboardingTier`
 * (gratuit jusqu'à 5, puis le plus petit palier qui laisse une place).
 *
 * Le paiement ne se fait PAS ici : le bouton ouvre le récapitulatif de
 * l'onglet Facturation (`/entreprise/billing?tier=`), qui porte la case
 * d'accès immédiat et la version des CGV. ❌ Ne jamais envoyer à Stripe depuis
 * cet écran : il sauterait l'information précontractuelle.
 */
const OrgSizeStep = ({ onContinue, onSkip }: Props) => {
  const { t, tp } = useT('org');
  const { t: tCommon } = useT('common');
  const [count, setCount] = useState(DEFAULT_COUNT);
  const sliderId = useId();
  const tier = onboardingTier(count);
  const free = tier.priceEurPerMonth === 0;
  const price = formatCurrency(tier.priceEurPerMonth, undefined, { maximumFractionDigits: 0 });
  const tierName = tCommon(`orgTier.${tier.key}`);

  return (
    <section aria-labelledby={`${sliderId}-title`} className="space-y-5">
      <div className="text-center">
        <h2 id={`${sliderId}-title`} className="text-xl font-bold text-[rgb(var(--color-text-primary))]">
          {t('onboarding.sizeTitle')}
        </h2>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-secondary))]">{t('onboarding.sizeIntro')}</p>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={sliderId} className="text-sm text-[rgb(var(--color-text-secondary))]">
            {t('onboarding.sizeLabel')}
          </label>
          <span className="text-2xl font-bold tabular-nums text-[rgb(var(--color-text-primary))]" aria-hidden="true">
            {count === MAX ? `${MAX}+` : count}
          </span>
        </div>
        <input
          id={sliderId}
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          aria-valuetext={tp('onboarding.sizeValue', count)}
          className="mt-2 w-full accent-[rgb(var(--color-accent))]"
        />
      </div>

      {/* Les six paliers, celui qui couvre l'effectif allumé. Décoratif pour un
          lecteur d'écran : le résumé ci-dessous dit la même chose en phrase. */}
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" aria-hidden="true">
        {ENTERPRISE_PRICING_TIERS.map((x) => {
          const on = x.key === tier.key;
          return (
            <li
              key={x.key}
              className={`rounded-lg px-1 py-2 text-center text-[11px] leading-tight transition-colors motion-reduce:transition-none ${
                on
                  ? 'bg-[rgb(var(--color-accent))] text-[rgb(var(--color-accent-solid-foreground))] font-semibold'
                  : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))]'
              }`}
            >
              <span className="block truncate">{tCommon(`orgTier.${x.key}`)}</span>
              <span className="block tabular-nums">{x.maxMembers ?? '∞'}</span>
            </li>
          );
        })}
      </ol>

      <p role="status" className="text-center text-sm text-[rgb(var(--color-text-secondary))]">
        {free
          ? t('onboarding.sizeFree')
          : tier.maxMembers === null
            ? t('onboarding.sizeUnlimited', { tier: tierName, price })
            : tp('onboarding.sizePaid', count, { tier: tierName, price, seats: tier.maxMembers, free: tier.maxMembers - count })}
      </p>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onContinue(tier.key)}
          className="w-full py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] inline-flex items-center justify-center gap-2"
        >
          {free ? t('onboarding.sizeStartFree') : t('onboarding.sizePay', { tier: tierName, price })}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        {!free && (
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]"
          >
            {t('onboarding.sizeSkip')}
          </button>
        )}
      </div>
    </section>
  );
};

export default OrgSizeStep;
