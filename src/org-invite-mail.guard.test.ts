// Témoin : `send-org-invite` n'est ni un relais de spam, ni un relais
// d'hameçonnage signé COSMO (audit de sécurité du 2026-09-30).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mailSafeText } from '../supabase/functions/_shared/mail-text';

const src = readFileSync(join(__dirname, '..', 'supabase', 'functions', 'send-org-invite', 'index.ts'), 'utf8');
const limits = readFileSync(join(__dirname, '..', 'supabase', 'functions', '_shared', 'rate-limit.ts'), 'utf8');

describe('mailSafeText', () => {
  it('retire les URL explicites, avec ou sans schéma www', () => {
    expect(mailSafeText('Acme, reconnectez-vous sur https://evil.example/login', 80)).toBe('Acme, reconnectez-vous sur');
    expect(mailSafeText('Voir www.evil.example maintenant', 80)).toBe('Voir maintenant');
    expect(mailSafeText('HTTP://EVIL.example', 80)).toBe('');
  });

  it('retire les caractères de contrôle et de retournement bidirectionnel', () => {
    expect(mailSafeText('Ac‮me​\nInc', 80)).toBe('Acme Inc');
  });

  it('borne la longueur', () => {
    const r = mailSafeText('x'.repeat(200), 80);
    expect(r.length).toBe(80);
    expect(r.endsWith('…')).toBe(true);
  });

  it('laisse intact un nom ordinaire', () => {
    expect(mailSafeText('Société Générale d’Études', 80)).toBe('Société Générale d’Études');
  });
});

describe('send-org-invite', () => {
  it('passe les deux textes libres par mailSafeText, sujet compris', () => {
    expect(src).toContain("from '../_shared/mail-text.ts'");
    expect(src).toMatch(/const inviterName = mailSafeText\(/);
    expect(src).toMatch(/const orgName = mailSafeText\(/);
    expect(src).not.toMatch(/org\.name as string, inviterName/);
    expect(src).not.toMatch(/subject: `[^`]*\$\{org\.name\}/);
  });

  it('consomme le plafond AVANT chaque envoi, par compte et par organisation', () => {
    const plafond = src.indexOf("consumeRateLimits('send-org-invite'");
    const envoi = src.indexOf("fetch('https://api.resend.com/emails'");
    expect(plafond).toBeGreaterThan(-1);
    expect(envoi).toBeGreaterThan(plafond);
    for (const cle of ['perAccountHour', 'perAccountDay', 'perOrgDay']) {
      expect(src).toContain(`ORG_INVITE_LIMITS.${cle}`);
      expect(limits).toMatch(new RegExp(`${cle}: \\{ limit: \\d+`));
    }
  });

  it('refuse un membre suspendu ET un membre dont l accès a expiré', () => {
    expect(src).toContain('access_expires_at');
    expect(src).toMatch(/membership\.suspended_at \|\| expired/);
  });
});
