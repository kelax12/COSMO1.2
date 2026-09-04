// ═══════════════════════════════════════════════════════════════════
// GARDE — le remboursement du mois en cours (C-65), et sa borne
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. Décision d'Axel du 2026-09-03 : « l'utilisateur doit pouvoir se
// faire rembourser le mois en cours à tout moment, mais que le mois en cours. »
// Avant, le produit n'avait AUCUN chemin de remboursement : `stripe-org-portal`
// ouvre le portail Stripe, qui sait résilier et ne rembourse pas, et rien
// n'appelait `refunds.create`. Une règle sans mécanisme est une phrase.
//
// L'item est explicite sur l'ordre de livraison : « ❌ Ne pas livrer le bouton
// avant la borne : un remboursement rejouable est une perte d'argent, pas un
// défaut d'UX. » Cette garde vérifie que la borne est là, et qu'elle est là
// SOUS SES TROIS FORMES — chacune couvre un mode de panne différent.
//
// ── CE QU'ELLE NE PROUVE PAS ─────────────────────────────────────────
//
// ⚠️ Elle est TEXTUELLE, comme les autres gardes d'Edge Function : pas de
// Docker, pas de stack locale, une clé Stripe de TEST et zéro abonnement. Rien
// ici n'a été joué contre Stripe.
//
// Ce qui EST réellement exécuté, c'est le calcul du MONTANT
// (`src/modules/billing/refund-amount.test.ts`, 12 cas) — c'est-à-dire la
// seule partie qui décide d'un chiffre, et donc la seule qui peut coûter de
// l'argent en se trompant. Le reste attend le parcours E2E que C-27 exige
// explicitement pour C-65.

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

