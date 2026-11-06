// test:changed · Vitest sur les seuls tests liés au diff contre `origin/main` (DEV-01, vague 2.4, 2026-11-06)
//
// 🔴 POURQUOI. La suite complète prend 54 min sur le poste de dev (4 cœurs, 8 Go) : on ne la
// lance pas, donc on pousse sans avoir rien joué. La boucle locale joue ce que le diff touche ;
// le noyau CI (`ci-noyau.yml`, ~5 min) joue tout, et c'est lui qui juge.
//
// Ce qui est sélectionné, à partir des fichiers modifiés depuis la base de fusion avec
// `origin/main` (commits locaux + arbre de travail + fichiers non suivis) :
//   1. les sources JS/TS modifiées sont passées à `vitest related` : Vitest joue tout test qui
//      les importe, directement ou non (graphe de modules), et les tests modifiés eux-mêmes ;
//   2. tout test qui NOMME un fichier modifié (chemin complet, ou nom de fichier pour ce qui
//      n'est pas du code : workflow, `.md`, `.sql`, hook…) : beaucoup de gardes lisent un
//      fichier par `readFileSync`, invisible au graphe d'imports.
//
// ⚠️ `maxWorkers` reste celui de `vitest.config.ts` (C-47) : ce script ne passe AUCUNE option
// de parallélisme à Vitest (témoin : `test-changed.test.mjs`).
// ⚠️ Lockfile, `vitest.config.ts` ou `src/test/setup.ts` modifiés : tout test peut en
// dépendre. Le script le dit et conseille `npm test` ; il joue quand même sa sélection.
//
// Usage : `npm run test:changed` · `npm run test:changed -- --base <ref>` · `--liste` (n'exécute pas).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const TEST = /\.(?:test|spec)\.(?:tsx?|mjs)$/;
/** Les dossiers que `vitest.config.ts` ramasse (`include`), moins ce qu'il exclut. */
const RACINES_TESTS = ['src/', 'scripts/', 'eslint-rules/', 'api/'];
const HORS_VITEST = ['src/__test__/', 'e2e/'];
/** Un changement ici peut toucher n'importe quel test. */
export const CONFIGURATION = ['package-lock.json', 'vitest.config.ts', 'src/test/setup.ts'];

/** Les fichiers de test que Vitest ramasse, parmi les fichiers suivis. */
export function fichiersDeTest(suivis) {
  return suivis.filter(
    (f) => TEST.test(f) && RACINES_TESTS.some((r) => f.startsWith(r)) && !HORS_VITEST.some((r) => f.startsWith(r)),
  );
}

/**
 * @param {{ changes: string[], tests: string[], lire: (f: string) => string }} input
 *   `changes` : chemins relatifs, `/`, fichiers modifiés qui existent encore.
 *   `tests` : fichiers de test candidats. `lire` : contenu d'un fichier.
 * @returns {{ related: string[], parTexte: string[], configuration: string[] }}
 */
export function selectionner({ changes, tests, lire }) {
  const related = changes.filter((f) => SOURCE.test(f));
  const configuration = changes.filter((f) => CONFIGURATION.includes(f));
  const parTexte = new Set();
  for (const t of tests) {
    if (related.includes(t)) continue;
    let contenu;
    try {
      contenu = lire(t);
    } catch {
      continue;
    }
    for (const f of changes) {
      if (f === t) continue;
      // Le nom seul pour ce qui n'est pas du code (`ci.yml`, `TESTING.md`) ; pour une source,
      // le chemin complet, sinon `index.ts` ou `hooks.ts` désigneraient la moitié du dépôt.
      const nom = basename(f);
      if (contenu.includes(f) || (!SOURCE.test(f) && nom.length >= 5 && contenu.includes(nom))) {
        parTexte.add(t);
        break;
      }
    }
  }
  return { related, parTexte: [...parTexte].sort(), configuration };
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const lignes = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** Les fichiers modifiés depuis la base de fusion avec `base` (commits, arbre, non suivis). */
export function lireChangements(base, executer = git) {
  const mb = executer(['merge-base', base, 'HEAD']).trim();
  const modifies = lignes(executer(['diff', '--name-only', '--diff-filter=d', mb]));
  const nouveaux = lignes(executer(['ls-files', '--others', '--exclude-standard']));
  return [...new Set([...modifies, ...nouveaux])].sort();
}

export function run({ argv, executer = git, lire = (f) => readFileSync(f, 'utf8'), existe = existsSync, log = console.log, lancer }) {
  const iBase = argv.indexOf('--base');
  const base = iBase >= 0 ? argv[iBase + 1] : 'origin/main';
  if (!base) {
    log('test:changed · --base sans valeur');
    return 1;
  }
  let changes;
  try {
    changes = lireChangements(base, executer).filter((f) => existe(f));
  } catch (e) {
    // Pas de repli silencieux sur « rien à tester » : une base illisible est une erreur.
    log(`test:changed · base « ${base} » illisible (git fetch origin ?) : ${String(e.message ?? e).split('\n')[0]}`);
    return 1;
  }
  if (changes.length === 0) {
    log(`test:changed · aucun fichier modifié depuis ${base} : rien à jouer.`);
    return 0;
  }
  const tests = fichiersDeTest(lignes(executer(['ls-files'])));
  const { related, parTexte, configuration } = selectionner({ changes, tests, lire });
  log(`test:changed · ${changes.length} fichier(s) modifié(s) depuis ${base}`);
  log(`  sources passées à vitest related : ${related.length}`);
  log(`  tests qui nomment un fichier modifié : ${parTexte.length}${parTexte.length ? `\n    ${parTexte.join('\n    ')}` : ''}`);
  if (configuration.length) {
    log(`  ⚠️ configuration modifiée (${configuration.join(', ')}) : tout test peut en dépendre, npm test conseillé.`);
  }
  const fichiers = [...related, ...parTexte];
  if (fichiers.length === 0) {
    log('test:changed · aucun test lié au diff.');
    return 0;
  }
  if (argv.includes('--liste')) return 0;
  return lancer(['related', '--run', '--passWithNoTests', ...fichiers]);
}

function lancerVitest(args) {
  const require = createRequire(import.meta.url);
  // `process.execPath` + le .mjs de Vitest : `spawnSync('npx.cmd')` rend EINVAL sous Windows.
  const bin = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
  const r = spawnSync(process.execPath, [bin, ...args], { stdio: 'inherit' });
  return r.status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(run({ argv: process.argv.slice(2), lancer: lancerVitest }));
}
