// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — hooks React Query.
//
// MODE DÉMO : une organisation de démo ne paie jamais. `useOrgSubscription`
// renvoie `null` (= palier gratuit) sans aucune requête, et les mutations de
// checkout/portail ne sont pas exposées dans l'UI démo. Pas de
// `local.repository` ni d'entrée dans `repository.factory` : il n'y a aucune
// sémantique démo à simuler pour un abonnement Stripe.
//
// 🔴 LECTURE SEULE depuis le 2026-10-01. Les mutations (paiement, portail,
// remboursement) vivent dans `org-billing.mutations.ts` : ce fichier est importé
// par `OrganizationPage`, et ses mutations pesaient dans le chunk de la page
// alors que seuls l'onglet Facturation et la section Paramètres s'en servent.
// ❌ Ne pas les réexporter d'ici : elles reviendraient dans le chunk.
// ═══════════════════════════════════════════════════════════════════
import { useQuery } from '@tanstack/react-query';
import { useIsDemo } from '@/lib/app-mode.store';
import { getOrgSubscription } from './org-billing.repository';
import type { OrgSubscription } from './org-billing.types';

export const orgBillingKeys = {
  all: ['org-billing'] as const,
  subscription: (orgId: string) => [...orgBillingKeys.all, 'subscription', orgId] as const,
};

export const useOrgSubscription = (orgId: string | undefined) => {
  const isDemo = useIsDemo();
  return useQuery<OrgSubscription | null>({
    queryKey: orgBillingKeys.subscription(orgId ?? ''),
    queryFn: () => (isDemo ? Promise.resolve(null) : getOrgSubscription(orgId as string)),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });
};
