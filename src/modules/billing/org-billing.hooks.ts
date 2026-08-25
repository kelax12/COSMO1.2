// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — hooks React Query.
//
// MODE DÉMO : une organisation de démo ne paie jamais. `useOrgSubscription`
// renvoie `null` (= palier gratuit) sans aucune requête, et les mutations de
// checkout/portail ne sont pas exposées dans l'UI démo. Pas de
// `local.repository` ni d'entrée dans `repository.factory` : il n'y a aucune
// sémantique démo à simuler pour un abonnement Stripe.
// ═══════════════════════════════════════════════════════════════════
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useIsDemo } from '@/lib/app-mode.store';
import { translator } from '@/i18n/useT';
import { getOrgSubscription } from './org-billing.repository';
import type { OrgSubscription } from './org-billing.types';
import type { OrgBillingInterval, OrgTierKey } from './premium-config';

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

/** Invoque une Edge Function Stripe et redirige vers l'URL renvoyée. */
async function redirectToStripe(
  fn: 'stripe-org-checkout' | 'stripe-org-portal',
  body: Record<string, unknown>,
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('not_authenticated');

  const { data, error } = await supabase.functions.invoke(fn, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error as string);
  if (!data?.url) throw new Error('no_url');

  window.location.href = data.url as string;
}

export const useStartOrgCheckout = () =>
  useMutation({
    mutationFn: ({
      orgId,
      tierKey,
      interval,
    }: {
      orgId: string;
      tierKey: OrgTierKey;
      /**
       * Périodicité choisie. Le client n'envoie qu'un mot d'une liste fermée —
       * jamais un montant, jamais un price ID : le serveur seul fait la
       * conversion, donc personne ne peut se choisir un tarif. Absente =
       * mensuel, comme avant l'existence du sélecteur.
       */
      interval?: OrgBillingInterval;
    }) => redirectToStripe('stripe-org-checkout', { orgId, tierKey, interval }),
    onError: (err: Error) => {
      // `translator(ns).t(key)` — forme vérifiée dans src/i18n/useT.ts et
      // utilisée par src/modules/organizations/hooks.ts. Hors composant, on ne
      // peut pas appeler le hook `useT`.
      const { t } = translator('org');
      toast.error(
        err.message === 'already_subscribed' ? t('billing.alreadySubscribed') : t('billing.error'),
      );
    },
  });

export const useOpenOrgPortal = () =>
  useMutation({
    mutationFn: ({ orgId }: { orgId: string }) => redirectToStripe('stripe-org-portal', { orgId }),
    onError: () => {
      toast.error(translator('org').t('billing.error'));
    },
  });
