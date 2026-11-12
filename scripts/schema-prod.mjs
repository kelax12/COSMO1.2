// ═══════════════════════════════════════════════════════════════════
// schema-prod.mjs · LE DEPOT REJOUE EGALE-T-IL LA PRODUCTION ? (TST-06, ROB-02)
//
// `check:migration-coverage` dit si chaque FICHIER a laisse une trace en
// prod ; il ne dit pas que la base reconstruite depuis le depot EST la prod
// (une ligne au ledger ne prouve pas qu'un `CREATE OR REPLACE` a remplace le
// corps vivant, mig. 144). Ce script compare deux instantanes rendus par le
// MEME pg_dump (celui du conteneur de la stack locale), au MEME format que
// `supabase/schema.sql` :
//   · la base FRAICHE : `supabase start` + `scripts/apply-migrations.mjs` sur
//     `supabase/migration/`, moins les migrations pas encore en prod ;
//   · la PRODUCTION, lue en LECTURE SEULE (pg_dump --schema-only, catalogue).
// Objet par objet : « en prod seulement », « dans le depot seulement »,
// « different ». Repris de `noyau/migrations-cli` (2026-11-09) pour tourner
// sur `main` sans la baseline CLI.
//
// Deux commandes :
//   node scripts/schema-prod.mjs en-attente <introspection.json> [--retirer]
//       Les migrations du depot pas en prod, au sens de la porte Edge
//       (`enAttenteDeProduction`, meme classeur que `check:migration-coverage`).
//       Avec `--retirer`, les efface de l'arbre du RUNNER avant le rejeu.
//   node scripts/schema-prod.mjs comparer
//       Compare base fraiche (DATABASE_URL, defaut stack locale) et production
//       (PROD_DB_URL). Sortie 1 au premier ecart.
//
// 🔴 AUCUNE ecriture en production : `select` sur le catalogue, pg_dump
// --schema-only, session `read only`. Aucun artefact : le journal (public)
// porte la liste des objets en ecart et leurs definitions, masquees.
// ⚠️ Pas de shebang : le temoin importe ce module (cf. `scripts/CLAUDE.md`).
// ═══════════════════════════════════════════════════════════════════
import { readFileSync, unlinkSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { lireBase, normaliserDump, rendreComplements, projetId } from './contrat-donnees.mjs';
import { classer, lireMigrations, enAttenteDeProduction } from './check-migration-coverage.mjs';

export const DOSSIER_MIGRATIONS = 'supabase/migration';

/** Les fichiers du depot que la prod n'a pas, lus sur une introspection de `check:migration-coverage`. */
export function enAttente(fichiers, intro) {
  return enAttenteDeProduction(classer(fichiers, intro)).map((r) => r.name);
}

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

/**
 * Le rapport : la liste des ecarts, puis (`complet`) la definition ENTIERE de
 * chaque objet tel qu'il est en production, entre `<<< prod <cle>` et `>>>`.
 * C'est elle qui se reporte dans la baseline : un diff de lignes ne dit pas
 * l'ordre des colonnes d'une table.
 */
export function rapport(e, { maxLignes = 60, complet = false } = {}) {
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
  if (complet) {
    out.push('', 'Definitions de production des objets en ecart :');
    for (const k of [...e.seulementProd, ...e.differents]) out.push(`<<< prod ${k}`, e.b.get(k), '>>>');
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
      const chemin = argv[1];
      if (!chemin) throw new Error('en-attente : chemin de l introspection attendu.');
      const brut = JSON.parse(readFileSync(chemin, 'utf8'));
      const intro = Array.isArray(brut) ? (brut[0].introspection ?? brut[0]) : (brut.introspection ?? brut);
      if ((intro.ledger ?? []).length === 0) throw new Error('ledger de production vide : lecture suspecte, aucune conclusion.');
      const attente = enAttente(lireMigrations(join(racine, DOSSIER_MIGRATIONS)), intro);
      const liste = attente.map((f) => `  · ${f}`).join('\n') || '  (aucune)';
      console.log(`Migrations du depot pas encore en production : ${attente.length}\n${liste}`);
      const puces = attente.map((f) => `- \`${f}\``).join('\n') || '- aucune';
      resumer(`### Migrations en attente de production (${attente.length})\n\n${puces}\n`);
      if (argv.includes('--retirer')) {
        for (const f of attente) unlinkSync(join(racine, DOSSIER_MIGRATIONS, f));
        if (attente.length) console.log(`Retirees de l'arbre du runner : ${attente.length} (la base fraiche ne construit que ce que la prod a recu).`);
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
      console.log(rapport(e, { complet: true }));
      resumer(`### Base fraiche contre production : ${n === 0 ? 'identiques' : `${n} ecart(s)`}\n\n\`\`\`\n${texte.split('\n').slice(0, 400).join('\n')}\n\`\`\`\n`);
      if (n === 0) {
        console.log(`\n✓ La base rejouee depuis supabase/migration/ egale la production (${e.total} objets).`);
        return 0;
      }
      annoter(`${n} ecart(s) entre la base fraiche et la production.\n${texte.split('\n').slice(0, 25).join('\n')}`);
      return 1;
    }
    console.error('Usage : node scripts/schema-prod.mjs en-attente <introspection.json> [--retirer] | comparer');
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
