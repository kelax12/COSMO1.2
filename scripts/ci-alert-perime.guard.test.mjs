// ═══════════════════════════════════════════════════════════════════
// ci-alert-perime.guard.test.mjs · LE TÉMOIN DE L'ALERTE PÉRIMÉE
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Depuis le 2026-10-16, les runs `CI` de `main` ne s'annulent plus entre eux
// (un groupe de concurrence par commit). Or un `e2e` rouge dure bien plus
// longtemps qu'un vert : 4,3 h le 2026-10-02 (57 cas × 3 tentatives), 23 min
// vert. Un commit A qui casse, réparé par B dix minutes plus tard, rend donc
// le vert de B AVANT le rouge de A, et `ci-alert.yml` rouvrait l'issue
// `ci-red` et poussait l'alerte des heures après la réparation. Ce rouge-là
// était annulé avant, et silencieux.
//
// Ce témoin refuse :
//   · un rouge déjà réparé par un run vert PLUS RÉCENT qui alerterait quand même ;
//   · un contrôle qui avalerait l'alerte dans le doute (API en panne,
//     contexte incomplet) : dans le doute, l'alerte part ;
//   · un `ci-alert.yml` qui n'appellerait plus le contrôle, ou dont une des
//     deux sorties (issue, webhook) ne le respecterait pas.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reparateur, listerRuns, run } from './ci-alert-perime.mjs';
import { lireEtapes } from './ci-toutes-les-gardes.mjs';

const CREE = '2026-10-16T10:00:00Z';
const vert = (id, cree, sha = `sha${id}000000`) => ({
  id, created_at: cree, head_sha: sha, conclusion: 'success', html_url: `https://x/runs/${id}`,
});
const env = (o = {}) => ({
  REPO: 'kelax12/COSMO1.2', WF_ID: '123', CREE, SHA: 'aaaaaaa1111', GH_TOKEN: 't',
  GITHUB_OUTPUT: 'sortie.txt', ...o,
});

/** Joue `run` avec une API simulée, et capture la sortie GitHub et les lignes. */
async function jouer(e, runs) {
  const ecrit = [];
  const lignes = [];
  let appels = 0;
  const lister = async () => {
    appels += 1;
    if (runs instanceof Error) throw runs;
    return runs;
  };
  const r = await run({ env: e, lister, ecrire: (p, t) => ecrit.push([p, t]), log: (l) => lignes.push(l) });
  return { ...r, ecrit, lignes: lignes.join('\n'), appels };
}

describe('ci-alert-perime · TÉMOIN : un rouge déjà réparé ne réveille personne', () => {
  it('un run vert PLUS RÉCENT sur main : périmé, `perime=true` écrit, le réparateur nommé', async () => {
    const r = await jouer(env(), [vert(9, '2026-10-16T10:10:00Z', 'bbbbbbb2222')]);
    expect(r.perime).toBe(true);
    expect(r.ecrit).toEqual([['sortie.txt', 'perime=true\n']]);
    expect(r.lignes).toMatch(/aaaaaaa.*bbbbbbb.*https:\/\/x\/runs\/9/s);
  });

  it('seuls des verts plus ANCIENS : pas périmé, l’alerte part', async () => {
    const r = await jouer(env(), [vert(7, '2026-10-16T09:50:00Z'), vert(6, '2026-10-16T09:00:00Z')]);
    expect(r.perime).toBe(false);
    expect(r.ecrit).toEqual([['sortie.txt', 'perime=false\n']]);
  });

  it('un run plus récent mais ROUGE ne répare rien', async () => {
    const rouge = { ...vert(9, '2026-10-16T10:10:00Z'), conclusion: 'failure' };
    expect(reparateur([rouge], { creeLe: CREE })).toBeNull();
  });

  it('créé à la même seconde : pas plus récent, pas périmé', () => {
    expect(reparateur([vert(9, CREE)], { creeLe: CREE })).toBeNull();
  });
});

