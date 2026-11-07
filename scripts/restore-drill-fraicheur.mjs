// ═══════════════════════════════════════════════════════════════════
// restore-drill-fraicheur.mjs · UN DRILL VERT DE MOINS DE 35 JOURS ?
//
// Appele par `.github/workflows/restore-drill-fraicheur.yml` (hebdomadaire).
//
// 🔴 POURQUOI UNE GARDE D'ABSENCE (ROB-01, vague 4.4, 2026-11-07)
//
// `ci-alert.yml` sonne quand le drill ECHOUE. Il ne dit rien quand le drill
// ne tourne PAS : workflow desactive a la main (ce fut le cas du 2026-09-01
// au 2026-10-15, et `gh run list` ne montrait meme pas qu'il manquait), cron
// suspendu par GitHub, YAML casse qui n'execute plus rien. Un silence qu'on
// prend pour un accord. Cette garde lit l'historique des runs et rougit si
// aucun job `drill-auto` n'a REUSSI sur `main` depuis 35 jours (un mois de
// cron, plus quatre jours de marge pour un run en retard ou rejoue).
//
// ✅ Dans le doute, elle rougit : API en panne, jeton refuse, reponse
//    illisible = exit 1. Elle ne rend jamais un vert qu'elle n'a pas lu.
// 🔴 PAS DE SHEBANG (cf. `ops-alert.mjs`) : le temoin importe ce module.
//    Temoin : `scripts/restore-drill-fraicheur.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════

export const JOURS_MAX = 35;
export const JOB = 'drill-auto';
const JOUR_MS = 86_400_000;

/**
 * Le verdict, sur des runs DEJA lus : `[{ id, date, jobs: [{ name, conclusion }] }]`.
 * Rend `{ ok, dernier, ageJours, message }`.
 */
export function verdictFraicheur(runs, maintenant = new Date(), joursMax = JOURS_MAX) {
  const verts = (runs ?? [])
    .filter((r) => (r.jobs ?? []).some((j) => j.name === JOB && j.conclusion === 'success'))
    .map((r) => ({ id: r.id, t: Date.parse(r.date) }))
    .filter((r) => Number.isFinite(r.t))
    .sort((a, b) => b.t - a.t);
  if (verts.length === 0) {
    return {
      ok: false, dernier: null, ageJours: null,
      message: `Aucun drill de restauration vert (job ${JOB}) sur main dans l historique lu : la seule sauvegarde n est pas eprouvee.`,
    };
  }
  const d = verts[0];
  const ageJours = Math.floor((maintenant.getTime() - d.t) / JOUR_MS);
  const quand = new Date(d.t).toISOString().slice(0, 10);
  if (ageJours > joursMax) {
    return {
      ok: false, dernier: d, ageJours,
      message: `Dernier drill de restauration vert le ${quand} (run ${d.id}), il y a ${ageJours} jours, au-dela de ${joursMax} : le drill mensuel ne tourne plus, ou ne passe plus.`,
    };
  }
  return { ok: true, dernier: d, ageJours, message: `Dernier drill vert le ${quand} (run ${d.id}), il y a ${ageJours} jour(s).` };
}

/** Lit les runs reussis de `restore-drill.yml` sur main, et leurs jobs. */
export async function lireRuns({ repo, jeton, fetcher = fetch, limite = 30 }) {
  if (!repo || !jeton) throw new Error('REPO ou GH_TOKEN absent : historique illisible.');
  const entetes = { authorization: `Bearer ${jeton}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  const lire = async (url) => {
    const r = await fetcher(url, { headers: entetes });
    if (!r.ok) throw new Error(`API GitHub ${r.status} sur ${url.replace(/\?.*$/, '')}`);
    return r.json();
  };
  const base = `https://api.github.com/repos/${repo}/actions`;
  const liste = await lire(`${base}/workflows/restore-drill.yml/runs?branch=main&status=success&per_page=${limite}`);
  if (!Array.isArray(liste?.workflow_runs)) throw new Error('Reponse de l API illisible (workflow_runs absent).');
  const runs = [];
  for (const run of liste.workflow_runs) {
    const j = await lire(`${base}/runs/${run.id}/jobs?per_page=50`);
    if (!Array.isArray(j?.jobs)) throw new Error(`Jobs du run ${run.id} illisibles.`);
    runs.push({
      id: run.id,
      date: run.updated_at ?? run.created_at,
      jobs: j.jobs.map((x) => ({ name: x.name, conclusion: x.conclusion })),
    });
    // Le plus recent qui porte un drill-auto vert suffit : la liste est triee.
    if (runs.at(-1).jobs.some((x) => x.name === JOB && x.conclusion === 'success')) break;
  }
  return runs;
}

// Entree CLI. `import.meta.main` n'existe pas en Node 20 : on compare argv.
if (process.argv[1] && process.argv[1].endsWith('restore-drill-fraicheur.mjs')) {
  let code = 1;
  try {
    const runs = await lireRuns({ repo: process.env.REPO, jeton: process.env.GH_TOKEN });
    const v = verdictFraicheur(runs);
    console.log(v.ok ? `::notice title=fraicheur du drill::${v.message}` : `::error title=fraicheur du drill::${v.message}`);
    code = v.ok ? 0 : 1;
  } catch (e) {
    console.log(`::error title=fraicheur du drill::Historique illisible, donc rouge : ${e.message}`);
  }
  process.exit(code);
}
