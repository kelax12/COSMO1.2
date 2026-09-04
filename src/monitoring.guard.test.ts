// ═══════════════════════════════════════════════════════════════════
// GARDE — Sentry n'a QU'UNE porte, et elle est dynamique
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (arbitrage C-13 · C-14 du 2026-09-03).
//
// « Différer Sentry après le premier rendu : 49,3 ko sortent du chemin
// critique. » Différer l'`init()` ne suffisait PAS : onze fichiers du SHELL
// faisaient `import * as Sentry from '@sentry/react'`, et **un seul import
// statique suffit à garder le paquet dans le chunk d'entrée**, quel que soit
// le moment où on l'initialise.
//
// C'est une régression INVISIBLE À LA RELECTURE : le fichier fautif marche
// parfaitement, l'application aussi, et seul `check:bundle` s'en aperçoit —
// à condition qu'on le lise. D'où cette garde, qui échoue en nommant le
// fichier.
//
// ── CE QU'ELLE MESURE ────────────────────────────────────────────────
//
// Deux choses distinctes, et les deux comptent :
//
//   1. Personne n'importe `@sentry/react` hors de `sentry-client.ts` (la
//      réexportation nommée) et de `main.tsx` (en position de TYPE seulement,
//      donc effacé à la compilation).
//   2. `sentry-client.ts` ne réexporte QUE des noms. Un `export *` y
//      rétablirait le namespace opaque que Rollup ne peut pas élaguer —
//      mesuré : le chunk passe alors de 49,3 à 155,9 ko gzip, et comme il est
//      chargé à la première inactivité pour tout visiteur muni d'un DSN, la
//      mise en différé deviendrait un RECUL NET de 106 ko.
//
// ── LE TÉMOIN ────────────────────────────────────────────────────────
//
// Le détecteur est soumis à un échantillon qu'il DOIT voir, et la liste des
// dispenses est vérifiée encore vivante : une exception qui ne couvre plus
// rien finit par en couvrir une vraie.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

/**
 * Une LIAISON statique vers `@sentry/react`.
 *
 * ⚠️ `import` ET `export … from` : un ré-export crée exactement la même
 * dépendance statique, et la première version de cette garde ne cherchait que
 * `import` — elle aurait donc laissé passer un `export * from '@sentry/react'`
 * posé n'importe où, c'est-à-dire le retour du problème par la porte d'à côté.
 * Le motif traverse les lignes : la porte unique écrit sa liste sur sept.
 */
const STATIC_SENTRY_IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]@sentry\/react['"]/;

/**
 * Les deux seuls fichiers autorisés, chacun pour une raison différente.
 *
 * ⚠️ `main.tsx` n'y figure PAS : il ne mentionne `@sentry/react` qu'en
 *    position de TYPE (`typeof import(...)`), ce que le détecteur ne voit pas
 *    — et qui est effacé à la compilation, donc gratuit.
 */
const ALLOWED = new Set([
  // La réexportation nommée. C'est ELLE que `monitoring.ts` charge en `import()`.
  'lib/sentry-client.ts',
]);

/**
 * Le CODE seul, commentaires retirés.
 *
 * ⚠️ Indispensable, et c'est la deuxième fois que ce piège se referme dans ce
 * dépôt : `sentry-client.ts` ÉCRIT « ❌ ne jamais ajouter `export *` » dans son
 * en-tête, pour que personne ne le fasse. Une garde qui lit les commentaires
 * accuse donc le fichier de porter exactement ce contre quoi il prévient.
 */
function codeOnly(source: string): string {
  const noBlocks = source.replace(/[/][*][^]*?[*][/]/g, ' ');
  return noBlocks
    .split(String.fromCharCode(10))
    .map((line) => {
      const at = line.indexOf('//');
      return at === -1 ? line : line.slice(0, at);
    })
    .join(String.fromCharCode(10));
}

function walk(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(rel);
  }
  return out;
}

