// ═══════════════════════════════════════════════════════════════════
// schema-prod.mjs · UNE BASE FRAICHE EGALE-T-ELLE LA PRODUCTION ? (ROB-02, V8.1-8.2)
//
// L'audit du 2026-11-06 (ROB-02) : migrations appliquees a la main, ledger
// divergent (fichiers sans entree, entrees sans fichier, `164` en prod hors
// ledger). `supabase/schema.sql` disait ce que le DEPOT reconstruit, rien ne
// disait que la PRODUCTION etait la meme chose.
//
// Ce script compare deux instantanes rendus par le MEME pg_dump (celui du
// conteneur de la stack locale), au MEME format que `supabase/schema.sql`
// (schema `public` + objets poses hors `public` : triggers sur auth.users,
// policies de storage, buckets, pg_cron) :
//   · la base FRAICHE de la stack locale (`supabase start` a applique
//     `supabase/migrations/`, moins les migrations pas encore en prod) ;
//   · la PRODUCTION, lue en LECTURE SEULE (pg_dump --schema-only, catalogue).
//
// La comparaison se fait OBJET par OBJET (les en-tetes `-- Name: …; Type: …`
// de pg_dump) : un ecart se lit « en prod seulement », « dans le depot
// seulement » ou « different », jamais comme un diff de 20 000 lignes.
//
// Deux commandes :
//   node scripts/schema-prod.mjs en-attente [--retirer]
//       Liste les migrations de `supabase/migrations/` (hors baseline) que le
//       ledger de production ne connait pas, par version OU par nom. Avec
//       `--retirer`, les efface de l'arbre du RUNNER pour que `supabase start`
//       ne construise que ce que la prod a recu. Lit : PROD_DB_URL.
//   node scripts/schema-prod.mjs comparer
//       Compare base fraiche (DATABASE_URL, defaut stack locale) et production
//       (PROD_DB_URL). Sortie 1 au premier ecart non justifie.
//
// 🔴 AUCUNE ecriture en production : `select` sur le catalogue et le ledger,
// pg_dump --schema-only. Aucun artefact : ce qui part au journal (public) est
// la liste des objets en ecart et leurs lignes de definition, masquees
// (adresses, jetons). Pas une ligne de table.
// ⚠️ Pas de shebang : le temoin importe ce module (cf. `scripts/CLAUDE.md`).
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, unlinkSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { lireBase, normaliserDump, rendreComplements, projetId } from './contrat-donnees.mjs';

export const DOSSIER_MIGRATIONS = 'supabase/migrations';
/** Le fichier de base : tout ce qui le precede est l'historique `supabase/migration/`. */
export const RE_BASELINE = /^\d{14}_baseline\.sql$/;
/** Format de la CLI : `<14 chiffres>_<nom>.sql`. */
export const RE_FICHIER_CLI = /^(\d{14})_([a-z0-9_]+)\.sql$/;

// ─── Migrations en attente ──────────────────────────────────────────

/**
 * Les fichiers de `supabase/migrations/` postérieurs à la baseline, avec la
 * version et le nom que le ledger peut porter. Une migration appliquee par
 * `apply_migration` (MCP) porte une version DATEE DE L'APPLICATION et son nom
 * sans horodatage (`245_cron_journal`) ; une migration poussee par la CLI
 * porte la version du fichier. On accepte les deux.
 */
export function fichiersPosterieurs(fichiers) {
  return fichiers
    .filter((f) => RE_FICHIER_CLI.test(f) && !RE_BASELINE.test(f))
    .sort()
    .map((f) => {
      const [, version, nom] = f.match(RE_FICHIER_CLI);
      return { fichier: f, version, nom };
    });
}

/** Ceux que le ledger de production ne connait ni par version ni par nom. */
export function enAttente(posterieurs, ledger) {
  const versions = new Set(ledger.map((l) => String(l.version)));
  const noms = new Set(ledger.map((l) => String(l.name ?? '')));
  return posterieurs.filter((m) => !versions.has(m.version) && !noms.has(m.nom));
}

export const SQL_LEDGER = 'select version, name from supabase_migrations.schema_migrations order by version';

// ─── Instantanes ────────────────────────────────────────────────────

const LOCAL = /@(127\.0\.0\.1|localhost|\[::1\]|host\.docker\.internal)(:\d+)?\//;

/**
 * Client `pg` : en local sans TLS ; vers la prod, TLS chiffre sans
 * verification de chaine, comme le `psql` de `migration-coverage.yml` et de
 * `db-backup.yml` (sslmode par defaut) : le certificat du pooler n'est pas
 * dans le magasin de Node, et la session est en lecture seule. Le
 * `sslmode` de l'URL est retire : `pg-connection-string` le lirait comme
 * `verify-full` et la connexion echouerait sur le certificat.
 */
export function optionsClient(url) {
  if (LOCAL.test(url)) return { connectionString: url };
  const u = new URL(url);
  u.searchParams.delete('sslmode');
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: false } };
}

