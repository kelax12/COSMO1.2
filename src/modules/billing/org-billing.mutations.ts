// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — mutations (paiement, portail, rétractation, résiliation).
//
// Séparées de `org-billing.hooks.ts` le 2026-10-01 : la page /entreprise
// n'a besoin que de la lecture d'abonnement, et ce code ne sert qu'à l'onglet
// Facturation et à la section Paramètres, tous deux chargés à la demande.
// ❌ AUCUN REJEU AUTOMATIQUE sur une mutation qui déplace de l'argent : voir
//    `useOrgSubscriptionAction` et src/modules/billing/CLAUDE.md.
// ═══════════════════════════════════════════════════════════════════
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { translator } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import type { OrgBillingInterval, OrgTierKey } from './premium-config';
import { ApiError, makeApiError } from '@/lib/normalizeApiError';
import { CGV_VERSION } from './cgv-version';

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

const CHECKOUT_ERROR_KEYS: Record<string, KeyOf<'orgAdmin'>> = {
  already_subscribed: 'billing.alreadySubscribed',
  // Impayé en cours : la sortie est la carte, dans le portail, jamais un
  // second abonnement (`_shared/org-checkout-gate.ts`).
  subscription_past_due: 'billing.subscriptionPastDue',
  yearly_unavailable: 'billing.yearlyUnavailable',
  forbidden: 'billing.ownerOnly',
  no_subscription: 'billing.noSubscription',
  immediate_access_required: 'billing.immediateAccessRequired',
  cgv_outdated: 'billing.cgvOutdated',
  withdrawal_window_closed: 'billing.withdrawalClosed',
  subscription_action_failed: 'billing.actionFailed',
};

export const useStartOrgCheckout = () =>
  useMutation({
    // 🔴 AUCUN REJEU AUTOMATIQUE sur un chemin qui mène au paiement : on fait
    // retenter la PERSONNE, jamais le navigateur.
    retry: 0,
    mutationFn: ({
      orgId,
      tierKey,
      interval,
      immediateAccess,
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
      /** Case « accès immédiat » cochée (L221-25). Le serveur l'exige. */
      immediateAccess: boolean;
    }) =>
      redirectToStripe('stripe-org-checkout', {
        orgId,
        tierKey,
        interval,
        immediateAccess,
        cgvVersion: CGV_VERSION,
      }),
    onError: (err: Error) => {
      // `translator(ns).t(key)` — forme vérifiée dans src/i18n/useT.ts et
      // utilisée par src/modules/organizations/hooks.ts. Hors composant, on ne
      // peut pas appeler le hook `useT`.
      const { t } = translator('orgAdmin');
      toast.error(t(CHECKOUT_ERROR_KEYS[errorCode(err)] ?? 'billing.error'));
    },
  });

/** Action sur l'abonnement, servie par `stripe-org-subscription`. */
export type OrgSubscriptionAction = 'withdraw' | 'cancel' | 'resume' | 'cancel_now';

async function invokeSubscription(orgId: string, action: OrgSubscriptionAction | 'withdrawal_preview') {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw makeApiError('not_authenticated');

  const { data, error } = await supabase.functions.invoke('stripe-org-subscription', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { orgId, action },
  });
  // Même extraction que `redirectToStripe` : le code métier est dans le CORPS.
  if (error) throw makeApiError((await edgeErrorCode(error)) ?? 'invoke_failed');
  if (data?.error) throw makeApiError(data.error as string);
  return data as Record<string, unknown>;
}

export interface WithdrawalPreview {
  amountCents: number;
  deadline: string;
  recipient: string;
}

/**
 * Récapitulatif de l'écran de rétractation (§2) : montant qui sera remboursé,
 * calculé par le SERVEUR (`refund-amount.ts`), jamais ici. `enabled` ne vaut
 * que pendant les 14 jours : hors délai, le serveur refuse de toute façon.
 */
export const useWithdrawalPreview = (orgId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['org-billing', 'withdrawal-preview', orgId],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<WithdrawalPreview> => {
      const data = await invokeSubscription(orgId, 'withdrawal_preview');
      return {
        amountCents: Number(data.amountCents ?? 0),
        deadline: String(data.deadline ?? ''),
        recipient: String(data.recipient ?? ''),
      };
    },
  });

/**
 * Rétractation, résiliation, annulation de résiliation (décision du
 * 2026-11-01). ❌ AUCUNE ne rembourse : le remboursement d'une rétractation est
 * fait à la main par l'admin (`stripe-org-refund`).
 */
export const useOrgSubscriptionAction = (onDone?: (action: OrgSubscriptionAction) => void) =>
  useMutation({
    // 🔴 AUCUN REJEU AUTOMATIQUE : on fait retenter la PERSONNE, jamais le
    // navigateur, sur un chemin qui arrête un contrat payé.
    retry: 0,
    mutationFn: async ({ orgId, action }: { orgId: string; action: OrgSubscriptionAction }) => {
      const data = await invokeSubscription(orgId, action);
      return { action, amountCents: Number(data.amountCents ?? 0), accessUntil: String(data.accessUntil ?? '') };
    },
    onSuccess: ({ action }) => {
      onDone?.(action);
    },
    onError: (err: Error) => {
      const { t } = translator('orgAdmin');
      toast.error(t(CHECKOUT_ERROR_KEYS[errorCode(err)] ?? 'billing.error'));
    },
  });

export const useOpenOrgPortal = () =>
  useMutation({
    mutationFn: ({ orgId }: { orgId: string }) => redirectToStripe('stripe-org-portal', { orgId }),
    onError: () => {
      toast.error(translator('orgAdmin').t('billing.error'));
    },
  });
