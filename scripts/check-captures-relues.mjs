// ═══════════════════════════════════════════════════════════════════
// check-captures-relues.mjs · aucune référence visuelle ne change sur `main`
// sans comparaison avant/après relue et tracée (V15.4, FRO-02, 2026-11-08)
//
// 🔴 LE DÉFAUT (FRO-02). Quatorze références de `e2e/__screenshots__/` ont
// été régénérées d'un geste, par le job `visual` lui-même, après huit jours de
// rouge pendant des refontes d'interface. Une référence régénérée sans regard
// entérine la régression qu'elle devait détecter, et rien ne gardait la trace
// de ce qui avait bougé. Le plan disait « régénération par PR » ; la décision
// d'Axel du 2026-10-29 garde le push direct sur `main` (ni branche ni PR). La
// revue se trace donc DANS LE COMMIT.
//
// ── LA RÈGLE ────────────────────────────────────────────────────────
//
// Tout commit de la plage poussée qui touche `e2e/__screenshots__/**` (ajout,
// modification, suppression) doit porter, dans son DERNIER paragraphe, le
// trailer
//
//     Captures-relues: https://github.com/<proprietaire>/<depot>/actions/runs/<id>
//
// qui pointe vers le run de `captures-regenerer.yml` ayant produit l'artefact
// de revue `captures-revue` (avant, après, différence, page d'index).
//
// Avec `--verifier-runs` (CI), la garde interroge en plus l'API GitHub : le run
// doit exister, appartenir au MÊME dépôt, provenir de `captures-regenerer.yml`
// et être terminé en succès. Un lien recopié d'un autre run ne passe pas.
//
// ── CE QUE CETTE GARDE NE PROUVE PAS ────────────────────────────────
//
// ⚠️ Le trailer dit « un humain a ouvert l'artefact de CE run avant de
// committer ». Il ne dit pas que l'humain a bien regardé, ni que les images
// du commit sont celles du run (le run a poussé une branche `noyau/captures-<id>`
// que l'on ramène sur `main` : la procédure est dans `e2e/CLAUDE.md`). C'est
// une trace, pas une preuve de lecture. Elle ferme pourtant le geste de FRO-02 :
// régénérer sans run, sans artefact, sans lien.
// ❌ AUCUNE variable ne contourne la règle, et `--no-verify` ne la saute pas :
//    c'est le job CI `fichiers-sensibles` de `ci-noyau.yml` qui la rejoue sur
//    chaque poussée, et il ne se saute pas depuis le poste.
//
// Témoin : `scripts/check-captures-relues.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Le dossier gardé (les références sont par plateforme : `linux/` en CI). */
export const DOSSIER = 'e2e/__screenshots__/';
export const TRAILER = 'Captures-relues';
/** Le workflow dont le run est la seule preuve admise. */
export const WORKFLOW = '.github/workflows/captures-regenerer.yml';

const RE_URL = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/actions\/runs\/(\d+)$/;
const RE_LIGNE = new RegExp(`^${TRAILER}:[ \\t]*(\\S+)[ \\t]*$`);
const VIDE = '0000000000000000000000000000000000000000';

/**
 * Le trailer est lu dans le DERNIER paragraphe seulement, comme `git
 * interpret-trailers` : une ligne `Captures-relues:` au milieu d'un récit ne
 * compte pas.
 * @returns {string[]} les valeurs brutes, dans l'ordre
 */
export function lireTrailers(message) {
  const blocs = String(message ?? '').replace(/\r\n/g, '\n').trim().split(/\n[ \t]*\n/);
  if (blocs.length < 2) return []; // un seul paragraphe est le sujet, jamais un trailer
  return blocs[blocs.length - 1]
    .split('\n')
    .map((l) => RE_LIGNE.exec(l.trim()))
    .filter(Boolean)
    .map((m) => m[1]);
}

/** @returns {{proprietaire:string, depot:string, id:string} | null} */
export function lireUrlRun(valeur) {
  const m = RE_URL.exec(valeur ?? '');
  return m ? { proprietaire: m[1], depot: m[2], id: m[3] } : null;
}

/**
 * Juge des commits déjà lus : `[{ sha, sujet, message, fichiers }]`.
 * @param {{depot?: string}} options `depot` = `proprietaire/depot` attendu
 * @returns {{ fautes: string[], runs: Map<string, string[]> }} `runs` : id → commits
 */
export function juger(commits, { depot } = {}) {
  const fautes = [];
  const runs = new Map();
  for (const c of commits) {
    if (!c.fichiers || c.fichiers.length === 0) continue;
    const court = c.sha.slice(0, 8);
    const quoi = `${c.fichiers.length} fichier(s) de ${DOSSIER}`;
    const valeurs = lireTrailers(c.message);
    if (valeurs.length === 0) {
      fautes.push(`${court} « ${c.sujet} » modifie ${quoi} sans trailer « ${TRAILER}: <URL du run> »`);
      continue;
    }
    const url = lireUrlRun(valeurs[valeurs.length - 1]);
    if (!url) {
      fautes.push(`${court} : trailer « ${TRAILER} » illisible (« ${valeurs[valeurs.length - 1]} ») ; attendu https://github.com/<proprietaire>/<depot>/actions/runs/<id>`);
      continue;
    }
    if (depot && `${url.proprietaire}/${url.depot}`.toLowerCase() !== depot.toLowerCase()) {
      fautes.push(`${court} : le run cité est celui de ${url.proprietaire}/${url.depot}, pas de ${depot}`);
      continue;
    }
    const liste = runs.get(url.id) ?? [];
    liste.push(court);
    runs.set(url.id, liste);
  }
  return { fautes, runs };
}

