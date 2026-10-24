// ═══════════════════════════════════════════════════════════════════
// Audit du code serveur du 2026-10-24 (Edge Functions, `api/`, SQL 213-226)
// ═══════════════════════════════════════════════════════════════════
//
// Un témoin par finding `SV-*` corrigé dans le code. Les parties PURES
// (`_shared/org-membership.ts`, `_shared/caller-ip.ts`,
// `_shared/renewal-notice-text.ts`) sont exécutées ; les points d'entrée Deno,
// que rien ici ne peut lancer, sont vérifiés sur leur source, commentaires
// retirés (ces fichiers citent leurs anciens défauts en commentaire).
//
// ❌ Un vert ici ne prouve pas qu'une fonction DÉPLOYÉE porte le correctif :
//    seul `npm run check:edge` relie le dépôt à la production (C-35).
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { membershipIsActive, pickOrgSuccessor } from '../supabase/functions/_shared/org-membership';
import { callerIp } from '../supabase/functions/_shared/caller-ip';
import { renewalNoticeMail } from '../supabase/functions/_shared/renewal-notice-text';
import { PREMIUM_ENFORCED } from '@/modules/billing/premium-config';

const LF = String.fromCharCode(10);
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join(LF);
const codeOnly = (src: string) =>
  src
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(LF)
    .map((l) => {
      const at = l.indexOf('//');
      return at === -1 ? l : l.slice(0, at);
    })
    .join(LF);
const fn = (name: string) => codeOnly(read(`supabase/functions/${name}/index.ts`));

const NOW = Date.parse('2026-10-24T12:00:00Z');
const PAST = '2026-10-01T00:00:00Z';
const FUTURE = '2027-01-01T00:00:00Z';

describe('SV-1 · un accès expiré vaut un accès suspendu', () => {
  it('membershipIsActive suit `is_org_member` (mig. 161) : suspendu ou expiré = inactif', () => {
    expect(membershipIsActive({ suspended_at: null, access_expires_at: null }, NOW)).toBe(true);
    expect(membershipIsActive({ suspended_at: null, access_expires_at: FUTURE }, NOW)).toBe(true);
    expect(membershipIsActive({ suspended_at: PAST, access_expires_at: null }, NOW)).toBe(false);
    expect(membershipIsActive({ suspended_at: null, access_expires_at: PAST }, NOW)).toBe(false);
    // Même borne que le SQL : `access_expires_at > now()`, donc l'instant exact est expiré.
    expect(membershipIsActive({ suspended_at: null, access_expires_at: new Date(NOW).toISOString() }, NOW)).toBe(false);
    // Une date illisible n'ouvre rien.
    expect(membershipIsActive({ suspended_at: null, access_expires_at: 'pas une date' }, NOW)).toBe(false);
  });

  it('send-org-invite et verify-org-domain lisent `access_expires_at` et passent par membershipIsActive', () => {
    for (const name of ['send-org-invite', 'verify-org-domain']) {
      const code = fn(name);
      expect(code, name).toMatch(/select\('role, suspended_at, access_expires_at'\)/);
      expect(code, name).toMatch(/!membershipIsActive\(membership, Date\.now\(\)\)/);
      // TÉMOIN du défaut : la garde qui ne regardait que la suspension.
      expect(code, name).not.toMatch(/membership\.suspended_at\s*\|\|/);
    }
  });
});

