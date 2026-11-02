// ═══════════════════════════════════════════════════════════════════
// GARDE — rétractation, résiliation, remboursement (décision du 2026-11-01)
// ═══════════════════════════════════════════════════════════════════
//
// Consigne : `Documents/analytics/docs/REMBOURSEMENT-RESILIATION.md`. Elle
// remplace « rembourser le mois en cours à tout moment » (2026-09-03).
//
// ⚠️ Garde TEXTUELLE, comme les autres gardes d'Edge Function : rien ici n'est
// joué contre Stripe. Ce qui EST exécuté : le montant
// (`src/modules/billing/refund-amount.test.ts`), le verrou anti-rejeu
// (`refund-replay.test.ts`), les textes d'emails (`billing-mail-text.test.ts`)
// et le parcours d'écran (`OrgBillingTab.retractation.parcours.test.tsx`).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8');

/** Le CODE seul : ces fichiers citent leurs propres pièges en commentaire. */
function codeOnly(source: string): string {
  return source
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(String.fromCharCode(10))
    .map((line) => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join(String.fromCharCode(10));
}

/** Ordre entre deux TOKENS, qui exige d'abord qu'ils EXISTENT (un `-1` passerait). */
function expectOrder(source: string, first: string, second: string, why: string): void {
  const at = (needle: string): number => {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
    const m = new RegExp(`(?<![A-Za-z0-9_$])${escaped}`).exec(source);
    return m ? m.index : -1;
  };
  const a = at(first);
  const b = at(second);
  expect(a, `${first} est ABSENT — ${why}`).toBeGreaterThan(-1);
  expect(b, `${second} est ABSENT — ${why}`).toBeGreaterThan(-1);
  expect(a, why).toBeLessThan(b);
}

const refundFn = codeOnly(read('supabase/functions/stripe-org-refund/index.ts'));
const subFn = codeOnly(read('supabase/functions/stripe-org-subscription/index.ts'));
const checkoutFn = codeOnly(read('supabase/functions/stripe-org-checkout/index.ts'));
const webhook = codeOnly(read('supabase/functions/stripe-webhook/index.ts'));
const mutations = codeOnly(read('src/modules/billing/org-billing.mutations.ts'));
const billingTab = read('src/components/organization/OrgBillingTab.tsx');
const checkoutRecap = read('src/components/organization/OrgCheckoutRecap.tsx');
const deleteFlow = codeOnly(read('src/pages/organization/useDeleteOrgFlow.ts'));
const refundReplay = codeOnly(read('supabase/functions/_shared/refund-replay.ts'));

describe('le remboursement est réservé à l ADMIN', () => {
  it('stripe-org-refund exige is_admin() et lit son erreur', () => {
    expect(refundFn).toMatch(/rpc\('is_admin'\)/);
    expect(refundFn).toMatch(/if \(adminError\) throw adminError/);
    expect(refundFn).toMatch(/isAdmin !== true/);
    expectOrder(refundFn, "rpc('is_admin')", 'stripe.refunds.create', 'la garde admin passe AVANT tout remboursement');
  });

  it('jamais admin_allowlisted() (affichage seul)', () => {
    expect(refundFn).not.toContain('admin_allowlisted');
  });

  it('aucun chemin de l interface utilisateur n appelle stripe-org-refund', () => {
    expect(mutations).not.toContain('stripe-org-refund');
    expect(codeOnly(billingTab)).not.toContain('stripe-org-refund');
    expect(deleteFlow).not.toContain('stripe-org-refund');
    expect(mutations).not.toContain('useCancelAndRefundOrg');
  });

  it('aperçu sans `confirm: true` : l admin valide un montant calculé, jamais saisi', () => {
    expect(refundFn).toMatch(/if \(confirm !== true\)/);
    expectOrder(refundFn, 'confirm !== true', 'stripe.refunds.create', 'l aperçu sort AVANT tout remboursement');
    expect(refundFn).not.toMatch(/amountCents\s*[:=]\s*body|req\.json\(\)[^\n]*amount/);
  });

  it('les exceptions hors fenêtre sont nommées, et le rappel manqué doit être MARQUÉ', () => {
    expect(refundFn).toContain("'conformity'");
    expect(refundFn).toContain("'renewal_notice_missed'");
    expect(refundFn).toMatch(/renewal_notice_missed_at/);
  });
});

describe('la BORNE — un remboursement rejouable est une perte d argent', () => {
  it('clé d idempotence dérivée de la facture', () => {
    expect(refundFn).toMatch(/idempotencyKey:\s*`org-refund:\$\{invoice\.id\}`/);
  });

  it('pré-contrôle des remboursements déjà posés, arithmétique dans _shared', () => {
    expect(refundFn).toContain('stripe.refunds.list');
    expect(refundFn).toMatch(/remainingRefundableCents\(/);
    expect(refundFn).toMatch(/priorRefunds:\s*existing\.data/);
    expect(refundReplay).toMatch(/already/);
    expect(refundFn).not.toMatch(/existing\.data\.reduce/);
  });

  it('jamais plus que l encaissé', () => {
    expect(refundReplay).toMatch(/Math\.min\(/);
    expect(refundFn).toMatch(/amountPaidCents:\s*invoice\.amount_paid/);
  });

  it('une rétractation déjà remboursée n est pas rejouée', () => {
    expect(refundFn).toMatch(/if \(w\.refunded_at\) return json\(\{ error: 'already_refunded' \}/);
  });
});

describe('la RÉTRACTATION — 14 jours, arrêt immédiat, aucun remboursement automatique', () => {
  it('refuse hors fenêtre, à partir de la conclusion du contrat', () => {
    expect(subFn).toMatch(/withinWithdrawalWindow\(contractStart, now\)/);
    expect(subFn).toMatch(/const contractStart = subscription\.start_date/);
    expect(subFn).toContain("'withdrawal_window_closed'");
  });

  it('arrête l abonnement, enregistre, accuse réception, alerte', () => {
    expectOrder(subFn, 'stripe.subscriptions.cancel', "from('org_withdrawals').insert", 'arrêt puis trace');
    expect(subFn).toMatch(/withdrawalAckMail\(/);
    expect(subFn).toMatch(/RETRACTATION org/);
  });

  it('n appelle JAMAIS refunds.create', () => {
    expect(subFn).not.toContain('refunds.create');
  });

  it('le prorata n est retenu qu avec la demande expresse d accès immédiat', () => {
    expect(subFn).toMatch(/immediateAccessRequested:\s*!!acceptance\?\.immediate_access_at/);
  });
});

describe('la RÉSILIATION — fin de période, sans remboursement', () => {
  it('cancel_at_period_end, et un email de confirmation', () => {
    expect(subFn).toMatch(/cancel_at_period_end:\s*action === 'cancel'/);
    expect(subFn).toMatch(/cancellationMail\(/);
  });

  it('la suppression d organisation arrête l abonnement AVANT de supprimer, sans rembourser', () => {
    expectOrder(deleteFlow, 'stop.mutate', 'remove.mutate', 'on arrête l abonnement AVANT de supprimer');
    expect(deleteFlow).toMatch(/action: 'cancel_now'/);
    expect(deleteFlow).toMatch(/onSuccess:\s*\(\)\s*=>\s*remove\.mutate/);
  });

  it('aucun rejeu automatique sur une action d abonnement', () => {
    expect(mutations).toMatch(/useOrgSubscriptionAction[^]*?retry:\s*0/);
  });
});

describe('le PAIEMENT — demande expresse d accès immédiat et version des CGV', () => {
  it('le checkout refuse sans la case, et trace l acceptation AVANT la session', () => {
    expect(checkoutFn).toMatch(/if \(immediateAccess !== true\) return json\(\{ error: 'immediate_access_required' \}/);
    expect(checkoutFn).toMatch(/if \(cgvVersion !== CGV_VERSION\)/);
    expectOrder(checkoutFn, "from('billing_acceptances').insert", 'stripe.checkout.sessions.create', 'preuve avant paiement');
  });

  it('l écran conditionne le paiement à la case', () => {
    // La case n'apparaît qu'une fois le palier choisi (récapitulatif, lot 1 du
    // 2026-11-02), et le bouton ne paie que case cochée : sinon il explique.
    expect(billingTab).toMatch(/const canChoose = canPay &&/);
    expect(billingTab).toMatch(/canChoose && selectedTier/);
    expect(checkoutRecap).toMatch(/if \(immediateAccess\) \{\s*onPay\(\);/);
    expect(checkoutRecap).toContain('billing.immediateAccessLabel');
  });
});

describe('le JOURNAL — une ligne compensatoire, jamais une modification', () => {
  it('les fonctions de remboursement et d abonnement n écrivent rien dans payment_records', () => {
    expect(refundFn).not.toContain('payment_records');
    expect(subFn).not.toContain('payment_records');
  });

  it('le webhook écrit un montant NÉGATIF sur charge.refunded, depuis amount_refunded', () => {
    expect(webhook).toContain("case 'charge.refunded'");
    expect(webhook).toMatch(/amount_cents:\s*-\(charge\.amount_refunded/);
    expect(webhook).not.toMatch(/amount_cents:\s*-\(charge\.amount\s/);
  });
});

describe('les CGV le disent', () => {
  it('rétractation 14 jours, bouton, formulaire type, pas de remboursement après, sauf exceptions', () => {
    const cgu = read('src/pages/CGUPage.tsx');
    for (const key of ['terms.s5.li4bis', 'terms.s5.li5bis', 'terms.s5bis.p3bis', 'terms.s5ter.title']) {
      expect(cgu).toContain(key);
    }
    for (const locale of ['fr', 'en']) {
      const legal = JSON.parse(read(`src/locales/${locale}/legalTerms.json`)) as {
        terms: { s5: Record<string, string>; s5bis: Record<string, string>; updatedAt: string };
      };
      expect(legal.terms.updatedAt).toContain('2026-11-01');
      expect(legal.terms.s5bis.p4.length).toBeGreaterThan(200);
      expect(legal.terms.s5.li5).toBeTruthy();
    }
    const fr = JSON.parse(read('src/locales/fr/legalTerms.json')) as { terms: { s5: Record<string, string>; s5bis: Record<string, string> } };
    expect(fr.terms.s5bis.p3).toContain('Se rétracter du contrat ici');
    expect(fr.terms.s5.li5).toContain('aucun remboursement');
    expect(fr.terms.s5.li5bis).toContain('défaut de conformité');
  });
});
