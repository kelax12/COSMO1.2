// ═══════════════════════════════════════════════════════════════════
// check-migration-coverage.mjs · RECOUVREMENT depot <-> ledger de prod (C-79)
//
// ❌ Ne pas se contenter d'un comptage : ce script RANGE chaque fichier dans un verdict et
// n'echoue que sur le dernier.
//   AU LEDGER      une entree au nom du fichier (preuve forte mais faible : mig. 144).
//   OBJET EN BASE  hors ledger, un objet cree existe au catalogue. Depuis la 200, le NOM ne
//                  suffit plus : definition de fonction / policy, cible de DROP (ROB-02).
//   OBJET RETIRE DEPUIS / SUPPRESSION VERIFIEE / SANS OBJET VERIFIABLE / NON APPLIQUEE (declaree)
//   ABSENT DES DEUX -> ECHEC : le depot decrit un objet que la prod n'a pas.
// 🔴 Une ligne au ledger ne prouve pas qu'un CREATE OR REPLACE a remplace le corps vivant ; « OBJET
// EN BASE » ne prouve pas que tout le fichier est passe (le script le DIT). Preuve forte :
// pg_get_functiondef, ou rejouer le chemin reel dans une transaction annulee.
//
// USAGE (lecture seule cote prod) :
//   1. node scripts/check-migration-coverage.mjs --print-sql   (requete d'introspection, une ligne JSON)
//   2. node scripts/check-migration-coverage.mjs <introspection.json> [--sens=depot]
//      sort en 1 sur un fichier pas en prod, ou une entree recente du ledger sans fichier (ROB-03) ;
//      `--sens=depot` ne juge que le premier sens (`edge-deploy.yml`, `ci-vert.yml` CI-05).
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolu depuis le SCRIPT, pas `cwd`. `COSMO_MIGRATION_DIR` : le temoin y soumet
// un jeu fabrique, et `ci-vert.yml` les migrations du SHA a tagger.
const MIGRATION_DIR =
  process.env.COSMO_MIGRATION_DIR
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migration');

/**
 * Non-appliquees DELIBEREMENT (ecart voulu, motif, date). Une entree FAUSSE (migration en fait
 * appliquee) fait ECHOUER la garde. ❌ Jamais d'entree pour faire passer la CI.
 */
const NON_APPLIQUEES_DELIBEREMENT = {};

/** Migrations sans objet de catalogue (GRANT, donnees) : aveu d'une LIMITE, pas dispense. ❌ Y mettre un fichier qui cree quoi que ce soit le soustrairait a la mesure. */
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

