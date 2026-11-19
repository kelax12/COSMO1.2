import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fichiersDeTest, selectionner, lireChangements, run, CONFIGURATION, PLAFOND, GARDES_UI, refusPlafond } from './test-changed.mjs';

const CONTENUS = {
  'scripts/ci-toutes-les-gardes.guard.test.mjs': "readFileSync('.github/workflows/ci-noyau.yml')",
  'scripts/docs.guard.test.mjs': "lit docs/TESTING.md et l'index.ts",
  'src/lib/toast.test.ts': "import { toast } from './toast';",
  'src/lib/autre.test.ts': 'rien à voir',
};
const lire = (f) => {
  if (!(f in CONTENUS)) throw new Error(`absent : ${f}`);
  return CONTENUS[f];
};

describe('fichiersDeTest : ce que vitest.config.ts ramasse', () => {
  it('garde src/, scripts/, eslint-rules/, api/ ; écarte e2e/ et src/__test__/', () => {
    expect(fichiersDeTest([
      'src/a.test.ts', 'src/b.spec.tsx', 'scripts/c.test.mjs', 'eslint-rules/d.test.mjs', 'api/e.test.ts',
      'e2e/f.spec.ts', 'src/__test__/g.test.ts', 'src/h.ts', 'docs/i.test.ts',
    ])).toEqual(['src/a.test.ts', 'src/b.spec.tsx', 'scripts/c.test.mjs', 'eslint-rules/d.test.mjs', 'api/e.test.ts']);
  });
});

describe('selectionner', () => {
  const tests = Object.keys(CONTENUS);

  it('une source modifiée part à vitest related ; un test qui ne la nomme pas n’est pas ajouté', () => {
    const r = selectionner({ changes: ['src/lib/toast.ts'], tests, lire });
    expect(r.related).toEqual(['src/lib/toast.ts']);
    expect(r.parTexte).toEqual([]);
  });

  it('un workflow modifié appelle le test qui le lit par son nom (invisible au graphe d’imports)', () => {
    const r = selectionner({ changes: ['.github/workflows/ci-noyau.yml'], tests, lire });
    expect(r.related).toEqual([]);
    expect(r.parTexte).toEqual(['scripts/ci-toutes-les-gardes.guard.test.mjs']);
  });

  it('un doc modifié est trouvé par son chemin', () => {
    expect(selectionner({ changes: ['docs/TESTING.md'], tests, lire }).parTexte).toEqual(['scripts/docs.guard.test.mjs']);
  });

  it('une source n’est cherchée que par son chemin complet, jamais par un nom court (`index.ts`)', () => {
    expect(selectionner({ changes: ['src/modules/x/index.ts'], tests, lire }).parTexte).toEqual([]);
  });

  it('un test modifié part à related, sans doublon par le texte', () => {
    const r = selectionner({ changes: ['src/lib/toast.test.ts', 'src/lib/toast.ts'], tests, lire });
    expect(r.related).toEqual(['src/lib/toast.test.ts', 'src/lib/toast.ts']);
    expect(r.parTexte).toEqual([]);
  });

  it('un test illisible est ignoré, pas fatal', () => {
    expect(selectionner({ changes: ['docs/TESTING.md'], tests: ['inconnu.test.ts', ...tests], lire }).parTexte)
      .toEqual(['scripts/docs.guard.test.mjs']);
  });

  it('signale une configuration modifiée', () => {
    expect(selectionner({ changes: ['package-lock.json', 'src/a.ts'], tests, lire }).configuration).toEqual(['package-lock.json']);
    expect(CONFIGURATION).toContain('vitest.config.ts');
  });
});

/** Un faux `git` : réponses par sous-commande. */
const fauxGit = (rep) => (args) => {
  const r = rep[args[0]];
  if (r instanceof Error) throw r;
  return typeof r === 'function' ? r(args) : (r ?? '');
};

