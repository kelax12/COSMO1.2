// ═══════════════════════════════════════════════════════════════════
// check-captures-relues.guard.test.mjs · le TÉMOIN de la revue des captures
// (V15.4, FRO-02)
//
// 🔴 POURQUOI · quatorze références visuelles régénérées d'un geste, sans
// trace. Ce témoin rejoue la règle dans un VRAI dépôt git jetable : un commit
// qui modifie `e2e/__screenshots__/**` sans le trailer fait rougir la garde,
// le même commit avec le trailer passe. Un test qui ne verrait que du texte ne
// prouverait pas que `git diff-tree` voit le fichier.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  DOSSIER, TRAILER, WORKFLOW, lireTrailers, lireUrlRun, juger, verifierRuns, lireCommits, executerGit, run,
} from './check-captures-relues.mjs';

const URL_OK = 'https://github.com/kelax12/COSMO1.2/actions/runs/123456789';
const sha = (c) => c.repeat(40);

describe('lireTrailers', () => {
  it('lit le trailer du dernier paragraphe', () => {
    expect(lireTrailers(`chore(visual): 3 refs\n\nPourquoi.\n\n${TRAILER}: ${URL_OK}\n`)).toEqual([URL_OK]);
  });
  it('ignore une ligne du milieu ou un message à un seul paragraphe', () => {
    expect(lireTrailers(`sujet\n\n${TRAILER}: ${URL_OK}\n\nSuite du récit.\n`)).toEqual([]);
    expect(lireTrailers(`${TRAILER}: ${URL_OK}`)).toEqual([]);
  });
  it('tolère CRLF et le message vide', () => {
    expect(lireTrailers(`s\r\n\r\n${TRAILER}: ${URL_OK}\r\n`)).toEqual([URL_OK]);
    expect(lireTrailers(undefined)).toEqual([]);
  });
});

describe('lireUrlRun', () => {
  it('accepte une URL de run, refuse le reste', () => {
    expect(lireUrlRun(URL_OK)).toEqual({ proprietaire: 'kelax12', depot: 'COSMO1.2', id: '123456789' });
    for (const mauvaise of [
      'http://github.com/a/b/actions/runs/1', 'https://github.com/a/b/actions/runs/', 'https://github.com/a/b/pull/3',
      'https://github.com/a/b/actions/runs/1/attempts/2', 'https://evil.example/a/b/actions/runs/1', 'oui', '',
    ]) expect(lireUrlRun(mauvaise)).toBeNull();
  });
});

describe('juger', () => {
  const commit = (message, fichiers = [`${DOSSIER}linux/a.png`]) => ({ sha: sha('a'), sujet: 'sujet', message, fichiers });
  it('rougit sans trailer, passe avec', () => {
    expect(juger([commit('sujet')]).fautes).toHaveLength(1);
    expect(juger([commit(`sujet\n\n${TRAILER}: ${URL_OK}`)]).fautes).toEqual([]);
  });
  it('ne regarde pas un commit qui ne touche aucune capture', () => {
    expect(juger([commit('sujet', [])]).fautes).toEqual([]);
  });
  it('refuse une URL illisible et un run d un autre dépôt', () => {
    expect(juger([commit(`s\n\n${TRAILER}: pas-une-url`)]).fautes[0]).toMatch(/illisible/);
    const autre = 'https://github.com/pirate/autre/actions/runs/5';
    expect(juger([commit(`s\n\n${TRAILER}: ${autre}`)], { depot: 'kelax12/COSMO1.2' }).fautes[0]).toMatch(/pirate\/autre/);
    expect(juger([commit(`s\n\n${TRAILER}: ${URL_OK}`)], { depot: 'KELAX12/cosmo1.2' }).fautes).toEqual([]);
  });
  it('regroupe les commits par run', () => {
    const r = juger([commit(`s\n\n${TRAILER}: ${URL_OK}`)]).runs;
    expect([...r.keys()]).toEqual(['123456789']);
  });
});

describe('verifierRuns : le run existe, vient du bon workflow, a réussi', () => {
  const runs = new Map([['7', ['abcd1234']]]);
  const avec = (status, json) => verifierRuns(runs, { depot: 'o/d', chercher: async () => ({ status, json }) });
  it('accepte un run terminé en succès du bon workflow', async () => {
    expect(await avec(200, { path: WORKFLOW, status: 'completed', conclusion: 'success' })).toEqual([]);
    expect(await avec(200, { path: `${WORKFLOW}@refs/heads/x`, status: 'completed', conclusion: 'success' })).toEqual([]);
  });
  it('refuse introuvable, autre workflow, run rouge ou en cours', async () => {
    expect((await avec(404, null))[0]).toMatch(/introuvable/);
    expect((await avec(200, { path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }))[0]).toMatch(/pas de/);
    expect((await avec(200, { path: WORKFLOW, status: 'completed', conclusion: 'failure' }))[0]).toMatch(/failure/);
    expect((await avec(200, { path: WORKFLOW, status: 'in_progress', conclusion: null }))[0]).toMatch(/in_progress/);
  });
});