/**
 * Interroge l'API GitHub : le run existe-t-il, vient-il du bon workflow, a-t-il
 * réussi ? `chercher(url)` renvoie `{ status, json }` (injecté pour le témoin).
 */
export async function verifierRuns(runs, { depot, chercher }) {
  const fautes = [];
  for (const [id, commits] of runs) {
    const res = await chercher(`https://api.github.com/repos/${depot}/actions/runs/${id}`);
    const qui = `run ${id} (commit ${commits.join(', ')})`;
    if (res.status !== 200) {
      fautes.push(`${qui} : introuvable (HTTP ${res.status})`);
      continue;
    }
    const r = res.json ?? {};
    if (r.path !== WORKFLOW && !String(r.path ?? '').startsWith(`${WORKFLOW}@`)) {
      fautes.push(`${qui} : provient de « ${r.path ?? '?'} », pas de ${WORKFLOW}`);
    } else if (r.status !== 'completed' || r.conclusion !== 'success') {
      fautes.push(`${qui} : état ${r.status}/${r.conclusion ?? '-'} ; seul un run terminé en succès a produit un artefact relisible`);
    }
  }
  return fautes;
}

// ─── Lecture de git ──────────────────────────────────────────────────

export const executerGit = (cwd) => (args) => execFileSync('git', args, {
  cwd,
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const git = executerGit(undefined);

/** Les commits de `A..B` qui touchent le dossier gardé (fusions comprises, `-m`). */
export function lireCommits(plage, executer = git) {
  const m = /^([0-9A-Za-z_./^~-]+)\.\.([0-9A-Za-z_./^~-]+)$/.exec(plage ?? '');
  if (!m) throw new Error(`plage illisible : « ${plage} » (attendu A..B)`);
  if (m[1] === VIDE || m[2] === VIDE) throw new Error(`plage sans base (${plage})`);
  const shas = executer(['rev-list', `${m[1]}..${m[2]}`]).split('\n').filter(Boolean);
  const commits = [];
  for (const sha of shas) {
    const brut = executer(['diff-tree', '-r', '-m', '--no-commit-id', '--name-only', '-z', '--no-renames', sha, '--', DOSSIER]);
    const fichiers = [...new Set(brut.split('\0').filter(Boolean))];
    if (fichiers.length === 0) continue;
    commits.push({
      sha,
      sujet: executer(['log', '-1', '--format=%s', sha]).trim(),
      message: executer(['log', '-1', '--format=%B', sha]),
      fichiers,
    });
  }
  return commits;
}

// ─── Point d'entrée ──────────────────────────────────────────────────

/** @returns {Promise<number>} le code de sortie */
export async function run({
  argv = process.argv.slice(2),
  env = process.env,
  executer = git,
  chercher,
  log = console.log,
  erreur = console.error,
} = {}) {
  const ci = env.GITHUB_ACTIONS === 'true';
  const signaler = (l) => (ci ? log(`::error title=captures-relues::${l}`) : erreur(`  ✖ ${l}`));
  const i = argv.indexOf('--plage');
  if (i < 0 || !argv[i + 1]) {
    erreur('usage : check-captures-relues.mjs --plage A..B [--verifier-runs]');
    return 1;
  }
  const depot = env.GITHUB_REPOSITORY || undefined;
  let fautes;
  try {
    const commits = lireCommits(argv[i + 1], executer);
    log(`captures relues · ${commits.length} commit(s) touchent ${DOSSIER}`);
    const jugement = juger(commits, { depot });
    fautes = [...jugement.fautes];
    if (argv.includes('--verifier-runs') && jugement.runs.size > 0) {
      if (!depot) throw new Error('--verifier-runs demande GITHUB_REPOSITORY');
      const jeton = env.GITHUB_TOKEN;
      const lire = chercher ?? (async (url) => {
        const r = await fetch(url, {
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
          },
        });
        return { status: r.status, json: r.status === 200 ? await r.json() : null };
      });
      fautes.push(...(await verifierRuns(jugement.runs, { depot, chercher: lire })));
    }
  } catch (e) {
    signaler(`lecture impossible : ${e.message}`);
    return 1;
  }
  if (fautes.length === 0) {
    log('captures relues · rien à reprocher');
    return 0;
  }
  for (const f of fautes) signaler(f);
  for (const l of [
    'Une référence visuelle ne change plus sans revue tracée (FRO-02). Marche à suivre :',
    '  1. lancer le workflow « Captures : regenerer » (Actions) ;',
    '  2. ouvrir l artefact `captures-revue` et relire avant, après, différence ;',
    '  3. ramener la branche noyau/captures-<run> sur main, commit complété par',
    `     le trailer « ${TRAILER}: <URL du run> » (git commit --amend --trailer) ;`,
    '  4. supprimer la branche. Détail : e2e/CLAUDE.md.',
  ]) erreur(l);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run().then((code) => process.exit(code));
}
