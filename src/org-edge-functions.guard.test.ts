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
import { slackText, slackEscape, txtMatches } from '../supabase/functions/_shared/org-integrations';
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