describe('dépôt git jetable : le témoin de bout en bout', () => {
  function depot() {
    const d = mkdtempSync(join(tmpdir(), 'captures-relues-'));
    const g = (...a) => execFileSync('git', ['-C', d, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8' });
    g('init', '-q', '-b', 'main');
    mkdirSync(join(d, DOSSIER, 'linux'), { recursive: true });
    writeFileSync(join(d, 'README.md'), 'x');
    g('add', '-A'); g('commit', '-q', '-m', 'base');
    return { d, g, base: g('rev-parse', 'HEAD').trim() };
  }
  const lancer = async (d, base, extra = [], env = {}) => {
    const sortie = [];
    const code = await run({
      argv: ['--plage', `${base}..HEAD`, ...extra], env,
      executer: executerGit(d), log: (l) => sortie.push(l), erreur: (l) => sortie.push(l),
    });
    return { code, sortie: sortie.join('\n') };
  };

  it('ROUGE sur une capture modifiée sans trailer, VERT avec', async () => {
    const { d, g, base } = depot();
    try {
      writeFileSync(join(d, DOSSIER, 'linux/a.png'), 'nouvelle image');
      g('add', '-A'); g('commit', '-q', '-m', 'chore(visual): une ref');
      const rouge = await lancer(d, base);
      expect(rouge.code).toBe(1);
      expect(rouge.sortie).toMatch(/sans trailer/);

      g('commit', '-q', '--amend', '-m', `chore(visual): une ref\n\nRelues.\n\n${TRAILER}: ${URL_OK}`);
      const vert = await lancer(d, base);
      expect(vert.code).toBe(0);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('ROUGE sur une suppression de capture, et sur un trailer d un autre dépôt', async () => {
    const { d, g, base } = depot();
    try {
      writeFileSync(join(d, DOSSIER, 'linux/a.png'), 'v1');
      g('add', '-A'); g('commit', '-q', '-m', `ajout\n\n${TRAILER}: ${URL_OK}`);
      const milieu = g('rev-parse', 'HEAD').trim();
      g('rm', '-q', DOSSIER + 'linux/a.png'); g('commit', '-q', '-m', 'retrait');
      expect((await lancer(d, milieu)).code).toBe(1);
      expect((await lancer(d, base, [], { GITHUB_REPOSITORY: 'pirate/autre' })).code).toBe(1);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('VERT pour un commit qui ne touche pas aux captures', async () => {
    const { d, g, base } = depot();
    try {
      writeFileSync(join(d, 'README.md'), 'y');
      g('add', '-A'); g('commit', '-q', '-m', 'docs');
      expect((await lancer(d, base)).code).toBe(0);
      expect(lireCommits(`${base}..HEAD`, executerGit(d))).toEqual([]);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('--verifier-runs : un run rouge fait rougir un commit pourtant muni du trailer', async () => {
    const { d, g, base } = depot();
    try {
      writeFileSync(join(d, DOSSIER, 'linux/a.png'), 'img');
      g('add', '-A'); g('commit', '-q', '-m', `ref\n\n${TRAILER}: ${URL_OK}`);
      const env = { GITHUB_REPOSITORY: 'kelax12/COSMO1.2' };
      const appeler = (json) => run({
        argv: ['--plage', `${base}..HEAD`, '--verifier-runs'], env, executer: executerGit(d),
        chercher: async () => ({ status: 200, json }), log: () => {}, erreur: () => {},
      });
      expect(await appeler({ path: WORKFLOW, status: 'completed', conclusion: 'failure' })).toBe(1);
      expect(await appeler({ path: WORKFLOW, status: 'completed', conclusion: 'success' })).toBe(0);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('plage illisible ou sans base : échec, jamais un vert muet', async () => {
    const muet = { env: {}, executer: () => '', log: () => {}, erreur: () => {} };
    expect(await run({ argv: ['--plage', 'oups'], ...muet })).toBe(1);
    expect(await run({ argv: ['--plage', `${'0'.repeat(40)}..HEAD`], ...muet })).toBe(1);
    expect(await run({ argv: [], ...muet })).toBe(1);
  });
});

describe('branchement', () => {
  const lire = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
  it('ci-noyau.yml joue la garde sur la plage poussée, avec la vérification des runs', () => {
    const ci = lire('.github/workflows/ci-noyau.yml');
    const bloc = ci.slice(ci.indexOf('\n  fichiers-sensibles:'));
    expect(bloc).toContain('node scripts/check-captures-relues.mjs --plage "$PLAGE" --verifier-runs');
    expect(bloc).toMatch(/actions: read/);
    expect(bloc).not.toMatch(/continue-on-error/);
  });
  it('visual.yml ne commite ni ne pousse plus rien', () => {
    const v = lire('.github/workflows/visual.yml');
    expect(v).not.toMatch(/git push|git commit|contents: write/);
  });
  it('captures-regenerer.yml pousse sur noyau/captures-<run>, jamais sur main', () => {
    const w = lire(WORKFLOW);
    expect(w).toContain('workflow_dispatch');
    expect(w).toMatch(/refs\/heads\/noyau\/captures-\$\{\{ github\.run_id \}\}/);
    expect(w).not.toMatch(/push origin HEAD:(refs\/heads\/)?main/);
    expect(w).toContain('node scripts/captures-revue.mjs');
    expect(w).toMatch(/name: captures-revue/);
  });
});
