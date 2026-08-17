import { CreditCard, ChevronRight } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useOrgSubscription } from '@/modules/billing/org-billing.hooks';
import { effectiveTierKey, needsPaymentAttention } from '@/modules/billing/org-billing.logic';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';

interface Props {
  orgId: string;
  /** L'écran Abonnement est-il déjà ouvert ? */
  active: boolean;
  onOpen: () => void;
}

/**
 * Pastille « forfait » de l'en-tête entreprise — remplace l'onglet Abonnement.
 *
 * Montée UNIQUEMENT pour le propriétaire (l'appelant en décide) : c'est le seul
 * compte qui peut souscrire ou changer de palier, et un membre n'a rien à faire
 * d'un écran de paiement qu'il ne peut pas valider.
 *
 * Le nom affiché vient de `effectiveTierKey`, donc du droit réellement accordé :
 * un abonnement impayé retombe sur « Gratuit » et porte un point d'alerte,
 * exactement comme le serveur le traite.
 */
export function OrgPlanChip({ orgId, active, onOpen }: Props) {
  const { t } = useT('org');
  const { t: tc } = useT('common');
  const { data: subscription } = useOrgSubscription(orgId);
  const sub = subscription ?? null;
  const needsAttention = needsPaymentAttention(sub);

  // « Plan Équipe » plutôt que « Équipe » seul : dans un en-tête d'entreprise,
  // le mot nu se lirait comme le nom d'une équipe.
  const name = t('billing.planNamed', { name: tc(ORG_TIER_LABEL_KEYS[effectiveTierKey(sub)]) });

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? 'page' : undefined}
      aria-label={t('billing.planAria', { plan: name })}
      title={t('billing.planHint')}
      className={`group shrink-0 inline-flex items-center gap-2 h-9 px-2.5 sm:pr-2 rounded-xl border text-sm font-medium transition-colors ${
        active
          ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.1)] text-[rgb(var(--color-text-primary))]'
          : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]'
      }`}
    >
      <span className="relative flex items-center">
        <CreditCard size={15} aria-hidden="true" />
        {needsAttention && (
          <span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500"
            aria-hidden="true"
          />
        )}
      </span>
      {/* Le nom du forfait EST l'information : il reste affiché sur mobile, où
          c'est le nom de l'organisation qui se tronque (il est déjà répété par
          le titre de page). Seul le chevron décoratif disparaît. */}
      <span className="whitespace-nowrap">{name}</span>
      <ChevronRight
        size={14}
        aria-hidden="true"
        className="hidden sm:inline text-[rgb(var(--color-text-muted))] transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}

export default OrgPlanChip;
