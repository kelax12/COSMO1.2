// ═══════════════════════════════════════════════════════════════════
// Garde · bail des Edge Functions planifiées (mig. 245, ARC-06)
// ═══════════════════════════════════════════════════════════════════
//
// Deux volets :
//   1. `_shared/cron-lease.ts` est un module PUR : il est EXÉCUTÉ ici, avec
//      une RPC simulée (bail pris, tenu ailleurs, RPC absente, panne) ;
//   2. les cinq fonctions planifiées le prennent, APRÈS la porte du secret
//      (rien n'est lu avant) et AVANT leur première sélection (rien n'est lu
//      hors bail). Leur source est lue commentaires retirés, comme
//      `edge-seat-alert.guard.test.ts`.
//
// Pourquoi : idempotentes en rejeu, ces fonctions ne l'étaient pas en
// concurrence. Deux passages simultanés lisaient la même sélection et
// envoyaient chacun : avis L215-1 en double pour une même échéance.
//
// ❌ Un vert ici ne prouve rien de la fonction DÉPLOYÉE : `npm run check:edge`.
// Le bail lui-même (SQL) est prouvé par `supabase/proofs/245.proof.sql` et
// `e2e/rls/cron-journal.test.ts`.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CRON_LEASE_TTL_SECONDS,
  acquireCronLease,
  isMissingFunction,
  withCronLease,
  type RpcCall,
} from '../supabase/functions/_shared/cron-lease';

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

interface Appel {
  fn: string;
  args: Record<string, unknown>;
}

function rpcSimulee(acquire: { data: unknown; error: { code?: string } | null }) {
  const appels: Appel[] = [];
  const rpc: RpcCall = async (fn, args) => {
    appels.push({ fn, args });
    return fn === 'cron_lease_acquire' ? acquire : { data: true, error: null };
  };
  return { rpc, appels };
}

const ok = () => new Response('{"ok":true}', { status: 200 });
const busy = () => new Response('{"skipped":"already_running"}', { status: 200 });
const fail = async () => new Response('{"error":"lease_failed"}', { status: 500 });

describe('_shared/cron-lease.ts · exécuté', () => {
  it('la durée du bail dépasse la limite d exécution d une Edge Function (400 s)', () => {
    expect(CRON_LEASE_TTL_SECONDS).toBeGreaterThan(400);
    expect(CRON_LEASE_TTL_SECONDS).toBeLessThanOrEqual(3600);
  });

  it('reconnaît une RPC absente (mig. 245 non appliquée), et rien d autre', () => {
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true);
    expect(isMissingFunction({ code: '42883' })).toBe(true);
    expect(isMissingFunction({ code: '42501' })).toBe(false);
    expect(isMissingFunction(null)).toBe(false);
  });

  it('classe la réponse de cron_lease_acquire', async () => {
    expect(await acquireCronLease(rpcSimulee({ data: 'jeton', error: null }).rpc, 'j')).toEqual({ kind: 'held', token: 'jeton' });
    expect(await acquireCronLease(rpcSimulee({ data: null, error: null }).rpc, 'j')).toEqual({ kind: 'busy' });
    expect(await acquireCronLease(rpcSimulee({ data: null, error: { code: 'PGRST202' } }).rpc, 'j')).toEqual({ kind: 'unavailable' });
    expect(await acquireCronLease(rpcSimulee({ data: null, error: { code: '08006' } }).rpc, 'j')).toEqual({ kind: 'error' });
  });

  it('bail pris : travaille, puis rend le bail avec son jeton', async () => {
    const { rpc, appels } = rpcSimulee({ data: 'jeton-1', error: null });
    let travail = 0;
    const res = await withCronLease(rpc, 'renewal-notice', { work: async () => (travail++, ok()), onBusy: busy, onError: fail });
    expect(res.status).toBe(200);
    expect(travail).toBe(1);
    expect(appels).toEqual([
      { fn: 'cron_lease_acquire', args: { p_job: 'renewal-notice', p_ttl_seconds: CRON_LEASE_TTL_SECONDS } },
      { fn: 'cron_lease_release', args: { p_job: 'renewal-notice', p_token: 'jeton-1' } },
    ]);
  });

  it('bail tenu ailleurs : ne travaille PAS, rend skipped (le cas du doublon)', async () => {
    const { rpc, appels } = rpcSimulee({ data: null, error: null });
    let travail = 0;
    const res = await withCronLease(rpc, 'renewal-notice', { work: async () => (travail++, ok()), onBusy: busy, onError: fail });
    expect(travail).toBe(0);
    expect(await res.json()).toEqual({ skipped: 'already_running' });
    expect(appels.map((a) => a.fn)).toEqual(['cron_lease_acquire']);
  });

  it('RPC absente : travaille sans bail (comportement d avant la 245), ne rend rien', async () => {
    const { rpc, appels } = rpcSimulee({ data: null, error: { code: 'PGRST202' } });
    let travail = 0;
    await withCronLease(rpc, 'seat-alert', { work: async () => (travail++, ok()), onBusy: busy, onError: fail });
    expect(travail).toBe(1);
    expect(appels.map((a) => a.fn)).toEqual(['cron_lease_acquire']);
  });

  it('panne de la base : ne travaille pas, rend l erreur', async () => {
    const { rpc } = rpcSimulee({ data: null, error: { code: '08006' } });
    let travail = 0;
    const res = await withCronLease(rpc, 'seat-alert', { work: async () => (travail++, ok()), onBusy: busy, onError: fail });
    expect(travail).toBe(0);
    expect(res.status).toBe(500);
  });

  it('exception pendant le travail : le bail est rendu quand même', async () => {
    const { rpc, appels } = rpcSimulee({ data: 'jeton-2', error: null });
    await expect(
      withCronLease(rpc, 'org-webhook-dispatch', {
        work: async () => {
          throw new Error('panne');
        },
        onBusy: busy,
        onError: fail,
      }),
    ).rejects.toThrow('panne');
    expect(appels.at(-1)).toEqual({ fn: 'cron_lease_release', args: { p_job: 'org-webhook-dispatch', p_token: 'jeton-2' } });
  });
});

