// ═══════════════════════════════════════════════════════════════════
// ci-alert-perime.mjs · UN ROUGE DÉJÀ RÉPARÉ NE RÉVEILLE PERSONNE
//
// Appelé par `.github/workflows/ci-alert.yml`, avant l'issue `ci-red` et le
// webhook : il écrit `perime=true` quand un run VERT du même workflow, sur
// `main`, a été créé APRÈS le run rouge qui déclenche l'alerte.
//
// 🔴 POURQUOI CE FICHIER EXISTE (2026-10-16)
//
// Les runs `CI` de `main` ne s'annulent plus entre eux : un groupe de
// concurrence par commit (`ci.yml`). Or un `e2e` rouge dure bien plus
// longtemps qu'un vert (4,3 h le 2026-10-02, 23 min vert). Un commit A qui
// casse, réparé par B dix minutes plus tard, rend le vert de B AVANT le rouge
// de A : sans ce contrôle, l'issue `ci-red` se rouvrait et le webhook sonnait
// des heures après la réparation. Ce rouge-là était annulé avant, et muet.
//
// ✅ DANS LE DOUTE, L'ALERTE PART : API en panne, jeton refusé, contexte
//    incomplet, `GITHUB_OUTPUT` absent, script qui plante. Chacun de ces cas
//    laisse `perime` vide ou à `false`, et les deux sorties de `ci-alert.yml`
//    ne se taisent que sur `perime == 'true'`. Ce contrôle ne peut faire
//    qu'une chose : retirer une alerte DONT LA RÉPARATION EST PROUVÉE.
// ⚠️ Il ne compare que des runs du MÊME workflow (`workflow_id`) : un vert de
//    `Visual` ne répare pas un rouge de `CI`.
// ⚠️ Pour un workflow planifié, le run plus récent est créé APRÈS que le
//    rouge a fini : le contrôle ne le trouve pas, l'alerte part. Il ne mord
//    que sur ce que l'ordre d'arrivée a inversé.
//
// 🔴 PAS DE SHEBANG : le témoin importe ce module (cf. `scripts/CLAUDE.md`).
// Témoin : `scripts/ci-alert-perime.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════

import { appendFileSync } from 'node:fs';

/**
 * Le premier run VERT créé strictement après `creeLe`, ou `null`.
 * Une date illisible ne rend jamais un rouge périmé.
 */
export function reparateur(runs, { creeLe }) {
  const t0 = Date.parse(creeLe);
  if (Number.isNaN(t0)) return null;
  return runs.find((r) => r.conclusion === 'success' && Date.parse(r.created_at) > t0) ?? null;
}

/** Les derniers runs VERTS de `main` pour ce workflow. Une réponse non 2xx est une erreur, jamais une liste vide. */
export async function listerRuns({ repo, workflowId, token, fetchImpl = fetch }) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/runs`
    + '?branch=main&status=success&per_page=5';
  const res = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const corps = await res.json();
  if (!Array.isArray(corps.workflow_runs)) throw new Error('réponse sans `workflow_runs`');
  return corps.workflow_runs;
}

/**
 * Décide et écrit `perime=…` dans `GITHUB_OUTPUT`. Rend `{ perime }` sans
 * sortir lui-même, pour que le témoin l'exécute. Sort toujours en 0 : un
 * échec ici doit laisser partir l'alerte, pas rougir la vérification.
 */
export async function run({
  env = process.env,
  lister = listerRuns,
  ecrire = appendFileSync,
  log = console.log,
} = {}) {
  const court = (s) => String(s ?? '').slice(0, 7);
  let perime = false;
  const manquants = ['REPO', 'WF_ID', 'CREE'].filter((k) => !env[k]);
  if (manquants.length) {
    log(`::warning::contexte incomplet (${manquants.join(', ')}) : pas de vérification, l’alerte part.`);
  } else {
    try {
      const runs = await lister({ repo: env.REPO, workflowId: env.WF_ID, token: env.GH_TOKEN });
      const r = reparateur(runs, { creeLe: env.CREE });
      if (r) {
        perime = true;
        log(
          `::notice::Échec de ${court(env.SHA)} déjà réparé par ${court(r.head_sha)}, `
            + `run vert créé après lui : ${r.html_url}. Pas d’issue, pas de webhook.`,
        );
      } else {
        log(`Aucun run vert plus récent que celui de ${court(env.SHA)} : l’alerte part.`);
      }
    } catch (e) {
      log(`::warning::vérification impossible (${e.message}) : l’alerte part quand même.`);
    }
  }
  if (env.GITHUB_OUTPUT) ecrire(env.GITHUB_OUTPUT, `perime=${perime}\n`);
  else log('::warning::GITHUB_OUTPUT absent : sortie non écrite, l’alerte part.');
  return { perime };
}

if (process.argv[1] && process.argv[1].endsWith('ci-alert-perime.mjs')) {
  await run();
}
