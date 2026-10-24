// ═══════════════════════════════════════════════════════════════════
// check-secrets-age.mjs · l'AGE des secrets, contre une echeance ecrite
//
// 🔴 POURQUOI CE FICHIER EXISTE (AM-3, M-54)
//
// `docs/SECURITY.md` § « Rotation des secrets » disait COMMENT faire tourner
// un secret, jamais QUAND, et rien ne mesurait leur age. Un secret oublie ne
// casse rien : il vieillit, et le jour d'une fuite on ne sait pas depuis
// combien de temps il circule.
//
// ── CE QUE CE SCRIPT REGARDE ────────────────────────────────────────────
//
// Le registre `.github/secrets-registry.json` (NOMS SEULEMENT) contre quatre
// sources :
//   · GitHub Actions : `GET /repos/{repo}/actions/secrets` (nom + updated_at) ;
//   · Edge Functions : `GET /v1/projects/{ref}/secrets` (Management API) ;
//   · Vercel : `GET /v9/projects/{id}/env` (cle + updatedAt, JAMAIS decrypt) ;
//   · `.env.example`.
// Quatre verdicts, tous des ECHECS :
//   1. un secret VIVANT absent du registre ;
//   2. une entree du registre absente de la realite ;
//   3. un secret dont l'age depasse son echeance ;
//   4. un secret dont la date est INCONNUE : date inconnue = echue.
//
// ── JETON ABSENT = ECHEC ────────────────────────────────────────────────
//
// Chaque source exige son jeton, et son absence sort en 1. Jamais un
// `::warning::` dans un run vert (regle de CLAUDE.md, violee quatre fois).
// ❌ Aucun pas de cote « jeton absent donc source sautee ».
//
// ── LES VALEURS ─────────────────────────────────────────────────────────
//
// Les reponses des API contiennent parfois une valeur ou son empreinte.
// `lireNoms*` ne garde que { nom, date } et rien d'autre ne sort de la
// fonction : ni log, ni message d'erreur.
//
// Temoin : `scripts/check-secrets-age.guard.test.mjs`.
//
// Usage :
//   GH_TOKEN=… SUPABASE_ACCESS_TOKEN=… VERCEL_TOKEN=… VERCEL_PROJECT_ID=… \
//     GITHUB_REPOSITORY=kelax12/COSMO1.2 node scripts/check-secrets-age.mjs
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const REGISTRE = resolve(ROOT, '.github/secrets-registry.json');
const ENV_EXAMPLE = resolve(ROOT, '.env.example');
const PROJET_SUPABASE = 'ykeugqfgklejcdbrmawy';
const JOUR = 86_400_000;

// ═══════════════ NOYAU PUR · aucun reseau, aucun disque ═══════════════

export const STORES = ['github', 'supabase-edge', 'vercel', 'supabase-platform', 'public'];
export const CRITICITES = ['critical', 'high', 'medium', 'low'];

/** Valide la forme du registre. Rend une liste d'erreurs (vide = bien forme). */
export function validerRegistre(registre) {
  const erreurs = [];
  const entries = registre?.entries;
  if (!Array.isArray(entries) || entries.length === 0) return ['registre vide ou illisible'];
  const vues = new Set();
  for (const e of entries) {
    const id = `${e.store}/${e.name}`;
    if (vues.has(id)) erreurs.push(`${id} : entree en double`);
    vues.add(id);
    if (!/^[A-Z][A-Z0-9_]*$/.test(e.name ?? '')) erreurs.push(`${id} : nom invalide`);
    if (!STORES.includes(e.store)) erreurs.push(`${id} : store inconnu`);
    if (!['secret', 'config'].includes(e.kind)) erreurs.push(`${id} : kind inconnu`);
    if (!e.owner) erreurs.push(`${id} : proprietaire manquant`);
    if (!CRITICITES.includes(e.criticality)) erreurs.push(`${id} : criticite inconnue`);
    if (e.kind === 'secret' && !(Number.isInteger(e.maxAgeDays) && e.maxAgeDays > 0)) {
      erreurs.push(`${id} : un secret exige une echeance maxAgeDays`);
    }
    if (e.lastRotated != null && !/^\d{4}-\d{2}-\d{2}$/.test(e.lastRotated)) {
      erreurs.push(`${id} : lastRotated n'est pas AAAA-MM-JJ`);
    }
  }
  return erreurs;
}

