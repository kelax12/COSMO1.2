// ═══════════════════════════════════════════════════════════════════
// Journal des traitements planifiés (mig. 245 et 246, ARC-06), sur la base
// fraîche du job `rls-integration`.
//
// Trois choses, qu'aucun test unitaire ne peut voir :
//   1. les preuves `supabase/proofs/245.proof.sql` et `246.proof.sql`
//      embarquent le texte exact de leur migration et rendent « 0 ECHEC » ;
//   2. un job PLANIFIÉ par pg_cron écrit bien dans `cron_runs`, et le relevé
//      ferme la ligne à partir de la réponse de pg_net. Le job de test tourne
//      à la seconde et vise une adresse fermée (`127.0.0.1:9`) : la requête
//      part vraiment, échoue vraiment, et la ligne doit le dire ;
//   3. le bail se prend par PostgREST en `service_role`, jamais en `anon` ni
//      en `authenticated`.
//
// Rôle SQL : `postgres`, celui de pg_cron et de la surveillance. Les secrets
// Vault posés ici sont des valeurs de test, retirées en fin de fichier.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connecter } from './catalogue';
import { admin, anonClient, createTestUser, deleteTestUsers, type TestUser } from './helpers';

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8').replace(/\r\n/g, '\n');
const db = await connecter();
const SECRETS = ['cosmo_project_url', 'cosmo_cron_secret'];
const SECRET_DE_TEST = 'secret-de-test-cron-journal';
const JOB_TEST = 'test-cron-journal';
let user: TestUser | undefined;

async function poserSecrets() {
  await db.query('DELETE FROM vault.secrets WHERE name = ANY($1)', [SECRETS]);
  await db.query("SELECT vault.create_secret('http://127.0.0.1:9', 'cosmo_project_url')");
  await db.query('SELECT vault.create_secret($1, $2)', [SECRET_DE_TEST, 'cosmo_cron_secret']);
}

async function retirerSecrets() {
  await db.query('DELETE FROM vault.secrets WHERE name = ANY($1)', [SECRETS]);
}

async function attendre<T>(lire: () => Promise<T | undefined>, ms: number): Promise<T | undefined> {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const v = await lire();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}

beforeAll(async () => {
  user = await createTestUser();
});

afterAll(async () => {
  await db.query('SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = $1', [JOB_TEST]);
  await retirerSecrets();
  await db.query("DELETE FROM public.cron_leases WHERE job LIKE 'test-%'");
  await deleteTestUsers(user);
  await db.end();
});

