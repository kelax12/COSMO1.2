// Temoin de .githooks/garde-historique.sh : dans un depot jetable, une poussee saine
// passe, une poussee descendant d'un sha interdit et une poussee touchant un chemin
// purge sont refusees. Contexte : purge d'historique du 2026-11-13.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '..', '.githooks', 'garde-historique.sh');
let depot, dossierHook;
const git = (...a) => {
  const r = spawnSync('git', a, { cwd: depot, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};
const commit = (fichier, msg) => {
  mkdirSync(join(depot, fichier, '..'), { recursive: true });
  writeFileSync(join(depot, fichier), msg);
  git('add', '-A');
  git('commit', '-q', '-m', msg);
  return git('rev-parse', 'HEAD');
};
const garde = (sha, liste) => {
  writeFileSync(join(dossierHook, 'historique-interdit.txt'), liste);
  return spawnSync('sh', [join(dossierHook, 'garde-historique.sh')], {
    cwd: depot,
    encoding: 'utf8',
    input: `refs/heads/x ${sha} refs/heads/main ${'0'.repeat(40)}\n`,
  });
};

describe('garde-historique.sh', () => {
  let a, b, c;
  beforeAll(() => {
    const racine = mkdtempSync(join(tmpdir(), 'garde-hist-'));
    depot = join(racine, 'depot');
    dossierHook = join(racine, 'hook');
    mkdirSync(depot);
    mkdirSync(dossierHook);
    copyFileSync(SRC, join(dossierHook, 'garde-historique.sh'));
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    git('config', 'commit.gpgsign', 'false');
    a = commit('a.txt', 'a');
    b = commit('b.txt', 'b');
    c = commit('docs/business-plan/plan.md', 'c');
  });
  afterAll(() => rmSync(join(depot, '..'), { recursive: true, force: true }));

  it('accepte une poussee saine (sha interdit absent du depot ignore)', () => {
    const r = garde(b, `# commentaire\n${'1'.repeat(40)}\n`);
    expect(r.status).toBe(0);
  });
  it('refuse une poussee descendant d un sha interdit', () => {
    const r = garde(b, `${a}\n`);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('ancien historique');
    expect(r.stderr).toContain('cherry-pick');
  });
  it('refuse une poussee dont un commit touche un chemin purge', () => {
    const r = garde(c, '');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('chemin purge');
  });
});
