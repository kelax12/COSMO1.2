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
import { existsSync, lstatSync, readFileSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
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
// ── PRO-03 · `npm run worktrees:nettoyer` (à sec sans `--appliquer`) : supprimable = fusionnée dans origin/main (ancêtre ou
// `git cherry` sans `+`), propre, de plus de 2 h, ni principale, ni courante, ni verrouillée. 🔴 La junction `node_modules`
// part (`rmdir`) AVANT `git worktree remove`, sinon le contenu du principal est effacé. Jamais `--force`, jamais `branch -D`.
const AGE_MIN = 2 * 3600 * 1000;
const norm = (p) => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));
const lancer = (cwd, args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 26 });
  return { code: r.status ?? 1, out: (r.stdout ?? '').trim() };
};
const lien = (p) => existsSync(p) && lstatSync(p).isSymbolicLink();

/** Les worktrees : le premier est le principal. */
export function lister(racine) {
  return lancer(racine, ['worktree', 'list', '--porcelain']).out.split(/\r?\n\r?\n/).map((b) => {
    const l = b.split(/\r?\n/);
    const v = (k) => l.find((x) => x.startsWith(k + ' '))?.slice(k.length + 1);
    return { chemin: v('worktree'), tete: v('HEAD'), branche: v('branch')?.replace('refs/heads/', ''), verrou: l.some((x) => x.startsWith('locked')) };
  }).filter((w) => w.chemin);
}

/** Raisons de GARDER une worktree ; vide = supprimable. */
export function raisons(w, { principal, courante, maintenant }) {
  const git = (...a) => lancer(w.chemin, a);
  const r = [];
  if (norm(w.chemin) === norm(principal)) r.push('principale');
  if (norm(w.chemin) === norm(courante)) r.push('courante');
  if (w.verrou) r.push('verrouillée');
  if (r.length) return r;
  const fusion = git('merge-base', '--is-ancestor', w.tete, 'origin/main').code === 0
    || (git('cherry', 'origin/main', w.tete).code === 0 && !/^\+/m.test(git('cherry', 'origin/main', w.tete).out));
  if (!fusion) r.push('non fusionnée');
  const sale = git('status', '--porcelain').out.split(/\r?\n/).filter((x) => x && !(lien(join(w.chemin, 'node_modules')) && /node_modules\/?$/.test(x)));
  if (sale.length) r.push('sale');
  const t = Number(git('log', '-1', '--format=%ct').out) * 1000;
  const fichiers = git('ls-files').out.split(/\r?\n/).filter(Boolean);
  const mtime = (f) => { try { return statSync(join(w.chemin, f)).mtimeMs; } catch { return 0; } };
  if (maintenant - t < AGE_MIN || fichiers.some((f) => maintenant - mtime(f) < AGE_MIN)) r.push('récente');
  return r;
}

/** Balaye `.claude/worktrees/` du principal ; `appliquer` supprime les supprimables. */
export function balayer({ cwd, appliquer = false, maintenant = Date.now() }) {
  const tous = lister(cwd);
  const principal = tous[0].chemin;
  const courante = lancer(cwd, ['rev-parse', '--show-toplevel']).out;
  const zone = norm(join(principal, '.claude', 'worktrees')) + sep;
  const nm = join(principal, 'node_modules');
  const bilan = tous.slice(1).filter((w) => (norm(w.chemin) + sep).startsWith(zone)).map((w) => {
    const gardee = raisons(w, { principal, courante, maintenant });
    return { ...w, gardee, fait: false, note: '' };
  });
  for (const w of bilan.filter((x) => appliquer && !x.gardee.length)) {
    const lnk = join(w.chemin, 'node_modules');
    if (lien(lnk)) { try { rmdirSync(lnk); } catch { unlinkSync(lnk); } } // le lien seul, jamais la cible
    if (!existsSync(nm)) throw new Error('node_modules du principal a disparu : arrêt.');
    const rm = lancer(principal, ['worktree', 'remove', w.chemin]);
    w.fait = rm.code === 0;
    if (!w.fait) w.note = rm.out || 'git worktree remove a refusé';
    else if (w.branche) w.note = lancer(principal, ['branch', '-d', w.branche]).code === 0 ? '' : 'branche gardée (-d refuse)';
  }
  if (appliquer && !existsSync(nm)) throw new Error('node_modules du principal a disparu.');
  return bilan;
}
const lance = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (lance && process.argv.includes('--worktrees')) {
  const [court, appliquer] = ['--court', '--appliquer'].map((f) => process.argv.includes(f));
  if (!court) lancer('.', ['fetch', 'origin']);
  const bilan = balayer({ cwd: process.cwd(), appliquer });
  const bons = bilan.filter((w) => !w.gardee.length);
  if (court) {
    if (bons.length) console.log(`worktrees · ${bons.length} supprimable(s) : npm run worktrees:nettoyer -- --appliquer (la courante reste).`);
  } else {
    for (const w of bilan) console.log(`${w.fait ? 'supprimée' : w.gardee.length ? 'gardée' : 'supprimable'} ${w.chemin} ${w.gardee.join(', ')} ${w.note}`.trimEnd());
    console.log(`${bilan.length} worktree(s), ${bons.length} supprimable(s)${appliquer ? '' : ' (à sec : --appliquer pour supprimer)'}.`);
  }
} else if (lance && process.argv.includes('--pousser')) {
  const git = (args, voir = false) => {
    const r = spawnSync('git', args, { encoding: 'utf8', stdio: voir ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    return { code: r.status ?? 1, out: r.stdout ?? '' };
  };
  const code = await pousser({ git, runs: lireRuns, attendre: (ms) => new Promise((r) => setTimeout(r, ms)), log: console.log });
  // PRO-03 : propose seulement, ne supprime rien (la courante reste).
  if (code === 0) spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--worktrees', '--court'], { stdio: 'inherit' });
  process.exit(code);
} else if (lance) {
  let stdin = '';
  try {
    stdin = readFileSync(0, 'utf8');
  } catch {
    stdin = '';
  }
  process.exit(main({ stdin }));
}
