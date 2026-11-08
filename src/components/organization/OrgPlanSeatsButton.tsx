import { useT } from '@/i18n/useT';
import { useOrgSubscription } from '@/modules/billing/org-billing.hooks';
import { effectiveTierKey } from '@/modules/billing/org-billing.logic';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';

interface Props {
  orgId: string;
  used: number;
  /** Places du palier : nombre, `null` = illimité, `undefined` = inconnu (pas de jauge). */
  quota?: number | null;
  onClick: () => void;
}

/**
 * « Changer de forfait » de la barre de l'annuaire (variante B) :
 * le palier en vigueur et les places occupées, là où l'on invite. Monté par
 * l'appelant pour le propriétaire seul ; il ouvre le récapitulatif de
 * facturation, jamais Stripe en direct.
 */
const OrgPlanSeatsButton = ({ orgId, used, quota, onClick }: Props) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const { t: tc } = useT('common');
  const { data: subscription } = useOrgSubscription(orgId);
  const plan = tc(ORG_TIER_LABEL_KEYS[effectiveTierKey(subscription ?? null)]);
  const hasGauge = typeof quota === 'number' && quota > 0;
  const percent = hasGauge ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const full = hasGauge && used >= quota;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tOrgAdmin('page.planSeatsAria', { plan })}
      title={tOrgAdmin('page.overQuotaBillingCta')}
      className="inline-flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-medium border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] transition-colors whitespace-nowrap"
    >
      <span className="text-xs text-[rgb(var(--color-text-secondary))]">
        {hasGauge ? tOrgAdmin('page.planSeats', { plan, used, quota }) : plan}
      </span>
      {hasGauge && (
        <span className="w-11 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
          <span
            className={`block h-full rounded-full ${full ? 'bg-red-500' : 'bg-[rgb(var(--color-accent))]'}`}
            style={{ width: `${percent}%` }}
          />
        </span>
      )}
      <span className="font-semibold text-[rgb(var(--color-accent))]">{tOrgAdmin('page.planChange')}</span>
    </button>
  );
};

export default OrgPlanSeatsButton;
