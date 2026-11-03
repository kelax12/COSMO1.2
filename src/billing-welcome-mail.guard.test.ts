// Garde de source : l'e-mail de bienvenue reçoit ses données, et la première
// facture ne déclenche pas de reçu en double (spec 2026-11-02 § 6.2).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LF = String.fromCharCode(10);
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join(LF);
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const webhook = codeOnly(read('supabase/functions/stripe-webhook/index.ts'));

describe('e-mail de bienvenue (spec 2026-11-02 § 6.2)', () => {
  it('la bienvenue reçoit palier, date de paiement, échéance et facture', () => {
    expect(webhook).toMatch(/subscriptionConfirmationMail\(\{[\s\S]*tierKey[\s\S]*paidAt[\s\S]*nextDueAt[\s\S]*invoiceUrl/);
  });

  it('le premier prélèvement n envoie PAS de reçu : la bienvenue le remplace', () => {
    expect(webhook).toMatch(/billing_reason\s*!==\s*'subscription_create'/);
  });

  it('témoin : la garde voit bien un reçu non conditionné', () => {
    const sabotage = "if (owner?.email && (invoice.amount_paid ?? 0) > 0) { await sendBillingMail('x', owner.email, receiptMail({})) }";
    expect(sabotage).not.toMatch(/billing_reason\s*!==\s*'subscription_create'/);
  });
});
