// ═══════════════════════════════════════════════════════════════════
// check-migration-coverage.mjs — RECOUVREMENT depot <-> ledger de prod (C-79)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Mesure du 2026-09-14, nom a nom : 152 fichiers dans supabase/migration/,
// 138 entrees dans supabase_migrations.schema_migrations. 32 fichiers sans
// aucune correspondance, 17 entrees sans fichier.
//
// L'enonce « tout le depot est applique en prod, ledger relu » a ete ecrit
// CINQ FOIS dans CLAUDE.md sur une lecture qui ne recouvre que 120 fichiers
// sur 152. Et « ledger a 148 entrees » etait le NUMERO de la derniere
// migration, recopie comme un total.
//
// ❌ Ne pas se contenter d'un comptage : c'est precisement le comptage qui a
// menti. Ce script ne compte pas, il RANGE chaque fichier dans un verdict, et
// n'echoue que sur le dernier.
//
// ── LES VERDICTS ────────────────────────────────────────────────────
//
//   AU LEDGER      le nom du fichier a une entree. C'est la preuve la plus
//                  forte dont on dispose ici, et elle reste faible (cf. plus
//                  bas).
//   OBJET EN BASE  aucune entree, mais au moins un des objets que le fichier
//                  pretend creer EXISTE dans le catalogue Postgres. C'est le
//                  cas des migrations precoces (000 a 058, plus 081 et 082),
//                  passees avant que le ledger serve.
//   OBJET RETIRE   aucune entree, et tous ses objets ont ete supprimes par une
//   DEPUIS         migration ULTERIEURE. Mesure, pas declare : les mig. 013,
//                  015 et 016 ont ete videes par la 141 (C-04, 2026-09-04).
//   SUPPRESSION    le fichier ne cree rien et ne fait que supprimer ; ses
//   VERIFIEE       cibles sont bien absentes du catalogue. Un effet negatif se
//                  mesure aussi (mig. 090).
//   SANS OBJET     GRANT ou migration de donnees : le catalogue n'en garde
//   VERIFIABLE     aucune trace. DECLARE un par un, avec son motif, parce
//                  qu'un fichier qu'on ne sait pas verifier doit se voir.
//   NON APPLIQUEE  absence DELIBEREE et declaree (mig. 140, qui se joue dans
//   (declaree)     la fenetre de bascule Stripe live).
//   ABSENT DES DEUX -> ECHEC. Le depot decrit un objet que la prod n'a pas.
//
// ── CE QUE CE SCRIPT NE PROUVE PAS, ET IL FAUT LE DIRE ──────────────
//
// 🔴 UNE LIGNE AU LEDGER NE PROUVE PAS QU'UN `CREATE OR REPLACE` A REMPLACE
// LE CORPS VIVANT. La mig. 144 portait sa ligne depuis le 2026-09-09 et
// `pg_get_functiondef()` montrait encore le corps de la 143 : il a fallu la
// rejouer sous la 147. Ce script rendrait « AU LEDGER » sur la 144, et il
// aurait eu tort de rassurer.
//
// 🔴 « OBJET EN BASE » NE PROUVE PAS QUE TOUT LE FICHIER EST PASSE. Un
// fichier qui cree trois objets dont un seul existe rend ce verdict. Le
// script le DIT dans sa sortie plutot que de le taire.
//
// La seule preuve forte reste celle qui a servi pour la 147 : interroger le
// catalogue sur l'objet que la migration pretend creer, ou rejouer le chemin
// reel dans une transaction annulee. Ce script automatise le grossier ; il ne
// remplace pas le fin, et sa sortie le rappelle a chaque execution.
//
// ⚠️ `npm run check:drift` ne comble pas ce trou : il compare un SCHEMA
// AGREGE, pas un journal, et ne sait donc pas dire QUEL fichier manque.
//
// ── USAGE (2 etapes, lecture seule cote prod) ───────────────────────
//
//   1. node scripts/check-migration-coverage.mjs --print-sql
//      -> affiche la requete d'introspection a executer sur la prod.
//         Elle renvoie UNE ligne JSON.
//   2. node scripts/check-migration-coverage.mjs <introspection.json>
//      -> range les fichiers et sort en 1 si l'un d'eux est ABSENT DES DEUX.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolu depuis l'emplacement du SCRIPT, pas depuis `cwd`. `COSMO_MIGRATION_DIR`
// n'existe que pour le temoin (`scripts/check-migration-coverage.guard.test.mjs`),
// qui doit pouvoir lui soumettre un jeu de migrations fabrique. Sans cette
// porte, la garde ne serait verifiable que contre le depot entier, donc pas
// verifiable du tout.
const MIGRATION_DIR =
  process.env.COSMO_MIGRATION_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migration');

