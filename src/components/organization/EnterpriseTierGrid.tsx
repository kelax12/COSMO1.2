import { Check } from 'lucide-react';
import { ENTERPRISE_PRICING_TIERS, displayedMonthlyEur, yearlyTotalEur } from '@/modules/billing/premium-config';
import type { OrgBillingInterval, OrgTierKey } from '@/modules/billing/premium-config';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import { formatCurrency } from '@/i18n/format';
import { useT } from '@/i18n/useT';

interface Props {
  /** Palier actuellement actif — mis en avant. */
  currentTier?: OrgTierKey;
  /** Absent = grille purement informative (pas propriétaire, ou flag dormant). */
  onSelect?: (tier: OrgTierKey) => void;
  isPending?: boolean;
  /**
   * Périodicité affichée. Elle ne change QUE le montant : les bornes d'effectif
   * et le quota de sièges sont portés par le palier seul, dans les deux cas.
   * Absente = mensuel, la valeur qui existait avant le sélecteur.
   */
  interval?: OrgBillingInterval;
  /**
   * La facturation est-elle éteinte pour TOUT LE MONDE
   * (`ENTERPRISE_BILLING_ENFORCED === false`) ?
   *
   * Distinct de `!onSelect` : un membre non propriétaire n'a pas non plus de
   * `onSelect` alors que son organisation, elle, peut très bien être facturée.
   * Lui afficher « Gratuit » serait un mensonge — il voit la grille nue, et la
   * phrase `billing.ownerOnly` lui dit pourquoi.
   */
  dormant?: boolean;
}

/**
 * Grille des cinq paliers. Les montants viennent de `ENTERPRISE_PRICING_TIERS`
 * et sont rendus par `formatCurrency` — jamais de montant écrit en dur, et
 * jamais de compteur animé sur un prix (il passerait par 48 € avant de se
 * poser sur 50 €).
 *
 * Quand la facturation est éteinte (`dormant`), même traitement que la landing
 * entreprise (`PricingSection.tsx`) : le prix de chaque palier payant est
 * REMPLACÉ par « Gratuit » en accent ambre, avec le tarif d'après affiché
 * juste en dessous, barré. Une étiquette « Gratuit » à côté d'un prix encore
 * affiché en gros (l'ancien rendu) laisse deux montants contradictoires à
 * l'écran ; remplacer le prix lui-même est la seule version qui ne ment pas.
 */
export function EnterpriseTierGrid({
  currentTier,
  onSelect,
  isPending,
  dormant,
  interval = 'monthly',
}: Props) {
  const { t } = useT('org');
  const { t: tc } = useT('common');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {ENTERPRISE_PRICING_TIERS.map((tier) => {
        const isCurrent = currentTier === tier.key;
        const isFree = tier.priceEurPerMonth === 0;
        // Palier payant, mais gratuit PENDANT l'offre de lancement — c'est ce
        // cas qui porte le prix barré, jamais le palier gratuit de base (rien
        // à comparer : il n'a jamais eu de prix payant).
        const isPromo = dormant && !isFree;
        // Le gros montant est toujours un tarif MENSUEL : en annuel c'est
        // l'équivalent mensuel remisé, et le débit réel passe sur la ligne du
        // dessous. Afficher 168 € en gros à côté de 50 € ne se compare pas.
        const monthlyShown = displayedMonthlyEur(tier.priceEurPerMonth, interval);
        const range =
          tier.maxMembers === null
            ? t('billing.rangeFrom', { min: tier.minMembers })
            : t('billing.rangeUpTo', {
                min: tier.minMembers,
                max: tier.maxMembers,
              });

        return (
          <div
            key={tier.key}
            className={`rounded-xl border p-4 flex flex-col gap-2 ${
              isCurrent
                ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.06)]'
                : 'border-[rgb(var(--color-border))]'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                {/* Le nom porte le palier, l'effectif le qualifie : « Équipe »
                    seul ne dit pas à qui il s'adresse, « 5 à 10 membres » seul
                    n'est pas un nom qu'on prononce. Sauf pour le palier gratuit,
                    dont le nom EST déjà le prix affiché juste dessous — l'écrire
                    deux fois ne le rend pas plus gratuit. */}
                {!isFree && (
                  <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                    {tc(ORG_TIER_LABEL_KEYS[tier.key])}
                  </span>
                )}
                <span className="text-xs text-[rgb(var(--color-text-secondary))]">{range}</span>
              </div>

              {/* Coin droit de l'en-tête : réservé au palier actif — le prix
                  porte maintenant lui-même le statut « Gratuit » pendant
                  l'offre, plus besoin d'une étiquette séparée ici. */}
              {isCurrent && (
                <Check size={16} className="shrink-0 text-[rgb(var(--color-accent))]" aria-hidden />
              )}
              {!isFree && !isCurrent && !dormant && onSelect && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onSelect(tier.key)}
                  className="shrink-0 rounded-lg bg-[rgb(var(--color-accent-solid))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-60"
                >
                  {t('billing.subscribe')}
                </button>
              )}
            </div>

            {isFree || isPromo ? (
              <>
                <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                  {t('billing.free')}
                </div>
                {/* Rien sous le palier gratuit de base (aucun tarif payant à
                    comparer) — seulement sous les paliers rendus gratuits par
                    l'offre de lancement, comme sur la landing. */}
                {isPromo && (
                  <s className="text-xs text-[rgb(var(--color-text-muted))] decoration-[rgb(var(--color-border-strong))]">
                    {t('billing.insteadOf', { price: monthlyShown })}
                  </s>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-[rgb(var(--color-text-primary))]">
                    {formatCurrency(monthlyShown)}
                  </span>
                  {/* Répétée dans chaque carte, pas seulement dans le
                      sélecteur : au moment où le regard est sur LE prix d'un
                      palier précis, c'est là qu'il faut confirmer pourquoi il
                      a baissé. Même ambre que « Gratuit » — c'est la couleur
                      qui, dans cette grille, veut déjà dire « ce que l'offre
                      te fait gagner ». */}
                  {interval === 'yearly' && (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {t('billing.intervalSave')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[rgb(var(--color-text-secondary))]">
                  {interval === 'yearly'
                    ? t('billing.perMonthBilledYearly', {
                        total: formatCurrency(yearlyTotalEur(tier.priceEurPerMonth)),
                      })
                    : t('billing.perMonth')}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EnterpriseTierGrid;
