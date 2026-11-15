// ═══════════════════════════════════════════════════════════════════
// captures-revue.guard.test.mjs · les TÉMOINS de la revue des captures (V15.4, FRO-02) : l'artefact de revue puis le trailer `Captures-relues`
//
// Il fabrique de vrais PNG, rejoue `captures-revue.mjs` et refuse un artefact
// qui ne montrerait pas ce qui a changé : une capture modifiée doit sortir
// avec son avant, son après et sa différence, une capture identique ne doit
// rien produire, et une régénération qui n'a rien écrit doit échouer.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { comparer, listerPng, pageIndex, produire, run } from './captures-revue.mjs';

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

function png(w, h, [r, g, b], pixelsRouges = []) {
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) { p.data[i * 4] = r; p.data[i * 4 + 1] = g; p.data[i * 4 + 2] = b; p.data[i * 4 + 3] = 255; }
  for (const i of pixelsRouges) { p.data[i * 4] = 255; p.data[i * 4 + 1] = 0; p.data[i * 4 + 2] = 0; }
  return PNG.sync.write(p);
}

function monde() {
  const d = mkdtempSync(join(tmpdir(), 'captures-revue-'));
  for (const s of ['avant', 'apres']) mkdirSync(join(d, s, 'linux'), { recursive: true });
  const poser = (s, nom, octets) => writeFileSync(join(d, s, 'linux', nom), octets);
  return { d, poser, avant: join(d, 'avant'), apres: join(d, 'apres'), sortie: join(d, 'out') };
}

describe('comparer', () => {
  it('compte les pixels qui diffèrent, seuil 0', () => {
    const a = PNG.sync.read(png(10, 10, [255, 255, 255]));
    const b = PNG.sync.read(png(10, 10, [255, 255, 255], [3, 4]));
    const c = comparer(a, b);
    expect(c.memeTaille).toBe(true);
    expect(c.pixels).toBe(2);
    expect(c.total).toBe(100);
    expect(c.image.data[3 * 4]).toBe(255);
    expect(c.image.data[3 * 4 + 1]).toBe(0);
  });
  it('signale des tailles différentes sans fabriquer de diff', () => {
    const c = comparer(PNG.sync.read(png(10, 10, [0, 0, 0])), PNG.sync.read(png(10, 12, [0, 0, 0])));
    expect(c.memeTaille).toBe(false);
    expect(c.image).toBeNull();
  });
});

describe('produire : modifiée, ajoutée, supprimée, identique', () => {
  it('écrit avant, après, diff et l index pour ce qui change, et rien pour l identique', () => {
    const m = monde();
    try {
      m.poser('avant', 'stable.png', png(8, 8, [10, 10, 10]));
      m.poser('apres', 'stable.png', png(8, 8, [10, 10, 10]));
      m.poser('avant', 'bouge.png', png(8, 8, [255, 255, 255]));
      m.poser('apres', 'bouge.png', png(8, 8, [255, 255, 255], [0, 1, 2]));
      m.poser('avant', 'taille.png', png(8, 8, [0, 0, 0]));
      m.poser('apres', 'taille.png', png(8, 9, [0, 0, 0]));
      m.poser('apres', 'neuve.png', png(8, 8, [1, 2, 3]));
      m.poser('avant', 'partie.png', png(8, 8, [1, 2, 3]));
      const r = produire(m);
      expect(r.compte).toEqual({ modifiee: 2, ajoutee: 1, supprimee: 1, identique: 1 });
      const sortie = (p) => existsSync(join(m.sortie, p));
      expect(sortie('avant/linux/bouge.png') && sortie('apres/linux/bouge.png') && sortie('diff/linux/bouge.png')).toBe(true);
      expect(sortie('diff/linux/taille.png')).toBe(false);
      expect(sortie('apres/linux/neuve.png')).toBe(true);
      expect(sortie('avant/linux/partie.png')).toBe(true);
      expect(sortie('avant/linux/stable.png')).toBe(false);
      const html = readFileSync(join(m.sortie, 'index.html'), 'utf8');
      expect(html).toContain('3 pixel(s) sur 64');
      expect(html).toContain('MODIFIÉE');
      expect(html).toContain('AJOUTÉE');
      expect(html).toContain('SUPPRIMÉE');
      expect(html).toContain('dimensions différentes');
      expect(html).not.toContain('stable.png');
      expect(html).not.toMatch(/<script/);
    } finally { rmSync(m.d, { recursive: true, force: true }); }
  });

  it('octets identiques : aucune entrée à relire', () => {
    const m = monde();
    try {
      m.poser('avant', 'a.png', png(4, 4, [9, 9, 9]));
      m.poser('apres', 'a.png', png(4, 4, [9, 9, 9]));
      const r = produire(m);
      expect(r.compte.identique).toBe(1);
      expect(pageIndex(r)).toContain('rien à relire');
    } finally { rmSync(m.d, { recursive: true, force: true }); }
  });

  it('échappe un nom de fichier piégé dans la page', () => {
    const html = pageIndex({ compte: { modifiee: 0, ajoutee: 1, supprimee: 0, identique: 0 }, entrees: [{ chemin: '<img src=x onerror=1>.png', etat: 'ajoutee' }] });
    expect(html).not.toContain('<img src=x onerror=1>');
  });
});

