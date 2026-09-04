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
import type { KeyOf } from '@/i18n/catalog';
import { getOrgSubscription } from './org-billing.repository';
import type { OrgSubscription } from './org-billing.types';
import type { OrgBillingInterval, OrgTierKey } from './premium-config';
import { ApiError, makeApiError } from '@/lib/normalizeApiError';

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
  if (!session) throw makeApiError('not_authenticated');

  const { data, error } = await supabase.functions.invoke(fn, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body,
  });
  // ⚠️ Sur un statut non-2xx, `invoke` renseigne `error` et laisse `data` à
  // `null` : le code métier renvoyé par l'Edge Function (`already_subscribed`,
  // `yearly_unavailable`…) est dans le CORPS de la réponse, pas dans le message
  // de l'erreur, qui vaut « Edge Function returned a non-2xx status code ».
  // Sans cette extraction, tous ces cas retombaient sur le message générique
  // « Impossible de contacter Stripe », y compris quand Stripe répondait très
  // bien. On dit à l'utilisateur ce qui s'est réellement passé.
  if (error) throw makeApiError((await edgeErrorCode(error)) ?? 'invoke_failed');
  if (data?.error) throw makeApiError(data.error as string);
  if (!data?.url) throw makeApiError('no_url');

  window.location.href = data.url as string;
}

/** Le champ `error` du corps JSON d'une réponse d'Edge Function en échec. */
async function edgeErrorCode(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context;
  if (!context || typeof (context as Response).clone !== 'function') return null;
  try {
    const body: unknown = await (context as Response).clone().json();
    const code = (body as { error?: unknown } | null)?.error;
    return typeof code === 'string' ? code : null;
  } catch {
    // Corps vide ou non JSON : on retombe sur le message générique.
    return null;
  }
}

/**
 * Codes métier de `stripe-org-checkout` → clé de message.
 *
 * `yearly_unavailable` est distinct de `tier_unavailable` exprès : le mensuel
 * fonctionne, donc l'utilisateur a une action possible tout de suite. Un
 * message générique le laisserait croire que le paiement est en panne.
 */
/**
 * Le CODE d'une erreur, jamais son texte affichable.
 *
 * 🔴 POURQUOI CE HELPER (C-62). La table ci-dessous etait indexee par
 * `err.message`, ce qui n'a marche que tant que ces refus voyageaient dans un
 * `throw new Error('<code>')` — c'est-a-dire tant que le code SERVAIT AUSSI de
 * message affichable. C'est exactement le tuyau que C-62 ferme : depuis, le
 * code est dans `ApiError.code` et `message` porte le texte du catalogue.
 *
 * Indexer par `message` reviendrait donc a chercher « Une erreur inattendue est
 * survenue. » dans une table de codes : introuvable, repli generique, et un
 * ecran qui cesse de dire ce qui s'est reellement passe sans que rien n'echoue.
 */
const errorCode = (err: Error): string => (err instanceof ApiError ? err.code : err.message);

const CHECKOUT_ERROR_KEYS: Record<string, KeyOf<'org'>> = {
  already_subscribed: 'billing.alreadySubscribed',
  withdrawal_consent_required: 'billing.withdrawalRequired',
  yearly_unavailable: 'billing.yearlyUnavailable',
  forbidden: 'billing.ownerOnly',
  // C-65 — les refus propres au remboursement.
  no_subscription: 'billing.noSubscription',
  refund_failed: 'billing.refundFailed',
};

export const useStartOrgCheckout = () =>
  useMutation({
    mutationFn: ({
      orgId,
      tierKey,
      interval,
      immediateExecution,
      waivesWithdrawal,
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
      /**
       * Accord exprès à l'exécution immédiate du service (art. L221-28, 13°).
       *
       * ⚠️ Transmis au SERVEUR, qui refuse la session sans lui et enregistre la
       * preuve avant de créer le paiement (`withdrawal_consents`, mig. 135).
       * Ces deux drapeaux ne gardaient qu'un bouton jusqu'au 2026-09-02 : ils ne
       * quittaient pas le navigateur, donc rien ne prouvait le consentement le
       * jour d'une contestation (finding S-6).
       */
      immediateExecution: boolean;
      /** Reconnaissance de renoncer au droit de rétractation. DEUX accords distincts. */
      waivesWithdrawal: boolean;
    }) =>
      redirectToStripe('stripe-org-checkout', {
        orgId,
        tierKey,
        interval,
        immediateExecution,
        waivesWithdrawal,
      }),
    onError: (err: Error) => {
      // `translator(ns).t(key)` — forme vérifiée dans src/i18n/useT.ts et
      // utilisée par src/modules/organizations/hooks.ts. Hors composant, on ne
      // peut pas appeler le hook `useT`.
      const { t } = translator('org');
      toast.error(t(CHECKOUT_ERROR_KEYS[errorCode(err)] ?? 'billing.error'));
    },
  });

/**
 * Résilier ET se faire rembourser la période en cours, en un geste (C-65).
 *
 * 🔴 POURQUOI CE HOOK N'UTILISE PAS `redirectToStripe`. Celui-là attend une
 * `url` et navigue dessus ; ici il n'y a nulle part où aller — l'action se
 * termine sur place, et la personne doit VOIR ce qui s'est passé. Une
 * redirection vers Stripe reviendrait à lui redemander de faire elle-même ce
 * qu'on vient de lui promettre en un clic.
 *
 * ⚠️ Le montant rendu vient du SERVEUR (`refundedCents`), il n'est jamais
 * recalculé ici : deux calculs d'un même montant finissent par diverger, et
 * celui qu'on afficherait ne serait pas celui qu'on a viré.
 */
export const useCancelAndRefundOrg = (onDone?: () => void) =>
  useMutation({
    mutationFn: async ({ orgId }: { orgId: string }) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw makeApiError('not_authenticated');

      const { data, error } = await supabase.functions.invoke('stripe-org-refund', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { orgId },
      });
      // Même extraction que `redirectToStripe` : le code métier est dans le
      // CORPS, pas dans le message de l'erreur.
      if (error) throw new Error((await edgeErrorCode(error)) ?? 'invoke_failed');
      if (data?.error) throw new Error(data.error as string);
      return { refundedCents: Number(data?.refundedCents ?? 0) };
    },
    onSuccess: ({ refundedCents }) => {
      const { t } = translator('org');
      toast.success(
        refundedCents > 0
          ? t('billing.refundDone', { amount: (refundedCents / 100).toFixed(2) })
          : t('billing.cancelDone'),
      );
      onDone?.();
    },
    onError: (err: Error) => {
      const { t } = translator('org');
      toast.error(t(CHECKOUT_ERROR_KEYS[errorCode(err)] ?? 'billing.error'));
    },
  });

export const useOpenOrgPortal = () =>
  useMutation({
    mutationFn: ({ orgId }: { orgId: string }) => redirectToStripe('stripe-org-portal', { orgId }),
    onError: () => {
      toast.error(translator('org').t('billing.error'));
    },
  });