/** Fonction planifiée → première sélection, qui doit tomber SOUS le bail. */
const PLANIFIEES: Record<string, string> = {
  'renewal-notice': "rpc('orgs_due_for_renewal_notice')",
  'seat-alert': "rpc('orgs_for_seat_alert')",
  'inactive-accounts': "'accounts_due_for_inactivity_notice'",
  'org-digest': "rpc('org_notifications_to_email'",
  'org-webhook-dispatch': "rpc('org_webhook_deliveries_due'",
};

/** Rend la liste des défauts d'une source : vide si le bail est bien placé. */
function defautsDuBail(code: string, selection: string): string[] {
  const porte = code.search(/x-cron-secret'[)]\s*!==\s*CRON_SECRET/);
  const bail = code.indexOf('withCronLease(');
  const lecture = code.indexOf(selection);
  const defauts: string[] = [];
  if (!/import\s*\{\s*withCronLease\s*\}\s*from\s*'..\/_shared\/cron-lease.ts'/.test(code)) defauts.push('import absent');
  if (bail < 0) defauts.push('withCronLease jamais appelé');
  if (porte < 0) defauts.push('porte du secret introuvable');
  if (lecture < 0) defauts.push('sélection introuvable');
  if (bail >= 0 && porte >= 0 && bail < porte) defauts.push('bail pris AVANT la porte du secret');
  if (bail >= 0 && lecture >= 0 && lecture < bail) defauts.push('sélection lue HORS bail');
  return defauts;
}

describe('fonctions planifiées · le bail est pris, au bon endroit', () => {
  it('TÉMOIN : le détecteur voit une sélection lue hors bail', () => {
    const sansBail =
      "if (req.headers.get('x-cron-secret') !== CRON_SECRET) deny()\nconst { data } = await admin.rpc('orgs_for_seat_alert')";
    expect(defautsDuBail(sansBail, "rpc('orgs_for_seat_alert')")).toEqual(['import absent', 'withCronLease jamais appelé']);
    const horsBail =
      "import { withCronLease } from '../_shared/cron-lease.ts'\nif (req.headers.get('x-cron-secret') !== CRON_SECRET) deny()\n" +
      "const { data } = await admin.rpc('orgs_for_seat_alert')\nreturn withCronLease(rpc, 'seat-alert', h)";
    expect(defautsDuBail(horsBail, "rpc('orgs_for_seat_alert')")).toEqual(['sélection lue HORS bail']);
  });

  for (const [slug, selection] of Object.entries(PLANIFIEES)) {
    it(`${slug} : bail après la porte du secret, sélection sous le bail`, () => {
      const code = codeOnly(read(`supabase/functions/${slug}/index.ts`));
      expect(code.length).toBeGreaterThan(1000);
      expect(defautsDuBail(code, selection)).toEqual([]);
      expect(code).toContain("skipped: 'already_running'");
    });
  }

  it('chaque job appelé par cron_invoke (mig. 245) a sa fonction sous bail', () => {
    const sql = read('supabase/migration/245_cron_journal.sql');
    const chemins = [...sql.matchAll(/WHEN '[a-z-]+'\s+THEN '([a-z-]+)(?:\?mode=[a-z]+)?'/g)].map((m) => m[1]);
    expect(new Set(chemins)).toEqual(new Set(Object.keys(PLANIFIEES)));
  });
});

// ═══════════════════════════════════════════════════════════════════
// Garde · ordre de la bascule pg_cron (ARC-06, vague 10.1)
// ═══════════════════════════════════════════════════════════════════
//
// Retirer les `schedule:` GitHub AVANT d'avoir appliqué les mig. 245 et 246 en
// production arrête les six traitements (avis L215-1, alertes de sièges, comptes
// inactifs, notifications, webhooks) sans qu'aucune alerte ne sonne : la sonde
// `Journal des crons` lit une table qui n'existe pas encore. Ce volet fige
// l'ordre : tant que `BASCULE_FAITE` vaut `false`, les quatre workflows gardent
// leur `schedule:` et la sonde n'en a pas. Le commit de bascule (`DEPLOYMENT.md`
// § 2sexies, étape 8) retourne la constante ET les workflows, ensemble, après
// le verdict `cron_runs_verdict()` à six `ok`.
//
// ❌ Ne jamais passer cette constante à `true` seule, ni la retourner pour
//    « faire passer » un retrait de `schedule:` : le test dit que la production
//    n'a pas encore pris le relais.
const BASCULE_FAITE = true;
const WORKFLOWS_DE_PRODUCTION = ['renewal-notice', 'inactive-accounts', 'org-digest', 'org-webhook-dispatch'];
const aUnSchedule = (yml: string) => /^\s+schedule:/m.test(yml);

describe('bascule pg_cron · les plannings GitHub suivent l’état de la production', () => {
  it('TÉMOIN : le détecteur voit un `schedule:` et ne confond pas un commentaire avec lui', () => {
    expect(aUnSchedule('on:\n  schedule:\n    - cron: "1 1 * * *"\n  workflow_dispatch:\n')).toBe(true);
    expect(aUnSchedule('on:\n  # PLUS DE `schedule:` ici\n  workflow_dispatch:\n')).toBe(false);
  });

  for (const wf of WORKFLOWS_DE_PRODUCTION) {
    it(`${wf}.yml : ${BASCULE_FAITE ? 'plus de schedule' : 'schedule GitHub conservé'}, rattrapage manuel gardé`, () => {
      const yml = read(`.github/workflows/${wf}.yml`);
      expect(aUnSchedule(yml), `${wf}.yml : schedule ${BASCULE_FAITE ? 'revenu' : 'retiré avant la bascule'}`).toBe(!BASCULE_FAITE);
      expect(yml, `${wf}.yml : rattrapage manuel perdu`).toMatch(/^\s+workflow_dispatch:/m);
    });
  }

  it(`cron-journal.yml : ${BASCULE_FAITE ? 'planifié à l’heure' : 'sans schedule tant que 245 et 246 ne sont pas en production'}`, () => {
    expect(aUnSchedule(read('.github/workflows/cron-journal.yml'))).toBe(BASCULE_FAITE);
  });
});