describe('lireChangements', () => {
  it('diff depuis la base de fusion (commits + arbre), plus les non suivis, sans doublon', () => {
    const vus = [];
    const ex = fauxGit({
      'merge-base': (a) => { vus.push(a.join(' ')); return 'abc123\n'; },
      diff: (a) => { vus.push(a.join(' ')); return 'b.ts\na.ts\n'; },
      'ls-files': 'c.ts\na.ts\n',
    });
    expect(lireChangements('origin/main', ex)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(vus).toEqual(['merge-base origin/main HEAD', 'diff --name-only --diff-filter=d abc123']);
  });
});

describe('run', () => {
  const sortie = () => {
    const l = [];
    return { l, log: (x) => l.push(x) };
  };
  const ex = fauxGit({
    'merge-base': 'abc\n',
    diff: '.github/workflows/ci-noyau.yml\nsrc/lib/toast.ts\nsupprime.ts\n',
    'ls-files': (a) => (a.includes('--others') ? '' : `${Object.keys(CONTENUS).join('\n')}\n`),
  });
  const existe = (f) => f !== 'supprime.ts';
  const base = { executer: ex, lire, existe, log: () => {} };

  it('lance Vitest sur les sources et les tests trouvés par le texte, plafond par défaut', async () => {
    const s = sortie();
    let recu;
    const code = await run({ ...base, argv: [], log: s.log, lancer: (o) => { recu = o; return 0; } });
    expect(code).toBe(0);
    expect(recu.fichiers).toEqual(['src/lib/toast.ts', 'scripts/ci-toutes-les-gardes.guard.test.mjs']);
    expect(recu.plafond).toBe(PLAFOND);
    expect(s.l.join('\n')).toMatch(/2 fichier\(s\) modifié\(s\) depuis origin\/main/);
  });

  it('rend le code de sortie du lanceur (1 rouge, 2 plafond dépassé)', async () => {
    expect(await run({ ...base, argv: [], lancer: () => 1 })).toBe(1);
    expect(await run({ ...base, argv: [], lancer: () => 2 })).toBe(2);
  });

  it('--tout lève le plafond', async () => {
    let recu;
    await run({ ...base, argv: ['--tout'], lancer: (o) => { recu = o; return 0; } });
    expect(recu.plafond).toBe(0);
  });

  it('TÉMOIN plafond : au-delà, un refus qui dit NON JOUÉS ; en deçà ou sans plafond, rien', () => {
    expect(refusPlafond(PLAFOND + 1, PLAFOND)).toMatch(/NON JOUÉS.*npm run pousser/);
    expect(refusPlafond(PLAFOND, PLAFOND)).toBe('');
    expect(refusPlafond(505, 0)).toBe('');
  });

  it('--rapide : ESLint sur les sources modifiées, puis la sélection et les gardes UI', async () => {
    let lintes;
    let recu;
    const code = await run({ ...base, argv: ['--rapide'], linter: (f) => { lintes = f; return 0; }, lancer: (o) => { recu = o; return 0; } });
    expect(code).toBe(0);
    expect(lintes).toEqual(['src/lib/toast.ts']);
    expect(recu.fichiers).toEqual(expect.arrayContaining([...GARDES_UI, 'src/lib/toast.ts']));
  });

  it('TÉMOIN --rapide : un ESLint rouge arrête tout, Vitest ne part pas', async () => {
    let lance = false;
    const s = sortie();
    expect(await run({ ...base, argv: ['--rapide'], log: s.log, linter: () => 1, lancer: () => { lance = true; return 0; } })).toBe(1);
    expect(lance).toBe(false);
    expect(s.l.join()).toMatch(/ESLint rouge/);
  });

  it('--liste n’exécute rien (ni lint ni Vitest) ; --base change la référence', async () => {
    let appele = false;
    const vus = [];
    const ex2 = (a) => { vus.push(a.join(' ')); return ex(a); };
    const rien = () => { appele = true; return 0; };
    expect(await run({ ...base, argv: ['--liste', '--rapide', '--base', 'HEAD~1'], executer: ex2, linter: rien, lancer: rien })).toBe(0);
    expect(appele).toBe(false);
    expect(vus[0]).toBe('merge-base HEAD~1 HEAD');
  });

  it('TÉMOIN : une base illisible est une ERREUR, jamais un « rien à tester »', async () => {
    const s = sortie();
    const casse = fauxGit({ 'merge-base': new Error('fatal: Not a valid object name origin/main') });
    expect(await run({ ...base, argv: [], executer: casse, log: s.log, lancer: () => 0 })).toBe(1);
    expect(s.l.join()).toMatch(/illisible/);
    expect(await run({ ...base, argv: ['--base'], lancer: () => 0 })).toBe(1);
  });

  it('aucun fichier modifié, ou aucun test lié : 0, et le dit', async () => {
    const s = sortie();
    const vide = fauxGit({ 'merge-base': 'abc', diff: '', 'ls-files': '' });
    expect(await run({ ...base, argv: [], executer: vide, log: s.log, lancer: () => 1 })).toBe(0);
    expect(s.l.join()).toMatch(/aucun fichier modifié/);
    const s2 = sortie();
    const isole = fauxGit({ 'merge-base': 'abc', diff: 'README.txt\n', 'ls-files': (a) => (a.includes('--others') ? '' : 'src/lib/autre.test.ts\n') });
    expect(await run({ ...base, argv: [], executer: isole, existe: () => true, log: s2.log, lancer: () => 1 })).toBe(0);
    expect(s2.l.join()).toMatch(/aucun test lié/);
  });

  it('avertit quand la configuration de test a bougé', async () => {
    const s = sortie();
    const conf = fauxGit({ 'merge-base': 'abc', diff: 'vitest.config.ts\nsrc/lib/toast.ts\n', 'ls-files': (a) => (a.includes('--others') ? '' : 'src/lib/toast.test.ts\n') });
    await run({ ...base, argv: ['--liste'], executer: conf, existe: () => true, log: s.log, lancer: () => 0 });
    expect(s.l.join()).toMatch(/configuration modifiée \(vitest\.config\.ts\)/);
  });

  // C-47 : `maxWorkers: 2` est fixé dans vitest.config.ts ; l'écraser sature la machine.
  it('TÉMOIN : ni le script ni les commandes npm ne passent --maxWorkers', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/test-changed.mjs'), 'utf8');
    expect(script).not.toMatch(/--max-?workers|maxWorkers:|maxWorkers\s*=/i);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['test:changed']).toBe('node scripts/test-changed.mjs');
    expect(pkg.scripts['verif:rapide']).toBe('node scripts/test-changed.mjs --rapide');
  });
});
