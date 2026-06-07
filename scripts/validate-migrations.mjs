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
//
// Codes de sortie : 1 si au moins une ERREUR, 0 sinon (les WARN n'échouent pas).
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migration';
const NAME_RE = /^\d{3}_[a-z0-9_]+\.sql$/;

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

console.log(`\nMigrations validées : ${files.length} fichier(s), ${errors} erreur(s), ${warnings} avertissement(s).`);
process.exit(errors > 0 ? 1 : 0);
