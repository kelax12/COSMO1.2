// ═══════════════════════════════════════════════════════════════════
// check-fichiers-sensibles.guard.test.mjs · le TÉMOIN du filtre avant commit
//
// 🔴 POURQUOI · le 2026-10-30, `leads-50.csv` et six PDF de business plan
// sont partis sur le dépôt public sans que rien ne bronche. Ce témoin refuse
// une garde qui laisserait repasser ce commit-là : il rejoue la règle sur
// les chemins réels de l'incident, puis le hook ENTIER dans un dépôt git
// jetable (un `.csv` indexé doit faire échouer `git commit`).
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  EXCEPTIONS,
  TAILLE_MAX,
  raisonSensible,
  juger,
  exceptionsPerimees,
  lireRaw,
  lireArbre,
  lirePlage,
  run,
} from './check-fichiers-sensibles.mjs';

const B = 'a'.repeat(40);
const e = (chemin, taille = 10, blob = B) => ({ chemin, blob, taille });

describe('raisonSensible : la règle', () => {
  it.each([
    ['leads-50.csv'],
    ['docs/business-plan/business-plan-cosmo-2026-final.pdf'],
    ['exports/Clients.XLSX'],
    ['vieux.xls'],
    ['backup/prod-2026-10-13.sql.gz'],
    ['prod.dump'],
    ['base.backup'],
    ['.env'],
    ['.env.local'],
    ['.env.cosmo-cli'],
    ['supabase/functions/.env'],
  ])('TÉMOIN : refuse %s', (chemin) => {
    expect(raisonSensible(chemin, 10)).not.toBeNull();
  });

  it.each([['.env.example'], ['.env.e2e-stub'], ['src/lib/env.ts'], ['docs/csv-export.md'], ['environment.d.ts']])(
    'laisse passer %s',
    (chemin) => {
      expect(raisonSensible(chemin, 10)).toBeNull();
    },
  );

  it('refuse au-delà de 1 Mo, pas à 1 Mo pile', () => {
    expect(raisonSensible('public/video.mp4', TAILLE_MAX)).toBeNull();
    expect(raisonSensible('public/video.mp4', TAILLE_MAX + 1)).toMatch(/1 Mo/);
  });
});

describe('juger : les exceptions, une par une', () => {
  const ex = [{ chemin: 'public/a.pdf', blob: B, motif: 'un motif assez long pour être lu' }];

  it('l incident du 2026-10-30 : chaque fichier est refusé et nommé', () => {
    const refus = juger([e('leads-50.csv'), e('docs/business-plan/business-plan-cosmo-2026-v4.pdf'), e('src/a.ts')], ex);
    expect(refus).toHaveLength(2);
    expect(refus[0]).toMatch(/^leads-50\.csv : export tabulaire/);
  });

  it('une exception couvre SA version, pas une autre', () => {
    expect(juger([e('public/a.pdf')], ex)).toEqual([]);
    expect(juger([e('public/a.pdf', 10, 'b'.repeat(40))], ex).join()).toMatch(/autre|pas pour/);
  });

  it('une exception ne couvre pas un autre chemin', () => {
    expect(juger([e('public/b.pdf')], ex)).toHaveLength(1);
  });
});

describe('exceptionsPerimees', () => {
  // Empreinte recalculée depuis le disque (`blob <taille>\0<octets>`, l'algorithme
  // de `git hash-object`) : le rejeu des sabotages joue dans une copie SANS `.git`.
  // L'arbre entier, lui, est relu par le job CI `fichiers-sensibles` (`--arbre`).
  it('le vrai dépôt : chaque exception désigne le fichier présent, octet pour octet', () => {
    for (const x of EXCEPTIONS) {
      const octets = readFileSync(resolve(process.cwd(), x.chemin));
      const blob = createHash('sha1').update(`blob ${octets.length}\0`).update(octets).digest('hex');
      expect(blob, x.chemin).toBe(x.blob);
    }
  });

  it('lireArbre : lit `ls-tree -r -l -z`, ignore un sous-module', () => {
    const s = `100644 blob ${B}    8855\tpublic/a.xlsx\x00160000 commit ${B}       -\tsous-module\0`;
    expect(lireArbre(s)).toEqual([{ chemin: 'public/a.xlsx', blob: B, taille: 8855 }]);
  });

  it('refuse une exception sans fichier, sans motif, ou d une autre version', () => {
    const f = exceptionsPerimees([e('x.pdf', 1, 'c'.repeat(40))], [
      { chemin: 'absent.pdf', blob: B, motif: 'un motif assez long pour être lu' },
      { chemin: 'x.pdf', blob: B, motif: 'court' },
    ]);
    expect(f.join('\n')).toMatch(/absent\.pdf : exception périmée/);
    expect(f.join('\n')).toMatch(/x\.pdf : exception sans motif/);
    expect(f.join('\n')).toMatch(/x\.pdf : exception périmée, l arbre porte/);
  });

  it('chaque exception déclarée a un motif et une empreinte complète', () => {
    for (const x of EXCEPTIONS) {
      expect(x.blob, x.chemin).toMatch(/^[0-9a-f]{40}$/);
      expect(x.motif.length, x.chemin).toBeGreaterThan(40);
    }
  });
});

