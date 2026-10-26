// ═══════════════════════════════════════════════════════════════════
// edge-deploy-select.mjs · QUELLES Edge Functions redeployer (AM-6)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Le deploiement des Edge Functions etait un geste MANUEL, et `check:edge`
// ne voyait la derive qu'apres coup. Le 2026-10-23, `stripe-org-checkout`
// et `stripe-org-portal` portaient sur `main` la mention 293 B (`c161de2b`)
// que la production n'executait pas : un correctif committe n'est pas un
// correctif deploye.
//
// `.github/workflows/edge-deploy.yml` deploie donc, apres une `CI` verte sur
// `main`, les fonctions modifiees depuis le dernier SHA deploye. Ce script
// decide de la LISTE. Le workflow ne fait que l'executer.
//
// ── LA REGLE DE SELECTION, ET POURQUOI ELLE PENCHE VERS « TROP » ─────────
//
// Une fonction redeployee pour rien coute une version de plus. Une fonction
// OUBLIEE est la derive C-35, invisible jusqu'au prochain `check:edge`. Dans
// le doute, on deploie : chaque regle ci-dessous ajoute, aucune ne retire.
//
//   · un fichier sous `supabase/functions/<slug>/` → `<slug>` ;
//   · un module `_shared/` → TOUTE fonction qui l'importe. 🔴 C'est la lecon
//     de W-2 : `verify-org-domain` embarquait l'ancienne
//     `_shared/org-integrations.ts`. Deux lectures, UNIES : le perimetre
//     transitif de `check:edge` (`repoFilesFor`, qui voit un `_shared` importe
//     par un autre `_shared`) ET le `grep -l "_shared/<module>"` du runbook ;
//   · `supabase/config.toml` → TOUTES : un `verify_jwt` ne prend effet qu'au
//     deploiement (W-1, `org-webhook-dispatch` en 401 avant son code) ;
//   · un fichier a la racine de `supabase/functions/` (hors `.md`), un
//     `deno.json` par exemple → TOUTES : il s'applique a chacune.
//
// ── LE DERNIER SHA DEPLOYE ──────────────────────────────────────────────
//
// Il est lu dans le TITRE du dernier run vert de `edge-deploy.yml`
// (`run-name`), pas dans son `head_sha` : un run `workflow_run` porte le SHA
// de la branche par defaut AU MOMENT du declenchement, pas celui que `CI` a
// valide. Un run sans SHA dans son titre (CI rouge, rien a faire) ne compte
// jamais comme un deploiement.
//
//   · aucun run vert → AMORCAGE : toutes les fonctions ;
//   · le SHA a deployer est deja contenu dans le dernier deploye (un run
//     ancien qui finit apres un recent) → RIEN, et surtout pas un retour
//     arriere de la prod vers un code plus vieux ;
//   · le dernier deploye n'est pas un ancetre (historique reecrit) → TOUTES.
//
// ── UNE FONCTION, UNE SECTION, UNE SONDE ────────────────────────────────
//
// Une fonction selectionnee sans section `[functions.<slug>]` dans
// `supabase/config.toml`, ou sans sonde dans `check-edge-smoke.mjs`, fait
// ECHOUER la selection. Deployee sans section, elle part en `verify_jwt =
// true` par defaut (W-1) ; sans sonde, rien ne dit qu'elle repond.
//
// ── TEMOIN ──────────────────────────────────────────────────────────────
//
// `scripts/edge-deploy-select.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { repoFilesFor } from './check-edge-deploy.mjs';
import { SONDES } from './check-edge-smoke.mjs';

const ROOT = process.cwd();
const FUNCTIONS_DIR = resolve(ROOT, 'supabase/functions');
const WORKFLOW = 'edge-deploy.yml';

// ═══════════════════════════════════════════════════════════════════
// NOYAU PUR · aucun reseau, aucun disque. C'est ce que le temoin exerce.
// ═══════════════════════════════════════════════════════════════════

const SHA_RE = /\b[0-9a-f]{40}\b/;

/** Le SHA complet porte par un titre de run, ou `null`. */
export function shaDuTitre(titre) {
  const m = String(titre ?? '').match(SHA_RE);
  return m ? m[0] : null;
}

/**
 * Le dernier SHA deploye, lu dans les runs de `edge-deploy.yml` (du plus
 * recent au plus ancien, ordre de l'API).
 *
 * Seul un run `success` dont le titre porte un SHA compte. ❌ Jamais le
 * `head_sha` du run : cf. l'en-tete.
 */
export function choisirBase(runs) {
  for (const run of runs ?? []) {
    if (run?.conclusion !== 'success') continue;
    const sha = shaDuTitre(run.display_title);
    if (sha) return sha;
  }
  return null;
}

