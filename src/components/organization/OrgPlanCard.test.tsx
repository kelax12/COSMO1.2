// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrgPlanCard } from './OrgPlanCard';
import type { OrgSubscription } from '@/modules/billing/org-billing.types';

const sub = (over: Partial<OrgSubscription> = {}): OrgSubscription => ({
  orgId: 'org-1', tierKey: 't20', maxMembers: 20, status: 'active', billingInterval: 'monthly',
  currentPeriodEnd: '2026-12-02T00:00:00.000Z', discountCode: null, startedAt: null, cancelAtPeriodEnd: false,
  ...over,
});

describe('OrgPlanCard', () => {
  it('palier gratuit plein : pastille d essai, jauge 5 sur 5, phrase « Complet »', () => {
    render(<OrgPlanCard subscription={null} memberCount={5} />);
    expect(screen.getByText("Palier d'essai")).toBeTruthy();
    expect(screen.getByText('5 sur 5')).toBeTruthy();
    expect(screen.getByRole('meter', { name: /sièges occupés/i }).getAttribute('aria-valuenow')).toBe('5');
    expect(screen.getByText(/complet\. le prochain membre/i)).toBeTruthy();
  });

  it('payant actif : pastille Actif et prochaine échéance au montant dérivé', () => {
    render(<OrgPlanCard subscription={sub()} memberCount={14} />);
    expect(screen.getByText('Actif')).toBeTruthy();
    expect(screen.getByText(/prochaine échéance le .*150,00 €/i)).toBeTruthy();
  });

  it('impayé : pastille Paiement en attente, pas d échéance annoncée', () => {
    render(<OrgPlanCard subscription={sub({ status: 'past_due' })} memberCount={14} />);
    expect(screen.getByText('Paiement en attente')).toBeTruthy();
    expect(screen.queryByText(/prochaine échéance/i)).toBeNull();
  });

  it('résiliation programmée : pastille de fin, pas d échéance', () => {
    render(<OrgPlanCard subscription={sub({ cancelAtPeriodEnd: true })} memberCount={14} />);
    expect(screen.getByText(/se termine le/i)).toBeTruthy();
    expect(screen.queryByText(/prochaine échéance/i)).toBeNull();
  });
});
