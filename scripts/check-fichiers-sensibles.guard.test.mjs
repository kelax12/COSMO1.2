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
  CHEMINS_INTERDITS,
  globVersRegex,
  raisonSensible,
  juger,
  exceptionsPerimees,
  lireRaw,
  lireArbre,
  lireLsFiles,
  lirePlage,
  run,
} from './check-fichiers-sensibles.mjs';

const B = 'a'.repeat(40);
const e = (chemin, taille = 10, blob = B) => ({ chemin, blob, taille });

describe('raisonSensible : la règle', () => {
  it.each([
    ['leads-50.csv'],
    ['exports/prospects.csv'],
    ['docs/business-plan/business-plan-cosmo-2026-final.pdf'],
    ['docs/business-plan/notes.md'],
    ['prive/faille.md'],
    ['prive/RGPD-VIOLATION.md'],
    ['Prive/a-faire-manuel.md'],
    ['leads-relance.txt'],
    ['supabase/.temp/project-ref'],
    ['supabase/.temp/linked-project.json'],
    ['.claude/settings.local.json'],
    ['docs/offre-commerciale.docx'],
    ['pitch.PPTX'],
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

  it.each([
    ['.env.example'], ['.env.e2e-stub'], ['src/lib/env.ts'], ['docs/csv-export.md'], ['environment.d.ts'],
    ['.claude/settings.json'], ['.claude/launch.json'], ['src/leads.ts'], ['privee/x.md'], ['docs/prive/x.md'],
    ['supabase/functions/report-bug/index.ts'],
  ])(
    'laisse passer %s',
    (chemin) => {
      expect(raisonSensible(chemin, 10)).toBeNull();
    },
  );

  it('un chemin interdit l emporte sur le suffixe : la raison la plus précise', () => {
    expect(raisonSensible('prive/leads.csv', 10)).toMatch(/prive/);
    expect(raisonSensible('leads-50.csv', 10)).toMatch(/prospection/);
    expect(raisonSensible('supabase/.temp/x.csv', 10)).toMatch(/CLI Supabase/);
  });

  it('globVersRegex : `**` traverse les dossiers, `*` reste dans un nom', () => {
    expect(globVersRegex('prive/**').test('prive/a/b.md')).toBe(true);
    expect(globVersRegex('prive/**').test('src/prive/a.md')).toBe(false);
    expect(globVersRegex('**/leads-*').test('leads-1.csv')).toBe(true);
    expect(globVersRegex('**/leads-*').test('a/b/leads-1.csv')).toBe(true);
    expect(globVersRegex('**/leads-*').test('a/leads-x/b.md')).toBe(false);
    expect(globVersRegex('.claude/settings.local.json').test('.claude/settingsXlocal.json')).toBe(false);
  });

  it('la liste porte les motifs exigés par SEC-01 et SEC-07, un par un', () => {
    expect(CHEMINS_INTERDITS.map(([g]) => g)).toEqual([
      'prive/**', 'docs/business-plan/**', '**/leads-*', 'supabase/.temp/**', '.claude/settings.local.json',
    ]);
  });

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
    expect(refus[0]).toMatch(/^leads-50\.csv : fichier de prospection/);
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

  it('lireLsFiles : sortie ls-files -s -z, sous-module ignoré, forme cassée refusée', () => {
    const s = `100644 ${B} 0\tprive/faille.md\x00160000 ${B} 0\tsous-module\0`;
    expect(lireLsFiles(s)).toEqual([{ chemin: 'prive/faille.md', blob: B }]);
    expect(() => lireLsFiles('100644 abc 0\tx\0')).toThrow(/illisible/);
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
    expect(hook).toContain('scripts/check-fichiers-sensibles.mjs');
    expect(hook).toContain('exec node "$garde" --index');
    expect(hook).not.toMatch(/\$\{?COSMO_|SKIP|BYPASS/);
  });

  /**
   * Un dépôt git jetable, hook en place. `avecGarde: false` = le hook sans le
   * script qu'il lance (worktree trop ancien, copie partielle).
   */
  function depotJetable(corps, { avecGarde = true } = {}) {
    const d = mkdtempSync(join(tmpdir(), 'fichiers-sensibles-'));
    try {
      const g = (...args) => spawnSync('git', args, { cwd: d, encoding: 'utf8' });
      g('init', '-q');
      g('config', 'user.email', 'temoin@example.invalid');
      g('config', 'user.name', 'temoin');
      g('config', 'commit.gpgsign', 'false');
      mkdirSync(join(d, '.githooks'));
      copyFileSync(resolve(RACINE, '.githooks/pre-commit'), join(d, '.githooks/pre-commit'));
      g('config', 'core.hooksPath', '.githooks');
      const suivis = ['.githooks'];
      if (avecGarde) {
        mkdirSync(join(d, 'scripts'));
        copyFileSync(resolve(RACINE, 'scripts/check-fichiers-sensibles.mjs'), join(d, 'scripts/check-fichiers-sensibles.mjs'));
        suivis.push('scripts');
      }
      g('add', ...suivis);
      g('update-index', '--chmod=+x', '.githooks/pre-commit');
      corps({ d, g });
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  }

  it('TÉMOIN : un .csv indexé fait échouer `git commit`, un .ts passe', () => {
    depotJetable(({ d, g }) => {
      writeFileSync(join(d, 'a.ts'), 'export const a = 1;\n');
      g('add', 'a.ts');
      const ok = g('commit', '-q', '-m', 'code');
      expect(ok.status, ok.stderr).toBe(0);

      writeFileSync(join(d, 'export-clients.csv'), 'nom,email\nA,a@example.invalid\n');
      g('add', 'export-clients.csv');
      const refuse = g('commit', '-q', '-m', 'export');
      expect(refuse.status).not.toBe(0);
      expect(refuse.stderr).toMatch(/commit REFUSÉ/);
      expect(refuse.stderr).toMatch(/export-clients\.csv : export tabulaire/);
      expect(g('log', '--oneline').stdout.trim().split('\n')).toHaveLength(1);
    });
  }, 30_000);

  it('TÉMOIN : un fichier de `prive/` indexé fait échouer `git commit`', () => {
    depotJetable(({ d, g }) => {
      mkdirSync(join(d, 'prive'));
      writeFileSync(join(d, 'prive/faille.md'), '# findings ouverts\n');
      g('add', '-f', 'prive/faille.md');
      const refuse = g('commit', '-q', '-m', 'faille');
      expect(refuse.status).not.toBe(0);
      expect(refuse.stderr).toMatch(/prive\/faille\.md : dossier local `prive\/`/);
      expect(g('log', '--oneline').status).not.toBe(0);
    });
  }, 30_000);

  it('TÉMOIN : un hook privé de sa garde refuse le commit, jamais un vert muet', () => {
    depotJetable(({ d, g }) => {
      writeFileSync(join(d, 'a.ts'), 'export const a = 1;\n');
      g('add', 'a.ts');
      const refuse = g('commit', '-q', '-m', 'code');
      expect(refuse.status).not.toBe(0);
      expect(refuse.stderr).toMatch(/commit refuse, scripts\/check-fichiers-sensibles\.mjs introuvable/);
    }, { avecGarde: false });
  }, 30_000);
});

describe('ci-noyau.yml : la garde CI rejoue la même règle, sur l arbre ET sur la plage poussée', () => {
  const ci = readFileSync(resolve(process.cwd(), '.github/workflows/ci-noyau.yml'), 'utf8');

  it('le job lit l historique complet et passe --arbre et --plage', () => {
    const job = ci.slice(ci.indexOf('\n  fichiers-sensibles:'));
    expect(job.length).toBeGreaterThan(30);
    expect(job).toMatch(/fetch-depth: 0/);
    expect(job).toContain('node scripts/check-fichiers-sensibles.mjs --arbre');
    expect(job).toContain('--plage');
    expect(job).not.toMatch(/continue-on-error/);
  });
});
