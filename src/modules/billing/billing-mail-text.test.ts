// Textes des emails de facturation (`_shared/billing-mail-text.ts`), module pur.
import { describe, it, expect } from 'vitest';
import {
  CGV_VERSION as SERVER_CGV,
  cancellationMail,
  receiptMail,
  subscriptionConfirmationMail,
  withdrawalAckMail,
} from '../../../supabase/functions/_shared/billing-mail-text';
import { CGV_VERSION } from './cgv-version';

const APP = 'https://thecosmo.app';

describe('emails de facturation', () => {
  it('parité : le front et le serveur annoncent la même version des CGV', () => {
    expect(CGV_VERSION).toBe(SERVER_CGV);
  });

  it('la confirmation rappelle les 14 jours, le formulaire type et la demande d accès immédiat', () => {
    const m = subscriptionConfirmationMail({
      orgName: 'Acme',
      amountCents: 2900,
      interval: 'monthly',
      immediateAccessAt: '2026-11-01T10:00:00Z',
      withdrawalDeadline: Date.parse('2026-11-15T10:00:00Z') / 1000,
      appUrl: APP,
    });
    expect(m.text).toContain('14 jours');
    expect(m.text).toContain('15/11/2026');
    expect(m.text).toContain('formulaire type');
    expect(m.text).toContain('acces immediat');
    expect(m.text).toContain(CGV_VERSION);
    expect(m.text).toContain('293 B');
  });

  it('sans demande d accès immédiat, la confirmation promet un remboursement intégral', () => {
    const m = subscriptionConfirmationMail({
      orgName: 'Acme', amountCents: 2900, interval: 'yearly', immediateAccessAt: null, withdrawalDeadline: 0, appUrl: APP,
    });
    expect(m.text).toContain('integralement');
  });

  it('accusé de rétractation : date, heure, montant, délai', () => {
    const m = withdrawalAckMail({ orgName: 'Acme', withdrawnAt: '2026-11-03T09:30:00Z', amountCents: 1933 });
    expect(m.text).toContain('19,33 €');
    expect(m.text).toContain('14 jours');
    expect(m.text).toMatch(/03\/11\/2026/);
  });

  it('résiliation : date de fin d accès et aucun remboursement', () => {
    const m = cancellationMail({ orgName: 'Acme', accessUntil: '2026-12-01T00:00:00Z', appUrl: APP });
    expect(m.text).toContain('01/12/2026');
    expect(m.text).toContain('Aucun remboursement');
  });

  it('reçu : lien de résiliation, et le nom d organisation est échappé dans le HTML', () => {
    const m = receiptMail({ orgName: '<a href="x">', amountCents: 2900, paidAt: 1_800_000_000, appUrl: APP });
    expect(m.text).toContain(`${APP}/entreprise?tab=billing`);
    expect(m.html).not.toContain('<a href');
  });
});
