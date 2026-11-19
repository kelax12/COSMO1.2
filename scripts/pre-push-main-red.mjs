// pre-push · refuse de pousser sur `main` quand le dernier run `CI noyau` de `main` est rouge ;
// `--pousser` : la poussée d'une session (`npm run pousser`, ADR 0022), en bas du fichier.
//
// - Seul le noyau (`ci-noyau.yml`) juge ; les autres workflows ne bloquent rien. Tant que `main`
//   est rouge, aucune garde ne voit la régression suivante.
// - 🔴 AUCUN CONTOURNEMENT : ce script ne lit AUCUNE variable d'environnement (témoin
//   `pre-push-main-red.test.mjs`).
// - Passe un commit dont `CI noyau` a déjà rendu un verdict VERT (branche `noyau/<nom>`), et lui
//   seul : c'est pousser un commit jugé, pas du rouge.
// - Ne regarde QUE `refs/heads/main`. `gh` absent, hors ligne ou non authentifié : REFUSE.
// Installé par `git config core.hooksPath .githooks` (cf. scripts/CLAUDE.md).
import { execFileSync, spawnSync } from 'node:child_process';
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

// ── `npm run pousser` (ADR 0022) : le noyau juge le commit sur `noyau/<session>-<sha>`, puis ce
// SHA part sur `main`. Rien de lourd ne tourne sur le poste pendant l'attente.

/** La branche de vérification d'un commit : `noyau/<branche locale>-<sha court>`. */
export function brancheDeVerif(branche, sha) {
  const nom = branche.replace(/^worktree-/, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '') || 'session';
  return `noyau/${nom}-${sha.slice(0, 8)}`;
}

const EN_COURS = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);

/** Attend que `trouver()` rende un run terminé ; `null` au bout de `limite` ms. */
async function attendreRun(trouver, attendre, delai, limite) {
  for (let t = 0; t <= limite; t += delai) {
    const run = trouver();
    if (run?.status === 'completed') return run;
    await attendre(delai);
  }
  return null;
}

/** `git(args, voir)` → {code, out} ; `runs(filtre)` = `lireRuns` ; `attendre(ms)` → Promise. */
export async function pousser({ git, runs, attendre, log, delai = 20_000, limite = 40 * 60_000 }) {
  const ok = (args, voir) => git(args, voir).code === 0;
  const rebaser = () => ok(['fetch', 'origin']) && ok(['rebase', 'origin/main'], true);
  if (!rebaser()) return (log('pousser · fetch ou rebase en échec : régler à la main.'), 1);
  if (ok(['merge-base', '--is-ancestor', 'HEAD', 'origin/main'])) return (log('pousser · rien de neuf face à origin/main.'), 0);
  const sha = git(['rev-parse', 'HEAD']).out.trim();
  const branche = brancheDeVerif(git(['rev-parse', '--abbrev-ref', 'HEAD']).out.trim(), sha);
  if (!ok(['push', 'origin', `HEAD:refs/heads/${branche}`], true)) return 1;
  log(`pousser · ${WORKFLOW} juge ${sha.slice(0, 8)} sur ${branche} (4 à 7 min, rien ne tourne ici).`);
  const run = await attendreRun(() => (runs(['--branch', branche]) ?? []).find((r) => r.headSha === sha), attendre, delai, limite);
  git(['push', 'origin', '--delete', branche]);
  if (run?.conclusion !== 'success') {
    log(`pousser · ${WORKFLOW} ${run ? run.conclusion : 'sans verdict'} ${run?.url ?? ''} : rien n'est parti sur main.`);
    return 1;
  }
  for (let essai = 0; essai < 3; essai += 1) {
    // `garde-noyau-en-cours.sh` refuse une poussée pendant un run de main : attendre sa fin.
    await attendreRun(() => ((runs(['--branch', 'main']) ?? []).some((r) => EN_COURS.has(r.status)) ? null : { status: 'completed' }), attendre, delai, limite);
    if (ok(['push', 'origin', 'HEAD:main'], true)) return (log(`pousser · ${sha.slice(0, 8)} jugé vert, poussé sur main.`), 0);
    if (!rebaser()) break;
    log('pousser · main a bougé : commit rebasé, le noyau de main le rejugera.');
  }
  log('pousser · poussée sur main refusée : lire le message du hook.');
  return 1;
}

const lance = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (lance && process.argv.includes('--pousser')) {
  const git = (args, voir = false) => {
    const r = spawnSync('git', args, { encoding: 'utf8', stdio: voir ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    return { code: r.status ?? 1, out: r.stdout ?? '' };
  };
  process.exit(await pousser({ git, runs: lireRuns, attendre: (ms) => new Promise((r) => setTimeout(r, ms)), log: console.log }));
} else if (lance) {
  let stdin = '';
  try {
    stdin = readFileSync(0, 'utf8');
  } catch {
    stdin = '';
  }
  process.exit(main({ stdin }));
}
