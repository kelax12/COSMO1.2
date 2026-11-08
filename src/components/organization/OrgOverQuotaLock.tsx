import { Lock } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface Props {
  memberCount: number;
  quota: number;
  excess: number;
  /** Admin ou propriétaire : peut retirer des membres. */
  canManageMembers: boolean;
  /** Propriétaire : peut changer de forfait. */
  canChangePlan: boolean;
  onManageMembers: () => void;
  onChangePlan: () => void;
}

/**
 * Espace entreprise VERROUILLÉ : l'effectif dépasse le quota du palier
 * (baisse de palier, abonnement tombé). Décision d'Axel : tant
 * que l'organisation a des membres en trop, ses sections de travail sont
 * fermées ; seules restent celles qui permettent d'en sortir
 * (`sectionOpenWhileOverQuota`). Remplace le contenu de la section demandée,
 * jamais la navigation ni l'en-tête.
 *
 * ⚠️ Verrou d'INTERFACE : la base continue de servir les données à qui les
 * demande par l'API. Ce n'est pas une frontière de sécurité.
 */
export function OrgOverQuotaLock({
  memberCount,
  quota,
  excess,
  canManageMembers,
  canChangePlan,
  onManageMembers,
  onChangePlan,
}: Props) {
  const { t, tp } = useT('orgAdmin');
  return (
    <section
      aria-labelledby="org-over-quota-title"
      className="mx-auto mt-8 max-w-lg rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-6 py-8 text-center"
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]">
        <Lock size={22} aria-hidden="true" />
      </div>
      <h2 id="org-over-quota-title" className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
        {t('page.overQuotaTitle')}
      </h2>
      <p role="status" className="mt-2 text-sm font-medium text-[rgb(var(--color-text-primary))]">
        {tp('page.overQuotaCount', memberCount, { quota, excess })}
      </p>
      <p className="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">
        {t(canManageMembers ? 'page.overQuotaAdmin' : 'page.overQuotaMember')}
      </p>
      {(canManageMembers || canChangePlan) && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {canManageMembers && (
            <button
              type="button"
              onClick={onManageMembers}
              className="min-h-11 rounded-xl border border-[rgb(var(--color-border))] px-4 text-sm font-semibold text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
            >
              {t('page.overQuotaMembersCta')}
            </button>
          )}
          {canChangePlan && (
            <button
              type="button"
              onClick={onChangePlan}
              className="min-h-11 rounded-xl bg-[rgb(var(--color-accent))] px-4 text-sm font-semibold text-white"
            >
              {t('page.overQuotaBillingCta')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default OrgOverQuotaLock;