async function connecter(url) {
  const { default: pg } = await import('pg');
  const client = new pg.Client(optionsClient(url));
  await client.connect();
  // Lecture seule, posee par la session elle-meme : un ordre d'ecriture echouerait.
  await client.query('set session characteristics as transaction read only');
  return client;
}

/**
 * pg_dump du conteneur local, contre l'URL passee par l'environnement du
 * conteneur (jamais en argument : elle porte le mot de passe).
 */
export function pgDump(conteneur, urlDansConteneur) {
  const variable = 'COSMO_URL_DUMP';
  const r = spawnSync('docker', [
    'exec', '-e', variable, conteneur, 'sh', '-c',
    `pg_dump "$${variable}" --schema-only --schema=public --no-owner --no-tablespaces`,
  ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, [variable]: urlDansConteneur } });
  if (r.error) throw new Error(`docker : ${r.error.message}`);
  if (r.status !== 0) {
    const fin = masquer(String(r.stderr || '').trim().split('\n').slice(-8).join('\n'));
    throw new Error(`pg_dump a rendu ${r.status}\n${fin}`);
  }
  return r.stdout;
}

export async function instantane(url, conteneur, urlDansConteneur = url) {
  const client = await connecter(url);
  try {
    const { complements } = await lireBase(client);
    return normaliserDump(pgDump(conteneur, urlDansConteneur)) + '\n' + rendreComplements(complements);
  } finally {
    await client.end();
  }
}

// ─── Comparaison objet par objet ────────────────────────────────────

/**
 * Decoupe un instantane en objets. pg_dump precede chaque objet de
 *   --
 *   -- Name: tasks; Type: TABLE; Schema: public; Owner: -
 *   --
 * Les complements (une ligne = un objet) sont cles par leur ligne entiere.
 */
export function objets(texte) {
  const carte = new Map();
  const vus = new Map();
  const poser = (cle, lignes) => {
    const n = (vus.get(cle) ?? 0) + 1;
    vus.set(cle, n);
    carte.set(n > 1 ? `${cle} #${n}` : cle, lignes.join('\n').trim());
  };
  const lignes = String(texte).replace(/\r\n?/g, '\n').split('\n');
  const debutComplements = lignes.findIndex((l) => l.startsWith('-- ─── Objets poses hors du schema'));
  const dump = debutComplements >= 0 ? lignes.slice(0, debutComplements) : lignes;
  const complements = debutComplements >= 0 ? lignes.slice(debutComplements + 1) : [];

  let cle = '(en-tete)';
  let tampon = [];
  for (let i = 0; i < dump.length; i += 1) {
    const m = dump[i].match(/^-- Name: (.*); Type: ([^;]+); Schema: ([^;]*);/);
    if (m && dump[i - 1] === '--') {
      if (tampon.length && tampon.some((l) => l.trim() && l !== '--')) poser(cle, tampon.filter((l) => l !== '--'));
      cle = `${m[2]} ${m[3] && m[3] !== '-' ? `${m[3]}.` : ''}${m[1]}`;
      tampon = [];
      i += 1; // la ligne `--` qui ferme l'en-tete
      continue;
    }
    tampon.push(dump[i]);
  }
  if (tampon.some((l) => l.trim() && l !== '--')) poser(cle, tampon.filter((l) => l !== '--'));

  let section = 'COMPLEMENT';
  for (const l of complements) {
    if (/^-- (Triggers|Policies|storage\.buckets|pg_cron)/.test(l)) {
      section = `COMPLEMENT ${l.replace(/^-- /, '').split(' ')[0]}`;
      continue;
    }
    if (!l.trim() || /^-- \((aucun|aucune)\)$/.test(l)) continue;
    poser(`${section} ${l.trim()}`, [l]);
  }
  return carte;
}

/** Ecarts entre la base fraiche et la prod : trois listes de cles, plus les definitions. */
export function ecarts(fraiche, prod) {
  const a = objets(fraiche);
  const b = objets(prod);
  const seulementProd = [...b.keys()].filter((k) => !a.has(k)).sort();
  const seulementDepot = [...a.keys()].filter((k) => !b.has(k)).sort();
  const differents = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k)).sort();
  return { seulementProd, seulementDepot, differents, a, b, total: a.size };
}

/** Lignes propres a chaque cote (multiensemble), dans l'ordre : un diff d'objet lisible. */
export function diffLignes(depot, prod) {
  const compte = (lignes) => lignes.reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map());
  const ld = depot.split('\n');
  const lp = prod.split('\n');
  const cp = compte(lp);
  const cd = compte(ld);
  const moins = [];
  for (const l of ld) {
    if ((cp.get(l) ?? 0) > 0) cp.set(l, cp.get(l) - 1);
    else moins.push(`- ${l}`);
  }
  const plus = [];
  for (const l of lp) {
    if ((cd.get(l) ?? 0) > 0) cd.set(l, cd.get(l) - 1);
    else plus.push(`+ ${l}`);
  }
  return [...moins, ...plus];
}

