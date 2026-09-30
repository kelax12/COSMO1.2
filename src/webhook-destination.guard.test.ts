// Témoin : un webhook d'entreprise ne part jamais vers une adresse interne
// (audit de sécurité du 2026-09-30, cf. `supabase/functions/_shared/webhook-destination.ts`).
//
// La contrainte SQL de la mig. 199 était une liste noire textuelle : elle
// laissait passer 172.16/12, 100.64/10, les IPv4 écrites en entier, et tout
// nom DNS résolvant vers une adresse privée. La décision est prise à l'envoi,
// sur les adresses RÉSOLUES ; ce fichier le verrouille.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkWebhookDestination,
  isBlockedIpv4,
  isBlockedIpv6,
  type Resolver,
} from '../supabase/functions/_shared/webhook-destination';

const dns = (table: Record<string, { A?: string[]; AAAA?: string[] }>): Resolver =>
  async (host, type) => table[host]?.[type] ?? [];

const PUBLIC = dns({ 'hooks.slack.com': { A: ['3.120.0.10'], AAAA: ['2600:1f18::1'] } });

describe('isBlockedIpv4', () => {
  it.each([
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '100.127.255.255', '127.0.0.1', '169.254.169.254',
    '172.16.0.1', '172.31.255.255', '192.0.0.8', '192.0.2.1', '192.168.1.1', '198.18.0.1',
    '198.51.100.7', '203.0.113.9', '224.0.0.1', '255.255.255.255', 'pas une ip', '1.2.3',
  ])('refuse %s', (ip) => expect(isBlockedIpv4(ip)).toBe(true));

  it.each(['8.8.8.8', '3.120.0.10', '172.15.0.1', '172.32.0.1', '100.63.0.1', '100.128.0.1'])(
    'accepte %s', (ip) => expect(isBlockedIpv4(ip)).toBe(false),
  );
});

describe('isBlockedIpv6', () => {
  it.each([
    '::', '::1', '[::1]', 'fe80::1', 'fd00::1', 'fc12:3456::1', 'ff02::1', '2001:db8::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '64:ff9b::a9fe:a9fe',
    '2002:c0a8:0101::1', '2001:0:abcd::1', '::10.0.0.1', 'n importe quoi', '1:2:3',
  ])('refuse %s', (ip) => expect(isBlockedIpv6(ip)).toBe(true));

  it.each(['2600:1f18::1', '2a00:1450:4007:80e::200e', '::ffff:8.8.8.8', '64:ff9b::808:808'])(
    'accepte %s', (ip) => expect(isBlockedIpv6(ip)).toBe(false),
  );
});

describe('checkWebhookDestination', () => {
  it('accepte un nom public en https, port par défaut ou 443', async () => {
    expect(await checkWebhookDestination('https://hooks.slack.com/services/x', PUBLIC)).toEqual({ ok: true, host: 'hooks.slack.com' });
    expect((await checkWebhookDestination('https://hooks.slack.com:443/x', PUBLIC)).ok).toBe(true);
  });

  it.each([
    ['http://hooks.slack.com/x', 'not_https'],
    ['https://user:pw@hooks.slack.com/x', 'credentials_in_url'],
    ['https://hooks.slack.com:8080/x', 'port_not_allowed'],
    ['https://127.0.0.1/x', 'ip_literal'],
    ['https://2130706433/x', 'ip_literal'],
    ['https://0x7f000001/x', 'ip_literal'],
    ['https://127.1/x', 'ip_literal'],
    ['https://172.16.0.5/x', 'ip_literal'],
    ['https://[::1]/x', 'ip_literal'],
    ['https://localhost/x', 'invalid_host'],
    ['https://printer.local/x', 'internal_host'],
    ['https://db.internal/x', 'internal_host'],
    ['pas une url', 'invalid_url'],
  ])('refuse %s (%s)', async (url, reason) => {
    expect(await checkWebhookDestination(url, PUBLIC)).toEqual({ ok: false, reason });
  });

  it('refuse un nom public qui résout vers une adresse privée', async () => {
    const r = dns({ 'evil.example.com': { A: ['169.254.169.254'] } });
    expect(await checkWebhookDestination('https://evil.example.com/', r)).toEqual({ ok: false, reason: 'private_address' });
  });

  it('refuse dès qu UNE seule adresse est privée, même en AAAA', async () => {
    const r = dns({ 'mixed.example.com': { A: ['8.8.8.8'], AAAA: ['::1'] } });
    expect(await checkWebhookDestination('https://mixed.example.com/', r)).toEqual({ ok: false, reason: 'private_address' });
  });

  it('refuse un nom qui ne résout pas, et un DNS en panne', async () => {
    expect(await checkWebhookDestination('https://nx.example.com/', dns({}))).toEqual({ ok: false, reason: 'unresolvable' });
    const panne: Resolver = async () => { throw new Error('SERVFAIL'); };
    expect((await checkWebhookDestination('https://hooks.slack.com/', panne)).ok).toBe(false);
  });
});

describe('témoin : la fonction d envoi vérifie AVANT de fetch', () => {
  const src = readFileSync(join(__dirname, '..', 'supabase', 'functions', 'org-webhook-dispatch', 'index.ts'), 'utf8');

  it('importe la vérification et l appelle avant le fetch', () => {
    expect(src).toContain("from '../_shared/webhook-destination.ts'");
    const check = src.indexOf('checkWebhookDestination(');
    const call = src.indexOf('await fetch(');
    expect(check).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(check);
  });

  it('ne suit toujours aucune redirection', () => {
    expect(src).toContain("redirect: 'manual'");
  });
});
