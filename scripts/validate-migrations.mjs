// ═══════════════════════════════════════════════════════════════════
// validate-migrations.mjs — garde CI statique sur supabase/migration/*.sql
//
// On ne peut pas exécuter `supabase db push` en CI sans secrets, mais on
// peut au moins faire respecter les invariants documentés (CLAUDE.md) :
//   1. Nommage NNN_snake_case.sql (ordre déterministe des migrations).
//   2. Pas de guillemets échappés \" dans une CREATE POLICY (casse Postgres).
//   3. Numéros de migration uniques (pas de collision NNN).
//   4. [WARN] tout CREATE POLICY ... FOR UPDATE devrait avoir WITH CHECK (N1).
//   5. Toute fonction `RETURNS trigger` introduite a partir de la mig. 109
//      doit etre REVOKE-ee pour `anon` ET `authenticated` (regle posee par la
//      mig. 064b, re-appliquee par la 094b, oubliee par la 108 -> B-3).
//      Etat FINAL rejoue sur tout l'historique : une migration ulterieure peut
//      reparer l'oubli d'une precedente (c'est ce que fait la 109 pour la 108).
//      [WARN] si elle est en plus `SECURITY DEFINER` : c'est legitime quand le
//      trigger doit ECRIRE au-dela des droits de l'appelant (notifications,
//      mig. 095/110), jamais quand il ne fait que VALIDER (une garde executee
//      avec des privileges elargis devient elle-meme le contournement).
//      [ERREUR] si en plus son nom porte le prefixe `validate_` / `enforce_` /
//      `prevent_` (convention du depot pour une garde qui ne fait QUE valider,
//      mig. 143) : la, DEFINER n'a jamais de justification, donc plus question
//      d'avertissement.
//   6-16. La checklist de docs/SECURITY.md (angle mort AM-4), CLIQUET a partir
//      de la mig. 227 : idempotence (6), search_path des DEFINER (7), WITH
//      CHECK en ERREUR (8), RLS activee (9), trigger jamais DEFINER (10),
//      journal fiscal et preuves inalterables (11), pas d'admin_allowlisted()
//      en policy (12), auto-reference ON DELETE NO ACTION (13),
//      sanitize_display_name() (14), prevent_user_id_change (15), REVOKE
//      nomme a PUBLIC et anon (16). Detail en bas de fichier.
//
// Codes de sortie : 1 si au moins une ERREUR, 0 sinon (les WARN n'échouent pas).
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migration';
const NAME_RE = /^\d{3}_[a-z0-9_]+\.sql$/;

// Plancher de la regle 5 — CLIQUET, pas audit retroactif.
//
// Le premier jet posait le plancher a 64 (la migration qui a pose la regle) et
// sortait 12 erreurs. VERIFIE EN PROD le 2026-08-24, ces 12 sont des FAUX
// POSITIFS : sur les 28 fonctions de trigger de `public`, seules QUATRE
// etaient reellement executables par anon/authenticated, et la mig. 109 les
// revoque toutes les quatre. Les autres ont ete durcies par des chemins que ce
// modele statique ne peut pas voir (privileges par defaut du schema, REVOKE
// hors du jeu de migrations, fonctions creees avant le GRANT par defaut de
// Supabase).
//
// C'est exactement la limite que check-rls-advisors.mjs documente deja : un
// modele statique de l'historique complet est FAUX, et une gate rouge en
// permanence finit ignoree. Ce controle ne juge donc que le code NOUVEAU.
// Pour l'etat reel, la source de verite reste les advisors Supabase et :
//   select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE')
//     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
//     join pg_type t on t.oid = p.prorettype
//    where n.nspname = 'public' and t.typname = 'trigger';
const TRIGGER_RULE_FLOOR = 109;

