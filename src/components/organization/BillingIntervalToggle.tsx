import { useT } from '@/i18n/useT';
import type { OrgBillingInterval } from '@/modules/billing/premium-config';

interface Props {
  value: OrgBillingInterval;
  onChange: (interval: OrgBillingInterval) => void;
  /** Désactivé pendant une redirection vers Stripe. */
  disabled?: boolean;
}

const INTERVALS: OrgBillingInterval[] = ['monthly', 'yearly'];

/**
 * Sélecteur mensuel / annuel de la grille tarifaire entreprise.
 *
 * Deux boutons radio, pas un `<select>` : il n'y a que deux valeurs et la
 * remise de 30 % doit être LISIBLE sans ouvrir quoi que ce soit — c'est le seul
 * argument qui fait basculer quelqu'un vers l'annuel.
 *
 * `role="radiogroup"` plutôt que deux `<button>` nus : au clavier, les flèches
 * parcourent le groupe et un lecteur d'écran annonce « 1 sur 2 ». Le montant
 * affiché change au même instant dans toute la grille, donc l'état coché doit
 * être annoncé, pas seulement peint.
 */
export function BillingIntervalToggle({ value, onChange, disabled }: Props) {
  const { t } = useT('org');

  return (
    <div
      role="radiogroup"
      aria-label={t('billing.intervalLegend')}
      className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-1"
    >
      {INTERVALS.map((interval) => {
        const isActive = value === interval;
        return (
          <button
            key={interval}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(interval)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
              isActive
                ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
            }`}
          >
            {interval === 'monthly' ? t('billing.intervalMonthly') : t('billing.intervalYearly')}
            {/* La remise reste visible même quand l'annuel est déjà coché : elle
                explique le prix affiché, ce n'est pas seulement un appât. */}
            {interval === 'yearly' && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-caption font-semibold ${
                  isActive
                    ? 'bg-[rgb(var(--color-accent-solid-foreground)/0.2)]'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                }`}
              >
                {t('billing.intervalSave')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default BillingIntervalToggle;
