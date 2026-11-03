// Aperçu des e-mails pour l'œil, jamais en CI : ne tourne que si
// MAIL_PREVIEW_DIR est posé. `MAIL_PREVIEW_DIR=<dossier> npx vitest run <ce fichier>`
// écrit un .html par e-mail dans ce dossier.
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cancellationMail,
  receiptMail,
  refundDoneMail,
  subscriptionConfirmationMail,
  withdrawalAckMail,
} from '../../../supabase/functions/_shared/billing-mail-text';
import { renewalNoticeMail } from '../../../supabase/functions/_shared/renewal-notice-text';

const dir = process.env.MAIL_PREVIEW_DIR;
const APP = 'https://thecosmo.app';
const s = (iso: string) => Date.parse(iso) / 1000;

describe.skipIf(!dir)('aperçu des e-mails de facturation', () => {
  it('écrit les fichiers', () => {
    mkdirSync(dir as string, { recursive: true });
    const mails = {
      bienvenue: subscriptionConfirmationMail({
        orgName: 'Acme', amountCents: 7000, interval: 'monthly', tierKey: 't10', paidAt: s('2026-11-02T10:42:00Z'),
        nextDueAt: s('2026-12-02T10:42:00Z'), immediateAccessAt: '2026-11-02T10:42:00Z',
        withdrawalDeadline: s('2026-11-16T10:42:00Z'), invoiceUrl: 'https://invoice.stripe.com/i/exemple', appUrl: APP,
      }),
      recu: receiptMail({ orgName: 'Acme', amountCents: 7000, paidAt: s('2026-12-02T10:42:00Z'), appUrl: APP, invoiceUrl: 'https://invoice.stripe.com/i/exemple' }),
      resiliation: cancellationMail({ orgName: 'Acme', accessUntil: '2026-12-02T10:42:00Z', appUrl: APP }),
      retractation: withdrawalAckMail({ orgName: 'Acme', withdrawnAt: '2026-11-05T09:00:00Z', amountCents: 1933, appUrl: APP }),
      remboursement: refundDoneMail({ orgName: 'Acme', amountCents: 1933, refundedAt: '2026-11-06T09:00:00Z', appUrl: APP }),
      rappel: renewalNoticeMail({ org_name: 'Acme', period_end: '2026-12-17', tier_key: 't20' }, APP),
    };
    for (const [name, m] of Object.entries(mails)) {
      writeFileSync(join(dir as string, `${name}.html`), m.html, 'utf8');
      writeFileSync(join(dir as string, `${name}.txt`), `${m.subject}\n\n${m.text}`, 'utf8');
    }
  });
});