describe('garde — Sentry reste hors du chemin critique (C-13 · C-14)', () => {
  it('TEMOIN : le detecteur voit un import statique, et epargne un import de type', () => {
    expect(STATIC_SENTRY_IMPORT.test("import * as Sentry from '@sentry/react';")).toBe(true);
    expect(STATIC_SENTRY_IMPORT.test("import { init } from '@sentry/react';")).toBe(true);
    // Un RE-EXPORT cree la meme dependance statique, sur plusieurs lignes.
    expect(STATIC_SENTRY_IMPORT.test(
      ['export {', '  init,', "} from '@sentry/react';"].join('\n'),
    )).toBe(true);
    expect(STATIC_SENTRY_IMPORT.test("export * from '@sentry/react';")).toBe(true);
    // Position de TYPE : effacée à la compilation, donc sans effet sur le bundle.
    expect(STATIC_SENTRY_IMPORT.test("function f(s: typeof import('@sentry/react')) {}")).toBe(false);
    // L'import DYNAMIQUE est précisément ce qu'on veut.
    expect(STATIC_SENTRY_IMPORT.test("const mod = await import('./sentry-client');")).toBe(false);
  });

  it('personne n importe @sentry/react hors de la porte unique', () => {
    const offenders = walk(SRC)
      .map((rel) => rel.split(String.fromCharCode(92)).join('/'))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => STATIC_SENTRY_IMPORT.test(codeOnly(readFileSync(join(SRC, rel), 'utf-8'))));

    expect(
      offenders,
      [
        'Un SEUL import statique suffit a ramener 49 ko dans le chunk d entree,',
        'et ca ne se voit pas a la relecture. Passer par `@/lib/monitoring`,',
        'qui expose captureException / captureMessage / addBreadcrumb / setUser',
        'et tamponne ce qui arrive avant le chargement du SDK.',
      ].join('\n'),
    ).toEqual([]);
  });

  it('TEMOIN : la porte unique existe encore et importe bien Sentry', () => {
    // Si elle cessait de le faire, la garde ci-dessus serait verte en ne
    // protegeant plus rien.
    for (const rel of ALLOWED) {
      expect(STATIC_SENTRY_IMPORT.test(codeOnly(readFileSync(join(SRC, rel), 'utf-8'))), rel).toBe(true);
    }
  });

  it('la porte unique reexporte des NOMS, jamais un namespace', () => {
    // 🔴 `export *` rend le namespace opaque a Rollup : mesure, le chunk passe
    // de 49,3 a 155,9 ko gzip. Charge a l inactivite pour tout le monde, ce
    // serait 106 ko de plus expedies, juste plus tard.
    const src = codeOnly(readFileSync(join(SRC, 'lib/sentry-client.ts'), 'utf-8'));
    expect(src).not.toMatch(/export\s+\*\s+from\s+['"]@sentry\/react['"]/);
    expect(src).toMatch(/export\s*\{[^}]+\}\s*from\s+['"]@sentry\/react['"]/);
  });

  it('le chargement est bien DIFFERE, pas seulement deplace', () => {
    // `monitoring.ts` doit charger en `import()` dynamique. Un import statique
    // ici ramenerait tout le paquet dans l entree sans que rien d autre change.
    const src = codeOnly(readFileSync(join(SRC, 'lib/monitoring.ts'), 'utf-8'));
    expect(src).toMatch(/await import\(['"]\.\/sentry-client['"]\)/);
    expect(STATIC_SENTRY_IMPORT.test(src)).toBe(false);
  });

  it('les filets precoces sont poses AVANT le montage', () => {
    // L angle mort que l arbitrage nomme : les erreurs des premieres
    // millisecondes. `installEarlyHandlers` doit preceder `mount()`.
    const src = readFileSync(join(SRC, 'main.tsx'), 'utf-8');
    const install = src.indexOf('installEarlyHandlers()');
    const mount = src.indexOf('function mount()');
    expect(install).toBeGreaterThan(-1);
    expect(mount).toBeGreaterThan(-1);
    expect(install).toBeLessThan(mount);
  });
});
