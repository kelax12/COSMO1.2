import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decide, main, shasVersMain, lireRuns, WORKFLOW } from './pre-push-main-red.mjs';

const red = { status: 'completed', conclusion: 'failure', headSha: 'abcdef123456', url: 'u' };
const green = { status: 'completed', conclusion: 'success' };
const running = { status: 'in_progress', conclusion: null };
const SHA = '1111111111111111111111111111111111111111';
const versMain = `refs/heads/x ${SHA} refs/heads/main 2222222222222222222222222222222222222222\n`;

// La variable de contournement retirée le 2026-11-06, écrite en deux morceaux pour que ce
// fichier ne la contienne pas lui-même.
const ANCIENNE = ['COSMO', 'PUSH', 'ON', 'RED'].join('_');

describe('pre-push-main-red', () => {
  it('lit les SHA poussés vers main dans le stdin du hook, jamais une suppression', () => {
    expect(shasVersMain(versMain)).toEqual([SHA]);
    expect(shasVersMain(`refs/heads/fix ${SHA} refs/heads/fix 000\r\n`)).toEqual([]);
    expect(shasVersMain(`(delete) 0000000000000000000000000000000000000000 refs/heads/main ${SHA}\n`)).toEqual([]);
    expect(shasVersMain('')).toEqual([]);
  });

  it('ne lit que le noyau', () => {
    expect(WORKFLOW).toBe('CI noyau');
  });

  it('TÉMOIN : refuse une poussée vers main quand le dernier run noyau terminé est rouge', () => {
    const r = decide({ runs: [running, red, green], shas: [SHA] });
    expect(r.block).toBe(true);
    expect(r.message).toMatch(/REFUSÉ, le dernier run CI noyau de main est rouge/);
    expect(r.message).toMatch(/aucun contournement/);
    expect(r.message).toMatch(/noyau\//);
  });

  it('laisse passer quand le dernier run terminé est vert ou annulé', () => {
    expect(decide({ runs: [running, green, red], shas: [SHA] }).block).toBe(false);
    expect(decide({ runs: [{ status: 'completed', conclusion: 'cancelled' }], shas: [SHA] }).block).toBe(false);
  });

  it('laisse passer une poussée qui ne vise pas main, même sur du rouge', () => {
    expect(decide({ runs: [red], shas: [] }).block).toBe(false);
  });

  it('réparation : un SHA déjà jugé VERT par le noyau passe, et le dit', () => {
    const r = decide({ runs: [red], shas: [SHA], verdictsDuSha: { [SHA]: [red, green] } });
    expect(r.block).toBe(false);
    expect(r.message).toMatch(/déjà un verdict CI noyau VERT/);
  });

  it('TÉMOIN : un SHA sans verdict, en cours, rouge ou illisible reste refusé', () => {
    for (const verdicts of [undefined, null, [], [running], [red], [{ status: 'completed', conclusion: 'cancelled' }]]) {
      expect(decide({ runs: [red], shas: [SHA], verdictsDuSha: { [SHA]: verdicts } }).block).toBe(true);
    }
  });

  it('TÉMOIN : gh illisible REFUSE, il ne laisse plus passer', () => {
    const r = decide({ runs: null, shas: [SHA] });
    expect(r.block).toBe(true);
    expect(r.message).toMatch(/illisible/);
  });

  // 🔴 TÉMOIN 2.3 : plus aucun moyen de pousser sur un noyau rouge. On joue le point d'entrée
  // avec l'ancienne variable posée dans l'environnement du processus : la décision ne change pas.
  it('TÉMOIN : noyau rouge + ancienne variable de contournement posée = refus (code 1)', () => {
    const avant = process.env[ANCIENNE];
    process.env[ANCIENNE] = '1';
    try {
      const lignes = [];
      const lire = (filtre) => (filtre[0] === '--branch' ? [red] : []);
      expect(main({ stdin: versMain, lire, log: (l) => lignes.push(l) })).toBe(1);
      expect(lignes.join('\n')).toMatch(/REFUSÉ/);
    } finally {
      if (avant === undefined) delete process.env[ANCIENNE];
      else process.env[ANCIENNE] = avant;
    }
  });

  it('point d’entrée : interroge le SHA poussé seulement quand main est rouge', () => {
    const appels = [];
    const lire = (filtre) => {
      appels.push(filtre.join(' '));
      return filtre[0] === '--branch' ? [green] : [];
    };
    expect(main({ stdin: versMain, lire, log: () => {} })).toBe(0);
    expect(appels).toEqual(['--branch main']);
    appels.length = 0;
    const lireRouge = (filtre) => {
      appels.push(filtre.join(' '));
      return filtre[0] === '--branch' ? [red] : [green];
    };
    expect(main({ stdin: versMain, lire: lireRouge, log: () => {} })).toBe(0);
    expect(appels).toEqual(['--branch main', `--commit ${SHA}`]);
  });

  it('lireRuns : demande CI noyau à gh, et rend null sur une sortie illisible ou une erreur', () => {
    let vu;
    expect(lireRuns(['--branch', 'main'], (_b, args) => { vu = args; return '[{"status":"completed"}]'; })).toHaveLength(1);
    expect(vu).toEqual(expect.arrayContaining(['--workflow', 'CI noyau', '--branch', 'main']));
    expect(lireRuns([], () => 'pas du json')).toBeNull();
    expect(lireRuns([], () => '{}')).toBeNull();
    expect(lireRuns([], () => { throw new Error('gh absent'); })).toBeNull();
  });

  it('TÉMOIN : le script ne lit aucune variable d’environnement, le hook non plus', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/pre-push-main-red.mjs'), 'utf8');
    expect(script).not.toMatch(/process\.env/);
    const hook = readFileSync(join(process.cwd(), '.githooks/pre-push'), 'utf8');
    expect(hook).not.toMatch(/\$[A-Z_]{3,}/);
    expect(hook).toMatch(/exec node scripts\/pre-push-main-red\.mjs/);
  });

  it('TÉMOIN : l’ancienne variable de contournement n’existe plus nulle part (hors archive)', () => {
    // `git grep` sort en 1 quand il ne trouve rien, en 0 quand il trouve : seul 1 est un vert.
    const r = spawnSync('git', ['grep', '-l', ANCIENNE, '--', '.', ':!docs/archive/**'], { encoding: 'utf8' });
    expect(r.stdout.trim()).toBe('');
    expect(r.status).toBe(1);
  });
});
