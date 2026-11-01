import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from '@/lib/toast';
import { ArrowLeft } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { ENTERPRISE_BILLING_ENFORCED, PRICES_VISIBLE } from '@/modules/billing/premium-config';
import type { OrgBillingInterval } from '@/modules/billing/premium-config';
import { useOrgSubscription } from '@/modules/billing/org-billing.hooks';
import { useStartOrgCheckout, useOpenOrgPortal } from '@/modules/billing/org-billing.mutations';
import { OrgWithdrawCancel } from './OrgWithdrawCancel';
import { effectiveQuota, effectiveTierKey } from '@/modules/billing/org-billing.logic';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import { EnterpriseTierGrid } from './EnterpriseTierGrid';
import { BillingIntervalToggle } from './BillingIntervalToggle';
import { OrgBillingSeats } from './OrgBillingSeats';
import { OrgBillingHistory } from './OrgBillingHistory';
import { OrgBillingContactCard } from './OrgBillingContactCard';
import { useActiveOrganization, useOrgMembers } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';

interface Props {
  orgId: string;
  isOwner: boolean;
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
export function OrgBillingTab({ orgId, isOwner, onBack }: Props) {
  // Lus ici plutôt que passés par la page : le chunk `OrganizationPage` est à
  // son cliquet (18 ko), et ces valeurs ne servent qu'à cet écran. Les membres
  // viennent du cache que la page a déjà rempli (même clé React Query) :
  // aucune requête de plus. Chaque membre occupe un siège.
  const { data: members = [] } = useOrgMembers(orgId);
  const memberCount = members.length;
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const ownerId = activeOrg?.ownerId ?? '';
  const { t } = useT('org');
  const { t: tOrgAdmin } = useT('orgAdmin');
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

  // Demande expresse d'accès immédiat (L221-13, L221-25) : case NON cochée par
  // défaut, obligatoire pour payer. Le serveur la revérifie et la trace.
  const [immediateAccess, setImmediateAccess] = useState(false);

  // Retour de Stripe : on consomme le paramètre pour qu'un rafraîchissement ne
  // rejoue pas le toast.
  const checkoutResult = searchParams.get('checkout');
  useEffect(() => {
    if (!checkoutResult) return;
    if (checkoutResult === 'success') toast.success(tOrgAdmin('billing.checkoutSuccess'));
    if (checkoutResult === 'cancelled') toast.info(tOrgAdmin('billing.checkoutCancelled'));
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
  }, [checkoutResult, searchParams, setSearchParams, t, tOrgAdmin]);

  const quota = effectiveQuota(subscription ?? null);
  const planName = tOrgAdmin('billing.planNamed', {
    name: tc(ORG_TIER_LABEL_KEYS[effectiveTierKey(subscription ?? null)]),
  });
  const canPay = ENTERPRISE_BILLING_ENFORCED && isOwner;
  // Grille de paliers masquée depuis le 2026-10-16 (`PRICES_VISIBLE`), sauf si
  // la facturation est réactivée : on ne vend pas sans afficher de prix.
  const showPrices = PRICES_VISIBLE || ENTERPRISE_BILLING_ENFORCED;

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
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
          {tOrgAdmin('billing.title')}
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.subtitle')}</p>
      </header>

      <section className="rounded-xl border border-[rgb(var(--color-border))] p-4 flex flex-col gap-2">
        <span className="text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-secondary))]">
          {tOrgAdmin('billing.currentTier')}
        </span>
        {/* Le nom du forfait est ce que la pastille de l'en-tête annonce : les
            deux doivent dire le même mot, sinon le clic donne l'impression
            d'avoir changé d'objet. */}
        <p className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">{planName}</p>
        <p className="text-sm text-[rgb(var(--color-text-primary))]">
          {quota === null
            ? tOrgAdmin('billing.seatsUnlimited', { count: memberCount })
            : tOrgAdmin('billing.seatsUsed', { count: memberCount, quota })}
        </p>
        {subscription?.status === 'active' && subscription.currentPeriodEnd && (
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {tOrgAdmin('billing.renewsOn', { date: formatDate(new Date(subscription.currentPeriodEnd)) })}
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
              ? tOrgAdmin('billing.billedYearly')
              : tOrgAdmin('billing.billedMonthly')}
          </p>
        )}
        {subscription?.status === 'past_due' && (
          <p className="text-sm text-[rgb(var(--color-text-primary))]">{tOrgAdmin('billing.statusPastDue')}</p>
        )}
        {subscription?.status === 'cancelled' && (
          <p className="text-sm text-[rgb(var(--color-text-primary))]">{tOrgAdmin('billing.statusCancelled')}</p>
        )}
        {subscription?.discountCode && (
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">
            {tOrgAdmin('billing.discountApplied', { code: subscription.discountCode })}
          </p>
        )}
      </section>