/** `[functions.<slug>]` declarees dans un `config.toml`. */
export function sectionsDeclarees(toml) {
  const out = new Set();
  for (const brut of String(toml).split(/\r?\n/)) {
    const m = brut.replace(/#.*$/, '').trim().match(/^\[functions\.([a-z0-9-]+)\]$/);
    if (m) out.add(m[1]);
  }
  return out;
}

/**
 * Les fonctions a deployer pour une liste de chemins modifies.
 *
 * `perimetre(slug)` rend les fichiers que le bundle de la fonction embarque
 * (relatifs a `supabase/functions/`) ; `source(slug)` le texte de son
 * `index.ts`. Rend `{ slugs, raisons }`, `raisons` etant une Map
 * slug → [pourquoi], pour que le resume du run dise POURQUOI chaque fonction
 * part.
 */
export function selectionner({ changes, slugs, perimetre, source }) {
  const raisons = new Map();
  const ajouter = (slug, pourquoi) => {
    if (!raisons.has(slug)) raisons.set(slug, []);
    raisons.get(slug).push(pourquoi);
  };
  const toutes = (pourquoi) => slugs.forEach((s) => ajouter(s, pourquoi));

  // Calcule une fois : un `_shared` modifie se compare a chaque perimetre.
  const perimetres = new Map(slugs.map((s) => [s, new Set(perimetre(s))]));
  const sources = new Map(slugs.map((s) => [s, String(source(s))]));
  const orphelins = [];

  for (const brut of changes) {
    const chemin = String(brut).replace(/\\/g, '/');
    if (chemin === 'supabase/config.toml') {
      toutes('supabase/config.toml');
      continue;
    }
    if (!chemin.startsWith('supabase/functions/')) continue;
    const rel = chemin.slice('supabase/functions/'.length);
    // La documentation ne part pas dans un bundle (`estFichierDuBundle`).
    if (rel.endsWith('.md')) continue;

    const parts = rel.split('/');
    if (parts.length === 1) {
      toutes(chemin);
      continue;
    }

    if (parts[0] === '_shared') {
      const module = rel.replace(/\.[a-z]+$/, '');
      let importeurs = 0;
      for (const slug of slugs) {
        if (perimetres.get(slug).has(rel) || sources.get(slug).includes(module)) {
          ajouter(slug, chemin);
          importeurs += 1;
        }
      }
      if (importeurs === 0) orphelins.push(chemin);
      continue;
    }

    // Un dossier qui n'est plus une fonction du depot (supprime) : rien a
    // deployer. `check:edge` signale alors la fonction en ligne sans source.
    if (slugs.includes(parts[0])) ajouter(parts[0], chemin);
  }

  return { slugs: [...raisons.keys()].sort(), raisons, orphelins };
}

/**
 * Le plan, a partir de la base et de la tete.
 *
 * `estAncetre(a, b)` : `a` est-il contenu dans `b` (`git merge-base
 * --is-ancestor`, vrai aussi pour a === b) ? `diff(base, tete)` rend les
 * chemins modifies.
 */
export function planifier({ base, tete, estAncetre, diff }) {
  if (!SHA_RE.test(String(tete))) {
    throw new Error(`SHA a deployer invalide : « ${tete} ». Le deploiement ne devine pas.`);
  }
  if (!base) return { mode: 'amorcage', changes: null };
  if (estAncetre(tete, base)) return { mode: 'deja-deploye', changes: [] };
  if (!estAncetre(base, tete)) return { mode: 'historique-reecrit', changes: null };
  return { mode: 'diff', changes: diff(base, tete) };
}

/**
 * 🔴 Une fonction, une section, une sonde · rend la liste des manques pour
 * les fonctions selectionnees. Une liste non vide fait echouer le run.
 */
export function verifierTriple(slugs, { sections, sondes }) {
  const sondees = new Set(sondes.map((s) => s.fonction));
  const manques = [];
  for (const slug of slugs) {
    if (!sections.has(slug)) {
      manques.push(`« ${slug} » n'a pas de section [functions.${slug}] dans supabase/config.toml (W-1)`);
    }
    if (!sondees.has(slug)) {
      manques.push(`« ${slug} » n'a pas de sonde dans scripts/check-edge-smoke.mjs (C-91)`);
    }
  }
  return manques;
}

/** Tout le calcul, entrees et sorties injectees : c'est `main` sans I/O. */
export async function decider({ tete, lireRuns, estAncetre, diff, slugs, perimetre, source, sections, sondes }) {
  const runs = await lireRuns();
  const base = choisirBase(runs);
  const plan = planifier({ base, tete, estAncetre, diff });

  let selection;
  if (plan.changes === null) {
    const raisons = new Map(slugs.map((s) => [s, [plan.mode]]));
    selection = { slugs: [...slugs].sort(), raisons, orphelins: [] };
  } else {
    selection = selectionner({ changes: plan.changes, slugs, perimetre, source });
  }

  const manques = verifierTriple(selection.slugs, { sections, sondes });
  return { base, mode: plan.mode, ...selection, manques };
}

// ═══════════════════════════════════════════════════════════════════
// PROGRAMME
// ═══════════════════════════════════════════════════════════════════

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (r.error) throw r.error;
  return r;
}

