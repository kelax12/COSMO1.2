import { motion } from 'framer-motion';
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
  const { t: tOrgAdmin } = useT('orgAdmin');

  return (
    <div
      role="radiogroup"
      aria-label={tOrgAdmin('billing.intervalLegend')}
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
            className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
              isActive
                ? 'text-[rgb(var(--color-accent-solid-foreground))]'
                : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
            }`}
          >
            {/* Pastille partagée (`layoutId`) : elle glisse d'une option à l'autre.
                Sous mouvement réduit, Framer coupe l'animation de layout et la pastille
                se pose directement : aucune position ne dépend du mouvement. */}
            {isActive && (
              <motion.span
                layoutId="billing-interval-pill"
                aria-hidden
                className="absolute inset-0 rounded-full bg-[rgb(var(--color-accent-solid))]"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">
              {interval === 'monthly' ? tOrgAdmin('billing.intervalMonthly') : tOrgAdmin('billing.intervalYearly')}
            </span>
            {/* La remise reste visible même quand l'annuel est déjà coché : elle
                explique le prix affiché, ce n'est pas seulement un appât. */}
            {interval === 'yearly' && (
              <span
                className={`relative rounded-full px-1.5 py-0.5 text-caption font-semibold ${
                  isActive
                    ? 'bg-[rgb(var(--color-accent-solid-foreground)/0.2)]'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                }`}
              >
                {tOrgAdmin('billing.intervalSave')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default BillingIntervalToggle;