const refundFn = read('supabase/functions/stripe-org-refund/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const billingTab = read('src/components/organization/OrgBillingTab.tsx');
// ⚠️ L'enchainement a ete EXTRAIT de `OrganizationPage` quand celle-ci a
// franchi les 600 lignes (cliquet gele, arbitrage C-09 : « un fichier se
// decoupe quand on a de toute facon a le modifier »). La garde suit le code :
// une garde qui continue de lire l'ancien fichier passe au vert en ne
// regardant plus rien.
const deleteFlow = read('src/pages/organization/useDeleteOrgFlow.ts');

describe('la BORNE — un remboursement rejouable est une perte d argent', () => {
  it('porte une cle d idempotence DERIVEE DE LA FACTURE, pas un booleen', () => {
    // L'item l'exige nommement : « la garde est une CLE D IDEMPOTENCE derivee
    // de l `invoice_id`, pas un booleen en base ». Un booleen se desynchronise
    // de Stripe ; la cle est portee par Stripe lui-meme.
    expect(codeOnly(refundFn)).toMatch(/idempotencyKey:\s*`org-refund:\$\{invoice\.id\}`/);
  });

  it('verifie les remboursements DEJA poses avant d en creer un', () => {
    const code = codeOnly(refundFn);
    expect(code).toContain('stripe.refunds.list');
    // Et il retranche ce qui a deja ete rendu, au lieu de comparer a zero :
    // un remboursement PARTIEL laisse un reste, et l'ignorer rendrait deux fois.
    expect(code).toMatch(/already/);
  });

  it('ne rembourse JAMAIS plus que ce qui a ete encaisse', () => {
    // Deux bornes independantes : celle du calcul (testee pour de vrai dans
    // refund-amount.test.ts) et ce clamp au moment de l'appel.
    expect(codeOnly(refundFn)).toMatch(/Math\.min\(decision\.amountCents,/);
  });
});

describe('l ORDRE des deux actions', () => {
  it('rembourse AVANT de resilier', () => {
    // Les deux ordres ont un mode de panne et ils ne se valent pas : rembourser
    // puis echouer a resilier laisse la personne avec son argent et un acces
    // de trop (a son avantage) ; resilier puis echouer a rembourser lui prend
    // les deux. C'est exactement la discussion que la decision supprime.
    const code = codeOnly(refundFn);
    expect(code.indexOf('stripe.refunds.create')).toBeLessThan(
      code.indexOf('stripe.subscriptions.cancel'),
    );
  });

  it('resilie IMMEDIATEMENT, pas en fin de periode', () => {
    // On rembourse la periode : la laisser courir reviendrait a l'offrir.
    const code = codeOnly(refundFn);
    expect(code).toContain('stripe.subscriptions.cancel');
    expect(code).not.toMatch(/cancel_at_period_end:\s*true/);
  });

  it('la suppression d organisation rembourse AVANT de supprimer (C-39)', () => {
    // « Un seul geste, aucun debit orphelin. » L'ordre inverse ferait perdre
    // l'identifiant Stripe avec la cascade sur `org_subscriptions`.
    const code = codeOnly(deleteFlow);
    expect(code.indexOf('refund.mutate')).toBeLessThan(code.indexOf('remove.mutate'));
    // Et la suppression n'a lieu QUE si le remboursement a reussi : mieux vaut
    // une organisation encore la qu'une organisation detruite et un debit qui
    // continue.
    expect(code).toMatch(/onSuccess:\s*\(\)\s*=>\s*remove\.mutate/);
  });
});

describe('le JOURNAL — une ligne compensatoire, jamais une modification', () => {
  it('la fonction de remboursement n ecrit RIEN dans payment_records', () => {
    // La table est scellee par `row_hash` et n'a qu'un seul ecrivain. Deux
    // ecrivains sur un journal chaine, c'est la chaine cassee.
    expect(codeOnly(refundFn)).not.toContain('payment_records');
  });

  it('le webhook ecrit un montant NEGATIF sur `charge.refunded`', () => {
    const code = codeOnly(webhook);
    expect(code).toContain("case 'charge.refunded'");
    expect(code).toMatch(/amount_cents:\s*-\(charge\.amount_refunded/);
  });

  it('utilise `amount_refunded` et non `amount`', () => {
    // Un remboursement PARTIEL (le prorata annuel en est un) ne rend pas la
    // totalite de la charge : ecrire `amount` compenserait plus que le
    // remboursement reel, et le journal cesserait de correspondre a la banque.
    expect(codeOnly(webhook)).not.toMatch(/amount_cents:\s*-\(charge\.amount\s/);
  });
});

describe('QUI peut demander, et ce que la personne LIT', () => {
  it('proprietaire uniquement, comme le checkout et le portail', () => {
    const code = codeOnly(refundFn);
    expect(code).toMatch(/org\.owner_id !== user\.id/);
    expect(code).toContain("'forbidden'");
  });

  it('les lectures qui decident d un routage ne sont PAS avalees', () => {
    // Regle ecrite apres l audit Stripe du 2026-09-02 : on fait retenter
    // plutot que deviner.
    const code = codeOnly(refundFn);
    expect(code).toMatch(/if \(orgError\) throw orgError/);
    expect(code).toMatch(/if \(subError\) throw subError/);
  });

  it('le bouton existe la ou la personne peut l exercer', () => {
    expect(billingTab).toContain('billing.refundCta');
    expect(billingTab).toContain('useCancelAndRefundOrg');
  });

  it('la garantie est ECRITE dans les CGU, pas seulement dans le code', () => {
    // « Une garantie plus favorable que la loi doit etre ecrite, sans quoi
    // personne ne sait qu elle existe et elle ne desamorce rien. »
    const cgu = read('src/pages/CGUPage.tsx');
    expect(cgu).toContain('terms.s5.li5bis');
    for (const locale of ['fr', 'en']) {
      const legal = JSON.parse(read(`src/locales/${locale}/legal.json`)) as {
        terms: { s5: Record<string, string> };
      };
      expect(legal.terms.s5.li5bis, `${locale} → terms.s5.li5bis`).toBeTruthy();
    }
  });
});