/** Date effective : la plus recente de la date vivante et de lastRotated. null = inconnue. */
export function dateEffective(entree, dateVivante) {
  const candidats = [dateVivante, entree.lastRotated]
    .map((d) => (d ? Date.parse(d) : NaN))
    .filter((t) => Number.isFinite(t));
  return candidats.length ? new Date(Math.max(...candidats)) : null;
}

/**
 * Le coeur. `vivant` : { store: Map<nom, dateISO|null> | null }.
 * Un store a `null` est un store NON LU : c'est une erreur, pas un saut.
 * Rend { erreurs, lignes }.
 */
export function evaluer({ registre, vivant, exemple, maintenant }) {
  const erreurs = validerRegistre(registre).map((m) => `registre : ${m}`);
  const lignes = [];

  for (const store of ['github', 'supabase-edge', 'vercel']) {
    if (!(vivant[store] instanceof Map)) {
      erreurs.push(`${store} : source non lue, rien ne prouve l'etat de ses secrets`);
      continue;
    }
    const attendus = new Set(registre.entries.filter((e) => e.store === store).map((e) => e.name));
    for (const nom of vivant[store].keys()) {
      // Injectes par la plateforme, suivis sous `supabase-platform`.
      if (store === 'supabase-edge' && nom.startsWith('SUPABASE_')) continue;
      if (!attendus.has(nom)) erreurs.push(`${store}/${nom} : existe sans entree au registre`);
    }
    for (const nom of attendus) {
      if (!vivant[store].has(nom)) erreurs.push(`${store}/${nom} : au registre mais absent de ${store}`);
    }
  }

  const nomsExemple = new Set(registre.entries.filter((e) => e.store === 'public').map((e) => e.name));
  if (!(exemple instanceof Set)) {
    erreurs.push('.env.example : non lu');
  } else {
    for (const nom of exemple) if (!nomsExemple.has(nom)) erreurs.push(`public/${nom} : dans .env.example sans entree au registre`);
    for (const nom of nomsExemple) if (!exemple.has(nom)) erreurs.push(`public/${nom} : au registre mais absent de .env.example`);
  }

  for (const e of registre.entries) {
    if (e.kind !== 'secret') continue;
    const date = dateEffective(e, vivant[e.store] instanceof Map ? vivant[e.store].get(e.name) : null);
    const id = `${e.store}/${e.name}`;
    if (!date) {
      erreurs.push(`${id} : date de rotation INCONNUE, donc echue (echeance ${e.maxAgeDays} j, ${e.criticality})`);
      lignes.push({ id, age: null, max: e.maxAgeDays });
      continue;
    }
    const age = Math.floor((maintenant.getTime() - date.getTime()) / JOUR);
    lignes.push({ id, age, max: e.maxAgeDays });
    if (age > e.maxAgeDays) {
      erreurs.push(`${id} : ${age} j pour une echeance de ${e.maxAgeDays} j (${e.criticality}), a faire tourner`);
    }
  }
  return { erreurs, lignes };
}

/** Noms de `.env.example`, hors commentaires. */
export function nomsDeLExemple(texte) {
  const noms = new Set();
  for (const l of String(texte).split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(l);
    if (m) noms.add(m[1]);
  }
  return noms;
}