      {/* Qui compte : les sièges nommés, pas seulement leur nombre. Visible
          de tout ce qui atteint cet écran (le propriétaire, cf. la page) :
          l'annuaire les montre déjà à tous les membres. */}
      <OrgBillingSeats members={members} ownerId={ownerId} quota={quota} orgId={orgId} currentUserId={user?.id} isAdmin={isOwner || members.some((m) => m.userId === user?.id && m.role === 'admin')} />

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
              <span className="inline-flex w-fit items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                {tOrgAdmin('billing.promoBadge')}
              </span>
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                {tOrgAdmin('billing.dormant')}
              </p>
            </>
          )}
          {ENTERPRISE_BILLING_ENFORCED && !isOwner && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">
              {tOrgAdmin('billing.ownerOnly')}
            </p>
          )}
        </div>

        {/* Masqué tant que la facturation dort : afficher un choix annuel sur
            une offre gratuite reviendrait à laisser croire qu'on peut figer un
            tarif réduit avant même que la facturation existe. La feature
            n'est pas supprimée : `billingInterval` reste utilisable, il ne
            reste juste plus qu'à la valeur par défaut `monthly` tant que le
            flag est bas. */}
        {ENTERPRISE_BILLING_ENFORCED && (
          <BillingIntervalToggle
            value={billingInterval}
            onChange={setBillingInterval}
            disabled={checkout.isPending}
          />
        )}
      </div>

      {ENTERPRISE_BILLING_ENFORCED && billingInterval === 'yearly' && (
        <p className="-mt-3 text-xs text-[rgb(var(--color-text-secondary))]">
          {tOrgAdmin('billing.intervalYearlyHint')}
        </p>
      )}

      {/* Information précontractuelle (Conso. art. L111-1, L221-5), remise le
          2026-11-01 après son retrait du 2026-10-31 (LEGAL.md E2) : durée,
          reconduction et résiliation sous les yeux AVANT le choix d'un palier,
          pas seulement dans les CGU. Le montant exact est sur chaque carte. */}
      {canPay && (
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">
          {tOrgAdmin('billing.precontractual')}
        </p>
      )}

      {canPay && (
        <label className="flex items-start gap-2 text-xs text-[rgb(var(--color-text-primary))]">
          <input
            type="checkbox"
            checked={immediateAccess}
            onChange={(e) => setImmediateAccess(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {tOrgAdmin('billing.immediateAccessLabel')}{' '}
            <a href="/cgu" target="_blank" rel="noreferrer" className="underline">
              {tOrgAdmin('billing.cgvLink')}
            </a>
          </span>
        </label>
      )}

      {showPrices && (
      <EnterpriseTierGrid
        currentTier={subscription?.tierKey}
        onSelect={
          canPay && immediateAccess
            ? (tierKey) =>
                checkout.mutate(
                  {
                    orgId,
                    tierKey,
                    interval: billingInterval,
                    immediateAccess,
                  },
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
        <OrgWithdrawCancel orgId={orgId} subscription={subscription} />
      )}

      {/* Historique et destinataire des factures : propriétaire seul, les
          deux lectures le refusent à tout autre compte (mig. 180). Montés
          même quand la facturation dort : l'historique dit alors « aucun
          paiement », ce qui est exact, et le contact se prépare d'avance. */}
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
