import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { toast } from '@/lib/toast';
import { ArrowLeft } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { ENTERPRISE_BILLING_ENFORCED, ENTERPRISE_PRICING_TIERS, PRICES_VISIBLE } from '@/modules/billing/premium-config';
import type { OrgBillingInterval, OrgTierKey } from '@/modules/billing/premium-config';
import { useOrgSubscription, type AwaitActivation } from '@/modules/billing/org-billing.hooks';
import { useStartOrgCheckout, useOpenOrgPortal } from '@/modules/billing/org-billing.mutations';
import { ACTIVATION_TIMEOUT_MS, effectiveQuota, effectiveTierKey, isActivated, recommendedTier } from '@/modules/billing/org-billing.logic';
import { clearPendingCheckout, readPendingCheckout, writePendingCheckout } from '@/modules/billing/pending-checkout';
import { OrgWithdrawCancel } from './OrgWithdrawCancel';
import { EnterpriseTierGrid } from './EnterpriseTierGrid';
import { BillingIntervalToggle } from './BillingIntervalToggle';
import { OrgBillingSeats } from './OrgBillingSeats';
import { OrgBillingHistory } from './OrgBillingHistory';
import { OrgBillingContactCard } from './OrgBillingContactCard';
import { OrgPlanCard } from './OrgPlanCard';
import { OrgPrecontractualPictos } from './OrgPrecontractualPictos';
import { OrgCheckoutRecap } from './OrgCheckoutRecap';
import { OrgActivationState, type ActivationPhase } from './OrgActivationState';
import { useTierRangeLabel } from './billing-ui';
import { buildOrgLink } from './deep-link.helpers';
import { useActiveOrganization, useOrgMembers } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';

interface Props {
  orgId: string;
  isOwner: boolean;
  /** Retour à l'espace entreprise : cette vue n'a plus d'onglet actif. */
  onBack?: () => void;
}

const PAID_TIER_KEYS = new Set<string>(
  ENTERPRISE_PRICING_TIERS.filter((t) => t.priceEurPerMonth > 0).map((t) => t.key),
);

/**
 * Onglet Abonnement de l'espace entreprise (spec 2026-11-02, lot 1).
 *
 * Tant que `ENTERPRISE_BILLING_ENFORCED` est `false`, la grille reste visible
 * (elle informe) mais AUCUN CTA de paiement n'est monté. Le flag est la seule
 * condition : on doit pouvoir dire d'un coup d'œil si le produit facture.
 *
 * Retour de Stripe (`?checkout=success`) : plus de toast. L'onglet attend que
 * l'abonnement lu soit celui qu'on vient de payer (sondage BORNÉ, § 5.1), parce
 * que le webhook peut arriver après le client.
 */
