import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { ENTERPRISE_BILLING_ENFORCED } from '@/modules/billing/premium-config';
import type { OrgBillingInterval } from '@/modules/billing/premium-config';
import { useOrgSubscription, useStartOrgCheckout, useOpenOrgPortal } from '@/modules/billing/org-billing.hooks';
import { effectiveQuota, effectiveTierKey } from '@/modules/billing/org-billing.logic';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import { EnterpriseTierGrid } from './EnterpriseTierGrid';
import { BillingIntervalToggle } from './BillingIntervalToggle';

interface Props {
  orgId: string;
  isOwner: boolean;
  memberCount: number;
  /** Retour à l'espace entreprise — cette vue n'a plus d'onglet actif. */
  onBack?: () => void;
}

/**
 * Onglet Abonnement de l'espace entreprise.
 *
 * Tant que `ENTERPRISE_BILLING_ENFORCED` est `false`, la grille reste visible
 * (elle informe) mais AUCUN CTA de paiement n'est monté. Le flag est la seule
 * condition — pas « actif si les variables d'environnement existent » : on doit
 * pouvoir dire d'un coup d'œil si le produit facture ou non.
 */
export function OrgBillingTab({ orgId, isOwner, memberCount, onBack }: Props) {
  const { t } = useT('org');
  const { t: tc } = useT('common');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: subscription } = useOrgSubscription(orgId);
  const checkout = useStartOrgCheckout();
  const portal = useOpenOrgPortal();
  // Périodicité affichée dans la grille. État LOCAL, jamais persisté : c'est
  // une question posée avant l'achat, pas une préférence de l'utilisateur. La
  // périodicité qui compte après coup est celle de l'abonnement, et elle vient
  // de Stripe via le webhook (`subscription.billingInterval`).
  const [billingInterval, setBillingInterval] = useState<OrgBillingInterval>('monthly');

  // Retour de Stripe : on consomme le paramètre pour qu'un rafraîchissement ne
  // rejoue pas le toast.
  const checkoutResult = searchParams.get('checkout');
  useEffect(() => {
    if (!checkoutResult) return;
    if (checkoutResult === 'success') toast.success(t('billing.checkoutSuccess'));
    if (checkoutResult === 'cancelled') toast.info(t('billing.checkoutCancelled'));
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
  }, [checkoutResult, searchParams, setSearchParams, t]);

  const quota = effectiveQuota(subscription ?? null);
  const planName = t('billing.planNamed', {
    name: tc(ORG_TIER_LABEL_KEYS[effectiveTierKey(subscription ?? null)]),
  });
  const canPay = ENTERPRISE_BILLING_ENFORCED && isOwner;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="self-start -ml-1 mb-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
          >
            <ArrowLeft size={15} aria-hidden /> {t('billing.back')}
          </button>
        )}
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[rgb(var(--color-text-primary))]">
          <CreditCard size={18} aria-hidden />
          {t('billing.title')}
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('billing.subtitle')}</p>
      </header>

      <section className="rounded-xl border border-[rgb(var(--color-border))] p-4 flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-[rgb(var(--color-text-secondary))]">
          {t('billing.currentTier')}
        </span>
        {/* Le nom du forfait est ce que la pastille de l'en-tête annonce : les
            deux doivent dire le même mot, sinon le clic donne l'impression
            d'avoir changé d'objet. */}
        <p className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">{planName}</p>
        <p className="text-sm text-[rgb(var(--color-text-primary))]">
          {quota === null
            ? t('billing.seatsUnlimited', { count: memberCount })
            : t('billing.seatsUsed', { count: memberCount, quota })}
        </p>
        {subscription?.status === 'active' && subscription.currentPeriodEnd && (
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {t('billing.renewsOn', { date: formatDate(new Date(subscription.currentPeriodEnd)) })}
          </p>
        )}
        {/* La périodicité est dite explicitement : « Renouvellement le 12
            septembre » seul ne distingue pas un mois d'un an, et c'est
            exactement l'information qu'un propriétaire vient chercher ici.
            Elle n'est montrée que sur un abonnement réellement facturé — le
            palier gratuit n'a pas de périodicité. */}
        {subscription?.status === 'active' && subscription.tierKey !== 'free' && (
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {subscription.billingInterval === 'yearly'
              ? t('billing.billedYearly')
              : t('billing.billedMonthly')}
          </p>
        )}
        {subscription?.status === 'past_due' && (
          <p className="text-sm text-[rgb(var(--color-text-primary))]">{t('billing.statusPastDue')}</p>
        )}
        {subscription?.status === 'cancelled' && (
          <p className="text-sm text-[rgb(var(--color-text-primary))]">{t('billing.statusCancelled')}</p>
        )}
        {subscription?.discountCode && (
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {t('billing.discountApplied', { code: subscription.discountCode })}
          </p>
        )}
      </section>

      {/* Une seule rangée au-dessus de la grille : le statut de l'offre à
          gauche, le sélecteur de périodicité à droite. Les deux commentent le
          même objet — les montants juste en dessous — donc les séparer en deux
          blocs empilés éloignerait le sélecteur de ce qu'il pilote. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!ENTERPRISE_BILLING_ENFORCED && (
            <>
              {/* Même badge que la landing entreprise (`PricingSection.tsx`) :
                  annoncer la nature temporaire de l'offre AVANT le premier prix
                  barré, pas seulement dans la phrase qui suit. */}
              <span className="inline-flex w-fit items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-caption font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                {t('billing.promoBadge')}
              </span>
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                {t('billing.dormant')}
              </p>
            </>
          )}
          {ENTERPRISE_BILLING_ENFORCED && !isOwner && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">
              {t('billing.ownerOnly')}
            </p>
          )}
        </div>

        {/* Monté même quand la facturation dort : le sélecteur informe alors du
            tarif qui s'appliquera après l'offre de lancement, exactement comme
            la grille barrée qu'il pilote. Il ne déclenche aucun paiement — ça,
            c'est le CTA de chaque palier, monté sous la seule condition
            `ENTERPRISE_BILLING_ENFORCED`. */}
        <BillingIntervalToggle
          value={billingInterval}
          onChange={setBillingInterval}
          disabled={checkout.isPending}
        />
      </div>

      {billingInterval === 'yearly' && (
        <p className="-mt-3 text-xs text-[rgb(var(--color-text-secondary))]">
          {t('billing.intervalYearlyHint')}
        </p>
      )}

      <EnterpriseTierGrid
        currentTier={subscription?.tierKey}
        onSelect={
          canPay
            ? (tierKey) =>
                checkout.mutate(
                  { orgId, tierKey, interval: billingInterval },
                  {
                    // L'annuel indisponible ramène la grille sur le mensuel :
                    // le message dit qu'il fonctionne, l'écran doit le montrer
                    // au lieu de laisser l'utilisateur re-cliquer sur le même
                    // bouton en échec.
                    onError: (err: Error) => {
                      if (err.message === 'yearly_unavailable') setBillingInterval('monthly');
                    },
                  },
                )
            : undefined
        }
        isPending={checkout.isPending}
        dormant={!ENTERPRISE_BILLING_ENFORCED}
        interval={billingInterval}
      />

      {canPay && subscription && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={portal.isPending}
            onClick={() => portal.mutate({ orgId })}
            className="self-start rounded-lg border border-[rgb(var(--color-border))] px-3 py-2 text-sm disabled:opacity-60"
          >
            {t('billing.manage')}
          </button>
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.manageHint')}</p>
        </div>
      )}
    </div>
  );
}

export default OrgBillingTab;
