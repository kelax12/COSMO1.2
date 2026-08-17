import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { ENTERPRISE_BILLING_ENFORCED } from '@/modules/billing/premium-config';
import { useOrgSubscription, useStartOrgCheckout, useOpenOrgPortal } from '@/modules/billing/org-billing.hooks';
import { effectiveQuota, effectiveTierKey } from '@/modules/billing/org-billing.logic';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import { EnterpriseTierGrid } from './EnterpriseTierGrid';

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

      {!ENTERPRISE_BILLING_ENFORCED && (
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('billing.dormant')}</p>
      )}
      {ENTERPRISE_BILLING_ENFORCED && !isOwner && (
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('billing.ownerOnly')}</p>
      )}

      <EnterpriseTierGrid
        currentTier={subscription?.tierKey}
        onSelect={canPay ? (tierKey) => checkout.mutate({ orgId, tierKey }) : undefined}
        isPending={checkout.isPending}
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
