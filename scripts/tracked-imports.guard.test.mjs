// ═══════════════════════════════════════════════════════════════════
// tracked-imports.guard.test.mjs — aucun fichier COMMITÉ n'importe un module
// que git ne suit pas
//
// 🔴 POURQUOI CE FICHIER EXISTE (2026-09-12)
//
// La CI est tombée sur :
//
//   src/components/organization/TeamTaskModal.tsx(4,23): error TS2307:
//   Cannot find module '@/lib/toast'
//
// et c'est une classe de défaut que **rien de local ne peut voir**. Cet arbre
// porte, depuis la veille, le travail NON COMMITÉ d'une session voisine — dont
// `src/lib/toast.ts`, présent sur le disque et absent du dépôt. En indexant un
// fichier pour un tout autre correctif, sa ligne d'import est partie avec.
//
// `npm run typecheck`, `npm run lint`, `npm test` et le serveur de dev sont
// tous **verts** dans cette situation : ils lisent le DISQUE. Seule la CI, qui
// part d'un clone, voit le trou — et elle le voit après coup, sur un push.
//
// C'est la forme la plus coûteuse du défaut décrit dans `CLAUDE.md` sous « une
// garde se vérifie sur ce qu'elle REGARDE » : ici les gardes regardaient un
// arbre qui n'est pas celui qu'on livre.
//
// ⚠️ Ce test lit `HEAD`, pas le disque. C'est tout son intérêt, et c'est aussi
// sa limite : il ne dit rien d'un import ajouté et pas encore committé.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Suffixes qu'un `import '@/x'` peut résoudre. */
const RESOLUTIONS = ['', '.ts', '.tsx', '.js', '.json', '.css', '/index.ts', '/index.tsx'];

/** Les imports `@/...` d'un contenu, dédupliqués. */
function aliasImports(body) {
  return [
    ...new Set(
      [...body.matchAll(/from\s+['"]@\/([^'"]+)['"]/g)].map((m) => m[1]),
    ),
  ];
}

describe('aucun import `@/` de l arbre COMMITÉ ne pointe hors du dépôt', () => {
  const tracked = new Set(git('ls-files').split('\n').filter(Boolean));
  const sources = [...tracked].filter((f) => /^src\/.*\.tsx?$/.test(f));

  // 🔴 TÉMOIN. Sans lui, un `ls-files` qui rendrait une liste vide ferait
  // passer la garde sur ZÉRO fichier examiné — le motif exact des quatre
  // gardes prises en défaut le 2026-09-03.
  it('lit bien un arbre non vide', () => {
    expect(tracked.size).toBeGreaterThan(100);
    expect(sources.length).toBeGreaterThan(100);
  });

  it('chaque module importé est suivi par git', () => {
    // 🔴 UN SEUL appel à git, et pas un `git show` par fichier : la première
    // version en lançait 600, chacun un processus, et le test mourait sur le
    // `testTimeout` de 20 s (mesuré : 124 s). Une garde trop lente finit par
    // être désarmée ; celle-ci rend en moins d'une seconde.
    const lines = git('grep', '-I', '-E', "from ['\"]@/", 'HEAD', '--', 'src')
      .split('\n')
      .filter(Boolean);
    const missing = [];
    for (const line of lines) {
      // `HEAD:chemin:contenu` — le contenu peut contenir des « : », pas le chemin.
      const cut = line.indexOf(':', 'HEAD:'.length);
      const file = line.slice('HEAD:'.length, cut);
      if (!/\.tsx?$/.test(file)) continue;
      for (const spec of aliasImports(line.slice(cut + 1))) {
        const base = `src/${spec}`;
        if (RESOLUTIONS.some((ext) => tracked.has(base + ext))) continue;
        missing.push(`${file} → @/${spec}`);
      }
    }
    expect(
      missing,
      'Un fichier committé importe un module ABSENT du dépôt. Le typecheck '
        + 'local ne peut pas le voir : le fichier existe sur le disque, il '
        + 'n est simplement pas suivi. Soit le module doit être committé, soit '
        + 'l import ne devait pas l être.',
    ).toEqual([]);
  });

  // Le détecteur lui-même doit être éprouvé : une regex qui ne matcherait plus
  // rien rendrait `missing` vide quoi qu'il arrive.
  it('le détecteur voit un import, et sait qu un module absent est absent', () => {
    expect(aliasImports("import { a } from '@/lib/toast';")).toEqual(['lib/toast']);
    expect(aliasImports("import { a } from './voisin';")).toEqual([]);
    expect(RESOLUTIONS.some((e) => tracked.has('src/lib/__absent_du_depot__' + e))).toBe(false);
  });
});