describe('supabase/proofs : preuves 245, 246 et 252 rejouées sur la base fraîche', () => {
  const PREUVES = [
    { preuve: '245.proof.sql', migration: '245_cron_journal.sql' },
    { preuve: '246.proof.sql', migration: '246_cron_planification.sql' },
    { preuve: '252.proof.sql', migration: '252_sonde_disponibilite.sql' },
  ];
  for (const { preuve, migration } of PREUVES) {
    it(`${preuve} embarque le texte exact de ${migration}`, () => {
      const m = lire(`supabase/proofs/${preuve}`).match(/EXECUTE \$mig\$\n([\s\S]*?)\n\$mig\$;/);
      expect(m, `${preuve} : aucun bloc EXECUTE $mig$ … $mig$`).not.toBeNull();
      expect(m![1], `${preuve} : le texte embarqué a dérivé de ${migration}`).toBe(
        lire(`supabase/migration/${migration}`).replace(/\n+$/, ''),
      );
    });
  }

  // 245 se joue deux fois : sans secret Vault (branche `config_missing`) et
  // avec (branche `started`, requête mise en file puis annulée).
  for (const avecSecrets of [false, true]) {
    it(`245.proof.sql : PREUVE-ANNULEE 0 ECHEC (${avecSecrets ? 'avec' : 'sans'} secrets Vault)`, async () => {
      if (avecSecrets) await poserSecrets();
      else await retirerSecrets();
      let verdict: string;
      try {
        await db.query(lire('supabase/proofs/245.proof.sql'));
        verdict = 'le bloc DO a VALIDÉ au lieu de lever : la preuve ne s’annule pas';
      } catch (e) {
        verdict = (e as Error).message;
      }
      console.log(`PREUVE 245 (${avecSecrets ? 'avec' : 'sans'} secrets)\n  ${verdict.split(' | ').join('\n  ')}`);
      expect(verdict).toMatch(/^PREUVE-ANNULEE 0 ECHEC \|/);
    }, 60_000);
  }

  // 252 se joue sans et avec Vault ; la clôture simulée doit tourner ici
  // (rôle postgres de la pile locale), pas tomber dans sa branche `info`.
  for (const avecSecrets of [false, true]) {
    it(`252.proof.sql : PREUVE-ANNULEE 0 ECHEC, clôture des sondes simulée (${avecSecrets ? 'avec' : 'sans'} secrets Vault)`, async () => {
      if (avecSecrets) await poserSecrets();
      else await retirerSecrets();
      let verdict: string;
      try {
        await db.query(lire('supabase/proofs/252.proof.sql'));
        verdict = 'le bloc DO a VALIDÉ au lieu de lever : la preuve ne s’annule pas';
      } catch (e) {
        verdict = (e as Error).message;
      }
      console.log(`PREUVE 252 (${avecSecrets ? 'avec' : 'sans'} secrets)\n  ${verdict.split(' | ').join('\n  ')}`);
      expect(verdict).toMatch(/^PREUVE-ANNULEE 0 ECHEC \|/);
      expect(verdict).toContain('ok cloture sonde : passage reussi');
    }, 60_000);
  }

  it('246.proof.sql : PREUVE-ANNULEE 0 ECHEC (secrets Vault posés)', async () => {
    await poserSecrets();
    let verdict: string;
    try {
      await db.query(lire('supabase/proofs/246.proof.sql'));
      verdict = 'le bloc DO a VALIDÉ au lieu de lever : la preuve ne s’annule pas';
    } catch (e) {
      verdict = (e as Error).message;
    }
    console.log(`PREUVE 246\n  ${verdict.split(' | ').join('\n  ')}`);
    expect(verdict).toMatch(/^PREUVE-ANNULEE 0 ECHEC \|/);
  }, 60_000);

  it('l’annulation a tout emporté : ni bail de preuve, ni ligne future', async () => {
    const { rows } = await db.query<{ baux: string; futures: string }>(
      `SELECT (SELECT count(*)::text FROM public.cron_leases WHERE job = 'preuve-245') AS baux,
              (SELECT count(*)::text FROM public.cron_runs WHERE started_at > now() + interval '1 day') AS futures`,
    );
    expect(rows[0]).toEqual({ baux: '0', futures: '0' });
  });
});

