// ═══════════════════════════════════════════════════════════════════
// Témoins des Edge Functions `org-webhook-dispatch` et `verify-org-domain`
// (mig. 195 et 199, audit entreprise du 2026-09-24, étape 6).
//
// Deux niveaux : les parties PURES (`_shared/org-integrations.ts`) sont
// exécutées ; les refus des points d'entrée Deno, non exécutables ici, sont
// vérifiés sur la source. Ces fonctions ne sont PAS déployées au 2026-09-26.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  slackText, slackEscape, txtMatches, webhookHostOf, ipIsPublic, addressesArePublic,
} from '../supabase/functions/_shared/org-integrations';
import { describeRow, digestSubject, digestTime } from '../supabase/functions/_shared/org-digest-text';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const dispatch = read('supabase/functions/org-webhook-dispatch/index.ts');
const verify = read('supabase/functions/verify-org-domain/index.ts');

describe('org-webhook-dispatch', () => {
  it('message Slack : verbe par événement, nom échappé, lien vers l app', () => {
    expect(slackText('task.created', { task: { name: 'Devis <urgent>', project: 'Site' } }, 'https://x.app'))
      .toBe('Nouvelle tâche : *Devis &lt;urgent&gt;* (Site) · <https://x.app/entreprise/tasks|Ouvrir Cosmo>');
    expect(slackText('task.status_changed', { task: { name: 'A', status: 'review' } }, 'u')).toContain('Statut : En relecture');
    expect(slackText('task.completed', {}, 'u')).toContain('Tâche terminée : *Tâche*');
    expect(slackEscape('a&b')).toBe('a&amp;b');
  });

  it('échec FERMÉ sans CRON_SECRET, et jamais une garde conditionnée à son secret', () => {
    expect(dispatch).toMatch(/if \(!CRON_SECRET\)[\s\S]{0,300}503/);
    expect(dispatch).toContain("req.headers.get('x-cron-secret') !== CRON_SECRET");
    // TÉMOIN du motif interdit : une garde qui laisse tout passer sans secret.
    expect(dispatch).not.toMatch(/CRON_SECRET\s*&&\s*req\.headers/);
  });

  // A-6 (2026-09-30) : la liste noire textuelle de la mig. 199 laissait passer
  // tout ce qui suit. Chaque ligne est un contournement nommé par l'audit.
  it('cible : un NOM DNS, jamais une adresse littérale, quelle que soit sa notation', () => {
    expect(webhookHostOf('https://hooks.slack.com/services/T/B/X')).toBe('hooks.slack.com');
    expect(webhookHostOf('https://Hooks.Example.co.uk.:8443/x')).toBe('hooks.example.co.uk');
    for (const refused of [
      'http://hooks.slack.com/x', 'https://127.0.0.1/x', 'https://2130706433/x', 'https://0x7f000001/x',
      'https://0177.0.0.1/x', 'https://172.16.0.1/x', 'https://[::1]/x', 'https://[::ffff:127.0.0.1]/x',
      'https://localhost/x', 'https://metadata.google.internal/x', 'https://nas.local/x',
      'https://user:pw@hooks.slack.com/x', 'pas une url',
    ]) expect(webhookHostOf(refused), refused).toBeNull();
  });

  it('adresses résolues : une seule adresse privée suffit à refuser', () => {
    for (const pub of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700::6810:84e5', '2a00:1450:4007:80f::200e'])
      expect(ipIsPublic(pub), pub).toBe(true);
    for (const priv of [
      '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255',
      '192.168.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
      '::', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
      '64:ff9b::a9fe:a9fe', '2001:db8::1', '2002:7f00:1::1', '2001::1', 'nimportequoi', '1.2.3',
    ]) expect(ipIsPublic(priv), priv).toBe(false);
    expect(addressesArePublic(['8.8.8.8', '10.0.0.1'])).toBe(false);
    // TÉMOIN : aucune résolution n'est pas une autorisation.
    expect(addressesArePublic([])).toBe(false);
  });

  it('résout et refuse AVANT d envoyer, sans repli permissif', () => {
    expect(dispatch).toContain("Deno.resolveDns(host, 'A')");
    expect(dispatch).toContain("Deno.resolveDns(host, 'AAAA')");
    expect(dispatch).toMatch(/if \(!\(await targetIsPublic\(d\.url, publicHosts\)\)\) throw/);
    expect(dispatch.indexOf('targetIsPublic(d.url')).toBeLessThan(dispatch.indexOf('await fetch(d.url'));
  });

  it('ne suit AUCUNE redirection, borne le temps, signe le corps JSON', () => {
    expect(dispatch).toContain("redirect: 'manual'");
    expect(dispatch).toContain('AbortSignal.timeout(');
    expect(dispatch).toContain("'X-Cosmo-Signature'");
    expect(dispatch).toContain('`${ts}.${body}`');
  });
});

describe('verify-org-domain', () => {
  it('txtMatches : le jeton exact, une chaîne découpée recollée, jamais un préfixe', () => {
    expect(txtMatches([['cosmo-verify=abc']], 'abc')).toBe(true);
    expect(txtMatches([['v=spf1 -all'], ['cosmo-verify=', 'abc']], 'abc')).toBe(true);
    expect(txtMatches([['cosmo-verify=abcd']], 'abc')).toBe(false);
    expect(txtMatches([], 'abc')).toBe(false);
  });

  it('l appelant vient du JWT, doit être admin ACTIF, et un domaine d autrui répond comme un absent', () => {
    expect(verify).toContain('asUser.auth.getUser()');
    expect(verify).toMatch(/membership\.role !== 'admin'/);
    expect(verify).toMatch(/membership\.suspended_at/);
    expect(verify).toMatch(/pas d'oracle[\s\S]{0,200}not_found/);
  });

  it('une lecture qui décide d une autorisation ne se devine pas : 503', () => {
    expect(verify).toMatch(/memberError\) return json\(\{ error: 'lookup_failed' \}, 503/);
    expect(verify).toMatch(/'23505'[\s\S]{0,80}domain_taken/);
  });
});

describe('org-digest : langue et fuseau de l organisation (mig. 195)', () => {
  const row = { kind: 'task_assigned', task_name: 'Devis', project_name: null, actor_name: 'Marie', created_at: '2026-09-26T12:30:00Z' };

  it('français par défaut, heure dans le fuseau de l organisation', () => {
    expect(describeRow(row, 'fr', 'Europe/Paris')).toMatch(/^Une tâche vous a été assignée : Devis \(Marie\) · 26 sept\.?,? 14:30$/);
  });

  it('anglais si l organisation l a choisi, et un fuseau invalide retombe sur Paris', () => {
    expect(describeRow(row, 'en', 'America/New_York')).toMatch(/^A task was assigned to you: Devis \(Marie\) · 26 Sept?,? 08:30$/);
    expect(digestTime(row.created_at, 'fr', 'Mars/Olympus')).toBe(digestTime(row.created_at, 'fr', 'Europe/Paris'));
    expect(digestSubject('daily', 'Acme', 3, '', 'en')).toBe('Your Acme summary: 3 unread notification(s)');
  });
});