describe('ci-alert-perime · TÉMOIN : dans le doute, l’alerte part', () => {
  it('API en panne : `perime=false`, et la ligne dit que la vérification n’a pas eu lieu', async () => {
    const r = await jouer(env(), new Error('HTTP 403'));
    expect(r.perime).toBe(false);
    expect(r.ecrit).toEqual([['sortie.txt', 'perime=false\n']]);
    expect(r.lignes).toMatch(/vérification impossible.*HTTP 403.*l’alerte part/s);
  });

  it.each([['CREE'], ['WF_ID'], ['REPO']])('`%s` absent : `perime=false` sans appeler l’API', async (cle) => {
    const r = await jouer(env({ [cle]: '' }), [vert(9, '2026-10-16T10:10:00Z')]);
    expect(r.perime).toBe(false);
    expect(r.appels).toBe(0);
    expect(r.ecrit).toEqual([['sortie.txt', 'perime=false\n']]);
  });

  it('date de création illisible : jamais périmé', () => {
    expect(reparateur([vert(9, '2026-10-16T10:10:00Z')], { creeLe: 'pas une date' })).toBeNull();
  });

  it('sans `GITHUB_OUTPUT` : rien n’est écrit, la sortie vide laisse partir l’alerte', async () => {
    const r = await jouer(env({ GITHUB_OUTPUT: '' }), [vert(9, '2026-10-16T10:10:00Z')]);
    expect(r.ecrit).toEqual([]);
    expect(r.lignes).toMatch(/GITHUB_OUTPUT absent/);
  });
});

describe('listerRuns · la lecture de l’API', () => {
  it('lit les runs VERTS de `main` du même workflow, avec le jeton', async () => {
    const vus = [];
    const fetchImpl = async (url, init) => {
      vus.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ workflow_runs: [vert(9, CREE)] }) };
    };
    const runs = await listerRuns({ repo: 'o/r', workflowId: '123', token: 't', fetchImpl });
    expect(runs).toHaveLength(1);
    expect(vus[0].url).toBe('https://api.github.com/repos/o/r/actions/workflows/123/runs?branch=main&status=success&per_page=5');
    expect(vus[0].init.headers.Authorization).toBe('Bearer t');
  });

  it('une réponse non 2xx est une erreur, jamais une liste vide', async () => {
    const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({}) });
    await expect(listerRuns({ repo: 'o/r', workflowId: '1', token: 't', fetchImpl })).rejects.toThrow(/403/);
  });

  it('une réponse sans `workflow_runs` est une erreur', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ message: 'x' }) });
    await expect(listerRuns({ repo: 'o/r', workflowId: '1', token: 't', fetchImpl })).rejects.toThrow(/workflow_runs/);
  });
});

describe('ci-alert.yml · TÉMOIN : le contrôle est câblé sur les DEUX sorties', () => {
  const yaml = readFileSync(join(process.cwd(), '.github/workflows/ci-alert.yml'), 'utf8');
  const etapes = lireEtapes(yaml, 'open-issue');
  const iPerime = etapes.findIndex((e) => e.id === 'perime');
  const iIssue = etapes.findIndex((e) => e.run?.includes('gh issue'));
  const iWebhook = etapes.findIndex((e) => e.run?.includes('scripts/ops-alert.mjs'));

  it('une étape `perime` lance le script, AVANT l’issue et le webhook', () => {
    expect(iPerime).toBeGreaterThanOrEqual(0);
    expect(etapes[iPerime].run).toBe('node scripts/ci-alert-perime.mjs');
    expect(iIssue).toBeGreaterThan(iPerime);
    expect(iWebhook).toBeGreaterThan(iPerime);
    expect(etapes.findIndex((e) => e.uses?.startsWith('actions/checkout@'))).toBeLessThan(iPerime);
    expect(etapes[iPerime].env).toMatchObject({
      WF_ID: '${{ github.event.workflow_run.workflow_id }}',
      CREE: '${{ github.event.workflow_run.created_at }}',
      SHA: '${{ github.event.workflow_run.head_sha }}',
    });
  });

  it.each([['l’issue', () => iIssue], ['le webhook', () => iWebhook]])(
    '%s respecte le contrôle, et part encore si le contrôle a planté',
    (_nom, i) => {
      const si = etapes[i()].if;
      expect(si).toContain("steps.perime.outputs.perime != 'true'");
      expect(si).toMatch(/always\(\)/);
    },
  );

  it('le jeton peut lire les runs (`actions: read`), et rien de plus que l’existant', () => {
    const bloc = yaml.replace(/\r\n/g, '\n').match(/\npermissions:\n((?: {2}.*\n)+)/)[1];
    expect(bloc.trim().split('\n').map((l) => l.trim()).sort()).toEqual(
      ['actions: read', 'contents: read', 'issues: write'],
    );
  });
});