export function OrgBillingTab({ orgId, isOwner, onBack }: Props) {
  // Membres lus depuis le cache que la page a déjà rempli : aucune requête de plus.
  const { data: members = [] } = useOrgMembers(orgId);
  const memberCount = members.length;
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const ownerId = activeOrg?.ownerId ?? '';
  const { t: tOrgAdmin } = useT('orgAdmin');
  const rangeLabel = useTierRangeLabel();
  const [searchParams, setSearchParams] = useSearchParams();

  const [awaiting, setAwaiting] = useState<AwaitActivation | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const { data: subscription } = useOrgSubscription(orgId, {
    awaitActivation: awaiting && !timedOut ? awaiting : null,
  });
  const checkout = useStartOrgCheckout();
  const portal = useOpenOrgPortal();

  // Périodicité affichée : état LOCAL, jamais persisté. Celle qui compte après
  // coup vient de Stripe via le webhook (`subscription.billingInterval`).
  const [billingInterval, setBillingInterval] = useState<OrgBillingInterval>('monthly');
  // Demande expresse d'accès immédiat (L221-13, L221-25) : NON cochée par
  // défaut, posée une fois le palier choisi, obligatoire pour payer.
  const [selectedTier, setSelectedTier] = useState<OrgTierKey | null>(null);
  const [immediateAccess, setImmediateAccess] = useState(false);

  const canPay = ENTERPRISE_BILLING_ENFORCED && isOwner;
  const showPrices = PRICES_VISIBLE || ENTERPRISE_BILLING_ENFORCED;

  // Paramètres consommés une fois, pour qu'un rafraîchissement ne rejoue rien :
  // `checkout` (retour de Stripe) et `tier` (lien « Passer au palier
  // supérieur » du flux d'invitation, qui ouvre le récapitulatif).
  const checkoutResult = searchParams.get('checkout');
  const tierParam = searchParams.get('tier');
  useEffect(() => {
    if (!checkoutResult && !tierParam) return;
    if (checkoutResult === 'success') {
      const pending = readPendingCheckout(orgId);
      setAwaiting({ tierKey: pending?.tierKey ?? null, deadline: Date.now() + ACTIVATION_TIMEOUT_MS });
      setTimedOut(false);
    }
    if (checkoutResult === 'cancelled') {
      clearPendingCheckout();
      toast.info(tOrgAdmin('billing.checkoutCancelled'));
    }
    if (tierParam && canPay && PAID_TIER_KEYS.has(tierParam)) {
      setSelectedTier(tierParam as OrgTierKey);
      setImmediateAccess(false);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    next.delete('tier');
    setSearchParams(next, { replace: true });
  }, [checkoutResult, tierParam, canPay, orgId, searchParams, setSearchParams, tOrgAdmin]);

  // La borne de 20 s : passé ce délai, plus de sondage, un message.
  useEffect(() => {
    if (!awaiting) return;
    const id = window.setTimeout(() => setTimedOut(true), Math.max(0, awaiting.deadline - Date.now()));
    return () => window.clearTimeout(id);
  }, [awaiting]);

  const activated = awaiting ? isActivated(subscription, awaiting.tierKey) : false;
  useEffect(() => {
    if (activated) clearPendingCheckout();
  }, [activated]);

  const phase: ActivationPhase | null = !awaiting ? null : activated ? 'welcome' : timedOut ? 'timeout' : 'waiting';

  const pay = () => {
    if (!selectedTier) return;
    writePendingCheckout({ orgId, tierKey: selectedTier, interval: billingInterval, at: Date.now() });
    checkout.mutate(
      { orgId, tierKey: selectedTier, interval: billingInterval, immediateAccess },
      {
        onError: (err: Error) => {
          clearPendingCheckout();
          // Le CODE de l'erreur, jamais son texte traduit (C-62) : l'annuel
          // indisponible ramène la grille sur le mensuel, qui fonctionne.
          if ('code' in err && err.code === 'yearly_unavailable') setBillingInterval('monthly');
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="self-start -ml-1 mb-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
          >
            <ArrowLeft size={15} aria-hidden /> {tOrgAdmin('billing.back')}
          </button>
        )}
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">{tOrgAdmin('billing.title')}</h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.subtitle')}</p>
      </header>

      {phase && (
        <OrgActivationState
          phase={phase}
          tierLabel={rangeLabel(subscription?.tierKey ?? awaiting?.tierKey ?? 'free')}
          membersHref={buildOrgLink('members')}
          onClose={() => setAwaiting(null)}
        />
      )}

      <OrgPlanCard subscription={subscription ?? null} memberCount={memberCount} />

      <OrgBillingSeats
        members={members}
        ownerId={ownerId}
        quota={effectiveQuota(subscription ?? null)}
        orgId={orgId}
        currentUserId={user?.id}
        isAdmin={isOwner || members.some((m) => m.userId === user?.id && m.role === 'admin')}
      />

      {showPrices && (
        <section aria-labelledby="org-change-tier" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="org-change-tier" className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
              {tOrgAdmin('billing.changeTierTitle')}
            </h3>
            {ENTERPRISE_BILLING_ENFORCED && (
              <BillingIntervalToggle value={billingInterval} onChange={setBillingInterval} disabled={checkout.isPending} />
            )}
          </div>

          {!ENTERPRISE_BILLING_ENFORCED && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                {tOrgAdmin('billing.promoBadge')}
              </span>
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.dormant')}</p>
            </div>
          )}
          {ENTERPRISE_BILLING_ENFORCED && !isOwner && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.ownerOnly')}</p>
          )}
          {ENTERPRISE_BILLING_ENFORCED && billingInterval === 'yearly' && (
            <p className="-mt-1 text-xs text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.intervalYearlyHint')}</p>
          )}

          {canPay && <OrgPrecontractualPictos interval={billingInterval} />}

          <LayoutGroup>
            <AnimatePresence initial={false}>
              {canPay && selectedTier ? (
                <OrgCheckoutRecap
                  key="recap"
                  tierKey={selectedTier}
                  interval={billingInterval}
                  isPending={checkout.isPending}
                  isRedirecting={checkout.isSuccess}
                  immediateAccess={immediateAccess}
                  onImmediateAccessChange={setImmediateAccess}
                  onPay={pay}
                  onCancel={() => setSelectedTier(null)}
                />
              ) : (
                <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <EnterpriseTierGrid
                    currentTier={subscription?.tierKey}
                    recommendedKey={canPay ? recommendedTier(memberCount).key : undefined}
                    onSelect={
                      canPay
                        ? (tierKey) => {
                            // Choisir n'envoie PAS au paiement : le récapitulatif s'ouvre.
                            setSelectedTier(tierKey);
                            setImmediateAccess(false);
                          }
                        : undefined
                    }
                    isPending={checkout.isPending}
                    dormant={!ENTERPRISE_BILLING_ENFORCED}
                    interval={billingInterval}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutGroup>
        </section>
      )}

      {canPay && subscription && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={portal.isPending}
            onClick={() => portal.mutate({ orgId })}
            className="self-start rounded-lg border border-[rgb(var(--color-border))] px-3 py-2 text-sm disabled:opacity-60"
          >
            {tOrgAdmin('billing.manage')}
          </button>
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.manageHint')}</p>
        </div>
      )}

      {/* Rétractation (14 jours) et résiliation (fin de période, sans
          remboursement) : REMBOURSEMENT-RESILIATION.md §2 et §4. */}
      {canPay && subscription && effectiveTierKey(subscription) !== 'free' && (
        <OrgWithdrawCancel orgId={orgId} subscription={subscription} memberCount={memberCount} />
      )}

      {/* Historique et destinataire des factures : propriétaire seul (mig. 180). */}
      {isOwner && (
        <div className="grid gap-4 md:grid-cols-2 items-start">
          <OrgBillingHistory orgId={orgId} />
          <OrgBillingContactCard orgId={orgId} ownerEmail={user?.email} userId={user?.id} />
        </div>
      )}
    </div>
  );
}

export default OrgBillingTab;
