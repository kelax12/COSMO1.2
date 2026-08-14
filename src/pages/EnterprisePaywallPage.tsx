import { Building2, Check, Users } from 'lucide-react';
import { PageHeading, PageSubtitle } from '@/components/ui/typography';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';

/**
 * Paywall du mode entreprise — DORMANT.
 *
 * Composant préparé à la demande d'Axel (2026-08-14) pour que les paliers
 * tarifaires soient prêts quand le paywall sera réellement activé. Il
 * n'est monté nulle part (aucune route dans src/App.tsx, aucun lien dans la
 * nav) : pour l'instant il n'existe que ce fichier, invisible dans l'app.
 *
 * Paliers : voir ENTERPRISE_PRICING_TIERS (src/modules/billing/premium-config.ts).
 * Avant activation réelle : câbler une route + un CTA de nav, brancher un
 * vrai checkout Stripe (récurrent, montant variable par palier — le
 * checkout actuel de `PremiumPage` est un montant fixe, il ne convient pas
 * tel quel), et passer ENTERPRISE_BILLING_ENFORCED à `true`.
 */
const tierLabel = (minMembers: number, maxMembers: number | null): string =>
  maxMembers === null ? `${minMembers}+ membres` : `${minMembers} à ${maxMembers} membres`;

export function EnterprisePaywallPage() {
  return (
    <div className="p-4 sm:p-8 pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8 h-fit font-sans">
      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-[rgb(var(--color-accent)/0.1)] flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-[rgb(var(--color-accent))]" />
          </div>
          <PageHeading variant="standard">Cosmo Entreprise</PageHeading>
        </div>
        <PageSubtitle className="text-base sm:text-lg mb-10">
          Un tarif par palier de membres, sans engagement. Le palier gratuit reste l'essai.
        </PageSubtitle>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          {ENTERPRISE_PRICING_TIERS.filter((tier) => tier.maxMembers !== null).map((tier) => {
            const free = tier.priceEurPerMonth === 0;
            return (
              <div
                key={tier.minMembers}
                className="flex flex-col p-6 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-sm"
              >
                <div className="flex items-center gap-1.5 mb-5 text-[rgb(var(--color-text-muted))]">
                  <Users size={14} aria-hidden="true" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {tierLabel(tier.minMembers, tier.maxMembers)}
                  </span>
                </div>
                {free ? (
                  <div className="text-3xl font-bold text-[rgb(var(--color-text-primary))] mb-1">Gratuit</div>
                ) : (
                  <div className="flex items-baseline gap-0.5 mb-1">
                    <span className="text-3xl font-bold text-[rgb(var(--color-text-primary))]">
                      {tier.priceEurPerMonth}
                    </span>
                    <span className="text-2xl font-bold text-[rgb(var(--color-text-muted))]">€</span>
                    <span className="text-sm text-[rgb(var(--color-text-muted))] ml-1">/ mois</span>
                  </div>
                )}
                <div className="h-px bg-[rgb(var(--color-border))] my-5" />
                <div className="flex items-start gap-2 text-sm text-[rgb(var(--color-text-secondary))]">
                  <Check size={16} className="text-[rgb(var(--color-accent))] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Projets et OKR illimités</span>
                </div>
              </div>
            );
          })}
        </div>

        {ENTERPRISE_PRICING_TIERS.filter((tier) => tier.maxMembers === null).map((tier) => (
          <div
            key={tier.minMembers}
            className="flex items-center justify-between gap-4 p-4 sm:p-5 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-sm mb-6"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Users size={14} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--color-text-muted))] whitespace-nowrap">
                {tierLabel(tier.minMembers, tier.maxMembers)}
              </span>
            </div>
            <div className="flex items-baseline gap-0.5 shrink-0">
              <span className="text-xl font-bold text-[rgb(var(--color-text-primary))]">
                {tier.priceEurPerMonth}
              </span>
              <span className="text-lg font-bold text-[rgb(var(--color-text-muted))]">€</span>
              <span className="text-sm text-[rgb(var(--color-text-muted))] ml-1">/ mois</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-[rgb(var(--color-text-secondary))] shrink-0">
              <Check size={16} className="text-[rgb(var(--color-accent))]" aria-hidden="true" />
              <span>Projets et OKR illimités</span>
            </div>
          </div>
        ))}

        <div className="flex items-start gap-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 text-sm text-[rgb(var(--color-text-secondary))]">
          <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-accent))] mt-1.5 shrink-0" aria-hidden="true" />
          <p>
            Le forfait s'ajuste automatiquement au palier atteint par l'organisation ; aucune action
            manuelle n'est requise en cas de croissance de l'équipe. Facturation mensuelle, résiliable
            à tout moment.
          </p>
        </div>
      </div>
    </div>
  );
}

export default EnterprisePaywallPage;