/**
 * Migrations que le depot porte SANS qu'elles soient appliquees, DELIBEREMENT.
 *
 * 🔴 Meme discipline que `.github/edge-deploy.json` : une dispense declare
 * l'EXISTENCE d'un ecart voulu, son motif et sa date. Elle ne peut PAS faire
 * taire un ecart non voulu, et une entree qui se revele FAUSSE (la migration
 * est en fait appliquee) fait ECHOUER la garde. Sans cette symetrie, la
 * dispense perimerait en silence, ce qui est exactement le defaut que tout ce
 * fichier existe pour fermer.
 *
 * ❌ Ne JAMAIS y ajouter une entree pour faire passer la CI. Une migration
 * qu'on veut appliquer s'applique ; une migration qu'on ne veut pas appliquer
 * se declare ici, avec la raison.
 */
const NON_APPLIQUEES_DELIBEREMENT = {
  '140_stripe_identifiers_reset':
    "Se joue DANS la fenetre de bascule Stripe live, jamais avant : tant que la "
    + "cle est une cle de test, chaque checkout reecrit un identifiant de test. "
    + "Declare le 2026-09-15 (cf. CLAUDE.md, section facturation entreprise).",
};

/**
 * Migrations qui ne creent ni ne suppriment AUCUN objet de catalogue.
 *
 * ⚠️ Ce n'est pas une dispense de conformite, c'est l'aveu d'une LIMITE : le
 * catalogue Postgres ne garde aucune trace d'un GRANT par defaut ni d'un
 * `INSERT` de rattrapage. La garde ne peut rien en dire, et elle le DIT plutot
 * que de les ranger en vert sans le signaler.
 *
 * ❌ N'y mettre que des fichiers reellement sans objet. Un fichier qui cree
 * quoi que ce soit se verifie, et une entree ici le soustrairait a la mesure.
 */
const SANS_OBJET_VERIFIABLE = {
  '000_default_privileges':
    "N'ecrit que des GRANT et des ALTER DEFAULT PRIVILEGES. Aucun objet de "
    + "catalogue, donc rien a interroger. Son effet se lit dans les ACL "
    + "(has_function_privilege / has_table_privilege), que `npm run check:rls` "
    + "regarde deja. Declare le 2026-09-15.",
  '038_backfill_okr_key_results':
    "Migration de DONNEES : elle recopie les Key Results du JSONB okrs.key_results "
    + "vers la table dediee (mig. 008). Elle ne cree aucun objet, et son effet est "
    + "un nombre de lignes, qui depend du contenu des comptes et ne peut donc pas "
    + "faire l objet d une assertion stable. Declare le 2026-09-15.",
};

// ─── Parsing : quels objets CE fichier pretend-il creer ? ────────────

