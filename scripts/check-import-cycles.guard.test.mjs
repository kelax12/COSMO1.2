// ═══════════════════════════════════════════════════════════════════
// TÉMOIN — le détecteur de cycles d'imports (C-103)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 Ce détecteur est de la famille la plus dangereuse : un résolveur cassé
// construit un graphe VIDE, et un graphe vide n'a aucun cycle. La garde
// afficherait « ✓ aucun cycle » en n'ayant rien regardé. C'est pour ça que le
// script refuse de conclure sous 100 modules et 200 arêtes — et c'est ce
// refus, autant que la détection, que ce témoin vérifie.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import {
  importsStatiques,
  resoudre,
  trouverCycles,
  construireGraphe,
  listerModules,
} from './check-import-cycles.mjs';

const GARDE = join(process.cwd(), 'scripts', 'check-import-cycles.mjs');
const LF = String.fromCharCode(10);

describe('témoin — cycles d imports (C-103)', () => {
  it('`importsStatiques` voit les imports de VALEUR', () => {
    const src = [
      "import { a } from './a';",
      "import b from '@/lib/b';",
      "export { c } from './c';",
      "import './effet-de-bord';",
    ].join(LF);
    expect(importsStatiques(src)).toEqual(['./a', '@/lib/b', './c', './effet-de-bord']);
  });

  it('`importsStatiques` IGNORE les types et les imports dynamiques', () => {
    // 🔴 Les deux exclusions sont des décisions, pas des trous :
    //   · `import type` est effacé à la compilation — aucune arête
    //     d'exécution, donc aucun cycle d'évaluation possible ;
    //   · `import()` est différé — c'est même la façon de CASSER un cycle
    //     (la façade `@/lib/toast` en est l'exemple du dépôt).
    // Les compter ferait rougir la garde sur des constructions correctes,
    // et une garde qui refuse la bonne réponse finit désarmée.
    const src = [
      "import type { T } from './t';",
      "const m = await import('./dyn');",
      "import { reel } from './reel';",
    ].join(LF);
    expect(importsStatiques(src)).toEqual(['./reel']);
  });

  it('`importsStatiques` ne lit pas les commentaires', () => {
    const src = [
      "// import { faux } from './faux';",
      '/* import { autre } from "./autre"; */',
      "import { vrai } from './vrai';",
    ].join(LF);
    expect(importsStatiques(src)).toEqual(['./vrai']);
  });

  it('`resoudre` gere `@/`, le relatif, les extensions et les index', () => {
    const racine = mkdtempSync(join(tmpdir(), 'c103r-'));
    try {
      mkdirSync(join(racine, 'src', 'lib'), { recursive: true });
      mkdirSync(join(racine, 'src', 'mod'), { recursive: true });
      writeFileSync(join(racine, 'src', 'lib', 'a.ts'), '');
      writeFileSync(join(racine, 'src', 'mod', 'index.ts'), '');
      const depuis = join(racine, 'src', 'x.ts');

      expect(resoudre('@/lib/a', depuis, racine)).toBe(join(racine, 'src', 'lib', 'a.ts'));
      expect(resoudre('@/mod', depuis, racine)).toBe(join(racine, 'src', 'mod', 'index.ts'));
      expect(resoudre('./lib/a', depuis, racine)).toBe(join(racine, 'src', 'lib', 'a.ts'));
      // Un paquet npm n'est pas dans le graphe interne.
      expect(resoudre('react', depuis, racine)).toBeNull();
      // Un chemin interne introuvable rend `null` — et le script COMPTE ces
      // cas, parce qu'un résolveur qui échoue partout rendrait « 0 cycle ».
      expect(resoudre('@/rien-du-tout', depuis, racine)).toBeNull();
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('`trouverCycles` voit un cycle, et n en invente pas', () => {
    const acyclique = new Map([
      ['a', ['b', 'c']],
      ['b', ['c']],
      ['c', []],
    ]);
    expect(trouverCycles(acyclique)).toEqual([]);

    const cyclique = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', ['a']],
    ]);
    const cycles = trouverCycles(cyclique);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual(['a', 'b', 'c', 'a']);

    // Une boucle sur soi-même est un cycle.
    expect(trouverCycles(new Map([['a', ['a']]]))).toHaveLength(1);
  });

  it('un cycle pose A BLANC dans un arbre jetable EST vu', () => {
    // Le détecteur soumis au défaut, bout en bout : graphe construit depuis
    // de vrais fichiers, pas depuis une Map écrite à la main.
    const racine = mkdtempSync(join(tmpdir(), 'c103c-'));
    try {
      const src = join(racine, 'src');
      mkdirSync(src, { recursive: true });
      writeFileSync(join(src, 'a.ts'), "import { b } from './b';\nexport const a = b;\n");
      writeFileSync(join(src, 'b.ts'), "import { a } from './a';\nexport const b = a;\n");
      const { graphe, nonResolus } = construireGraphe(racine);
      expect(nonResolus).toBe(0);
      expect(trouverCycles(graphe)).toHaveLength(1);

      // …et le MÊME arbre, le cycle coupé par un `import type`, n'en a plus.
      writeFileSync(join(src, 'b.ts'), "import type { A } from './a';\nexport const b: A | null = null;\n");
      expect(trouverCycles(construireGraphe(racine).graphe)).toEqual([]);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('`listerModules` ecarte les tests et les declarations', () => {
    const racine = mkdtempSync(join(tmpdir(), 'c103l-'));
    try {
      const src = join(racine, 'src');
      mkdirSync(src, { recursive: true });
      for (const n of ['a.ts', 'a.test.ts', 'b.spec.tsx', 'c.d.ts', 'd.tsx']) {
        writeFileSync(join(src, n), '');
      }
      const vus = listerModules(src).map((p) => p.split(/[\\/]/).pop());
      expect(vus.sort()).toEqual(['a.ts', 'd.tsx']);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('la garde REFUSE de conclure sur un graphe minuscule', () => {
    // 🔴 Le contrôle qui compte. Deux fichiers, aucun cycle : la bonne
    // réponse n'est pas « ✓ aucun cycle », c'est « ce graphe ne décrit rien ».
    const racine = mkdtempSync(join(tmpdir(), 'c103m-'));
    try {
      mkdirSync(join(racine, 'src'), { recursive: true });
      writeFileSync(join(racine, 'src', 'a.ts'), 'export const a = 1;\n');
      writeFileSync(join(racine, 'src', 'b.ts'), "import { a } from './a';\nexport const b = a;\n");
      const r = spawnSync(process.execPath, [GARDE], {
        cwd: racine,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      expect(r.status).toBe(1);
      expect(sortie).toContain('parcours de src/ est cassé');
      expect(sortie).not.toContain('Aucun cycle');
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('le VRAI depot n a aucun cycle, et son graphe est consequent', () => {
    // La mesure du jour, pour que ce fichier dise aussi ce qui est vrai
    // aujourd'hui : 660 modules, ~2 400 arêtes, 0 non résolu, 0 cycle.
    const { graphe, aretes, nonResolus, modules } = construireGraphe(process.cwd());
    expect(modules.length).toBeGreaterThan(400);
    expect(aretes).toBeGreaterThan(1500);
    expect(nonResolus).toBe(0);
    expect(trouverCycles(graphe)).toEqual([]);
  });
});