/** Les objets crees par un fichier. ⚠️ Les DROP ne sont pas suivis : « OBJET EN BASE » reste une preuve FAIBLE, dite telle. */
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
    // Nom de policy entre guillemets OU nu : en reconnaitre une seule a produit un faux positif (mig. 135).
    /create\s+policy\s+(?:"([^"]+)"|([a-z_][\w$]*))\s+on\s+([\w."]+)/gi,
  )) {
    out.policies.push(`${(m[1] ?? m[2]).toLowerCase()}@@${norm(m[3]).split('.').pop()}`);
  }
  for (const m of propre.matchAll(/create\s+(?:or\s+replace\s+)?trigger\s+([\w."]+)/gi)) {
    out.triggers.push(norm(m[1]));
  }
  // `ADD CONSTRAINT` rend la mig. 037 verifiable (elle ne fait que reposer une cle etrangere).
  for (const m of propre.matchAll(/add\s+constraint\s+([\w"]+)/gi)) {
    out.constraints.push(norm(m[1]));
  }
  out.proprietaires = tablesProprietaires(propre, out);
  return out;
}

/** La TABLE de chaque objet cree : un `DROP TABLE` emporte index, policies, triggers, colonnes, contraintes (mig. 196). Pas les fonctions. */
function tablesProprietaires(propre, out) {
  const map = new Map();
  for (const c of out.columns) map.set(`columns:${c}`, c.split('.')[0]);
  for (const p of out.policies) map.set(`policies:${p}`, p.split('@@')[1]);
  for (const m of propre.matchAll(
    /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([\w."]+)\s+on\s+(?:only\s+)?([\w."]+)/gi,
  )) {
    map.set(`indexes:${norm(m[1])}`, norm(m[2]));
  }
  for (const m of propre.matchAll(/create\s+(?:or\s+replace\s+)?trigger\s+([\w."]+)[^;]*?\son\s+([\w."]+)/gi)) {
    map.set(`triggers:${norm(m[1])}`, norm(m[2]));
  }
  // `ALTER TABLE t ... ADD CONSTRAINT c` : lu instruction par instruction, pour
  // ne jamais rattacher une contrainte a l'ALTER d'une AUTRE instruction.
  for (const instr of propre.split(';')) {
    const t = instr.match(/^\s*alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)/i);
    if (!t) continue;
    for (const m of instr.matchAll(/add\s+constraint\s+([\w"]+)/gi)) {
      map.set(`constraints:${norm(m[1])}`, norm(t[1]));
    }
  }
  return map;
}

/** Les objets qu'un fichier SUPPRIME (« OBJET RETIRE DEPUIS » : 013, 015, 016 par la 141 ; « SUPPRESSION VERIFIEE » : 090). */
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
    out.policies.push(`${(m[1] ?? m[2]).toLowerCase()}@@${norm(m[3]).split('.').pop()}`);
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

// ─── Definitions : un NOM en base ne prouve pas que CE fichier est passe (ROB-02) ─────
// Depuis la 200, hors ledger : fonction = corps normalise egal a un corps de prod ; policy =
// commande, roles, jetons de USING / WITH CHECK ; DROP = cible encore la, que rien ne recree.
// ⚠️ Preuve FAIBLE, dite telle : index, table, colonne, contrainte, trigger (nom seul), fonction
// `AS '...'`, introspection sans `function_bodies` / `policy_defs`.

const LITTERAL_OU_BRUIT = /('(?:[^']|'')*')|--[^\n]*|\/\*[\s\S]*?\*\/|\s+/g;
export const sansCommentairesNiBlancs = (t) => String(t).replace(LITTERAL_OU_BRUIT, (m, lit) => lit ?? ' ')
  .replace(/('(?:[^']|'')*')| {2,}/g, (m, lit) => lit ?? ' ').trim();

const MOTS_SQL = new Set(('public and or not is null true false in any all array select from where as exists case when then else end '
  + 'between like ilike uuid text int integer bigint boolean smallint timestamp timestamptz date jsonb json numeric varchar bpchar').split(' '));
const jetons = (expr) => {
  const lit = [...String(expr ?? '').matchAll(/'((?:[^']|'')*)'/g)].map((m) => `'${m[1].toLowerCase()}`);
  const mots = String(expr ?? '').replace(/'(?:[^']|'')*'/g, ' ').toLowerCase().match(/[a-z_][a-z0-9_]*/g) ?? [];
  return new Set([...lit, ...mots.filter((w) => !MOTS_SQL.has(w) && !/_\d+$/.test(w))]);
};
const memesJetons = (a, b) => { const [x, y] = [jetons(a), jetons(b)]; return x.size === y.size && [...x].every((j) => y.has(j)); };

/** Contenu de la parenthese qui suit `re` (qui se termine par `\(`). */
function groupe(s, re) {
  const m = re.exec(s);
  if (!m) return '';
  let [i, n] = [m.index + m[0].length, 1];
  const debut = i;
  for (; i < s.length && n; i += 1) n += s[i] === '(' ? 1 : s[i] === ')' ? -1 : 0;
  return s.slice(debut, i - 1);
}

/** Les definitions d'un fichier : corps de fonctions `$tag$...$tag$`, policies (commande, roles, USING, CHECK). */
export function definitionsCreees(sql) {
  const fonctions = new Map();
  const policies = new Map();
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi)) {
    let reste = sql.slice(m.index + 1);
    reste = reste.slice(0, Math.max(0, reste.search(/create\s+(?:or\s+replace\s+)?function\s/i)) || undefined);
    const d = reste.match(/\bas\s+(\$\w*\$)/i);
    const fin = d ? reste.indexOf(d[1], d.index + d[0].length) : -1;
    if (fin < 0) continue;
    const nom = norm(m[1]);
    fonctions.set(nom, [...(fonctions.get(nom) ?? []), sansCommentairesNiBlancs(reste.slice(d.index + d[0].length, fin))]);
  }
  for (const instr of sql.replace(/--[^\n]*/g, '').split(';')) {
    const m = instr.match(/^\s*create\s+policy\s+(?:"([^"]+)"|([a-z_][\w$]*))\s+on\s+([\w."]+)([\s\S]*)$/i);
    if (!m) continue;
    const tete = m[4].split(/\b(?:using|with\s+check)\b/i)[0];
    policies.set(`${(m[1] ?? m[2]).toLowerCase()}@@${norm(m[3]).split('.').pop()}`, {
      c: (tete.match(/\bfor\s+(\w+)/i)?.[1] ?? 'all').toUpperCase(),
      r: (tete.match(/\bto\s+([\w",\s]+)/i)?.[1] ?? 'public').replace(/"/g, '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).sort().join(','),
      q: groupe(instr, /\busing\s*\(/i),
      w: groupe(instr, /\bwith\s+check\s*\(/i),
    });
  }
  return { fonctions, policies };
}

/** Ce que la prod a de DIFFERENT de ce que `sql` pose (liste de textes, vide = rien de mesurable ou tout egal). */
function definitionsDivergentes(sql, intro, redefini) {
  const { fonctions, policies } = definitionsCreees(sql);
  const out = [];
  for (const [nom, corps] of fonctions) {
    const prod = intro.function_bodies?.[nom];
    if (!prod || redefini('functions', nom)) continue;
    const vus = new Set(prod.map(sansCommentairesNiBlancs));
    if (corps.some((c) => !vus.has(c))) out.push(`functions: ${nom} (corps different de la prod)`);
  }
  for (const [cle, p] of policies) {
    const prod = intro.policy_defs?.[cle];
    if (!prod || redefini('policies', cle)) continue;
    const roles = [...(prod.r ?? [])].map((x) => String(x).toLowerCase()).sort().join(',');
    if (p.c !== String(prod.c).toUpperCase() || p.r !== roles || !memesJetons(p.q, prod.q) || !memesJetons(p.w, prod.w)) {
      out.push(`policies: ${cle} (commande, roles ou expression differents de la prod)`);
    }
  }
  return out;
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
  'function_bodies', (
    SELECT coalesce(json_object_agg(f, b), '{}'::json) FROM (
      SELECT lower(p.proname) AS f, json_agg(p.prosrc) AS b
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' GROUP BY 1) x
  ),
  'policy_defs', (
    SELECT coalesce(json_object_agg(k, d), '{}'::json) FROM (
      SELECT lower(policyname) || '@@' || lower(tablename) AS k,
             json_build_object('c', cmd, 'r', roles, 'q', qual, 'w', with_check) AS d
      FROM pg_policies WHERE schemaname IN ('public', 'storage')) x
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

/** Range chaque fichier dans un verdict. `dispenses` : pour le SEUL temoin (le CLI lit `NON_APPLIQUEES_DELIBEREMENT`). */
export function classer(fichiers, intro, dispenses = NON_APPLIQUEES_DELIBEREMENT) {
  const ledger = new Set([
    ...(intro.ledger ?? []).map((s) => String(s).toLowerCase()),
    ...(intro.ledger_names ?? []).map((s) => String(s).toLowerCase()),
  ]);
  const KINDS = ['tables', 'columns', 'functions', 'indexes', 'policies', 'triggers', 'constraints'];
  const catalogue = {};
  for (const k of KINDS) catalogue[k] = new Set((intro[k] ?? []).map(String));

  // Qui supprime quoi, et QUAND : l'ordre des noms est l'ordre d'application. Un fichier qui SUPPRIME
  // PUIS RECREE un objet (motif idempotent, mig. 015) ne le supprime pas : on retranche ce qu'il recree.
  const supprimeParFichier = new Map();
  for (const { name, sql } of fichiers) {
    const sup = objetsSupprimes(sql);
    const cre = objetsCrees(sql);
    for (const k of KINDS) sup[k] = sup[k].filter((n) => !cre[k].includes(n));
    supprimeParFichier.set(name, sup);
  }
  const ordre = new Map(fichiers.map((f, i) => [f.name, i]));
  const creeParFichier = new Map(fichiers.map((f) => [f.name, objetsCrees(f.sql)]));
  /** Un fichier ULTERIEUR recree `kind: nom` : l'etat en base n'est plus celui de `name`. */
  const recreeApres = (name, kind, nom) => fichiers.some((f) => ordre.get(f.name) > ordre.get(name) && creeParFichier.get(f.name)[kind].includes(nom));

  /** Le fichier ULTERIEUR qui supprime `kind: nom`, nommement ou par le `DROP TABLE` de sa table. */
  const supprimeApres = (name, kind, nom, proprietaires) => {
    const table = proprietaires?.get(`${kind}:${nom}`);
    for (const [autre, sup] of supprimeParFichier) {
      if (ordre.get(autre) <= ordre.get(name)) continue;
      if (sup[kind]?.includes(nom)) return autre;
      if (table && sup.tables.includes(table)) return `${autre}, DROP TABLE ${table}`;
    }
    return null;
  };

  const resultats = [];
  for (const { name, sql } of fichiers) {
    const cles = clesLedger(name);
    const auLedger = cles.some((c) => ledger.has(c));
    const cleDeclaree = cles.find((c) => dispenses[c]);

    const objets = objetsCrees(sql);
    const total = KINDS.reduce((n, k) => n + objets[k].length, 0);
    const trouves = [];
    const manquants = [];
    const retires = [];
    for (const kind of KINDS) {
      for (const nom of objets[kind]) {
        if (catalogue[kind].has(nom)) { trouves.push(`${kind}: ${nom}`); continue; }
        const par = supprimeApres(name, kind, nom, objets.proprietaires);
        if (par) { retires.push(`${kind}: ${nom} (supprime par ${par})`); continue; }
        manquants.push(`${kind}: ${nom}`);
      }
    }

    // 🔴 Une dispense FAUSSE (au ledger, ou objets en base) fait echouer : la declaration doit tomber.
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
          raison: dispenses[cleDeclaree],
        });
      }
      continue;
    }

    if (auLedger) {
      resultats.push({ name, verdict: VERDICT.LEDGER, total, trouves, manquants, retires });
      continue;
    }
    if (trouves.length > 0) {
      // Depuis la 200, le nom ne suffit plus : definitions differentes, cibles de DROP encore la.
      const divergents = Number.parseInt(name, 10) < PARTIEL_EN_ATTENTE_DEPUIS ? [] : [
        ...definitionsDivergentes(sql, intro, (k, n) => recreeApres(name, k, n)),
        ...KINDS.flatMap((k) => supprimeParFichier.get(name)[k]
          .filter((n) => catalogue[k].has(n) && !recreeApres(name, k, n)).map((n) => `${k}: ${n} (supprime par ce fichier, encore en base)`)),
      ];
      resultats.push({ name, verdict: VERDICT.OBJET, total, trouves, manquants, retires, divergents });
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

// ─── Sens inverse : chaque entree du ledger a-t-elle son fichier ? (ROB-03) ──
// 🔴 La 238 est en production depuis le 2026-11-01 sans fichier dans aucun commit : le classeur
// part des fichiers et ne la voit pas. Les 17 entrees d'avril a aout 2026 (C-79) restent LISTEES ;
// seule une entree posterieure a la garde echoue.

/** Version de ledger (14 chiffres) a partir de laquelle une entree sans fichier fait echouer. */
export const LEDGER_FICHIER_OBLIGATOIRE_DEPUIS = '20260914000000';

/** Les entrees du ledger (`version_nom`) sans fichier, rapprochees par nom avec ou sans prefixe numerique (comme `clesLedger`). */
export function entreesSansFichier(fichiers, intro, depuis = LEDGER_FICHIER_OBLIGATOIRE_DEPUIS) {
  const cles = new Set(fichiers.flatMap((f) => clesLedger(f.name)));
  const out = [];
  for (const brut of intro.ledger ?? []) {
    const entree = String(brut).toLowerCase();
    const m = entree.match(/^(\d+)_(.*)$/);
    const version = m ? m[1] : '';
    const nom = m ? m[2] : entree;
    if (nom && (cles.has(nom) || cles.has(nom.replace(/^\d+[a-z]?_/, '')))) continue;
    out.push({ entree, version, recente: version >= depuis });
  }
  return out;
}

// ─── Migrations du depot en attente de production (CI-05) ──────────
// Ce que `edge-deploy.yml` et `ci-vert.yml` refusent de devancer : un fichier ABSENT DES DEUX, ou
// hors ledger a partir de la 200 dont un objet manque en base (mig. 248) ou dont la DEFINITION
// differe de la prod (ROB-02, 262 et 264). Les partiels de 001 a 012 precedent le ledger.

/** Premier numero de fichier ou un « OBJET EN BASE » partiel compte comme non applique. */
export const PARTIEL_EN_ATTENTE_DEPUIS = 200;

export function enAttenteDeProduction(resultats) {
  return resultats.filter((r) => r.verdict === VERDICT.ABSENT
    || (r.verdict === VERDICT.OBJET && (r.manquants.length > 0 || r.divergents?.length > 0)
      && Number.parseInt(r.name, 10) >= PARTIEL_EN_ATTENTE_DEPUIS));
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
    console.error('Usage : check-migration-coverage.mjs --print-sql | <introspection.json> [--sens=depot]');
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

  // 🔴 REFUSER UN VERDICT RENDU SANS AVOIR RIEN LU : un ledger vide avec un
  // catalogue plein rendrait « OBJET EN BASE » partout, un VERT qui ne mesure rien.
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

  // Les partiels ne font PAS echouer : ils NOMMENT ce que « OBJET EN BASE » ne prouve pas.
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

  let echec = false;
  const attente = enAttenteDeProduction(resultats);
  if (attente.length > 0) {
    echec = true;
    console.error('');
    console.error(`❌ ${attente.length} migration(s) du depot PAS EN PRODUCTION :`);
    for (const r of attente) {
      console.error(`   ${r.name} : ${r.raison ?? `hors ledger, ${r.trouves.length}/${r.total} objets en base, manque ${[...r.manquants, ...(r.divergents ?? [])].join(', ')}`}`);
    }
    console.error('');
    console.error('Soit la migration doit etre appliquee, soit son absence est');
    console.error('deliberee et se DECLARE dans NON_APPLIQUEES_DELIBEREMENT, avec');
    console.error('son motif et sa date. Jamais un silence.');
  }

  // `--sens=depot` : le seul sens jugé par `edge-deploy.yml` et `ci-vert.yml`.
  if (!process.argv.includes('--sens=depot')) {
    const orphelines = entreesSansFichier(fichiers, intro);
    const anciennes = orphelines.filter((o) => !o.recente);
    const recentes = orphelines.filter((o) => o.recente);
    if (anciennes.length > 0) {
      console.log(`ℹ️  ${anciennes.length} entree(s) de ledger sans fichier, anterieures a ${LEDGER_FICHIER_OBLIGATOIRE_DEPUIS} (mesure C-79) :`);
      for (const o of anciennes) console.log(`   ${o.entree}`);
      console.log('');
    }
    if (recentes.length > 0) {
      echec = true;
      console.error('');
      console.error(`❌ ${recentes.length} entree(s) du ledger de PRODUCTION SANS FICHIER dans supabase/migration/ :`);
      for (const o of recentes) console.error(`   ${o.entree}`);
      console.error('');
      console.error('La production porte une migration que le depot ne sait pas reconstruire.');
      console.error('Committer son fichier sous le meme nom, relu contre le catalogue de prod.');
    }
  }
  if (echec) return 1;

  console.log('✅ Aucun fichier absent des deux, aucune entree de ledger sans fichier.');
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