describe('cron_runs : un job planifié écrit dans le journal', () => {
  it('sans secret Vault, un appel écrit une ligne config_missing et le verdict tombe en echec', async () => {
    await retirerSecrets();
    const { rows } = await db.query<{ id: string }>("SELECT public.cron_invoke('inactive-accounts')::text AS id");
    const { rows: ligne } = await db.query<{ status: string; request_id: string | null; finished_at: Date | null }>(
      'SELECT status, request_id, finished_at FROM public.cron_runs WHERE id = $1',
      [rows[0].id],
    );
    expect(ligne[0].status).toBe('config_missing');
    expect(ligne[0].request_id).toBeNull();
    expect(ligne[0].finished_at).not.toBeNull();
    const { rows: v } = await db.query<{ verdict: string }>(
      "SELECT verdict FROM public.cron_runs_verdict() WHERE job = 'inactive-accounts'",
    );
    expect(v[0].verdict).toBe('echec');
  });

  it('pg_cron déclenche cron_invoke, pg_net envoie, le relevé ferme la ligne', async () => {
    await poserSecrets();
    const { rows: t } = await db.query<{ debut: Date }>('SELECT now() AS debut');
    const debut = t[0].debut;
    await db.query('SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = $1', [JOB_TEST]);
    await db.query(
      `SELECT cron.schedule($1, '1 seconds', $cron$SELECT public.cron_invoke('seat-alert');$cron$)`,
      [JOB_TEST],
    );

    let ouverte: { id: string; request_id: string | null } | undefined;
    try {
      ouverte = await attendre(async () => {
        const { rows } = await db.query<{ id: string; request_id: string | null }>(
          `SELECT id::text, request_id::text FROM public.cron_runs
            WHERE job = 'seat-alert' AND started_at >= $1 ORDER BY id LIMIT 1`,
          [debut],
        );
        return rows[0];
      }, 30_000);
    } finally {
      await db.query('SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = $1', [JOB_TEST]);
    }
    expect(ouverte, 'aucune ligne écrite par le job pg_cron en 30 s').toBeDefined();
    expect(ouverte!.request_id, 'la ligne ne porte pas la requête pg_net').not.toBeNull();

    // pg_cron a bien exécuté la commande (journal de pg_cron lui-même).
    const { rows: runs } = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM cron.job_run_details
        WHERE command LIKE '%cron_invoke(''seat-alert'')%' AND status = 'succeeded' AND start_time >= $1`,
      [debut],
    );
    expect(Number(runs[0].n)).toBeGreaterThan(0);

    // La réponse de pg_net (connexion refusée) ferme la ligne en `error`.
    const fermee = await attendre(async () => {
      await db.query('SELECT public.cron_runs_close()');
      const { rows } = await db.query<{
        status: string;
        http_code: number | null;
        finished_at: Date | null;
        detail: string | null;
      }>('SELECT status, http_code, finished_at, detail FROM public.cron_runs WHERE id = $1', [ouverte!.id]);
      return rows[0].status === 'started' ? undefined : rows[0];
    }, 30_000);
    expect(fermee, 'la ligne est restée « started » : le relevé ne lit pas pg_net').toBeDefined();
    expect(fermee!.status).toBe('error');
    expect(fermee!.http_code).toBeNull();
    expect(fermee!.finished_at).not.toBeNull();
    expect(fermee!.detail ?? '').not.toContain(SECRET_DE_TEST);

    // Le secret n'est écrit dans aucune colonne du journal.
    const { rows: fuite } = await db.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM public.cron_runs r WHERE r::text LIKE $1',
      [`%${SECRET_DE_TEST}%`],
    );
    expect(fuite[0].n).toBe('0');
  }, 90_000);

  it('le journal reste fermé au client : anon et authenticated ne lisent rien', async () => {
    const a = await anonClient.from('cron_runs').select('id').limit(1);
    expect(a.data ?? []).toEqual([]);
    expect(a.error).not.toBeNull();
    const u = await user!.client.from('cron_runs').select('id').limit(1);
    expect(u.data ?? []).toEqual([]);
    expect(u.error).not.toBeNull();
  });
});

describe('cron_leases : le bail des Edge Functions, par PostgREST', () => {
  it('service_role prend le bail, le second appel est refusé, le jeton le rend', async () => {
    const job = `test-bail-${Date.now()}`;
    const un = await admin.rpc('cron_lease_acquire', { p_job: job, p_ttl_seconds: 60 });
    expect(un.error).toBeNull();
    expect(typeof un.data).toBe('string');
    const deux = await admin.rpc('cron_lease_acquire', { p_job: job, p_ttl_seconds: 60 });
    expect(deux.error).toBeNull();
    expect(deux.data).toBeNull();
    const rendu = await admin.rpc('cron_lease_release', { p_job: job, p_token: un.data });
    expect(rendu.data).toBe(true);
    const trois = await admin.rpc('cron_lease_acquire', { p_job: job, p_ttl_seconds: 60 });
    expect(typeof trois.data).toBe('string');
  });

  it('anon et authenticated ne peuvent ni prendre un bail ni déclencher un appel', async () => {
    for (const client of [anonClient, user!.client]) {
      const bail = await client.rpc('cron_lease_acquire', { p_job: 'test-intrus', p_ttl_seconds: 60 });
      expect(bail.error).not.toBeNull();
      const appel = await client.rpc('cron_invoke', { p_job: 'renewal-notice' });
      expect(appel.error).not.toBeNull();
    }
    const service = await admin.rpc('cron_invoke', { p_job: 'renewal-notice' });
    expect(service.error, 'service_role ne doit pas pouvoir déclencher un envoi').not.toBeNull();
  });
});