describe('lecture de git', () => {
  it('lireRaw : sortie --raw -z, sous-module ignoré, forme cassée refusée', () => {
    const s = `:000000 100644 ${'0'.repeat(40)} ${B} A\0leads-50.csv\0\n:000000 160000 ${'0'.repeat(40)} ${B} A\0sous-module\0`;
    expect(lireRaw(s)).toEqual([{ chemin: 'leads-50.csv', blob: B }]);
    expect(() => lireRaw(':000000 100644 A\0x\0')).toThrow(/illisible/);
  });

  it('lirePlage : refuse une plage sans base ou mal formée', () => {
    expect(() => lirePlage(`${'0'.repeat(40)}..HEAD`, () => '')).toThrow(/sans base/);
    expect(() => lirePlage('HEAD;rm -rf /', () => '')).toThrow(/illisible/);
  });

  it('lirePlage : un fichier ajouté PUIS retiré dans la plage est quand même vu', () => {
    const appels = [];
    const executer = (args) => {
      appels.push(args[0]);
      if (args[0] === 'log') return `:000000 100644 ${'0'.repeat(40)} ${B} A\0leads-50.csv\0`;
      return `${B} 1234\n`;
    };
    const vus = lirePlage('abc..def', executer);
    expect(vus).toEqual([{ chemin: 'leads-50.csv', blob: B, taille: 1234 }]);
    expect(juger(vus)).toHaveLength(1);
    expect(appels).toEqual(['log', 'cat-file']);
  });
});

describe('run : le point d entrée', () => {
  const sorties = () => {
    const out = [];
    const err = [];
    return { out, err, log: (l) => out.push(l), erreur: (l) => err.push(l) };
  };

  it('sans mode : échec', () => {
    const s = sorties();
    expect(run({ argv: [], env: {}, log: s.log, erreur: s.erreur })).toBe(1);
  });

  it('arbre vide : échec, jamais un vert muet', () => {
    const s = sorties();
    expect(run({ argv: ['--arbre'], env: {}, executer: () => '', log: s.log, erreur: s.erreur })).toBe(1);
    expect(s.err.join()).toMatch(/vide/);
  });

  it('en CI, chaque refus est une annotation', () => {
    const s = sorties();
    const executer = (args) => (args[0] === 'diff'
      ? `:000000 100644 ${'0'.repeat(40)} ${B} A\0leads-50.csv\0`
      : `${B} 99\n`);
    expect(run({ argv: ['--index'], env: { GITHUB_ACTIONS: 'true' }, executer, log: s.log, erreur: s.erreur })).toBe(1);
    expect(s.out.filter((l) => l.startsWith('::error title=fichiers-sensibles::leads-50.csv'))).toHaveLength(1);
  });
});

describe('le hook pre-commit, joué en vrai', () => {
  const RACINE = process.cwd();
  const hook = readFileSync(resolve(RACINE, '.githooks/pre-commit'), 'utf8');

  it('le hook lance cette garde sur l index, sans variable de contournement', () => {
    expect(hook).toContain('exec node scripts/check-fichiers-sensibles.mjs --index');
    expect(hook).not.toMatch(/\$\{?COSMO_|SKIP|BYPASS/);
  });

  it('TÉMOIN : un .csv indexé fait échouer `git commit`, un .ts passe', () => {
    const d = mkdtempSync(join(tmpdir(), 'fichiers-sensibles-'));
    try {
      const g = (...args) => spawnSync('git', args, { cwd: d, encoding: 'utf8' });
      g('init', '-q');
      g('config', 'user.email', 'temoin@example.invalid');
      g('config', 'user.name', 'temoin');
      g('config', 'commit.gpgsign', 'false');
      mkdirSync(join(d, 'scripts'));
      mkdirSync(join(d, '.githooks'));
      copyFileSync(resolve(RACINE, 'scripts/check-fichiers-sensibles.mjs'), join(d, 'scripts/check-fichiers-sensibles.mjs'));
      copyFileSync(resolve(RACINE, '.githooks/pre-commit'), join(d, '.githooks/pre-commit'));
      g('config', 'core.hooksPath', '.githooks');

      writeFileSync(join(d, 'a.ts'), 'export const a = 1;\n');
      g('add', 'a.ts', 'scripts', '.githooks');
      g('update-index', '--chmod=+x', '.githooks/pre-commit');
      const ok = g('commit', '-q', '-m', 'code');
      expect(ok.status, ok.stderr).toBe(0);

      writeFileSync(join(d, 'leads-50.csv'), 'nom,email\nA,a@example.invalid\n');
      g('add', 'leads-50.csv');
      const refuse = g('commit', '-q', '-m', 'leads');
      expect(refuse.status).not.toBe(0);
      expect(refuse.stderr).toMatch(/leads-50\.csv : export tabulaire/);
      expect(g('log', '--oneline').stdout.trim().split('\n')).toHaveLength(1);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }, 30_000);
});

describe('ci.yml : la garde CI rejoue la même règle, sur l arbre ET sur la plage poussée', () => {
  const ci = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

  it('le job lit l historique complet et passe --arbre et --plage', () => {
    const job = ci.slice(ci.indexOf('\n  fichiers-sensibles:'));
    expect(job.length).toBeGreaterThan(30);
    expect(job).toMatch(/fetch-depth: 0/);
    expect(job).toContain('node scripts/check-fichiers-sensibles.mjs --arbre');
    expect(job).toContain('--plage');
    expect(job).not.toMatch(/continue-on-error/);
  });
});