// Plancher des regles 6 a 16 (checklist AM-4, 2026-10-24), CLIQUET aussi.
// 227 est le premier numero libre le jour de la pose : aucune migration
// existante n'est jugee, toute migration suivante l'est. ❌ Ne jamais le
// relever pour faire passer une migration : la corriger.
const CHECKLIST_FLOOR = 227;

let errors = 0;
let warnings = 0;
const err = (f, m) => { console.error(`✖ ${f}: ${m}`); errors++; };
const warn = (f, m) => { console.warn(`⚠ ${f}: ${m}`); warnings++; };

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const seenNumbers = new Map();

for (const f of files) {
  if (!NAME_RE.test(f)) {
    err(f, 'nom invalide (attendu NNN_snake_case.sql)');
    continue;
  }
  const num = f.slice(0, 3);
  if (seenNumbers.has(num)) warn(f, `numéro ${num} déjà utilisé par ${seenNumbers.get(num)}`);
  else seenNumbers.set(num, f);

  const sql = readFileSync(join(DIR, f), 'utf8');

  // (2) Guillemets échappés dans une policy.
  if (/CREATE\s+POLICY[\s\S]*?\\"/i.test(sql)) {
    err(f, 'guillemets échappés \\" détectés dans une CREATE POLICY (casse Postgres)');
  }

  // (4) UPDATE policy sans WITH CHECK — avertissement (faille N1).
  //     A partir du cliquet, c'est une ERREUR, jugee par la regle 8.
  if (Number(num) >= CHECKLIST_FLOOR) continue;
  for (const stmt of sql.match(/CREATE\s+POLICY[\s\S]*?;/gi) ?? []) {
    if (/FOR\s+UPDATE/i.test(stmt) && !/WITH\s+CHECK/i.test(stmt)) {
      warn(f, 'policy FOR UPDATE sans WITH CHECK — vérifier (faille N1)');
    }
  }
}

// ─── (5) Fonctions de trigger : durcissement des droits ─────────────
//
// Regle posee par la mig. 064b, re-appliquee par la 094b, oubliee par la 108
// (finding B-3 de faille.md). Une fonction `RETURNS trigger` n'est de toute
// facon pas appelable directement — Postgres refuse — mais tant qu'elle reste
// executable par `anon` / `authenticated`, elle apparait dans les advisors
// Supabase et NOIE le signal : c'est ce bruit qui a masque la vraie anomalie.
//
// Verification GLOBALE, pas par fichier : une migration ulterieure peut
// reparer l'oubli d'une precedente (c'est exactement ce que fait la 109 pour
// la 108). On rejoue donc l'historique et on evalue l'ETAT FINAL, comme
// check-rls-advisors.mjs le fait deja pour les policies.
//
// `REVOKE ... FROM PUBLIC` ne compte PAS : il ne retire pas le GRANT par
// defaut pose par Supabase. Les deux roles doivent etre nommes (lecon 094b).
const triggerFns = new Map(); // nom -> { file, secdef }
const revokedAnon = new Set();
const revokedAuth = new Set();

const REVOKE_FN_RE =
  /REVOKE\s+(?:ALL|EXECUTE)(?:\s+PRIVILEGES)?\s+ON\s+FUNCTION\s+(?:public\.)?(\w+)\s*\([^)]*\)\s*FROM\s+([^;]+);/gi;

for (const f of files) {
  if (!NAME_RE.test(f)) continue;
  const sql = readFileSync(join(DIR, f), 'utf8');
  const num = Number.parseInt(f.slice(0, 3), 10);

  for (const m of sql.matchAll(
    // `RETURNS TRIGGER` doit suivre IMMÉDIATEMENT la liste d'arguments :
    // autoriser du texte entre les deux faisait matcher une fonction normale
    // suivie, quelques lignes plus bas, d'une fonction de trigger.
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\([^)]*\)\s*RETURNS\s+TRIGGER\b([\s\S]{0,400}?)\bAS\b/gi,
  )) {
    const fn = m[1];
    const decl = m[2];
    if (num < TRIGGER_RULE_FLOOR) continue;
    triggerFns.set(fn.toLowerCase(), { file: f, fn, num, secdef: /SECURITY\s+DEFINER/i.test(decl) });
  }

  for (const m of sql.matchAll(REVOKE_FN_RE)) {
    const fn = m[1].toLowerCase();
    const roles = m[2];
    if (/\banon\b/i.test(roles)) revokedAnon.add(fn);
    if (/\bauthenticated\b/i.test(roles)) revokedAuth.add(fn);
  }
}

