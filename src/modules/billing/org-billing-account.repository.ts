// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — historique des paiements et contact de facturation (mig. 180)
//
// Module À PART de `org-billing.repository.ts`, et c'est une mesure : celui-là
// est lu par la pastille de forfait, donc par le chunk `OrganizationPage`, à
// son cliquet. Ici, seul l'écran Facturation (lazy) importe.
//
// L'historique est en LECTURE SEULE (journal fiscal, mig. 125). Seul le
// contact s'écrit depuis le client, sous RLS propriétaire.
// ═══════════════════════════════════════════════════════════════════
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type { OrgBillingContact, OrgBillingHistoryEntry } from './org-billing.types';

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
