#!/usr/bin/env node
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
    triggerFns.set(fn.toLowerCase(), { file: f, fn, secdef: /SECURITY\s+DEFINER/i.test(decl) });
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
    warn(t.file, `fonction de trigger ${t.fn}() en SECURITY DEFINER — legitime seulement si elle doit ECRIRE au-dela des droits de l'appelant (notifications, mig. 095/110) ; une garde de validation doit rester SECURITY INVOKER (finding B-3)`);
  }
}

console.log(`\nMigrations validées : ${files.length} fichier(s), ${errors} erreur(s), ${warnings} avertissement(s).`);
process.exit(errors > 0 ? 1 : 0);