// Les lecteurs ne gardent QUE { nom, date } : rien d'autre ne survit.
export function lireGithub(json) {
  const liste = json?.secrets;
  if (!Array.isArray(liste)) throw new Error('reponse GitHub inattendue (pas de `secrets`)');
  return new Map(liste.map((s) => [s.name, s.updated_at ?? null]));
}
export function lireSupabase(json) {
  if (!Array.isArray(json)) throw new Error('reponse Supabase inattendue (pas un tableau)');
  return new Map(json.map((s) => [s.name, s.updated_at ?? null]));
}
export function lireVercel(json) {
  const liste = json?.envs;
  if (!Array.isArray(liste)) throw new Error('reponse Vercel inattendue (pas de `envs`)');
  const m = new Map();
  for (const v of liste) {
    const t = v.updatedAt ?? v.createdAt;
    const d = typeof t === 'number' ? new Date(t).toISOString() : null;
    // Une cle presente sur plusieurs cibles : la plus ANCIENNE date, on ne ment pas par le haut.
    if (!m.has(v.key)) m.set(v.key, d);
    else {
      const avant = m.get(v.key);
      m.set(v.key, avant && d ? (d < avant ? d : avant) : null);
    }
  }
  return m;
}

// ═══════════════ RESEAU · fin, et le jeton est exige ═══════════════

async function get(url, jeton) {
  const rep = await fetch(url, { headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json' } });
  if (!rep.ok) throw new Error(`HTTP ${rep.status} sur ${new URL(url).host}`);
  return rep.json();
}

/** Lit les trois sources. Une source sans jeton ou en erreur reste `null` (= ECHEC dans `evaluer`). */
export async function lireSources(env, erreurs) {
  const vivant = { github: null, 'supabase-edge': null, vercel: null };
  const lire = async (store, jetons, fn) => {
    const manquants = jetons.filter((j) => !env[j]);
    if (manquants.length) {
      erreurs.push(`${store} : ${manquants.join(', ')} absent : echec, jamais un saut`);
      return;
    }
    try {
      vivant[store] = await fn();
    } catch (e) {
      erreurs.push(`${store} : lecture impossible (${e.message})`);
    }
  };
  await lire('github', ['GH_TOKEN', 'GITHUB_REPOSITORY'], async () =>
    lireGithub(await get(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/secrets?per_page=100`, env.GH_TOKEN)));
  await lire('supabase-edge', ['SUPABASE_ACCESS_TOKEN'], async () =>
    lireSupabase(await get(`https://api.supabase.com/v1/projects/${PROJET_SUPABASE}/secrets`, env.SUPABASE_ACCESS_TOKEN)));
  await lire('vercel', ['VERCEL_TOKEN', 'VERCEL_PROJECT_ID'], async () => {
    const equipe = env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}` : '';
    return lireVercel(await get(`https://api.vercel.com/v9/projects/${encodeURIComponent(env.VERCEL_PROJECT_ID)}/env${equipe}`, env.VERCEL_TOKEN));
  });
  return vivant;
}

export async function run(env = process.env, maintenant = new Date()) {
  const registre = JSON.parse(readFileSync(REGISTRE, 'utf8'));
  const exemple = nomsDeLExemple(readFileSync(ENV_EXAMPLE, 'utf8'));
  const erreursLecture = [];
  const vivant = await lireSources(env, erreursLecture);
  const { erreurs, lignes } = evaluer({ registre, vivant, exemple, maintenant });
  const toutes = [...new Set([...erreursLecture, ...erreurs])];
  return { exit: toutes.length ? 1 : 0, erreurs: toutes, lignes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await run();
  for (const l of r.lignes) console.log(`${l.age === null ? '?' : l.age} j / ${l.max} j  ${l.id}`);
  if (r.exit) {
    console.error(`\n✖ ${r.erreurs.length} ecart(s) :`);
    for (const e of r.erreurs) console.error(`  · ${e}`);
  } else {
    console.log(`\n✔ ${r.lignes.length} secret(s) dans leur echeance`);
  }
  process.exit(r.exit);
}
