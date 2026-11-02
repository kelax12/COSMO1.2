// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mutate, historyRef } = vi.hoisted(() => ({
  mutate: vi.fn(),
  historyRef: { current: [] as unknown[] },
}));
vi.mock('@/modules/billing/org-billing.mutations', () => ({
  useOpenOrgPortal: () => ({ mutate, isPending: false }),
}));
vi.mock('@/modules/billing/org-billing-account.repository', () => ({
  getOrgBillingHistory: async () => historyRef.current,
  getOrgBillingContact: async () => null,
}));

import { appModeStore } from '@/lib/app-mode.store';
import { OrgPastDueBanner } from './OrgPastDueBanner';

const FAILED = {
  id: 1,
  eventType: 'invoice.payment_failed',
  invoiceNumber: 'F-1',
  hostedInvoiceUrl: null,
  amountCents: 15000,
  currency: 'eur',
  occurredAt: '2026-11-02T10:00:00Z',
};

function renderBanner() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OrgPastDueBanner orgId="org-1" memberCount={14} />
    </QueryClientProvider>,
  );
}

describe('OrgPastDueBanner', () => {
  beforeEach(() => {
    mutate.mockClear();
    appModeStore.setDemo(false);
  });
  afterEach(() => {
    appModeStore.setDemo(true);
  });

  it('date de l echec, membres rassurés, bouton vers le portail', async () => {
    historyRef.current = [FAILED];
    renderBanner();
    const title = await screen.findByText(/le paiement du .* n'est pas passé/i);
    expect(title.textContent).toMatch(/02\/11\/2026/);
    expect(screen.getByText(/vos 14 membres gardent tous leurs accès/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /mettre à jour ma carte/i }));
    expect(mutate).toHaveBeenCalledWith({ orgId: 'org-1' });
  });

  it('aucun échec dans le journal : titre sans date', async () => {
    historyRef.current = [];
    renderBanner();
    expect(await screen.findByText("Le dernier paiement n'est pas passé")).toBeTruthy();
  });

  it('pendant la lecture du journal : aucun titre, donc pas de bascule', () => {
    historyRef.current = [FAILED];
    renderBanner();
    expect(screen.queryByText(/n'est pas passé/i)).toBeNull();
    expect(screen.getByText(/vos 14 membres gardent tous leurs accès/i)).toBeTruthy();
  });
});
