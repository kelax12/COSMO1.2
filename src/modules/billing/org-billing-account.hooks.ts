// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — historique et contact de facturation, hooks (mig. 180)
//
// À part de `org-billing.hooks.ts` pour la même raison que le repository :
// ce module-là est dans le chunk `OrganizationPage` (pastille de forfait),
// celui-ci n'est importé que par l'écran Facturation, chargé à la demande.
// ═══════════════════════════════════════════════════════════════════
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsDemo } from '@/lib/app-mode.store';
import { safeParse } from '@/lib/safe-json';
import {
  deleteOrgBillingContact,
  getOrgBillingContact,
  getOrgBillingHistory,
  saveOrgBillingContact,
} from './org-billing-account.repository';
import type { OrgBillingContact, OrgBillingHistoryEntry } from './org-billing.types';

export const orgBillingAccountKeys = {
  history: (orgId: string) => ['org-billing', 'history', orgId] as const,
  contact: (orgId: string) => ['org-billing', 'contact', orgId] as const,
};

/**
 * Historique des paiements (propriétaire seul). En démo : vide, aucune
 * organisation de démo n'a jamais payé.
 *
 * ⚠️ `enabled` porte `isOwner` : la RPC refuse tout autre compte (42501), et
 * une lecture partie pour un admin ne ferait qu'afficher une erreur.
 */
export const useOrgBillingHistory = (orgId: string | undefined, isOwner: boolean) => {
  const isDemo = useIsDemo();
  return useQuery<OrgBillingHistoryEntry[]>({
    queryKey: orgBillingAccountKeys.history(orgId ?? ''),
    queryFn: () => (isDemo ? Promise.resolve([]) : getOrgBillingHistory(orgId as string)),
    enabled: !!orgId && isOwner,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Contact de facturation en DÉMO : `localStorage`, par organisation. Ce n'est
 * pas une donnée Stripe, c'est une préférence : la démo doit pouvoir la
 * montrer enregistrée, sinon le formulaire aurait l'air cassé.
 */
const demoContactKey = (orgId: string) => `cosmo_demo_org_billing_contact_${orgId}`;

function readDemoContact(orgId: string): OrgBillingContact | null {
  try {
    return safeParse<OrgBillingContact>(localStorage.getItem(demoContactKey(orgId)));
  } catch {
    return null;
  }
}

export const useOrgBillingContact = (orgId: string | undefined, isOwner: boolean) => {
  const isDemo = useIsDemo();
  return useQuery<OrgBillingContact | null>({
    queryKey: orgBillingAccountKeys.contact(orgId ?? ''),
    queryFn: () =>
      isDemo ? Promise.resolve(readDemoContact(orgId as string)) : getOrgBillingContact(orgId as string),
    enabled: !!orgId && isOwner,
    staleTime: 1000 * 60 * 5,
  });
};

/** Pose, remplace (`input` renseigné) ou retire (`input: null`) le contact. */
export const useSaveOrgBillingContact = (orgId: string, userId: string | undefined) => {
  const isDemo = useIsDemo();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string | null; email: string } | null) => {
      if (isDemo) {
        try {
          if (input) localStorage.setItem(demoContactKey(orgId), JSON.stringify({ orgId, ...input }));
          else localStorage.removeItem(demoContactKey(orgId));
        } catch { /* localStorage indisponible : l'écran garde la valeur du cache */ }
        return input ? { orgId, ...input } : null;
      }
      if (!input) {
        await deleteOrgBillingContact(orgId);
        return null;
      }
      return saveOrgBillingContact(orgId, input, userId);
    },
    // Les toasts sont posés par l'écran (`OrgBillingContactCard`) : ses textes
    // vivent dans `orgAccount`, chargé avec lui seul, et ce module-ci est lu
    // sur toutes les pages de /entreprise (pastille de forfait).
    onSuccess: (contact) => {
      queryClient.setQueryData(orgBillingAccountKeys.contact(orgId), contact);
    },
  });
};
