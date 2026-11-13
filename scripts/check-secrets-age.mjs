// ═══════════════════════════════════════════════════════════════════
// check-secrets-age.mjs · l'AGE des secrets, contre une echeance ecrite
//
// 🔴 POURQUOI CE FICHIER EXISTE (AM-3, M-54)
//
// `docs/SECRETS-ET-COFFRE.md` § « Rotation des secrets » disait COMMENT faire tourner
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
    erreurs.push(...validerCompletude(e, registre.procedures));
  }
  erreurs.push(...validerProcedures(registre.procedures, entries));
  return erreurs;
}

// ── V4.3 (SEC-04) : le registre est UNIQUE et COMPLET ────────────────
// Chaque entree dit qui la lit (`readers`), l'effet d'une fuite (`leak`) et
// renvoie a une procedure de rotation pas a pas (`rotation`, un id de
// `procedures`). Les procedures sont des NOMS et des COMMANDES, jamais une
// valeur ni un indice de valeur.

/** Une valeur ou un indice de valeur : chaine de connexion, cle PEM, longue suite opaque. */
export const MOTIFS_DE_VALEUR = [
  /postgres(ql)?:\/\/[^\s"<]*:[^\s"<@]+@/i,
  /-----BEGIN [A-Z ]*KEY/,
  /\b[A-Za-z0-9]{32,}\b/,
  /\b(sk|rk|pk)_(live|test)_/,
  /\bwhsec_/,
  /\bsbp_/,
  /\beyJ[A-Za-z0-9_-]{10}/,
  /https?:\/\/[^\s"]*(hooks\.|discord(app)?\.com\/api\/webhooks)/i,
];

/** Les procédures d'un secret que rien ne lit : variable chez Vercel, ou secret GitHub en attente de son lecteur. */
export const PROCEDURES_SANS_LECTEUR = ['variable-orpheline', 'secret-sans-lecteur'];

export function contientUneValeur(texte) {
  return MOTIFS_DE_VALEUR.some((re) => re.test(String(texte)));
}

/** Les champs de completude d'UNE entree. Rend une liste d'erreurs. */
export function validerCompletude(e, procedures) {
  const id = `${e.store}/${e.name}`;
  const erreurs = [];
  if (!Array.isArray(e.readers) || !e.readers.every((r) => typeof r === 'string' && r.trim())) {
    erreurs.push(`${id} : \`readers\` (qui le lit) manquant ou mal forme`);
  } else if (e.kind === 'secret' && e.readers.length === 0 && !PROCEDURES_SANS_LECTEUR.includes(e.rotation)) {
    erreurs.push(`${id} : un secret que personne ne lit est une variable orpheline (rotation: ${PROCEDURES_SANS_LECTEUR.join(' ou ')}), a retirer ou a justifier`);
  }
  if (typeof e.leak !== 'string' || e.leak.trim().length < 20) {
    erreurs.push(`${id} : \`leak\` (effet d'une fuite) manquant ou trop court`);
  }
  if (typeof e.rotation !== 'string' || !procedures || !Array.isArray(procedures[e.rotation])) {
    erreurs.push(`${id} : \`rotation\` ne designe aucune procedure de \`procedures\``);
  }
  if (e.coffre != null && e.coffre !== true) erreurs.push(`${id} : \`coffre\` vaut true ou n'existe pas`);
  if (e.coffre === true && e.kind !== 'secret') erreurs.push(`${id} : seul un secret va au coffre`);
  for (const champ of ['use', 'leak']) {
    if (contientUneValeur(e[champ] ?? '')) erreurs.push(`${id} : \`${champ}\` ressemble a une VALEUR de secret, jamais ici`);
  }
  for (const r of e.readers ?? []) {
    if (contientUneValeur(r)) erreurs.push(`${id} : un lecteur ressemble a une VALEUR de secret`);
  }
  return erreurs;
}

/** Les procedures : pas a pas (>= 3 etapes pour un secret), sans valeur, et utiles. */
export function validerProcedures(procedures, entries) {
  const erreurs = [];
  if (!procedures || typeof procedures !== 'object' || Array.isArray(procedures)) return ['`procedures` absent'];
  const pourSecret = new Set(entries.filter((e) => e.kind === 'secret').map((e) => e.rotation));
  const utilisees = new Set(entries.map((e) => e.rotation));
  for (const [nom, etapes] of Object.entries(procedures)) {
    if (!Array.isArray(etapes) || etapes.length === 0 || !etapes.every((s) => typeof s === 'string' && s.trim().length > 10)) {
      erreurs.push(`procedure ${nom} : une liste d'etapes non vides est exigee`);
      continue;
    }
    if (pourSecret.has(nom) && etapes.length < 3) erreurs.push(`procedure ${nom} : un secret exige au moins 3 etapes (generer, poser, verifier)`);
    if (!utilisees.has(nom)) erreurs.push(`procedure ${nom} : aucune entree ne l'utilise`);
    for (const s of etapes) {
      if (contientUneValeur(s)) erreurs.push(`procedure ${nom} : une etape ressemble a une VALEUR de secret`);
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

/**
 * Les écarts, rangés par GESTE (V9.4, TST-05, 2026-11-07).
 *
 * 🔴 Du 2026-10-26 au 2026-11-07, ce job a rendu 44 lignes d'écart en vrac, et
 * « GH_TOKEN absent » ne disait pas que le secret à créer s'appelle
 * `SECRETS_AUDIT_TOKEN` : rouge depuis sa pose, et personne ne savait quoi
 * faire. Chaque écart tombe ici dans UN geste, et un écart non reconnu tombe
 * dans « à lire », jamais nulle part. Ne change PAS le verdict : `run()` sort
 * en 1 sur la liste brute, ceci ne fait que l'expliquer.
 */
export function quoiFaire(erreurs) {
  const gestes = {
    jeton: { titre: 'Poser le jeton de lecture (geste d Axel)', items: [] },
    rotation: { titre: 'Faire tourner (geste d Axel, V4.3), puis renseigner lastRotated', items: [] },
    date: { titre: 'Date de rotation inconnue : renseigner lastRotated (date réelle) ou faire tourner', items: [] },
    inventaire: { titre: 'Inventaire : inscrire au registre (nom, store, kind, échéance) OU supprimer chez le fournisseur', items: [] },
    absent: { titre: 'Au registre mais absent : poser la variable OU retirer l entrée, par décision écrite', items: [] },
    registre: { titre: 'Registre mal formé : corriger .github/secrets-registry.json', items: [] },
    autre: { titre: 'À lire', items: [] },
  };
  const consequences = [];
  for (const e of erreurs) {
    if (/^github : GH_TOKEN/.test(e)) {
      gestes.jeton.items.push(
        'secret GitHub `SECRETS_AUDIT_TOKEN` absent : PAT fin (Settings → Developer settings), dépôt seul, '
          + 'permission « Secrets: Read-only », puis `gh secret set SECRETS_AUDIT_TOKEN`',
      );
    } else if (/ : (\S+) absent : echec/.test(e)) {
      gestes.jeton.items.push(e.replace(' : echec, jamais un saut', ' : secret du workflow à poser'));
    } else if (/source non lue|lecture impossible/.test(e)) {
      consequences.push(e);
    } else if (/, a faire tourner$/.test(e)) {
      gestes.rotation.items.push(e.replace(', a faire tourner', ''));
    } else if (/date de rotation INCONNUE/.test(e)) {
      const store = e.split('/')[0];
      if (erreurs.some((x) => x.startsWith(`${store} : source non lue`))) consequences.push(e);
      else gestes.date.items.push(e.replace(', donc echue', ''));
    } else if (/existe sans entree au registre|dans \.env\.example sans entree/.test(e)) {
      gestes.inventaire.items.push(e.split(' : ')[0]);
    } else if (/au registre mais absent/.test(e)) {
      gestes.absent.items.push(e.split(' : ')[0]);
    } else if (/^registre : /.test(e)) {
      gestes.registre.items.push(e.slice('registre : '.length));
    } else {
      gestes.autre.items.push(e);
    }
  }
  return { gestes: Object.values(gestes).filter((g) => g.items.length > 0), consequences };
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
    const { gestes, consequences } = quoiFaire(r.erreurs);
    console.error('\n▶ QUE FAIRE (noms seulement, aucune valeur) :');
    for (const g of gestes) {
      console.error(`\n  ${g.titre} :`);
      for (const i of g.items) console.error(`    - ${i}`);
    }
    if (consequences.length) {
      console.error(`\n  Conséquences, qui se lèvent avec le jeton (${consequences.length}) : la source n'est pas lue, donc ses dates non plus.`);
    }
    // Les LOGS d'un run exigent un compte même sur un dépôt public, les
    // ANNOTATIONS non : le geste doit se lire sans ouvrir le journal.
    if (process.env.GITHUB_ACTIONS === 'true') {
      for (const g of gestes) {
        for (const i of g.items) console.log(`::error title=secrets-age · ${g.titre.split(' :')[0]}::${i}`);
      }
    }
  } else {
    console.log(`\n✔ ${r.lignes.length} secret(s) dans leur echeance`);
  }
  process.exit(r.exit);
}