const norm = (s) => s.replace(/^public\./i, '').replace(/"/g, '').toLowerCase();

/**
 * Les objets crees par un fichier de migration.
 *
 * ⚠️ On ne suit PAS les DROP ici, contrairement a `check-prod-drift.mjs`. La
 * question n'est pas « quel etat final le depot decrit-il » mais « ce fichier
 * a-t-il laisse une trace en base ». Un objet cree puis supprime par une
 * migration ULTERIEURE ne dit rien de celle-ci ; c'est justement pour ca que le
 * verdict « OBJET EN BASE » est une preuve FAIBLE, et que le script le dit.
 */
function objetsCrees(sql) {
  const propre = sql.replace(/--[^\n]*/g, '');
  const out = {
    tables: [], columns: [], functions: [], indexes: [],
    policies: [], triggers: [], constraints: [],
  };

  for (const m of propre.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)) {
    out.tables.push(norm(m[1]));
  }
  for (const m of propre.matchAll(
    /alter\s+table\s+(?:if\s+exists\s+)?([\w."]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([\w"]+)/gi,
  )) {
    out.columns.push(`${norm(m[1])}.${norm(m[2])}`);
  }
  for (const m of propre.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi)) {
    out.functions.push(norm(m[1]));
  }
  for (const m of propre.matchAll(
    /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([\w."]+)/gi,
  )) {
    out.indexes.push(norm(m[1]));
  }
  for (const m of propre.matchAll(
    // Le nom d'une policy peut etre entre guillemets OU nu : les deux formes
    // existent dans ce depot, et n'en reconnaitre qu'une a deja produit un faux
    // positif dans `check-prod-drift.mjs` (mig. 135).
    /create\s+policy\s+(?:"([^"]+)"|([a-z_][\w$]*))\s+on\s+([\w."]+)/gi,
  )) {
    out.policies.push(`${(m[1] ?? m[2]).toLowerCase()}@@${norm(m[3])}`);
  }
  for (const m of propre.matchAll(/create\s+(?:or\s+replace\s+)?trigger\s+([\w."]+)/gi)) {
    out.triggers.push(norm(m[1]));
  }
  // `ADD CONSTRAINT` : c'est ce qui rend la mig. 037 verifiable. Sans lui, une
  // migration qui ne fait que reposer une cle etrangere (`ON DELETE CASCADE`)
  // n'a AUCUN objet identifiable, et la garde ne sait rien en dire.
  for (const m of propre.matchAll(/add\s+constraint\s+([\w"]+)/gi)) {
    out.constraints.push(norm(m[1]));
  }
  return out;
}

/**
 * Les objets qu'un fichier SUPPRIME.
 *
 * 🔴 Deux verdicts en dependent, et aucun des deux n'etait dans la premiere
 * version de ce script :
 *
 *   • « OBJET RETIRE DEPUIS » : un fichier dont TOUS les objets ont ete
 *     supprimes par une migration ULTERIEURE est legitimement invisible du
 *     catalogue. Mesure : les mig. 013, 015 et 016 creent
 *     `subscriptions_guard`, `consume_premium_token` et
 *     `credit_premium_token_from_ad`, que la mig. 141 a supprimees le
 *     2026-09-04 (C-04). Sans ce verdict, la garde reclamait trois migrations
 *     bel et bien appliquees, et il aurait fallu les dispenser a la main, donc
 *     ecrire un allowlist la ou une MESURE suffit.
 *
 *   • « SUPPRESSION VERIFIEE » : un fichier qui ne cree rien et ne fait que
 *     supprimer se verifie par l'ABSENCE de ses cibles. C'est le cas de la
 *     mig. 090. Son effet est negatif, il se mesure quand meme.
 */
function objetsSupprimes(sql) {
  const propre = sql.replace(/--[^\n]*/g, '');
  const out = {
    tables: [], columns: [], functions: [], indexes: [],
    policies: [], triggers: [], constraints: [],
  };
  for (const m of propre.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?([\w."]+)/gi)) {
    out.tables.push(norm(m[1]));
  }
  for (const m of propre.matchAll(/drop\s+column\s+(?:if\s+exists\s+)?([\w"]+)/gi)) {
    // La colonne seule : le nom de table n'est pas dans le meme fragment. On la
    // resout contre la table de l'ALTER le plus proche en amont, ci-dessous.
    out.columns.push(norm(m[1]));
  }
  for (const m of propre.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?([\w."]+)/gi)) {
    out.functions.push(norm(m[1]));
  }
  for (const m of propre.matchAll(/drop\s+index\s+(?:if\s+exists\s+)?([\w."]+)/gi)) {
    out.indexes.push(norm(m[1]));
  }
  for (const m of propre.matchAll(
    /drop\s+policy\s+(?:if\s+exists\s+)?(?:"([^"]+)"|([a-z_][\w$]*))\s+on\s+([\w."]+)/gi,
  )) {
    out.policies.push(`${(m[1] ?? m[2]).toLowerCase()}@@${norm(m[3])}`);
  }
  for (const m of propre.matchAll(/drop\s+trigger\s+(?:if\s+exists\s+)?([\w."]+)/gi)) {
    out.triggers.push(norm(m[1]));
  }
  for (const m of propre.matchAll(/drop\s+constraint\s+(?:if\s+exists\s+)?([\w"]+)/gi)) {
    out.constraints.push(norm(m[1]));
  }
  return out;
}

/** Nom de fichier -> cle comparable a une entree de ledger. */
function clesLedger(fichier) {
  const base = fichier.replace(/\.sql$/i, '').toLowerCase();
  // Le ledger de Supabase stocke tantot le nom complet du fichier, tantot son
  // `name` sans prefixe numerique, tantot un nom libre d'une autre epoque.
  // On accepte les deux formes que le depot peut produire ; le reste est du
  // ressort du verdict « OBJET EN BASE ».
  const sansPrefixe = base.replace(/^\d+[a-z]?_/, '');
  return [base, sansPrefixe];
}

// ─── SQL d'introspection (lecture seule) ────────────────────────────

const INTROSPECTION_SQL = `
SELECT json_build_object(
  'ledger', (
    SELECT coalesce(json_agg(lower(coalesce(version, '') || '_' || coalesce(name, ''))
                             ORDER BY version), '[]'::json)
    FROM supabase_migrations.schema_migrations
  ),
  'ledger_names', (
    SELECT coalesce(json_agg(DISTINCT lower(name)), '[]'::json)
    FROM supabase_migrations.schema_migrations WHERE name IS NOT NULL
  ),
  'tables', (
    SELECT coalesce(json_agg(lower(tablename) ORDER BY tablename), '[]'::json)
    FROM pg_tables WHERE schemaname = 'public'
  ),
  'columns', (
    SELECT coalesce(json_agg(lower(table_name) || '.' || lower(column_name)), '[]'::json)
    FROM information_schema.columns WHERE table_schema = 'public'
  ),
  'functions', (
    SELECT coalesce(json_agg(DISTINCT lower(p.proname)), '[]'::json)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ),
  'constraints', (
    SELECT coalesce(json_agg(lower(conname)), '[]'::json)
    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
  ),
  'indexes', (
    SELECT coalesce(json_agg(lower(indexname)), '[]'::json)
    FROM pg_indexes WHERE schemaname = 'public'
  ),
  'policies', (
    SELECT coalesce(json_agg(lower(polname) || '@@' || lower(c.relname)), '[]'::json)
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'storage')
  ),
  'triggers', (
    SELECT coalesce(json_agg(DISTINCT lower(t.tgname)), '[]'::json)
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'auth') AND NOT t.tgisinternal
  )
) AS introspection;
`.trim();

// ─── Classement ─────────────────────────────────────────────────────

export const VERDICT = {
  LEDGER: 'AU LEDGER',
  OBJET: 'OBJET EN BASE',
  RETIRE: 'OBJET RETIRE DEPUIS',
  SUPPRESSION: 'SUPPRESSION VERIFIEE',
  SANS_OBJET: 'SANS OBJET VERIFIABLE',
  DECLAREE: 'NON APPLIQUEE (declaree)',
  ABSENT: 'ABSENT DES DEUX',
};

/**
 * Range chaque fichier de migration dans un verdict.
 *
 * @param {{name: string, sql: string}[]} fichiers
 * @param {object} intro  l'introspection de prod
 */
export function classer(fichiers, intro) {
  const ledger = new Set([
    ...(intro.ledger ?? []).map((s) => String(s).toLowerCase()),
    ...(intro.ledger_names ?? []).map((s) => String(s).toLowerCase()),
  ]);
  const KINDS = ['tables', 'columns', 'functions', 'indexes', 'policies', 'triggers', 'constraints'];
  const catalogue = {};
  for (const k of KINDS) catalogue[k] = new Set((intro[k] ?? []).map(String));

  // ── Qui supprime quoi, et QUAND ──
  //
  // Les fichiers sont lus dans l'ordre de leur nom, qui est l'ordre
  // d'application. Pour chaque objet, on retient les fichiers qui le
  // suppriment ; « ulterieur » se lit alors sur cet ordre.
  //
  // ⚠️ Un fichier qui SUPPRIME PUIS RECREE le meme objet ne le supprime pas :
  // `DROP ... IF EXISTS` suivi d'un `CREATE` est le motif idempotent normal de
  // ce depot. Compte naivement, il faisait dire a la garde que la mig. 015
  // avait supprime `trg_subscriptions_guard`, alors qu'elle le repose. On
  // retranche donc de chaque fichier ce qu'il recree lui-meme.
  const supprimeParFichier = new Map();
  for (const { name, sql } of fichiers) {
    const sup = objetsSupprimes(sql);
    const cre = objetsCrees(sql);
    for (const k of KINDS) sup[k] = sup[k].filter((n) => !cre[k].includes(n));
    supprimeParFichier.set(name, sup);
  }
  const ordre = new Map(fichiers.map((f, i) => [f.name, i]));

  /** Le fichier ULTERIEUR a `name` qui supprime `kind: nom`, s'il existe. */
  const supprimeApres = (name, kind, nom) => {
    for (const [autre, sup] of supprimeParFichier) {
      if (ordre.get(autre) <= ordre.get(name)) continue;
      if (sup[kind]?.includes(nom)) return autre;
    }
    return null;
  };

  const resultats = [];
  for (const { name, sql } of fichiers) {
    const cles = clesLedger(name);
    const auLedger = cles.some((c) => ledger.has(c));
    const cleDeclaree = cles.find((c) => NON_APPLIQUEES_DELIBEREMENT[c]);

    const objets = objetsCrees(sql);
    const total = KINDS.reduce((n, k) => n + objets[k].length, 0);
    const trouves = [];
    const manquants = [];
    const retires = [];
    for (const kind of KINDS) {
      for (const nom of objets[kind]) {
        if (catalogue[kind].has(nom)) { trouves.push(`${kind}: ${nom}`); continue; }
        const par = supprimeApres(name, kind, nom);
        if (par) { retires.push(`${kind}: ${nom} (supprime par ${par})`); continue; }
        manquants.push(`${kind}: ${nom}`);
      }
    }

    // 🔴 Une dispense qui se revele FAUSSE fait echouer la garde. Une migration
    // declaree « non appliquee » qui est en fait au ledger, ou dont les objets
    // sont en base, decrit un etat perime : la declaration doit tomber, pas
    // survivre en silence.
    if (cleDeclaree) {
      if (auLedger || trouves.length > 0) {
        resultats.push({
          name, verdict: VERDICT.ABSENT, total, trouves, manquants, retires,
          raison:
            'DECLAREE non appliquee, mais elle L EST : '
            + (auLedger ? 'une ligne au ledger' : `objet(s) en base (${trouves.join(', ')})`)
            + '. Retirer l entree de NON_APPLIQUEES_DELIBEREMENT.',
        });
      } else {
        resultats.push({
          name, verdict: VERDICT.DECLAREE, total, trouves, manquants, retires,
          raison: NON_APPLIQUEES_DELIBEREMENT[cleDeclaree],
        });
      }
      continue;
    }

    if (auLedger) {
      resultats.push({ name, verdict: VERDICT.LEDGER, total, trouves, manquants, retires });
      continue;
    }
    if (trouves.length > 0) {
      resultats.push({ name, verdict: VERDICT.OBJET, total, trouves, manquants, retires });
      continue;
    }
    // Tous ses objets ont ete supprimes par une migration ULTERIEURE : il est
    // legitimement invisible du catalogue, et ca se MESURE. Cf. les mig. 013,
    // 015 et 016, videes par la 141.
    if (total > 0 && retires.length === total) {
      resultats.push({
        name, verdict: VERDICT.RETIRE, total, trouves, manquants, retires,
        raison: retires.join(', '),
      });
      continue;
    }

    // Aucune creation : le fichier ne fait peut-etre que SUPPRIMER. Son effet
    // est negatif, il se verifie quand meme, par l'absence de ses cibles.
    const sup = supprimeParFichier.get(name);
    const ciblesSup = KINDS.flatMap((k) => sup[k].map((n) => [k, n]));
    if (total === 0 && ciblesSup.length > 0) {
      const survivantes = ciblesSup.filter(([k, n]) => catalogue[k].has(n));
      if (survivantes.length === 0) {
        resultats.push({
          name, verdict: VERDICT.SUPPRESSION, total, trouves, manquants, retires,
          raison: `${ciblesSup.length} cible(s) de suppression, toutes absentes du catalogue`,
        });
      } else {
        resultats.push({
          name, verdict: VERDICT.ABSENT, total, trouves, manquants, retires,
          raison:
            'ne fait que supprimer, et ses cibles sont TOUJOURS LA : '
            + survivantes.map(([k, n]) => `${k}: ${n}`).join(', '),
        });
      }
      continue;
    }

    const motifSansObjet = SANS_OBJET_VERIFIABLE[cles.find((c) => SANS_OBJET_VERIFIABLE[c])];
    if (total === 0 && motifSansObjet) {
      resultats.push({
        name, verdict: VERDICT.SANS_OBJET, total, trouves, manquants, retires,
        raison: motifSansObjet,
      });
      continue;
    }

    resultats.push({
      name, verdict: VERDICT.ABSENT, total, trouves, manquants, retires,
      raison:
        total === 0
          ? "aucune entree au ledger, et le fichier ne cree ni ne supprime AUCUN objet "
            + "identifiable (GRANT, migration de donnees) : rien ne permet de dire s il est "
            + "passe. Si c est voulu, le DECLARER dans SANS_OBJET_VERIFIABLE avec son motif."
          : `aucune entree au ledger, et aucun de ses ${total} objet(s) n existe en base`,
    });
  }
  return resultats;
}

export function lireMigrations(dir = MIGRATION_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));
}

// ─── CLI ────────────────────────────────────────────────────────────

function main() {
  const arg = process.argv[2];

  if (arg === '--print-sql') {
    console.log(INTROSPECTION_SQL);
    return 0;
  }
  if (!arg) {
    console.error('Usage : check-migration-coverage.mjs --print-sql | <introspection.json>');
    return 2;
  }

  let intro;
  try {
    const brut = JSON.parse(readFileSync(arg, 'utf8'));
    // Accepte la forme rendue par le MCP / le SQL editor (un tableau d'une
    // ligne, ou l'objet directement).
    intro = Array.isArray(brut) ? (brut[0].introspection ?? brut[0]) : (brut.introspection ?? brut);
  } catch (e) {
    console.error(`Introspection illisible (${arg}) : ${e.message}`);
    return 2;
  }

  // 🔴 REFUSER UN VERDICT RENDU SANS AVOIR RIEN LU. C'est la classe de defaut
  // de `restore-drill.yml`, dont le controle NE POUVAIT PAS echouer. Une
  // introspection vide rendrait « ABSENT DES DEUX » sur les 152 fichiers, donc
  // un rouge spectaculaire ; mais un ledger vide avec un catalogue plein
  // rendrait « OBJET EN BASE » partout, donc un VERT qui ne mesure rien.
  if ((intro.ledger ?? []).length === 0 && (intro.ledger_names ?? []).length === 0) {
    console.error('ECHEC : le ledger lu est VIDE. Une garde ne rend pas de verdict sans avoir lu.');
    return 1;
  }
  if ((intro.tables ?? []).length === 0) {
    console.error('ECHEC : le catalogue lu est VIDE. Une garde ne rend pas de verdict sans avoir lu.');
    return 1;
  }

  const fichiers = lireMigrations();
  const resultats = classer(fichiers, intro);

  const parVerdict = {};
  for (const r of resultats) (parVerdict[r.verdict] ??= []).push(r);

  console.log(`Fichiers de migration lus : ${fichiers.length}`);
  console.log(`Entrees de ledger lues    : ${(intro.ledger ?? []).length}`);
  console.log('');
  for (const v of [
    VERDICT.LEDGER, VERDICT.OBJET, VERDICT.RETIRE, VERDICT.SUPPRESSION,
    VERDICT.SANS_OBJET, VERDICT.DECLAREE, VERDICT.ABSENT,
  ]) {
    console.log(`  ${v.padEnd(26)} ${String((parVerdict[v] ?? []).length).padStart(3)}`);
  }
  console.log('');

  // Les partiels ne font PAS echouer : ils NOMMENT ce que le verdict ne prouve
  // pas. Les taire reviendrait a laisser « OBJET EN BASE » passer pour « tout
  // le fichier est passe », ce qu'il ne dit pas.
  const partiels = (parVerdict[VERDICT.OBJET] ?? []).filter((r) => r.manquants.length > 0);
  if (partiels.length > 0) {
    console.log(`⚠️  ${partiels.length} fichier(s) « OBJET EN BASE » n ont qu une partie de leurs objets :`);
    for (const r of partiels) {
      console.log(`   ${r.name} : ${r.trouves.length}/${r.total} trouves, manque ${r.manquants.join(', ')}`);
    }
    console.log('');
  }

  for (const r of parVerdict[VERDICT.RETIRE] ?? []) {
    console.log(`ℹ️  ${r.name} : appliquee puis VIDEE par une migration ulterieure. ${r.raison}`);
  }
  for (const r of parVerdict[VERDICT.SUPPRESSION] ?? []) {
    console.log(`ℹ️  ${r.name} : migration purement suppressive. ${r.raison}`);
  }
  for (const r of parVerdict[VERDICT.SANS_OBJET] ?? []) {
    console.log(`⚠️  ${r.name} : NON VERIFIABLE par le catalogue. ${r.raison}`);
  }
  for (const r of parVerdict[VERDICT.DECLAREE] ?? []) {
    console.log(`ℹ️  ${r.name} : non appliquee, DECLAREE. ${r.raison}`);
  }

  const absents = parVerdict[VERDICT.ABSENT] ?? [];
  if (absents.length > 0) {
    console.error('');
    console.error(`❌ ${absents.length} fichier(s) ABSENT(S) DES DEUX :`);
    for (const r of absents) console.error(`   ${r.name} : ${r.raison}`);
    console.error('');
    console.error('Soit la migration doit etre appliquee, soit son absence est');
    console.error('deliberee et se DECLARE dans NON_APPLIQUEES_DELIBEREMENT, avec');
    console.error('son motif et sa date. Jamais un silence.');
    return 1;
  }

  console.log('✅ Aucun fichier absent des deux.');
  console.log('');
  console.log('⚠️  CE QUE CE VERT NE DIT PAS : une ligne au ledger ne prouve pas');
  console.log('   qu un CREATE OR REPLACE a remplace le corps vivant (mig. 144,');
  console.log('   rejouee par la 147), et « objet en base » ne prouve pas que tout');
  console.log('   le fichier est passe. La preuve forte reste pg_get_functiondef');
  console.log('   ou une transaction annulee qui rejoue le chemin reel.');
  return 0;
}

// Pas de shebang (cf. `scripts/ops-alert.mjs`) : le temoin importe ce module,
// et la chaine Vite/vitest ne retire pas le shebang que Node retire.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  process.exit(main());
}

export { INTROSPECTION_SQL, objetsCrees, objetsSupprimes, clesLedger, NON_APPLIQUEES_DELIBEREMENT, SANS_OBJET_VERIFIABLE };
