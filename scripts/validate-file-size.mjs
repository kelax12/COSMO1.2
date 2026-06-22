#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// validate-file-size.mjs — garde CI anti-croissance des god-components.
//
// Dette §9.3 : 11 composants entre 500 et 630 LOC. Les découper est un
// chantier « au fil de l'eau » (risque de régression UI sous faible
// couverture). En attendant, ce garde RATCHETTE la règle historique
// (≤ 1000 lignes, CLAUDE.md §10) à un plafond serré : on verrouille le
// max actuel pour qu'aucun fichier ne GROSSISSE et qu'aucun nouveau
// god-component n'apparaisse. À chaque découpe réussie, baisser CEILING.
//
// Exclusions alignées sur eslint/coverage : `ui/` (shadcn) et `showcase/`
// (markup marketing) ne sont pas du code métier à découper.
//
// Codes de sortie : 1 si un fichier dépasse CEILING, 0 sinon.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Plafond actuel. Max mesuré au 2026-06-22 : 629 (DesktopDetailsStep.tsx).
// Baisser au fil des découpes (#9.3) — ne JAMAIS remonter.
const CEILING = 650;
const ROOT = 'src';
const EXT = /\.(ts|tsx)$/;
// Répertoires exclus (chemins POSIX, comparés en `includes`).
const EXCLUDE_DIRS = [
  'src/components/ui',
  'src/components/showcase',
];
const EXCLUDE_FILE = /\.(test|spec)\.(ts|tsx)$/;

/** @returns {string[]} chemins POSIX de tous les fichiers source pertinents */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry).split('\\').join('/');
    if (EXCLUDE_DIRS.some((d) => full.startsWith(d))) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (EXT.test(full) && !EXCLUDE_FILE.test(full)) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n').length;
  if (lines > CEILING) offenders.push({ file, lines });
}

if (offenders.length > 0) {
  offenders.sort((a, b) => b.lines - a.lines);
  console.error(`✖ ${offenders.length} fichier(s) dépassent le plafond de ${CEILING} lignes :`);
  for (const o of offenders) console.error(`  ${o.lines}  ${o.file}`);
  console.error('\nDécouper le(s) fichier(s) (pattern hook-contrôleur, cf. CLAUDE.md) ');
  console.error('ou, si justifié, ajuster CEILING dans scripts/validate-file-size.mjs.');
  process.exit(1);
}

console.log(`✓ Tous les fichiers source sont ≤ ${CEILING} lignes.`);
