// ═══════════════════════════════════════════════════════════════════
// GARDE — un identifiant Stripe absent ne doit jamais rendre un 500 (C-71)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI. `stripe-org-checkout` (subscriptions.retrieve) et
// `stripe-org-portal` (billingPortal.sessions.create) présentaient tels quels
// des identifiants venus de `org_subscriptions`, sans `try/catch` autour de
// l'appel Stripe. Stripe répond `resource_missing` (404) dès que l'identifiant
// n'existe plus dans le compte présenté — le cas de TOUS les identifiants de
// test le jour du passage en compte live. Le client recevait un 500 opaque.
//
// La migration 140 (item C-08) traite la DONNÉE ; elle ne rend pas le CODE
// tolérant. `isResourceMissing` (testé pour de vrai dans
// `src/modules/billing/stripe-errors.test.ts`) est la seule partie qui décide
// d'un verdict ; cette garde est TEXTUELLE, comme les autres gardes d'Edge
// Function (pas de Docker, pas de stack locale) : elle vérifie que les deux
// fonctions appellent bien ce helper au bon endroit et NE RETHROW PAS pour ce
// cas précis, sans rejouer Stripe.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8');

/** Le CODE seul, sans commentaires — ces fichiers citent leurs propres pièges. */
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

const checkoutFn = read('supabase/functions/stripe-org-checkout/index.ts');
const portalFn = read('supabase/functions/stripe-org-portal/index.ts');

describe('checkout — un abonnement introuvable repart sur une souscription neuve', () => {
  it('importe isResourceMissing du module partagé', () => {
    expect(codeOnly(checkoutFn)).toMatch(
      /import\s*\{\s*isResourceMissing\s*\}\s*from\s*['"]\.\.\/_shared\/stripe-errors\.ts['"]/,
    );
  });

  it('entoure subscriptions.retrieve d un try/catch', () => {
    const code = codeOnly(checkoutFn);
    const retrieveAt = code.indexOf('stripe.subscriptions.retrieve(');
    const tryAt = code.lastIndexOf('try {', retrieveAt);
    expect(retrieveAt, 'stripe.subscriptions.retrieve est ABSENT').toBeGreaterThan(-1);
    expect(tryAt, 'aucun try avant subscriptions.retrieve').toBeGreaterThan(-1);
  });

  it('ne renvoie PAS already_subscribed quand isResourceMissing est vrai — sans relancer Stripe', () => {
    const code = codeOnly(checkoutFn);
    // Le bloc catch doit tester isResourceMissing et NE PAS retourner
    // already_subscribed dans ce cas : la personne doit pouvoir repayer.
    const catchIdx = code.indexOf('catch', code.indexOf('stripe.subscriptions.retrieve('));
    expect(catchIdx).toBeGreaterThan(-1);
    const catchBlock = code.slice(catchIdx, catchIdx + 400);
    expect(catchBlock).toContain('isResourceMissing');
  });

  it('relance toute autre erreur Stripe — jamais deviner', () => {
    const code = codeOnly(checkoutFn);
    const catchIdx = code.indexOf('catch', code.indexOf('stripe.subscriptions.retrieve('));
    const catchBlock = code.slice(catchIdx, catchIdx + 400);
    expect(catchBlock).toMatch(/if\s*\(\s*!\s*isResourceMissing\(/);
    expect(catchBlock).toMatch(/throw/);
  });
});

describe('portail — un customer introuvable dit clairement qu il n y a rien à gérer', () => {
  it('importe isResourceMissing du module partagé', () => {
    expect(codeOnly(portalFn)).toMatch(
      /import\s*\{\s*isResourceMissing\s*\}\s*from\s*['"]\.\.\/_shared\/stripe-errors\.ts['"]/,
    );
  });

  it('entoure billingPortal.sessions.create d un try/catch', () => {
    const code = codeOnly(portalFn);
    const createAt = code.indexOf('billingPortal.sessions.create(');
    const tryAt = code.lastIndexOf('try {', createAt);
    expect(createAt, 'billingPortal.sessions.create est ABSENT').toBeGreaterThan(-1);
    expect(tryAt, 'aucun try avant billingPortal.sessions.create').toBeGreaterThan(-1);
  });

  it('renvoie un code métier lisible (no_customer) plutôt qu un 500', () => {
    const code = codeOnly(portalFn);
    const createAt = code.indexOf('billingPortal.sessions.create(');
    const catchIdx = code.indexOf('catch', createAt);
    expect(catchIdx).toBeGreaterThan(-1);
    const catchBlock = code.slice(catchIdx, catchIdx + 400);
    expect(catchBlock).toContain('isResourceMissing');
    expect(catchBlock).toMatch(/no_customer/);
  });

  it('relance toute autre erreur Stripe — jamais deviner', () => {
    const code = codeOnly(portalFn);
    const createAt = code.indexOf('billingPortal.sessions.create(');
    const catchIdx = code.indexOf('catch', createAt);
    const catchBlock = code.slice(catchIdx, catchIdx + 400);
    expect(catchBlock).toMatch(/if\s*\(\s*!\s*isResourceMissing\(/);
    expect(catchBlock).toMatch(/throw/);
  });
});
