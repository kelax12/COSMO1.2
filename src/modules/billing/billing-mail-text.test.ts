// Textes des emails de facturation (`_shared/billing-mail-text.ts`), module pur.
import { describe, it, expect } from 'vitest';
import {
  CGV_VERSION as SERVER_CGV,
  cancellationMail,
  receiptMail,
  refundDoneMail,
  subscriptionConfirmationMail,
  withdrawalAckMail,
} from '../../../supabase/functions/_shared/billing-mail-text';
import { renewalNoticeMail } from '../../../supabase/functions/_shared/renewal-notice-text';
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
      tierKey: 't10',
      paidAt: Date.parse('2026-11-02T10:00:00Z') / 1000,
      nextDueAt: Date.parse('2026-12-02T10:00:00Z') / 1000,
      immediateAccessAt: '2026-11-01T10:00:00Z',
      withdrawalDeadline: Date.parse('2026-11-15T10:00:00Z') / 1000,
      invoiceUrl: null,
      appUrl: APP,
    });
    expect(m.text).toContain('14 jours');
    expect(m.text).toContain('15/11/2026');
    expect(m.text).toContain('formulaire type');
    expect(m.text).toContain('accès immédiat');
    expect(m.text).toContain(CGV_VERSION);
    expect(m.text).toContain('293 B');
  });

  it('sans demande d accès immédiat, la confirmation promet un remboursement intégral', () => {
    const m = subscriptionConfirmationMail({
      orgName: 'Acme', amountCents: 2900, interval: 'yearly', tierKey: 't10', paidAt: 0, nextDueAt: null,
      immediateAccessAt: null, withdrawalDeadline: 0, invoiceUrl: null, appUrl: APP,
    });
    expect(m.text).toContain('intégralement');
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
    expect(m.text).toContain(`${APP}/entreprise/billing`);
    expect(m.html).not.toContain('<a href="x">');
  });
});

describe('e-mails sur le gabarit commun', () => {
  it('bienvenue : encadré, bouton vers les membres, lien de facture https seul', () => {
    const m = subscriptionConfirmationMail({
      orgName: 'Acme', amountCents: 7000, interval: 'monthly', tierKey: 't10',
      paidAt: Date.parse('2026-11-02T10:00:00Z') / 1000, nextDueAt: Date.parse('2026-12-02T10:00:00Z') / 1000,
      immediateAccessAt: '2026-11-02T10:00:00Z', withdrawalDeadline: Date.parse('2026-11-16T10:00:00Z') / 1000,
      invoiceUrl: 'https://invoice.stripe.com/i/abc', appUrl: APP,
    });
    expect(m.subject).toBe('Votre abonnement COSMO Entreprise est actif');
    expect(m.text).toContain('Palier : 5 à 10 membres');
    expect(m.text).toContain('Montant : 70,00 € TTC / mois');
    expect(m.text).toContain('Prochaine échéance : 02/12/2026');
    expect(m.html).toContain('href="https://thecosmo.app/entreprise/members"');
    expect(m.html).toContain('href="https://invoice.stripe.com/i/abc"');
    // La date limite reste dans le paragraphe légal, pas dans l'encadré.
    expect(m.text).not.toMatch(/Changer d.avis :/);
    expect(m.text).toContain('16/11/2026');
  });

  it('bienvenue : une facture non https est ignorée', () => {
    const m = subscriptionConfirmationMail({
      orgName: 'Acme', amountCents: 7000, interval: 'yearly', tierKey: 't10', paidAt: 0, nextDueAt: null,
      immediateAccessAt: null, withdrawalDeadline: 0, invoiceUrl: 'javascript:alert(1)', appUrl: APP,
    });
    expect(m.html).not.toContain('javascript:');
    expect(m.text).toContain('Montant : 70,00 € TTC / an');
  });

  it('résiliation : fin d accès, aucun prélèvement, reprise possible, aucun remboursement', () => {
    const m = cancellationMail({ orgName: 'Acme', accessUntil: '2026-12-02T00:00:00Z', appUrl: APP });
    expect(m.text).toContain('Fin d’accès : 02/12/2026');
    expect(m.html).toContain('href="https://thecosmo.app/entreprise/billing"');
    expect(m.text).toContain('Aucun remboursement');
  });

  it('chaque e-mail porte le logo et le nom d organisation échappé', () => {
    const evil = 'Acme <img src=x onerror=alert(1)>';
    for (const m of [
      receiptMail({ orgName: evil, amountCents: 7000, paidAt: 0, appUrl: APP, invoiceUrl: null }),
      cancellationMail({ orgName: evil, accessUntil: '2026-12-02T00:00:00Z', appUrl: APP }),
      withdrawalAckMail({ orgName: evil, withdrawnAt: '2026-11-03T10:00:00Z', amountCents: 1933 }),
      refundDoneMail({ orgName: evil, amountCents: 1933, refundedAt: '2026-11-04T10:00:00Z' }),
    ]) {
      expect(m.html).toContain('alt="Cosmo"');
      expect(m.html).not.toContain('<img src=x');
    }
  });
});

describe('rappel annuel L215-1 sur le gabarit', () => {
  it('garde l article, la date, le dernier jour et le lien de résiliation', () => {
    const m = renewalNoticeMail({ org_name: 'Acme', period_end: '2026-12-17', tier_key: 't20' }, 'https://thecosmo.app');
    expect(m.subject).toBe('Votre abonnement COSMO sera renouvelé le 17/12/2026');
    expect(m.text).toContain('L215-1');
    expect(m.text).toContain('Renouvellement : 17/12/2026');
    expect(m.text).toContain('Montant débité : 1350,00 € TTC pour un an');
    expect(m.text).toContain('16/12/2026');
    expect(m.html).toContain('href="https://thecosmo.app/entreprise?tab=billing"');
    expect(m.html).toContain('alt="Cosmo"');
  });
});
