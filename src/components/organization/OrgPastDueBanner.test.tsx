// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mutate = vi.fn();
vi.mock('@/modules/billing/org-billing.mutations', () => ({
  useOpenOrgPortal: () => ({ mutate, isPending: false }),
}));
vi.mock('@/modules/billing/org-billing-account.repository', () => ({
  getOrgBillingHistory: async () => [
    { id: 1, eventType: 'invoice.payment_failed', invoiceNumber: 'F-1', hostedInvoiceUrl: null, amountCents: 15000, currency: 'eur', occurredAt: '2026-11-02T10:00:00Z' },
  ],
  getOrgBillingContact: async () => null,
}));

import { appModeStore } from '@/lib/app-mode.store';
import { OrgPastDueBanner } from './OrgPastDueBanner';

describe('OrgPastDueBanner', () => {
  it('date de l echec, membres rassurés, bouton vers le portail', async () => {
    appModeStore.setDemo(false);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <OrgPastDueBanner orgId="org-1" memberCount={14} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/le paiement du .* n'est pas passé/i)).toBeTruthy();
    expect(screen.getByText(/vos 14 membres gardent tous leurs accès/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /mettre à jour ma carte/i }));
    expect(mutate).toHaveBeenCalledWith({ orgId: 'org-1' });
  });
});
