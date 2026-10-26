// pre-push · refuse de pousser sur `main` quand le dernier run `CI` de `main` est rouge.
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
export function decide({ runs, override, toMain }) {
  if (!toMain) return { block: false, message: '' };
  if (runs === null) {
    return { block: false, message: 'pre-push : état de la CI de main illisible (gh), poussée autorisée sans vérification.' };
  }
  const last = runs.find((r) => r.status === 'completed');
  if (!last || !RED.has(last.conclusion ?? '')) return { block: false, message: '' };
  const where = `${(last.headSha ?? '').slice(0, 8)} ${last.url ?? ''}`.trim();
  if (override) {
    return { block: false, message: `pre-push : main est ROUGE (${where}), poussée forcée par COSMO_PUSH_ON_RED=1.` };
  }
  return {
    block: true,
    message: [
      `pre-push : REFUSÉ, le dernier run CI de main est rouge (${last.conclusion}, ${where}).`,
      'Pousser par-dessus du rouge cache la régression suivante.',
      'Réparer d\'abord ; pour le commit qui répare : COSMO_PUSH_ON_RED=1 git push',
    ].join('\n'),
  };
}

function readRuns() {
  try {
    const out = execFileSync(
      'gh',
      ['run', 'list', '--branch', 'main', '--workflow', 'CI', '--limit', '5', '--json', 'status,conclusion,headSha,url'],
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
  const { block, message } = decide({
    runs: toMain ? readRuns() : [],
    override: process.env.COSMO_PUSH_ON_RED === '1',
    toMain,
  });
  if (message) console.error(message);
  process.exit(block ? 1 : 0);
}
