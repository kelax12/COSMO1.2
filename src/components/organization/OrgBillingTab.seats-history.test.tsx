// @vitest-environment jsdom
// Facturation entreprise (revue du 2026-09-25) : qui compte, ce qui a été
// payé, et à qui partent les factures. Composant réel, repository intercepté.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';

const saveContact = vi.fn();
const history = vi.fn();
vi.mock('@/modules/billing/org-billing.repository', () => ({
  getOrgSubscription: async () => null,
  getOrgBillingHistory: (...a: unknown[]) => history(...a),
  getOrgBillingContact: async () => null,
  saveOrgBillingContact: async (orgId: string, input: { name: string | null; email: string }) => {
    saveContact(orgId, input);
    return { orgId, ...input };
  },
  deleteOrgBillingContact: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { appModeStore } from '@/lib/app-mode.store';
import { OrgBillingTab } from './OrgBillingTab';

const members = Array.from({ length: 10 }, (_, i) => ({
  orgId: 'org-1',
  userId: `u-${i}`,
  role: i < 2 ? ('admin' as const) : ('member' as const),
  joinedAt: `2026-09-${String(10 + i).padStart(2, '0')}T00:00:00.000Z`,
  displayName: `Personne ${i}`,
  email: `p${i}@acme.fr`,
}));

function renderTab(isOwner = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <OrgBillingTab
          orgId="org-1"
          isOwner={isOwner}
          ownerId="u-0"
          members={members}
          ownerEmail="owner@acme.fr"
          userId="u-0"
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Facturation entreprise : sièges, historique, contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appModeStore.setDemo(false);
    history.mockResolvedValue([
      {
        id: 2, eventType: 'charge.refunded', invoiceNumber: null, hostedInvoiceUrl: null,
        amountCents: -2000, currency: 'eur', occurredAt: '2026-09-20T10:00:00.000Z',
      },
      {
        id: 1, eventType: 'invoice.payment_succeeded', invoiceNumber: 'ACME-0001',
        hostedInvoiceUrl: 'https://invoice.stripe.com/i/abc', amountCents: 2000, currency: 'eur',
        occurredAt: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 0, eventType: 'invoice.payment_succeeded', invoiceNumber: 'X',
        hostedInvoiceUrl: 'javascript:alert(1)', amountCents: 2000, currency: 'eur',
        occurredAt: '2026-08-01T10:00:00.000Z',
      },
    ]);
  });

  it('nomme les sièges consommés, le propriétaire en premier, et replie au-delà de huit', () => {
    renderTab();
    const seats = screen.getByRole('region', { name: /qui compte/i });
    expect(within(seats).getByText('Personne 0')).toBeTruthy();
    expect(within(seats).getByText('Propriétaire')).toBeTruthy();
    expect(within(seats).queryByText('Personne 9')).toBeNull();
    fireEvent.click(within(seats).getByRole('button', { name: /voir les 10/i }));
    expect(within(seats).getByText('Personne 9')).toBeTruthy();
  });

  it('liste les paiements du journal, et ne rend jamais un lien non https', async () => {
    renderTab();
    const section = screen.getByRole('region', { name: /historique/i });
    await waitFor(() => expect(within(section).getByText(/ACME-0001/)).toBeTruthy());
    expect(within(section).getByText(/remboursement/i)).toBeTruthy();
    const links = within(section).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://invoice.stripe.com/i/abc');
  });

  it('enregistre un contact de facturation distinct, et refuse une adresse invalide', async () => {
    renderTab();
    const card = screen.getByRole('region', { name: /contact de facturation/i });
    expect(await within(card).findByText(/owner@acme\.fr/)).toBeTruthy();
    const email = within(card).getByLabelText(/adresse/i);
    fireEvent.change(email, { target: { value: 'pas-une-adresse' } });
    fireEvent.blur(email);
    expect(within(card).getByRole('alert')).toBeTruthy();
    expect((within(card).getByRole('button', { name: /enregistrer/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(within(card).getByLabelText(/nom/i), { target: { value: 'Service compta' } });
    fireEvent.change(email, { target: { value: 'compta@acme.fr' } });
    fireEvent.click(within(card).getByRole('button', { name: /enregistrer/i }));
    await waitFor(() =>
      expect(saveContact).toHaveBeenCalledWith('org-1', { name: 'Service compta', email: 'compta@acme.fr' }),
    );
  });

  it('un compte qui n est pas propriétaire ne lit ni l historique ni le contact', () => {
    renderTab(false);
    expect(screen.queryByRole('region', { name: /historique/i })).toBeNull();
    expect(screen.queryByRole('region', { name: /contact de facturation/i })).toBeNull();
    expect(history).not.toHaveBeenCalled();
  });
});