/** Rien de personnel ni de secret ne part au journal, meme si une definition en portait. */
export function masquer(texte) {
  return String(texte)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+/g, '<adresse>')
    .replace(/eyJ[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]+)*/g, '<jeton>')
    .replace(/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]+/g, '<cle>')
    .replace(/whsec_[A-Za-z0-9]+/g, '<cle>')
    .replace(/postgres(ql)?:\/\/[^\s'"]+/g, '<url>');
}

export function rapport(e, { maxLignes = 60 } = {}) {
  const out = [];
  out.push(`Objets compares : ${e.total} cote depot, ${e.b.size} cote production.`);
  out.push(`En production seulement : ${e.seulementProd.length}`);
  for (const k of e.seulementProd) {
    out.push(`  + ${k}`);
    for (const l of e.b.get(k).split('\n').slice(0, maxLignes)) out.push(`      ${l}`);
  }
  out.push(`Dans le depot seulement : ${e.seulementDepot.length}`);
  for (const k of e.seulementDepot) out.push(`  - ${k}`);
  out.push(`Definitions differentes : ${e.differents.length}`);
  for (const k of e.differents) {
    out.push(`  ~ ${k}`);
    for (const l of diffLignes(e.a.get(k), e.b.get(k)).slice(0, maxLignes)) out.push(`      ${l}`);
  }
  return masquer(out.join('\n'));
}

// ─── Orchestration ──────────────────────────────────────────────────

function annoter(message) {
  if (!process.env.GITHUB_ACTIONS) return;
  const echappe = String(message).replace(/%/g, '%25').replace(/\r?\n/g, '%0A');
  console.log(`::error title=Base fraiche contre production::${echappe}`);
}

function resumer(texte) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texte}\n`);
}

function urlProd(env) {
  const url = env.PROD_DB_URL;
  if (!url) throw new Error('PROD_DB_URL absent : aucun verdict sans avoir lu la production.');
  return url;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const [commande] = argv;
  const racine = process.cwd();
  try {
    if (commande === 'en-attente') {
      const fichiers = readdirSync(join(racine, DOSSIER_MIGRATIONS));
      if (!fichiers.some((f) => RE_BASELINE.test(f))) throw new Error(`aucune baseline dans ${DOSSIER_MIGRATIONS}`);
      const client = await connecter(urlProd(env));
      let ledger;
      try {
        ledger = (await client.query(SQL_LEDGER)).rows;
      } finally {
        await client.end();
      }
      if (ledger.length === 0) throw new Error('ledger de production vide : lecture suspecte, aucune conclusion.');
      const attente = enAttente(fichiersPosterieurs(fichiers), ledger);
      const lignes = attente.length
        ? attente.map((m) => `  · ${m.fichier} (ni la version ${m.version} ni le nom ${m.nom} au ledger)`)
        : ['  (aucune : tout supabase/migrations/ est en production)'];
      console.log(`Migrations du depot pas encore en production : ${attente.length}\n${lignes.join('\n')}`);
      resumer(`### Migrations en attente de production (${attente.length})\n\n${attente.map((m) => `- \`${m.fichier}\``).join('\n') || '- aucune'}\n`);
      if (argv.includes('--retirer')) {
        for (const m of attente) unlinkSync(join(racine, DOSSIER_MIGRATIONS, m.fichier));
        if (attente.length) console.log(`Retirees de l'arbre du runner : ${attente.length} (la base fraiche ne construira que ce que la prod a recu).`);
      }
      return 0;
    }
    if (commande === 'comparer') {
      const conteneur = `supabase_db_${projetId(racine)}`;
      const local = env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
      // Le conteneur joint sa propre base par son nom de reseau interne.
      const localDansConteneur = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';
      const fraiche = await instantane(local, conteneur, localDansConteneur);
      const prod = await instantane(urlProd(env), conteneur);
      const e = ecarts(fraiche, prod);
      const texte = rapport(e);
      const n = e.seulementProd.length + e.seulementDepot.length + e.differents.length;
      console.log(texte);
      resumer(`### Base fraiche contre production : ${n === 0 ? 'identiques' : `${n} ecart(s)`}\n\n\`\`\`\n${texte.split('\n').slice(0, 400).join('\n')}\n\`\`\`\n`);
      if (n === 0) {
        console.log(`\n✓ La base fraiche reconstruite par la CLI egale la production (${e.total} objets).`);
        return 0;
      }
      annoter(`${n} ecart(s) entre la base fraiche et la production.\n${texte.split('\n').slice(0, 25).join('\n')}`);
      return 1;
    }
    console.error('Usage : node scripts/schema-prod.mjs en-attente [--retirer] | comparer');
    return 2;
  } catch (err) {
    const m = masquer(err.message);
    console.error(`✖ ${m}`);
    annoter(m);
    return 1;
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  process.exitCode = await main();
}
