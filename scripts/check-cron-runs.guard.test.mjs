// ═══════════════════════════════════════════════════════════════════
// Témoin de `scripts/check-cron-runs.mjs` (ARC-06, vague 10.2).
//
// La sonde doit ROUGIR sur chacun des cas où un traitement planifié n'a pas
// tourné, et sur chacun des cas où elle n'a rien mesuré (secret absent,
// sélection vide, connexion impossible). Une sonde qui répond vert sans
// mesurer est pire qu'une sonde absente (`scripts/CLAUDE.md`).
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JOBS_ATTENDUS, VERDICT_SQL, juger, lireVerdict, run } from './check-cron-runs.mjs';

const ligne = (job, verdict, extra = {}) => ({
  job,
  fenetre: '26:00:00',
  dernier_debut: '2026-11-07T07:12:00Z',
  dernier_statut: verdict === 'ok' ? 'ok' : 'error',
  dernier_code: verdict === 'ok' ? 200 : 500,
  dernier_ok: verdict === 'ok' ? '2026-11-07T07:12:00Z' : null,
  verdict,
  ...extra,
});
const SIX = ['inactive-accounts', 'org-digest-daily', 'org-digest-hourly', 'org-webhook-dispatch', 'renewal-notice', 'seat-alert'];
const tousOk = () => SIX.map((j) => ligne(j, 'ok'));

/** Faux client pg : enregistre les requêtes, rend `rows` au SELECT. */
function faux(rows, { echoue = false } = {}) {
  const requetes = [];
  return {
    requetes,
    ended: false,
    async query(sql) {
      requetes.push(sql);
      if (sql === VERDICT_SQL && echoue) throw new Error('relation absente');
      return { rows: sql === VERDICT_SQL ? rows : [] };
    },
    async end() {
      this.ended = true;
    },
  };
}

describe('juger', () => {
  it('six jobs dans leur fenêtre : vert', () => {
    const { exit, lines } = juger(tousOk());
    expect(exit).toBe(0);
    expect(lines.at(-1)).toBe('6 job(s) sur 6 dans leur fenetre.');
    expect(lines.filter((l) => l.startsWith('::error'))).toEqual([]);
  });

  it('un job absent : rouge, nommé', () => {
    const rows = tousOk();
    rows[4] = ligne('renewal-notice', 'absent', { dernier_debut: null, dernier_statut: null, dernier_code: null });
    const { exit, lines } = juger(rows);
    expect(exit).toBe(1);
    expect(lines.some((l) => l.startsWith('::error title=cron renewal-notice absent::') && l.includes('jamais'))).toBe(true);
  });

  it('un job en échec : rouge, avec son code HTTP', () => {
    const rows = tousOk();
    rows[5] = ligne('seat-alert', 'echec');
    const { exit, lines } = juger(rows);
    expect(exit).toBe(1);
    expect(lines.find((l) => l.includes('cron seat-alert en echec'))).toContain('HTTP 500');
  });

  it('TÉMOIN : un verdict inconnu ne passe jamais pour un vert', () => {
    const rows = tousOk();
    rows[0] = ligne('inactive-accounts', 'peut-etre');
    expect(juger(rows).exit).toBe(1);
  });

  it('TÉMOIN : zéro ligne = rien mesuré = rouge', () => {
    expect(juger([]).exit).toBe(1);
    expect(juger(undefined).exit).toBe(1);
  });

  it('TÉMOIN : un job de moins que la mig. 245 = divergence = rouge', () => {
    expect(JOBS_ATTENDUS).toBe(6);
    const { exit, lines } = juger(tousOk().slice(0, 5));
    expect(exit).toBe(1);
    expect(lines.some((l) => l.includes('5 job(s) surveille(s) au lieu de 6'))).toBe(true);
  });

  it('la sonde compte autant de jobs que cron_runs_verdict() en déclare', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migration/245_cron_journal.sql'), 'utf8');
    const bloc = sql.slice(sql.indexOf('WITH attendus (job, fenetre)'), sql.indexOf('SELECT a.job'));
    expect([...bloc.matchAll(/\('([a-z-]+)',\s+interval/g)].map((m) => m[1]).sort()).toEqual(SIX);
  });
});

describe('lecture et exécution', () => {
  it('lit en transaction READ ONLY, puis annule', async () => {
    const c = faux(tousOk());
    expect(await lireVerdict(c)).toHaveLength(6);
    expect(c.requetes).toEqual(['BEGIN READ ONLY', VERDICT_SQL, 'ROLLBACK']);
  });

  it('TÉMOIN : secret absent = rouge, jamais un avertissement', async () => {
    const { exit, lines } = await run({}, async () => faux(tousOk()));
    expect(exit).toBe(1);
    expect(lines[0]).toMatch(/^::error::Secret SUPABASE_DB_URL absent/);
  });

  it('connexion ou requête impossible : rouge, sans le mot de passe', async () => {
    const { exit, lines } = await run({ DB_URL: 'postgresql://postgres.ref:motdepasse@hote:5432/postgres' }, async () => {
      throw new Error('connect ECONNREFUSED postgresql://postgres.ref:motdepasse@hote:5432');
    });
    expect(exit).toBe(1);
    expect(lines.join('\n')).not.toContain('motdepasse');

    const c = faux([], { echoue: true });
    const r2 = await run({ DB_URL: 'postgresql://x@y/z' }, async () => c);
    expect(r2.exit).toBe(1);
    expect(c.ended).toBe(true);
    expect(c.requetes.at(-1)).toBe('ROLLBACK');
  });

  it('bout à bout : un vert, un rouge', async () => {
    expect((await run({ DB_URL: 'postgresql://x@y/z' }, async () => faux(tousOk()))).exit).toBe(0);
    const rows = tousOk();
    rows[3] = ligne('org-webhook-dispatch', 'absent');
    expect((await run({ DB_URL: 'postgresql://x@y/z' }, async () => faux(rows))).exit).toBe(1);
  });
});
