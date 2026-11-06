// pre-push · refuse de pousser sur `main` quand le dernier run `CI` ou `CI noyau` de `main` est rouge.
//
// `CI noyau` (2026-11-06, CI-03) porte lint, typecheck et tests unitaires, sortis de `CI` :
// sans lui, un lint rouge sur `main` ne bloquerait plus rien. Les gardes de calendrier
// (`gardes-calendrier.yml`) ne sont PAS lues ici : elles ne jugent pas un commit.
//
// Pourquoi (2026-10-20) : 23 commits de code poussés sur un `main` rouge pendant 26 h,
// l'alerte Discord partie à chaque run. Tant que `main` est rouge, aucune garde ne voit
// la régression suivante : elle se noie dans le rouge déjà là.
//
// - Ne regarde QUE les poussées vers `refs/heads/main` : une branche de correctif ou une
//   PR reste toujours poussable, c'est le chemin normal pour remettre `main` au vert.
// - Contournement VOLONTAIRE, pour le commit qui répare : `COSMO_PUSH_ON_RED=1 git push`.
// - `gh` absent, hors ligne ou non authentifié : avertit et LAISSE PASSER. Un hook qui
//   bloque faute de réseau apprend à le contourner par réflexe.
//
// Installé par `git config core.hooksPath .githooks` (cf. scripts/CLAUDE.md).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RED = new Set(['failure', 'timed_out', 'startup_failure']);

/** Les workflows dont un rouge sur `main` bloque la poussée. */
export const WORKFLOWS = ['CI', 'CI noyau'];

/** Les lignes de stdin d'un hook pre-push : `<ref locale> <sha> <ref distante> <sha>`. */
export function pushesToMain(stdin) {
  return stdin
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .some((parts) => parts.length >= 4 && parts[2] === 'refs/heads/main');
}

/**
 * @param {{ runs: Array<{status: string, conclusion: string|null, headSha?: string, url?: string}>|null, override: boolean, toMain: boolean }} input
 *   `runs` du plus récent au plus ancien ; `null` = lecture impossible.
 * @returns {{ block: boolean, message: string }}
 */
export function decide({ runs, override, toMain, workflow = 'CI' }) {
  if (!toMain) return { block: false, message: '' };
  if (runs === null) {
    return { block: false, message: `pre-push : état de ${workflow} sur main illisible (gh), poussée autorisée sans vérification.` };
  }
  const last = runs.find((r) => r.status === 'completed');
  if (!last || !RED.has(last.conclusion ?? '')) return { block: false, message: '' };
  const where = `${(last.headSha ?? '').slice(0, 8)} ${last.url ?? ''}`.trim();
  if (override) {
    return { block: false, message: `pre-push : main est ROUGE (${workflow}, ${where}), poussée forcée par COSMO_PUSH_ON_RED=1.` };
  }
  return {
    block: true,
    message: [
      `pre-push : REFUSÉ, le dernier run ${workflow} de main est rouge (${last.conclusion}, ${where}).`,
      'Pousser par-dessus du rouge cache la régression suivante.',
      'Réparer d\'abord ; pour le commit qui répare : COSMO_PUSH_ON_RED=1 git push',
    ].join('\n'),
  };
}

function readRuns(workflow) {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', '--branch', 'main', '--workflow', workflow, '--limit', '5', '--json', 'status,conclusion,headSha,url'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20_000 },
    );
    return JSON.parse(out);
  } catch {
    return null;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let stdin = '';
  try {
    stdin = readFileSync(0, 'utf8');
  } catch {
    stdin = '';
  }
  const toMain = pushesToMain(stdin);
  let bloque = false;
  for (const workflow of WORKFLOWS) {
    const { block, message } = decide({
      runs: toMain ? readRuns(workflow) : [],
      override: process.env.COSMO_PUSH_ON_RED === '1',
      toMain,
      workflow,
    });
    if (message) console.error(message);
    bloque ||= block;
  }
  process.exit(bloque ? 1 : 0);
}
