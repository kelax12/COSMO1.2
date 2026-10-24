// Historique des paiements et contact de facturation d'une organisation.
// Verrouille : l'historique passe par la RPC et jamais par `payment_records`
// (journal fiscal fermé à `authenticated`, mig. 125), et l'upsert du contact
// n'écrit que des colonnes nommées (whitelist).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseMock } from '@/test/supabase-mock';

vi.mock('@/lib/supabase', async () => {
  const { supabaseMock: mock } = await import('@/test/supabase-mock');
  return { supabase: mock.client };
});

import {
  getOrgBillingHistory,
  getOrgBillingContact,
  saveOrgBillingContact,
  deleteOrgBillingContact,
} from './org-billing-account.repository';

beforeEach(() => supabaseMock.reset());

describe('getOrgBillingHistory', () => {
  it('lit par la RPC et mappe snake → camel, montants en nombres', async () => {
    supabaseMock.queueRpc('get_org_billing_history', {
      data: [{
        id: '7', event_type: 'invoice.paid', invoice_number: 'F-001',
        hosted_invoice_url: 'https://invoice.stripe.com/i', amount_cents: '2000',
        currency: 'eur', occurred_at: '2026-10-20T10:00:00Z',
      }],
    });

    const rows = await getOrgBillingHistory('org-1');

    expect(supabaseMock.rpcCalls).toEqual([{ fn: 'get_org_billing_history', args: { p_org: 'org-1' } }]);
    expect(rows).toEqual([{
      id: 7, eventType: 'invoice.paid', invoiceNumber: 'F-001',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i', amountCents: 2000,
      currency: 'eur', occurredAt: '2026-10-20T10:00:00Z',
    }]);
  });

  it('🔴 ne touche jamais `payment_records` directement', async () => {
    supabaseMock.queueRpc('get_org_billing_history', { data: [] });
    await getOrgBillingHistory('org-1');
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  it('data null = liste vide', async () => {
    supabaseMock.queueRpc('get_org_billing_history', { data: null });
    expect(await getOrgBillingHistory('org-1')).toEqual([]);
  });

  it('propage un refus (non-propriétaire)', async () => {
    supabaseMock.queueRpc('get_org_billing_history', { error: { message: 'forbidden', code: '42501' } });
    await expect(getOrgBillingHistory('org-1')).rejects.toThrow();
  });
});

describe('getOrgBillingContact', () => {
  it('aucun contact = null (les factures vont au propriétaire)', async () => {
    supabaseMock.queueTable('org_billing_contacts', { data: null });
    expect(await getOrgBillingContact('org-1')).toBeNull();
    expect(supabaseMock.argsOf('org_billing_contacts', 'eq')).toEqual(['org_id', 'org-1']);
  });

  it('mappe la ligne', async () => {
    supabaseMock.queueTable('org_billing_contacts', {
      data: { org_id: 'org-1', name: 'Compta', email: 'compta@acme.test' },
    });
    expect(await getOrgBillingContact('org-1')).toEqual({ orgId: 'org-1', name: 'Compta', email: 'compta@acme.test' });
  });
});

describe('saveOrgBillingContact', () => {
  it('n’écrit que les colonnes nommées, conflit sur org_id', async () => {
    supabaseMock.queueTable('org_billing_contacts', { data: null });
    const input = { name: 'Compta', email: 'compta@acme.test', role: 'owner' } as unknown as {
      name: string | null; email: string;
    };

    const saved = await saveOrgBillingContact('org-1', input, 'u1');

    const [row, opts] = supabaseMock.argsOf('org_billing_contacts', 'upsert') as [Record<string, unknown>, unknown];
    expect(Object.keys(row).sort()).toEqual(['email', 'name', 'org_id', 'updated_at', 'updated_by']);
    expect(row).toMatchObject({ org_id: 'org-1', name: 'Compta', email: 'compta@acme.test', updated_by: 'u1' });
    expect(opts).toEqual({ onConflict: 'org_id' });
    expect(saved).toEqual({ orgId: 'org-1', name: 'Compta', email: 'compta@acme.test' });
  });

  it('sans utilisateur, updated_by vaut null', async () => {
    supabaseMock.queueTable('org_billing_contacts', { data: null });
    await saveOrgBillingContact('org-1', { name: null, email: 'a@b.test' }, undefined);
    const [row] = supabaseMock.argsOf('org_billing_contacts', 'upsert') as [Record<string, unknown>];
    expect(row.updated_by).toBeNull();
  });

  it('propage une erreur RLS', async () => {
    supabaseMock.queueTable('org_billing_contacts', { error: { message: 'rls', code: '42501' } });
    await expect(saveOrgBillingContact('org-1', { name: null, email: 'a@b.test' }, 'u1')).rejects.toThrow();
  });
});

describe('deleteOrgBillingContact', () => {
  it('supprime la ligne de cette organisation seulement', async () => {
    supabaseMock.queueTable('org_billing_contacts', { data: null });
    await deleteOrgBillingContact('org-1');
    const calls = supabaseMock.callsFor('org_billing_contacts');
    expect(calls.map((c) => c.method)).toEqual(['delete', 'eq']);
    expect(calls[1].args).toEqual(['org_id', 'org-1']);
  });
});