function estAncetreGit(a, b) {
  const r = git(['merge-base', '--is-ancestor', a, b]);
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  // 128 : SHA inconnu du clone. Ni vrai ni faux : on ne devine pas.
  throw new Error(`git merge-base ${a} ${b} : code ${r.status} ${r.stderr.trim()}`);
}

function diffGit(base, tete) {
  const r = git(['diff', '--name-only', `${base}..${tete}`]);
  if (r.status !== 0) throw new Error(`git diff ${base}..${tete} : ${r.stderr.trim()}`);
  return r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
}

async function lireRunsGitHub() {
  const token = process.env.GH_TOKEN;
  const repo = process.env.REPO;
  if (!token || !repo) {
    throw new Error('GH_TOKEN ou REPO absent : impossible de lire le dernier SHA deploye.');
  }
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/runs?branch=main&status=success&per_page=30`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  // Une API en panne n'est PAS « aucun run vert » : ce serait un amorcage,
  // donc tout redeployer sur une lecture ratee.
  if (!r.ok) throw new Error(`API GitHub : runs de ${WORKFLOW} illisibles (HTTP ${r.status}).`);
  const corps = await r.json();
  if (!Array.isArray(corps.workflow_runs)) throw new Error('API GitHub : reponse sans `workflow_runs`.');
  return corps.workflow_runs;
}

function slugsDuDepot() {
  return readdirSync(FUNCTIONS_DIR)
    .filter((n) => n !== '_shared' && statSync(join(FUNCTIONS_DIR, n)).isDirectory())
    .sort();
}

function sortie(cle, valeur) {
  const f = process.env.GITHUB_OUTPUT;
  if (f) writeFileSync(f, `${cle}=${valeur}\n`, { flag: 'a' });
}

function resume(lignes) {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (!f) return;
  try {
    writeFileSync(f, `${lignes.join('\n')}\n`, { flag: 'a' });
  } catch {
    /* le resume est un confort, jamais une condition du verdict */
  }
}

async function main() {
  const tete = process.env.HEAD_SHA;
  const projectRef = JSON.parse(readFileSync(resolve(ROOT, '.github/edge-deploy.json'), 'utf8')).projectRef;
  if (!projectRef) throw new Error('.github/edge-deploy.json : `projectRef` manquant');

  const d = await decider({
    tete,
    lireRuns: lireRunsGitHub,
    estAncetre: estAncetreGit,
    diff: diffGit,
    slugs: slugsDuDepot(),
    perimetre: (slug) => [...repoFilesFor(slug).keys()],
    source: (slug) => readFileSync(join(FUNCTIONS_DIR, slug, 'index.ts'), 'utf8'),
    sections: sectionsDeclarees(readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8')),
    sondes: SONDES,
  });

  console.log(`Base : ${d.base ?? '(aucun deploiement anterieur)'} · tete : ${tete} · mode : ${d.mode}`);
  for (const slug of d.slugs) console.log(`  ${slug.padEnd(24)} ← ${d.raisons.get(slug).join(', ')}`);
  for (const o of d.orphelins) console.log(`  (${o} : aucune fonction ne l'importe)`);

  resume([
    '### Edge Functions a deployer',
    '',
    `Base \`${d.base ?? 'aucune'}\` → \`${tete}\` · mode **${d.mode}**`,
    '',
    ...(d.slugs.length
      ? ['| Fonction | Pourquoi |', '|---|---|', ...d.slugs.map((s) => `| \`${s}\` | ${d.raisons.get(s).join(', ')} |`)]
      : ['Aucune fonction modifiee.']),
  ]);

  if (d.manques.length > 0) {
    for (const m of d.manques) console.log(`::error title=edge-deploy::${m}`);
    process.exitCode = 1;
    return;
  }

  sortie('slugs', d.slugs.join(' '));
  sortie('project_ref', projectRef);
  console.log(`✓ ${d.slugs.length} fonction(s) a deployer.`);
}

const estPointDEntree = process.argv[1] && resolve(process.argv[1]).endsWith('edge-deploy-select.mjs');

if (estPointDEntree) {
  main().catch((e) => {
    console.log(`::error title=edge-deploy::${String(e.message).replace(/\r?\n/g, '%0A')}`);
    process.exitCode = 1;
  });
}
