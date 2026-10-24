// ═══════════════════════════════════════════════════════════════════
// C-121 · comptes inactifs depuis 3 ans : avertir, puis effacer
// ═══════════════════════════════════════════════════════════════════
//
// La sélection des comptes vit en SQL (mig. 226) et sa preuve, acteur par
// acteur, dans `supabase/proofs/226.proof.sql` (témoin : un compte vu hier
// n'est jamais visé). Ce fichier garde ce que la preuve SQL ne voit pas :
//   · le texte de l'avertissement (date annoncée, comment l'éviter) ;
//   · l'ordre « envoyer PUIS tracer » de `inactive-accounts` ;
//   · que l'effacement passe par `delete-account`, et que celui-ci
//     revérifie en base AVANT d'effacer un compte désigné par le cron.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INACTIVITY_GRACE_DAYS,
  MAX_DELETIONS_PER_RUN,
  MAX_NOTICES_PER_RUN,
  deletionDate,
  inactivityMail,
} from '../supabase/functions/_shared/inactivity-notice';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const codeOnly = (src: string) =>
  src
    .split('\n')
    .map((l) => (l.includes('//') ? l.slice(0, l.indexOf('//')) : l))
    .join('\n');

const inactiveRaw = read('supabase/functions/inactive-accounts/index.ts');
const inactive = codeOnly(inactiveRaw);
const deleteAccount = codeOnly(read('supabase/functions/delete-account/index.ts'));

describe('avertissement (module pur)', () => {
  it('annonce l effacement 30 jours après l envoi, comme la politique', () => {
    expect(INACTIVITY_GRACE_DAYS).toBe(30);
    expect(deletionDate(new Date('2029-01-10T08:00:00Z'))).toBe('09/02/2029');
    expect(deletionDate(new Date('2029-12-15T23:30:00Z'))).toBe('14/01/2030');
  });

  it('dit quand, et comment garder le compte', () => {
    const m = inactivityMail('https://thecosmo.app', new Date('2029-01-10T08:00:00Z'));
    expect(m.subject).toContain('09/02/2029');
    expect(m.text).toContain('09/02/2029');
    expect(m.text).toContain('https://thecosmo.app/login');
    expect(m.text).toMatch(/vous connecter une fois/);
    // Version anglaise pour les comptes en anglais.
    expect(m.text).toMatch(/sign in once before that date/);
  });

  it('échappe le HTML', () => {
    const m = inactivityMail('https://x.test/?a=<b>', new Date('2029-01-10T08:00:00Z'));
    expect(m.html).not.toContain('<b>');
    expect(m.html).toContain('&lt;b&gt;');
  });

  it('plafonne chaque exécution', () => {
    expect(MAX_NOTICES_PER_RUN).toBeGreaterThan(0);
    expect(MAX_NOTICES_PER_RUN).toBeLessThanOrEqual(200);
    expect(MAX_DELETIONS_PER_RUN).toBeGreaterThan(0);
    expect(MAX_DELETIONS_PER_RUN).toBeLessThanOrEqual(100);
  });
});

describe('inactive-accounts', () => {
  it('échoue FERMÉ sans son secret, et compare par égalité', () => {
    expect(inactive).toMatch(/if\s*[(]!CRON_SECRET[)]/);
    expect(inactive).toMatch(/x-cron-secret'[)]\s*!==\s*CRON_SECRET/);
    expect(inactive).not.toMatch(/if\s*[(]\s*[A-Z_]*SECRET\s*&&/);
  });

  it('n a aucune valeur par défaut d expéditeur', () => {
    expect(inactive).not.toMatch(/Deno[.]env[.]get[(]'[A-Z_]*FROM'[)]\s*[?][?]/);
  });

  it('trace l avertissement APRÈS l envoi, jamais avant', () => {
    // Source brute : codeOnly coupe à '//' et mangerait l'URL https://.
    const send = inactiveRaw.indexOf('api.resend.com');
    const trace = inactiveRaw.indexOf(".from('account_inactivity_notices')");
    expect(send).toBeGreaterThan(0);
    expect(trace).toBeGreaterThan(send);
  });

  it('n efface jamais elle-même : elle passe par delete-account', () => {
    expect(inactiveRaw).toContain('/functions/v1/delete-account');
    expect(inactive).not.toMatch(/auth[.]admin[.]deleteUser/);
    expect(inactive).not.toMatch(/[.]delete[(][)]/);
  });

  it('ne lâche aucun e-mail dans une alerte', () => {
    for (const line of inactive.split('\n').filter((l) => l.includes('opsAlert('))) {
      expect(line).not.toMatch(/row[.]email/);
    }
  });
});

describe('delete-account · mode cron (C-121)', () => {
  it('exige le secret, échoue fermé sans lui', () => {
    expect(deleteAccount).toMatch(/if\s*[(]!CRON_SECRET[)]/);
    expect(deleteAccount).toMatch(/cronHeader\s*!==\s*CRON_SECRET/);
  });

  it('revérifie en base que le compte est dû AVANT tout effacement', () => {
    const check = deleteAccount.indexOf("rpc('account_inactivity_deletion_due'");
    const firstErase = deleteAccount.indexOf(".from('friend_requests').delete()");
    expect(check).toBeGreaterThan(0);
    expect(firstErase).toBeGreaterThan(check);
    expect(deleteAccount).toMatch(/if\s*[(]due\s*!==\s*true[)]/);
  });

  it('n avale pas l erreur de cette vérification', () => {
    expect(deleteAccount).toMatch(/if\s*[(]dueError[)]/);
  });

  it('TÉMOIN : la vérification de l ordre détecte une inversion', () => {
    const inverted = ".from('friend_requests').delete()\n rpc('account_inactivity_deletion_due'";
    expect(inverted.indexOf("rpc('account_inactivity_deletion_due'")).toBeGreaterThan(
      inverted.indexOf(".from('friend_requests').delete()"),
    );
  });
});