describe('run', () => {
  it('échoue quand la régénération n a rien écrit, au lieu d un artefact vide et vert', () => {
    const m = monde();
    try {
      m.poser('avant', 'a.png', png(4, 4, [9, 9, 9]));
      const erreurs = [];
      expect(run({ argv: ['--avant', m.avant, '--apres', m.apres, '--sortie', m.sortie], log: () => {}, erreur: (l) => erreurs.push(l) })).toBe(1);
      expect(erreurs.join()).toMatch(/aucun PNG/);
      expect(run({ argv: [], log: () => {}, erreur: () => {} })).toBe(1);
    } finally { rmSync(m.d, { recursive: true, force: true }); }
  });
  it('réussit et compte', () => {
    const m = monde();
    try {
      m.poser('apres', 'a.png', png(4, 4, [9, 9, 9]));
      const lignes = [];
      expect(run({ argv: ['--avant', m.avant, '--apres', m.apres, '--sortie', m.sortie], log: (l) => lignes.push(l), erreur: () => {} })).toBe(0);
      expect(lignes[0]).toMatch(/1 ajoutée/);
      expect(listerPng(m.apres)).toEqual(['linux/a.png']);
    } finally { rmSync(m.d, { recursive: true, force: true }); }
  });
});

// ── trailer Captures-relues ──
import {
  DOSSIER, TRAILER, WORKFLOW, lireTrailers, lireUrlRun, juger, verifierRuns, lireCommits, executerGit, run as runRelues,
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
    const code = await runRelues({
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
      const appeler = (json) => runRelues({
        argv: ['--plage', `${base}..HEAD`, '--verifier-runs'], env, executer: executerGit(d),
        chercher: async () => ({ status: 200, json }), log: () => {}, erreur: () => {},
      });
      expect(await appeler({ path: WORKFLOW, status: 'completed', conclusion: 'failure' })).toBe(1);
      expect(await appeler({ path: WORKFLOW, status: 'completed', conclusion: 'success' })).toBe(0);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('plage illisible ou sans base : échec, jamais un vert muet', async () => {
    const muet = { env: {}, executer: () => '', log: () => {}, erreur: () => {} };
    expect(await runRelues({ argv: ['--plage', 'oups'], ...muet })).toBe(1);
    expect(await runRelues({ argv: ['--plage', `${'0'.repeat(40)}..HEAD`], ...muet })).toBe(1);
    expect(await runRelues({ argv: [], ...muet })).toBe(1);
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
