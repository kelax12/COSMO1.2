// pre-push · refuse de pousser sur `main` quand le dernier run `CI noyau` de `main` est rouge.
//
// Vague 2.3 (2026-11-06) : le hook ne lit plus QUE le noyau (`ci-noyau.yml`), le seul
// workflow qui juge le commit et lui seul. `CI etendue` (e2e, Lighthouse, audit), `Visual`,
// `Mutation`, `Sabotages` et les gardes de calendrier ne bloquent rien.
//
// Pourquoi (2026-10-20) : 23 commits de code poussés sur un `main` rouge pendant 26 h.
// Tant que `main` est rouge, aucune garde ne voit la régression suivante.
//
// 🔴 AUCUN CONTOURNEMENT. Il n'existait qu'une variable d'environnement pour forcer la
// poussée ; banalisée (CI-01), elle est retirée. Ce script ne lit AUCUNE variable
// d'environnement (témoin : `pre-push-main-red.test.mjs`).
//
// Le seul chemin pour réparer un noyau rouge : pousser le correctif sur une branche
// `noyau/<nom>` (le noyau y tourne), attendre son verdict VERT, puis pousser CE MÊME SHA
// sur `main`. Le hook laisse passer un commit dont `CI noyau` a déjà rendu un verdict vert,
// et seulement lui : ce n'est pas pousser du rouge, c'est pousser un commit jugé.
//
// - Ne regarde QUE les poussées vers `refs/heads/main`.
// - `gh` absent, hors ligne ou non authentifié : REFUSE en le disant. Un état illisible
//   n'est pas un état vert ; sans réseau, la poussée échouerait de toute façon.
//
// Installé par `git config core.hooksPath .githooks` (cf. scripts/CLAUDE.md).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RED = new Set(['failure', 'timed_out', 'startup_failure']);

/** Le seul workflow dont un rouge sur `main` bloque la poussée. */
export const WORKFLOW = 'CI noyau';

/** Branche de réparation : le noyau y tourne sur `push` (cf. `ci-noyau.yml`). */
export const BRANCHE_REPARATION = 'noyau/<nom>';

/**
 * Les SHA poussés vers `main`, lus dans le stdin d'un hook pre-push :
 * `<ref locale> <sha locale> <ref distante> <sha distante>`. Une suppression (sha nul) n'en
 * pousse aucun.
 */
export function shasVersMain(stdin) {
  return stdin
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length >= 4 && p[2] === 'refs/heads/main' && !/^0+$/.test(p[1]))
    .map((p) => p[1]);
}

/**
 * @param {{
 *   runs: Array<{status: string, conclusion: string|null, headSha?: string, url?: string}>|null,
 *   verdictsDuSha?: Record<string, Array<{status: string, conclusion: string|null, url?: string}>|null>,
 *   shas: string[],
 * }} input
 *   `runs` : runs `CI noyau` de `main`, du plus récent au plus ancien ; `null` = illisible.
 *   `verdictsDuSha` : pour chaque SHA poussé, ses runs `CI noyau` (toutes branches).
 * @returns {{ block: boolean, message: string }}
 */
export function decide({ runs, verdictsDuSha = {}, shas }) {
  if (shas.length === 0) return { block: false, message: '' };
  if (runs === null) {
    return {
      block: true,
      message: [
        `pre-push : REFUSÉ, état de ${WORKFLOW} sur main illisible (gh absent, hors ligne ou non authentifié).`,
        'Un état illisible n\'est pas un état vert. Vérifier : gh auth status',
      ].join('\n'),
    };
  }
  const last = runs.find((r) => r.status === 'completed');
  if (!last || !RED.has(last.conclusion ?? '')) return { block: false, message: '' };

  const where = `${(last.headSha ?? '').slice(0, 8)} ${last.url ?? ''}`.trim();
  const nonJuges = shas.filter((sha) => {
    const verdicts = verdictsDuSha[sha];
    return !verdicts?.some((r) => r.status === 'completed' && r.conclusion === 'success');
  });
  if (nonJuges.length === 0) {
    return {
      block: false,
      message: `pre-push : main est ROUGE (${WORKFLOW}, ${where}), mais ${shas.map((s) => s.slice(0, 8)).join(', ')} a déjà un verdict ${WORKFLOW} VERT : poussée autorisée.`,
    };
  }
  return {
    block: true,
    message: [
      `pre-push : REFUSÉ, le dernier run ${WORKFLOW} de main est rouge (${last.conclusion}, ${where}).`,
      'Pousser par-dessus du rouge cache la régression suivante. Il n\'existe aucun contournement.',
      `Pour réparer : pousser le correctif sur une branche ${BRANCHE_REPARATION}`,
      '  git push origin HEAD:refs/heads/noyau/<nom>',
      `puis, une fois son ${WORKFLOW} vert, pousser ce même SHA sur main (et supprimer la branche).`,
      `SHA sans verdict vert : ${nonJuges.map((s) => s.slice(0, 8)).join(', ')}`,
    ].join('\n'),
  };
}

/** Lit les runs `CI noyau` par `gh` ; `null` si la lecture échoue. */
export function lireRuns(filtre, executer = execFileSync) {
  try {
    const out = executer(
      'gh',
      ['run', 'list', '--workflow', WORKFLOW, ...filtre, '--limit', '10', '--json', 'status,conclusion,headSha,url'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20_000 },
    );
    const runs = JSON.parse(out);
    return Array.isArray(runs) ? runs : null;
  } catch {
    return null;
  }
}

/**
 * Point d'entrée, sans effet de bord : renvoie le code de sortie.
 * ⚠️ Pas de paramètre `env` : rien ne doit pouvoir changer la décision hors de l'état du noyau.
 */
export function main({ stdin, lire = lireRuns, log = console.error }) {
  const shas = shasVersMain(stdin);
  if (shas.length === 0) return 0;
  const runs = lire(['--branch', 'main']);
  const verdictsDuSha = {};
  const last = runs?.find((r) => r.status === 'completed');
  if (last && RED.has(last.conclusion ?? '')) {
    for (const sha of shas) verdictsDuSha[sha] = lire(['--commit', sha]);
  }
  const { block, message } = decide({ runs, verdictsDuSha, shas });
  if (message) log(message);
  return block ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let stdin = '';
  try {
    stdin = readFileSync(0, 'utf8');
  } catch {
    stdin = '';
  }
  process.exit(main({ stdin }));
}
