// Témoin de `scripts/check-cron-runs.mjs` (ARC-06, OBS-02) : ROUGIR sur chaque job ou sonde qui n'a
// pas tourné ou pas réussi, et sur chaque cas où rien n'a été mesuré (secret, sélection vide, connexion).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JOBS_ATTENDUS, JOBS_BASCULES, SONDES, VERDICT_SQL, juger, lireVerdict, run } from './check-cron-runs.mjs';

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
const tousOk = () => [...SIX, ...SONDES].map((j) => ligne(j, 'ok'));

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
  it('six jobs et trois sondes dans leur fenêtre : vert', () => {
    const { exit, lines } = juger(tousOk());
    expect(exit).toBe(0);
    expect(lines.at(-1)).toBe('9 job(s) sur 9 dans leur fenetre.');
    expect(lines.filter((l) => l.startsWith('::error'))).toEqual([]);
  });

  it('un job absent : rouge, nommé', () => {
    const rows = tousOk();
    rows[4] = ligne('renewal-notice', 'absent', { dernier_debut: null, dernier_statut: null, dernier_code: null });
    const { exit, lines } = juger(rows, SIX);
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

  it('bascule en deux temps : un job encore planifié par GitHub absent avertit, un job basculé absent rougit', () => {
    const rows = tousOk();
    rows[4] = ligne('renewal-notice', 'absent');
    const tenuParGithub = juger(rows, ['org-webhook-dispatch']);
    expect(tenuParGithub.exit).toBe(0);
    expect(tenuParGithub.lines.some((l) => l.startsWith('::warning title=cron renewal-notice'))).toBe(true);
    expect(juger(rows, ['org-webhook-dispatch', 'renewal-notice']).exit).toBe(1);
  });

  it('TÉMOIN : un job non basculé en échec rougit quand même (la chaîne pg_cron est cassée)', () => {
    const rows = tousOk();
    rows[5] = ligne('seat-alert', 'echec');
    expect(juger(rows, []).exit).toBe(1);
  });

  it('TÉMOIN : un job basculé que le verdict ne surveille pas = rouge', () => {
    expect(juger(tousOk(), [...SIX, 'job-fantome']).exit).toBe(1);
  });

  it('les jobs basculés sont des jobs du verdict, sans doublon', () => {
    expect(JOBS_BASCULES.length).toBeGreaterThan(0);
    expect(new Set(JOBS_BASCULES).size).toBe(JOBS_BASCULES.length);
    for (const j of JOBS_BASCULES) expect(SIX).toContain(j);
  });

  it('TÉMOIN : zéro ligne = rien mesuré = rouge', () => {
    expect(juger([]).exit).toBe(1);
    expect(juger(undefined).exit).toBe(1);
  });

  it('TÉMOIN : un job de moins que les mig. 245 / 252 = divergence = rouge', () => {
    expect(JOBS_ATTENDUS).toBe(6);
    const { exit, lines } = juger(tousOk().slice(0, 8));
    expect(exit).toBe(1);
    expect(lines.some((l) => l.includes('8 job(s) surveille(s) au lieu de 9'))).toBe(true);
    expect(juger(tousOk().slice(0, 6)).exit).toBe(1); // avant application de la 252
  });

  it('sonde arrêtée (absent) et prod injoignable (echec) : deux rouges distincts, jamais un avertissement', () => {
    const rows = tousOk();
    rows[7] = ligne('sonde-guide', 'echec', { dernier_code: 503 });
    rows[8] = ligne('sonde-site', 'absent');
    const { exit, lines } = juger(rows, []);
    expect(exit).toBe(1);
    expect(lines.find((x) => x.startsWith('::error title=prod injoignable sonde-guide::'))).toContain('HTTP 503');
    expect(lines.some((x) => x.startsWith('::error title=sonde sonde-site n a pas tourne::'))).toBe(true);
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
    expect(await lireVerdict(c)).toHaveLength(9);
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
