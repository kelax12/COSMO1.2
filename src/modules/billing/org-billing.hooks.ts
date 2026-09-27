// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — lecture de l'abonnement.
//
// MODE DÉMO : une organisation de démo ne paie jamais. `useOrgSubscription`
// renvoie `null` (= palier gratuit) sans aucune requête. Pas de
// `local.repository` ni d'entrée dans `repository.factory` : il n'y a aucune
// sémantique démo à simuler pour un abonnement Stripe.
//
// Les mutations (checkout, portail, résiliation/remboursement) vivent dans
// `org-billing.checkout.hooks.ts`, à part depuis le 2026-09-27 : ce fichier
// est importé directement par `OrganizationPage` (bannière freemium), donc
// TOUJOURS dans le chunk de la route /entreprise — un namespace i18n utilisé
// ici serait payé par toute visite, Aperçu compris. Ce fichier ne traduit
// rien, exprès.
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
