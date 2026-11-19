// test:changed · les tests liés au diff contre `origin/main` (DEV-01) ; `--rapide` = boucle locale (ADR 0022)
//
// La suite complète prend 54 min sur le poste (4 cœurs, 8 Go) : elle ne tourne qu'au noyau CI.
// Sélection, depuis la base de fusion (commits locaux, arbre, non suivis) :
//   1. sources JS/TS modifiées → `related` de Vitest (tout test qui les importe, et les tests modifiés) ;
//   2. tout test qui NOMME un fichier modifié (chemin complet, ou nom pour ce qui n'est pas du code) :
//      les gardes qui lisent par `readFileSync` échappent au graphe d'imports.
// 🔴 Plafond : au-delà de PLAFOND fichiers retenus (fichier carrefour : i18n, `utils.ts`), rien ne joue,
//    sortie 2 : le verdict revient au noyau (`npm run pousser`). `--tout` lève le plafond.
// `--rapide` : ESLint en cache sur les fichiers modifiés, puis la sélection + GARDES_UI.
// ⚠️ Aucune option de parallélisme passée à Vitest (C-47, témoin `test-changed.test.mjs`).
// ⚠️ Lockfile, `vitest.config.ts` ou `src/test/setup.ts` modifiés : signalé, `npm test` conseillé.
// Usage : `npm run test:changed [-- --base <ref> | --liste | --tout]` · `npm run verif:rapide`.
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

/** Au-delà, la sélection coûterait plus qu'un verdict du noyau (~6 s par fichier ici, 4 à 7 min au noyau). */
export const PLAFOND = 40;
export const SELECTION_TROP_LARGE = 2;
/** Gardes transverses qu'une retouche d'interface peut rougir sans les importer (~15 s à elles six). */
export const GARDES_UI = ['architecture', 'design-system', 'loading-empty-state', 'keyboard-audit-coverage', 'theme-contrast']
  .map((g) => `src/${g}.guard.test.ts`).concat('src/modules/orphan-hooks.guard.test.ts');

/** Le message de refus quand `n` fichiers retenus dépassent le plafond ; '' sinon (`plafond` 0 = aucun). */
export function refusPlafond(n, plafond) {
  if (!plafond || n <= plafond) return '';
  return `test:changed · ${n} fichiers de test retenus (plafond ${plafond}) : NON JOUÉS ici, le noyau juge (npm run pousser). Forcer : --tout.`;
}

export async function run({ argv, executer = git, lire = (f) => readFileSync(f, 'utf8'), existe = existsSync, log = console.log, lancer, linter }) {
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
  const rapide = argv.includes('--rapide');
  const aLinter = rapide ? changes.filter((f) => SOURCE.test(f)) : [];
  if (aLinter.length && !argv.includes('--liste') && (await linter(aLinter)) !== 0) {
    log('verif:rapide · ESLint rouge : tests non lancés.');
    return 1;
  }
  const fichiers = [...new Set([...related, ...parTexte, ...(rapide ? GARDES_UI.filter((g) => existe(g)) : [])])];
  if (fichiers.length === 0) {
    log('test:changed · aucun test lié au diff.');
    return 0;
  }
  if (argv.includes('--liste')) return 0;
  const code = await lancer({ fichiers, plafond: argv.includes('--tout') ? 0 : PLAFOND, log });
  if (rapide && code === 0) log('verif:rapide · vert. tsc, lint complet et suite complète : le noyau les joue (npm run pousser).');
  return code;
}

/** Vitest en processus : compter la sélection avant de la jouer, sans payer deux démarrages. */
async function lancerVitest({ fichiers, plafond, log }) {
  const { createVitest } = await import('vitest/node');
  const v = await createVitest('test', { related: fichiers, watch: false, run: true, passWithNoTests: true });
  try {
    const specs = await v.getRelevantTestSpecifications();
    const n = new Set(specs.map((s) => s.moduleId)).size;
    log(`  fichiers de test retenus par Vitest : ${n}`);
    const refus = refusPlafond(n, plafond);
    if (refus) return (log(refus), SELECTION_TROP_LARGE);
    if (n === 0) return 0;
    // `start()` et non `runTestSpecifications()` : lui seul initialise les reporters (`onInit`).
    const r = await v.start();
    return r.unhandledErrors.length > 0 || r.testModules.some((m) => !m.ok()) ? 1 : 0;
  } finally {
    await v.close();
  }
}

function lancerEslint(fichiers) {
  // `process.execPath` + le .js d'ESLint : `spawnSync('npx.cmd')` rend EINVAL sous Windows.
  const bin = join(dirname(createRequire(import.meta.url).resolve('eslint/package.json')), 'bin', 'eslint.js');
  const cache = ['--cache', '--cache-strategy', 'content', '--cache-location', '.eslintcache', '--no-warn-ignored'];
  return spawnSync(process.execPath, [bin, ...cache, ...fichiers], { stdio: 'inherit' }).status ?? 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(await run({ argv: process.argv.slice(2), lancer: lancerVitest, linter: lancerEslint }));
}
