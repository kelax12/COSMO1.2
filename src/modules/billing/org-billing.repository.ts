// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — abonnement, historique et contact de facturation.
//
// L'ABONNEMENT est en LECTURE SEULE, par construction : `org_subscriptions`
// n'a aucune policy d'écriture (mig. 101). Toute mutation passe par Stripe
// puis par le webhook. L'historique aussi (journal fiscal, mig. 125/180).
// Seul le CONTACT de facturation s'écrit depuis le client (mig. 180), sous RLS
// propriétaire.
// ═══════════════════════════════════════════════════════════════════
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type {
  OrgBillingContact,
  OrgBillingHistoryEntry,
  OrgSubscription,
  OrgSubscriptionStatus,
} from './org-billing.types';
import type { OrgBillingInterval, OrgTierKey } from './premium-config';

interface OrgSubscriptionRow {
  org_id: string;
  tier_key: OrgTierKey;
  max_members: number | null;
  status: OrgSubscriptionStatus;
  billing_interval: OrgBillingInterval | null;
  current_period_end: string | null;
  discount_code: string | null;
}

/** `null` = aucune ligne, c'est-à-dire palier gratuit. Pas une erreur. */
export async function getOrgSubscription(orgId: string): Promise<OrgSubscription | null> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('org_subscriptions')
    .select('org_id, tier_key, max_members, status, billing_interval, current_period_end, discount_code')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw normalizeApiError(error);
  if (!data) return null;

  const row = data as OrgSubscriptionRow;
  return {
    orgId: row.org_id,
    tierKey: row.tier_key,
    maxMembers: row.max_members,
    status: row.status,
    // `null` impossible en base (NOT NULL DEFAULT 'monthly', mig. 123) ; le
    // repli couvre la fenêtre où le front est déployé avant la migration.
    billingInterval: row.billing_interval ?? 'monthly',
    currentPeriodEnd: row.current_period_end,
    discountCode: row.discount_code,
  };
}

interface OrgBillingHistoryRow {
  id: number;
  event_type: string;
  invoice_number: string | null;
  hosted_invoice_url: string | null;
  amount_cents: number;
  currency: string;
  occurred_at: string;
}

/**
 * Historique des paiements d'une organisation (propriétaire seul).
 *
 * Passe par une RPC et jamais par `payment_records` directement : le journal
 * fiscal est fermé à `authenticated` (mig. 125) et doit le rester.
 */
export async function getOrgBillingHistory(orgId: string): Promise<OrgBillingHistoryEntry[]> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.rpc('get_org_billing_history', { p_org: orgId });
  if (error) throw normalizeApiError(error);

  return ((data ?? []) as OrgBillingHistoryRow[]).map((row) => ({
    id: Number(row.id),
    eventType: row.event_type,
    invoiceNumber: row.invoice_number,
    hostedInvoiceUrl: row.hosted_invoice_url,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    occurredAt: row.occurred_at,
  }));
}

/** `null` = aucun contact : les factures vont au propriétaire. */
export async function getOrgBillingContact(orgId: string): Promise<OrgBillingContact | null> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('org_billing_contacts')
    .select('org_id, name, email')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw normalizeApiError(error);
  if (!data) return null;
  const row = data as { org_id: string; name: string | null; email: string };
  return { orgId: row.org_id, name: row.name, email: row.email };
}

/**
 * Pose ou remplace le contact. Colonnes écrites NOMMÉMENT (whitelist) : rien
 * d'autre que le nom et l'adresse ne part du client.
 */
export async function saveOrgBillingContact(
  orgId: string,
  input: { name: string | null; email: string },
  userId: string | undefined,
): Promise<OrgBillingContact> {
  if (!supabase) throw new Error('Supabase not configured');

  const { error } = await supabase.from('org_billing_contacts').upsert(
    {
      org_id: orgId,
      name: input.name,
      email: input.email,
      updated_at: new Date().toISOString(),
      updated_by: userId ?? null,
    },
    { onConflict: 'org_id' },
  );
  if (error) throw normalizeApiError(error);
  return { orgId, name: input.name, email: input.email };
}

/** Retire le contact : les factures repartent au propriétaire. */
export async function deleteOrgBillingContact(orgId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('org_billing_contacts').delete().eq('org_id', orgId);
  if (error) throw normalizeApiError(error);
}
