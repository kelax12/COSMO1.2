// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgCheckoutRecap } from './OrgCheckoutRecap';

const base = {
  tierKey: 't10' as const,
  interval: 'monthly' as const,
  now: new Date(2026, 10, 2),
  isPending: false,
  isRedirecting: false,
  onCancel: vi.fn(),
};

describe('OrgCheckoutRecap', () => {
  it('dit le montant débité aujourd hui, l échéance et la fin du délai de rétractation', () => {
    render(<OrgCheckoutRecap {...base} immediateAccess={false} onImmediateAccessChange={vi.fn()} onPay={vi.fn()} />);
    expect(screen.getByText(/^70,00\s€\sTTC$/)).toBeTruthy();
    expect(screen.getByText(/même montant/i)).toBeTruthy();
    expect(screen.getByText(/jusqu'au/i)).toBeTruthy();
  });

  it('annuel : débité aujourd hui = total de l année', () => {
    render(<OrgCheckoutRecap {...base} interval="yearly" immediateAccess={false} onImmediateAccessChange={vi.fn()} onPay={vi.fn()} />);
    expect(screen.getByText(/^630,00\s€\sTTC$/)).toBeTruthy();
  });

  it('case non cochée : le bouton reste cliquable, explique, et ne paie pas', () => {
    const onPay = vi.fn();
    render(<OrgCheckoutRecap {...base} immediateAccess={false} onImmediateAccessChange={vi.fn()} onPay={onPay} />);
    const box = screen.getByRole('checkbox', { name: /je demande l'accès immédiat au service/i }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /payer 70,00\s€ avec stripe/i }));
    expect(onPay).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/cochez la case/i);
  });

  it('case cochée : un clic paie une fois', () => {
    const onPay = vi.fn();
    render(<OrgCheckoutRecap {...base} immediateAccess onImmediateAccessChange={vi.fn()} onPay={onPay} />);
    fireEvent.click(screen.getByRole('button', { name: /payer 70,00\s€ avec stripe/i }));
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('pendant la redirection : panneau Stripe, plus de bouton de paiement', () => {
    render(<OrgCheckoutRecap {...base} isPending immediateAccess onImmediateAccessChange={vi.fn()} onPay={vi.fn()} />);
    expect(screen.getByText(/direction stripe/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /payer/i })).toBeNull();
  });
});