for (const [key, t] of triggerFns) {
  if (!revokedAnon.has(key)) {
    err(t.file, `fonction de trigger ${t.fn}() jamais REVOKE-ee pour anon (mig. 064b)`);
  }
  if (!revokedAuth.has(key)) {
    err(t.file, `fonction de trigger ${t.fn}() jamais REVOKE-ee pour authenticated — REVOKE FROM PUBLIC ne suffit pas (mig. 094b)`);
  }
  if (t.secdef) {
    // Convention du dépôt : un nom en `validate_` / `enforce_` / `prevent_`
    // désigne une garde qui ne fait que VALIDER (elle lève ou rend NEW tel
    // quel), jamais une écriture au-delà des droits de l'appelant. Pour cette
    // classe, DEFINER n'est jamais légitime : c'est ERREUR, pas avertissement.
    // Un nom `notify_*` (ou tout autre) reste un avertissement, parce que le
    // script ne peut pas voir si le corps écrit réellement ailleurs — c'est le
    // cas des triggers de notification (mig. 095/110), volontairement DEFINER.
    // Ajouté pour la mig. 143 : `enforce_category_tree()` ne fait QUE valider,
    // et une fonction SECURITY DEFINER là ferait de ses messages d'erreur un
    // oracle sur des lignes non lisibles (finding B-3) — voir
    // migration-guards.test.mjs, cas « refuse une fonction de trigger SECURITY
    // DEFINER », vu rouge avant ce durcissement.
    if (/^(validate_|enforce_|prevent_)/.test(t.fn)) {
      err(t.file, `fonction de trigger ${t.fn}() en SECURITY DEFINER — une garde qui ne fait que VALIDER (préfixe validate_/enforce_/prevent_) doit rester SECURITY INVOKER, sinon ses erreurs deviennent un oracle sur des lignes non lisibles (finding B-3)`);
    } else if (t.num < CHECKLIST_FLOOR) {
      // A partir du cliquet, la regle 10 en fait une ERREUR, quel que soit le nom.
      warn(t.file, `fonction de trigger ${t.fn}() en SECURITY DEFINER — legitime seulement si elle doit ECRIRE au-dela des droits de l'appelant (notifications, mig. 095/110) ; une garde de validation doit rester SECURITY INVOKER (finding B-3)`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Regles 6 a 16, la checklist « avant tout commit qui touche
// supabase/migration/*.sql » (docs/SECURITY.md), devenue des regles
//
// Angle mort AM-4 : cette checklist etait MANUELLE. Chaque ligne verifiable
// sur le texte des migrations est ici ; le tableau ligne -> garde vit dans
// docs/SECURITY.md § « Avant tout commit qui touche supabase/migration ».
// Ce qui n'y est pas (auth.uid() nu, seconde policy PERMISSIVE, fonction
// revoquee citee par une policy) est deja juge par check-rls-advisors.mjs ;
// une table a `user_id` sans decision d'effacement, par check-erasure-coverage.
//
// Le SQL est lu SANS ses commentaires : ce depot commente abondamment ses
// migrations, et un « SECURITY DEFINER » ou un « DELETE FROM » ecrit dans un
// `--` n'est pas du code.
//
// Chaque regle a son TEMOIN dans migration-guards.test.mjs, vu rouge contre
// le script d'avant elles, et son sabotage de detecteur rejoue par
// `npm run check:sabotages`.
// ═══════════════════════════════════════════════════════════════════

/** Le SQL sans ses commentaires. */
const sansCommentaires = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, '');

/** Index de la parenthese qui ferme celle ouverte en `open`, ou -1. */
const fermante = (s, open) => {
  let depth = 0;
  for (let i = open; i < s.length; i += 1) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

/**
 * Chaque CREATE FUNCTION : son en-tete (les attributs, qu'ils soient ecrits
 * AVANT ou APRES le corps : Postgres accepte les deux), son corps, et sa place.
 */
const fonctionsDe = (sql) => {
  const out = [];
  const re = /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\(/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const finArgs = fermante(sql, m.index + m[0].length - 1);
    if (finArgs < 0) break;
    const reste = sql.slice(finArgs + 1);
    const as = reste.match(/\bAS\s+(\$\w*\$)/i);
    let header = '';
    let body = '';
    let fin;
    if (as) {
      const debutCorps = as.index + as[0].length;
      const finCorps = reste.indexOf(as[1], debutCorps);
      const finCorpsSure = finCorps < 0 ? reste.length : finCorps;
      body = reste.slice(debutCorps, finCorpsSure);
      const apres = reste.slice(finCorpsSure + as[1].length);
      const pv = apres.indexOf(';');
      header = `${reste.slice(0, as.index)} ${pv < 0 ? apres : apres.slice(0, pv)}`;
      fin = finArgs + 1 + finCorpsSure + as[1].length + Math.max(pv, 0);
    } else {
      const pv = reste.indexOf(';');
      header = pv < 0 ? reste : reste.slice(0, pv);
      fin = finArgs + 1 + (pv < 0 ? reste.length : pv);
    }
    out.push({
      fn: m[2],
      orReplace: Boolean(m[1]),
      header,
      body,
      debut: m.index,
      fin,
      trigger: /^\s*RETURNS\s+TRIGGER\b/i.test(header),
      definer: /\bSECURITY\s+DEFINER\b/i.test(header),
    });
    re.lastIndex = Math.max(fin, re.lastIndex);
  }
  return out;
};

/** Chaque CREATE POLICY : nom, table, commande, corps, place. */
const policiesDe = (sql) => [...sql.matchAll(
  /CREATE\s+POLICY\s+(?:"([^"]+)"|(\w+))\s+ON\s+(?:public\.)?(\w+)([\s\S]*?);/gi,
)].map((m) => ({
  name: m[1] ?? m[2],
  table: m[3].toLowerCase(),
  body: m[4],
  cmd: (m[4].match(/\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i)?.[1] ?? 'ALL').toUpperCase(),
  index: m.index,
}));

const ALTER_TABLE = String.raw`ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?(\w+)`;
const FN_PRIV_RE = (verb, prep) => new RegExp(
  String.raw`${verb}\s+(?:ALL|EXECUTE)(?:\s+PRIVILEGES)?\s+ON\s+FUNCTION\s+(?:public\.)?(\w+)\s*\([^)]*\)\s*${prep}\s+([^;]+);`,
  'gi',
);

// Le journal fiscal (mig. 125) est inalterable, `renewal_notices` est une
// PREUVE (L215-1) : ce qu'aucune migration ne doit pouvoir y faire.
const INALTERABLES = {
  payment_records: { cmds: ['UPDATE', 'DELETE', 'ALL'], ecrit: 'DELETE\\s+FROM|TRUNCATE(?:\\s+TABLE)?|UPDATE' },
  payment_closures: { cmds: ['UPDATE', 'DELETE', 'ALL'], ecrit: 'DELETE\\s+FROM|TRUNCATE(?:\\s+TABLE)?|UPDATE' },
  renewal_notices: { cmds: ['DELETE', 'ALL'], ecrit: 'DELETE\\s+FROM|TRUNCATE(?:\\s+TABLE)?' },
};

// Etat rejoue sur TOUT l'historique (une migration posterieure peut reparer).
const rlsActive = new Map(); // table -> bool, derniere instruction gagnante
const tablesPreventUid = new Set();
const fnRevokedPublic = new Set();
const fnRevokedAnon = new Set();
const fnOuvertesAnon = new Set(); // GRANT explicite a anon / PUBLIC : voulu
const fnGranted = new Set();
// Objets NOUVEAUX, a juger (cliquet).
const tablesNeuves = new Map(); // table -> fichier
const tablesUserId = new Map(); // table -> fichier
const fonctionsNeuves = new Map(); // nom -> { file, ...fonction }

for (const f of files) {
  if (!NAME_RE.test(f)) continue;
  const num = Number.parseInt(f.slice(0, 3), 10);
  const sql = sansCommentaires(readFileSync(join(DIR, f), 'utf8'));
  const neuve = num >= CHECKLIST_FLOOR;

  for (const m of sql.matchAll(new RegExp(String.raw`${ALTER_TABLE}\s+(ENABLE|DISABLE)\s+ROW\s+LEVEL\s+SECURITY`, 'gi'))) {
    rlsActive.set(m[1].toLowerCase(), /^enable$/i.test(m[2]));
  }
  for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+\w+([^;]*);/gi)) {
    const on = m[1].match(/\bON\s+(?:public\.)?(\w+)/i);
    if (on && /EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:public\.)?prevent_user_id_change\s*\(/i.test(m[1])) {
      tablesPreventUid.add(on[1].toLowerCase());
    }
  }
  for (const m of sql.matchAll(FN_PRIV_RE('REVOKE', 'FROM'))) {
    if (/\bpublic\b/i.test(m[2])) fnRevokedPublic.add(m[1].toLowerCase());
    if (/\banon\b/i.test(m[2])) fnRevokedAnon.add(m[1].toLowerCase());
  }
  for (const m of sql.matchAll(FN_PRIV_RE('GRANT', 'TO'))) {
    if (/\b(anon|public)\b/i.test(m[2])) fnOuvertesAnon.add(m[1].toLowerCase());
    else fnGranted.add(m[1].toLowerCase());
  }

  if (!neuve) continue;

  // ── Tables creees : RLS, user_id, auto-reference ───────────────────
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\s*\(/gi)) {
    if (m[1] && m[1].toLowerCase() !== 'public') continue;
    const table = m[2].toLowerCase();
    const ouvre = m.index + m[0].length - 1;
    const corps = sql.slice(ouvre + 1, Math.max(fermante(sql, ouvre), ouvre + 1));
    tablesNeuves.set(table, f);
    if (/(?:^|[,(])\s*user_id\s+uuid\b/i.test(corps)) tablesUserId.set(table, f);
    // (13) auto-reference : ON DELETE NO ACTION, ni CASCADE ni RESTRICT.
    const autoRef = new RegExp(
      String.raw`(\w+)[^,]*?\bREFERENCES\s+(?:public\.)?${table}\b\s*(?:\([^)]*\))?[^,]*?\bON\s+DELETE\s+(CASCADE|RESTRICT)`,
      'gi',
    );
    for (const r of corps.matchAll(autoRef)) {
      err(f, `${table}.${r[1]} reference ${table} ON DELETE ${r[2].toUpperCase()} : une auto-reference est ON DELETE NO ACTION : RESTRICT ne voit pas que l'enfant part dans la MEME requete et rendait la suppression de compte impossible (RGPD art. 17)`);
    }
  }
  for (const m of sql.matchAll(new RegExp(String.raw`${ALTER_TABLE}\s+([^;]*?)\bREFERENCES\s+(?:public\.)?(\w+)\b[^;]*?\bON\s+DELETE\s+(CASCADE|RESTRICT)`, 'gi'))) {
    if (m[1].toLowerCase() !== m[3].toLowerCase()) continue;
    err(f, `${m[1]} reference ${m[1]} ON DELETE ${m[4].toUpperCase()} (ALTER TABLE) : une auto-reference est ON DELETE NO ACTION (RGPD art. 17)`);
  }
  for (const m of sql.matchAll(new RegExp(String.raw`${ALTER_TABLE}\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?user_id\b`, 'gi'))) {
    tablesUserId.set(m[1].toLowerCase(), f);
  }

  // ── Fonctions creees ───────────────────────────────────────────────
  const fns = fonctionsDe(sql);
  for (const fn of fns) {
    fonctionsNeuves.set(fn.fn.toLowerCase(), { file: f, ...fn });
    // (6) idempotence : CREATE OR REPLACE.
    if (!fn.orReplace) {
      err(f, `fonction ${fn.fn}() creee sans OR REPLACE : la migration doit pouvoir se rejouer (checklist, idempotence)`);
    }
    // (7) SECURITY DEFINER : SET search_path = ''.
    if (fn.definer && !/\bSET\s+search_path\s*(?:=|TO)\s*''/i.test(fn.header)) {
      err(f, `fonction ${fn.fn}() en SECURITY DEFINER sans SET search_path = '' : un search_path mutable laisse l'appelant substituer ses propres objets (advisor function_search_path_mutable)`);
    }
    // (10) fonction de trigger : jamais DEFINER, quel que soit son nom
    //      (le prefixe validate_/enforce_/prevent_ est deja une erreur, regle 5).
    if (fn.trigger && fn.definer && !/^(validate_|enforce_|prevent_)/.test(fn.fn)) {
      err(f, `fonction de trigger ${fn.fn}() en SECURITY DEFINER a partir de la mig. ${CHECKLIST_FLOOR} : un trigger BEFORE s'execute avant le WITH CHECK de la RLS : ses erreurs deviennent un oracle (B-3). Ecrire au-dela des droits de l'appelant passe par une fonction dediee, appelee depuis un trigger INVOKER`);
    }
    // (14) raw_user_meta_data recopie : sanitize_display_name() (M-2).
    if (/raw_user_meta_data/i.test(fn.body) && /\b(INSERT|UPDATE)\b/i.test(fn.body) && !/sanitize_display_name\s*\(/i.test(fn.body)) {
      err(f, `fonction ${fn.fn}() recopie raw_user_meta_data sans sanitize_display_name() : une donnee controlee par un tiers entre dans une table (mig. 026, faille M-2)`);
    }
  }
  let horsFonctions = sql;
  for (const fn of [...fns].reverse()) horsFonctions = horsFonctions.slice(0, fn.debut) + horsFonctions.slice(fn.fin);
  if (/raw_user_meta_data/i.test(horsFonctions) && /\b(INSERT|UPDATE)\b/i.test(horsFonctions) && !/sanitize_display_name\s*\(/i.test(horsFonctions)) {
    err(f, 'raw_user_meta_data recopie hors fonction sans sanitize_display_name() (mig. 026, faille M-2)');
  }

  // ── Policies creees ────────────────────────────────────────────────
  const drops = [...sql.matchAll(/DROP\s+POLICY\s+IF\s+EXISTS\s+(?:"([^"]+)"|(\w+))\s+ON\s+(?:public\.)?(\w+)/gi)]
    .map((m) => ({ cle: `${m[3].toLowerCase()}.${m[1] ?? m[2]}`, index: m.index }));
  for (const p of policiesDe(sql)) {
    // (6) idempotence : DROP POLICY IF EXISTS avant CREATE POLICY.
    if (!drops.some((d) => d.cle === `${p.table}.${p.name}` && d.index < p.index)) {
      err(f, `policy "${p.name}" sur ${p.table} creee sans DROP POLICY IF EXISTS prealable : la prod a deja des policies : la migration doit pouvoir se rejouer`);
    }
    // (8) UPDATE : WITH CHECK (faille N1).
    if (p.cmd === 'UPDATE' && !/\bWITH\s+CHECK\b/i.test(p.body)) {
      err(f, `policy "${p.name}" sur ${p.table} : FOR UPDATE sans WITH CHECK : la ligne MODIFIEE n'est pas re-verifiee (faille N1)`);
    }
    // (11) journal fiscal et preuves : aucune policy de reecriture.
    if (INALTERABLES[p.table]?.cmds.includes(p.cmd)) {
      err(f, `policy "${p.name}" FOR ${p.cmd} sur ${p.table} : table inalterable (journal fiscal mig. 125 / preuve L215-1) : une erreur se corrige par une ligne compensatoire`);
    }
    // (12) surface admin : is_admin(), jamais admin_allowlisted().
    if (/\badmin_allowlisted\s*\(/i.test(p.body)) {
      err(f, `policy "${p.name}" sur ${p.table} appelle admin_allowlisted() : cette fonction ignore le niveau d'assurance de la session, exprès : la garde est is_admin() (mig. 131)`);
    }
  }

  // (11) journal fiscal et preuves : ni purge, ni reecriture, ni droit de le faire.
  for (const [table, regle] of Object.entries(INALTERABLES)) {
    const ecrit = new RegExp(String.raw`\b(?:${regle.ecrit})\s+(?:ONLY\s+)?(?:public\.)?${table}\b`, 'i');
    const desarme = new RegExp(String.raw`${ALTER_TABLE.replace('(\\w+)', table)}\s+DISABLE\s+TRIGGER|DROP\s+TRIGGER[^;]*\bON\s+(?:public\.)?${table}\b`, 'i');
    const droit = new RegExp(String.raw`GRANT\s+[^;]*?\b(?:${regle.cmds.join('|')}|TRUNCATE)\b[^;]*?\bON\s+(?:TABLE\s+)?(?:public\.)?${table}\b`, 'i');
    if (ecrit.test(sql) || desarme.test(sql) || droit.test(sql)) {
      err(f, `purge ou reecriture de ${table} : table inalterable (journal fiscal mig. 125 / preuve L215-1) : jamais de DELETE, TRUNCATE, UPDATE, trigger desarme ni GRANT de le faire`);
    }
  }
}

// (9) RLS activee sur toute table creee, etat final.
for (const [table, f] of tablesNeuves) {
  if (rlsActive.get(table) !== true) {
    err(f, `table ${table} creee sans ENABLE ROW LEVEL SECURITY : sans elle, la table est lisible et ecrivable par tout role qui a le GRANT par defaut`);
  }
}
// (15) user_id : trigger prevent_user_id_change, etat final.
for (const [table, f] of tablesUserId) {
  if (!tablesPreventUid.has(table)) {
    err(f, `table ${table} porte user_id sans trigger prevent_user_id_change : un UPDATE pourrait transferer une ligne a un autre compte (checklist, mass-assignment V1)`);
  }
}
// (16) GRANT EXECUTE / SECURITY DEFINER : REVOKE nomme a PUBLIC ET anon.
for (const [key, fn] of fonctionsNeuves) {
  if (fn.trigger || fnOuvertesAnon.has(key)) continue;
  if (!fn.definer && !fnGranted.has(key)) continue;
  if (!fnRevokedPublic.has(key)) {
    err(fn.file, `fonction ${fn.fn}() jamais REVOKE-ee pour PUBLIC : un GRANT EXECUTE n'a de sens qu'apres REVOKE ... FROM PUBLIC, anon`);
  }
  if (!fnRevokedAnon.has(key)) {
    err(fn.file, `fonction ${fn.fn}() jamais REVOKE-ee pour anon : REVOKE FROM PUBLIC ne retire pas le GRANT par defaut du schema public (lecon 094b)`);
  }
}

console.log(`\nMigrations validées : ${files.length} fichier(s), ${errors} erreur(s), ${warnings} avertissement(s).`);
process.exit(errors > 0 ? 1 : 0);