describe('SV-2 · le successeur d un propriétaire effacé est un membre ACTIF', () => {
  const m = (user_id: string, role: string, s: string | null = null, e: string | null = null) =>
    ({ user_id, role, suspended_at: s, access_expires_at: e });

  it('préfère un admin actif, puis un membre actif, à un admin suspendu ou expiré', () => {
    expect(pickOrgSuccessor([m('a', 'admin', PAST), m('b', 'member'), m('c', 'admin')], NOW)?.user_id).toBe('c');
    expect(pickOrgSuccessor([m('a', 'admin', PAST), m('b', 'member')], NOW)?.user_id).toBe('b');
    expect(pickOrgSuccessor([m('a', 'admin', null, PAST), m('b', 'member')], NOW)?.user_id).toBe('b');
    // L'ordre reçu (ancienneté) départage à rang égal.
    expect(pickOrgSuccessor([m('a', 'member'), m('b', 'member')], NOW)?.user_id).toBe('a');
  });

  it('sans membre actif, garde l ancien choix plutôt que de détruire l organisation', () => {
    expect(pickOrgSuccessor([m('a', 'member', PAST), m('b', 'admin', PAST)], NOW)?.user_id).toBe('b');
    expect(pickOrgSuccessor([], NOW)).toBeNull();
  });

  it('delete-account lit la suspension et l expiration, et choisit par pickOrgSuccessor', () => {
    const code = fn('delete-account');
    expect(code).toMatch(/select\('user_id, role, joined_at, suspended_at, access_expires_at'\)/);
    expect(code).toMatch(/pickOrgSuccessor\(/);
    expect(code).not.toMatch(/find\(\(m\) => m\.role === 'admin'\)/);
  });
});

describe('SV-3 · le plafond par IP de report-bug ne se contourne pas', () => {
  const req = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n.toLowerCase()] ?? null } });

  it('cf-connecting-ip (posé par Cloudflare) l emporte sur un x-forwarded-for forgé', () => {
    expect(callerIp(req({ 'x-forwarded-for': '6.6.6.6, 81.2.3.4', 'cf-connecting-ip': '81.2.3.4' }))).toBe('81.2.3.4');
    expect(callerIp(req({ 'x-forwarded-for': ' 9.9.9.9 , 10.0.0.1' }))).toBe('9.9.9.9');
    expect(callerIp(req({}))).toBe('unknown');
  });

  it('report-bug borne les anonymes ENSEMBLE, après validation, sans toucher aux comptes connectés', () => {
    const helper = codeOnly(read('supabase/functions/_shared/rate-limit.ts'));
    expect(helper).toMatch(/anonymous:\s*\{\s*limit:\s*\d+,\s*window:\s*'1 day'\s*\}/);
    const code = fn('report-bug');
    const ip = code.indexOf("domain: 'report-bug:ip'");
    const anon = code.indexOf("domain: 'report-bug:anonymous'");
    expect(ip).toBeGreaterThan(0);
    // Après la validation du corps et la résolution de l'auteur : une requête
    // invalide ne vide pas le seau commun.
    expect(anon).toBeGreaterThan(code.lastIndexOf("error: 'invalid_attachment'"));
    expect(anon).toBeGreaterThan(code.indexOf('auth.getUser()'));
    // Alternative au seau du compte : un compte connecté n'y puise jamais.
    expect(code.slice(code.indexOf("domain: 'report-bug:account'") - 200, anon)).toMatch(/reporterEmail\s*\?/);
    // Et un plafond de TOUTE la fonction, après le seau propre, sur les deux
    // chemins : des comptes créés en série ne le multiplient pas (G-2).
    expect(helper).toMatch(/global:\s*\{\s*limit:\s*\d+,\s*window:\s*'1 day'\s*\}/);
    const global = code.indexOf("domain: 'report-bug:global'");
    expect(global).toBeGreaterThan(anon);
    expect(code.slice(anon, global)).not.toMatch(/consumeRateLimits\(/);
  });
});

describe('SV-4 · stripe-create-checkout fermée tant que le premium perso est coupé', () => {
  const code = fn('stripe-create-checkout');

  it('son interrupteur suit PREMIUM_ENFORCED', () => {
    const m = code.match(/const PERSONAL_CHECKOUT_ENABLED\s*=\s*(true|false)/);
    expect(m, 'PERSONAL_CHECKOUT_ENABLED introuvable').not.toBeNull();
    expect(m?.[1] === 'true').toBe(PREMIUM_ENFORCED);
  });

  it('refuse AVANT toute lecture en base et tout appel Stripe, APRÈS le 401', () => {
    const refus = code.indexOf('if (!PERSONAL_CHECKOUT_ENABLED)');
    expect(refus).toBeGreaterThan(code.indexOf('auth.getUser()'));
    expect(refus).toBeLessThan(code.indexOf('new Stripe('));
    expect(refus).toBeLessThan(code.indexOf(".from('subscriptions')"));
  });
});

describe('SV-5 · le nom d organisation est échappé dans l avis L215-1', () => {
  it('aucune balise du nom n arrive dans le HTML, le texte reste lisible', () => {
    const mail = renewalNoticeMail(
      { org_name: 'Acme <a href="https://x.test">payez ici</a>', period_end: '2026-11-30' },
      'https://thecosmo.app',
    );
    expect(mail.html).not.toContain('<a href');
    expect(mail.html).toContain('&lt;a href=&quot;https://x.test&quot;&gt;');
    expect(mail.text).toContain('« Acme <a href="https://x.test">payez ici</a> »');
    expect(mail.subject).toBe('Votre abonnement Cosmo se reconduit le 30/11/2026');
    expect(mail.text).toContain('https://thecosmo.app/entreprise?tab=billing');
  });

  it('renewal-notice construit son courriel par le module pur', () => {
    const code = fn('renewal-notice');
    expect(code).toContain('renewalNoticeMail(org, APP_URL)');
    expect(code).not.toMatch(/<p style="margin:0 0 8px">\$\{l\}<\/p>/);
  });
});

describe('SV-6 · stripe-webhook échoue FERMÉ et BRUYANT sans son secret', () => {
  it('503 et alerte avant la vérification de signature', () => {
    const code = fn('stripe-webhook');
    const garde = code.indexOf('if (!WEBHOOK_SECRET)');
    expect(garde).toBeGreaterThan(0);
    expect(garde).toBeLessThan(code.indexOf('constructEventAsync('));
    expect(code.slice(garde, garde + 400)).toMatch(/opsAlert\([\s\S]*status: 503/);
    expect(code).not.toMatch(/Deno\.env\.get\('STRIPE_WEBHOOK_SECRET'\)\s*\?\?\s*''/);
  });
});

describe('SV-7 · org-webhook-dispatch ne remet pas le compteur d échecs à zéro sur panne de lecture', () => {
  it('la lecture de failure_count regarde son erreur', () => {
    const code = fn('org-webhook-dispatch');
    expect(code).toMatch(/const \{ data: w, error: wError \} = await admin\.from\('org_webhooks'\)/);
    expect(code).toMatch(/if \(wError\)/);
  });
});
