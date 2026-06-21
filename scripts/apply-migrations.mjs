#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// apply-migrations.mjs — applique supabase/migration/*.sql DANS L'ORDRE
// contre une base Postgres (DATABASE_URL).
//
// Pourquoi : le repo stocke ses migrations dans `supabase/migration/`
// (singulier, préfixes NNN_) — un layout que la CLI Supabase ne reconnaît
// pas (`db push`/`db reset` attendent `supabase/migrations/<ts>_*.sql`).
// Ce loader rejoue donc les fichiers sur une base vierge (stack Supabase
// locale) pour le harnais de tests RLS d'intégration (cf. e2e/rls/).
//
// Usage :
//   DATABASE_URL=postgres://... node scripts/apply-migrations.mjs
//   node scripts/apply-migrations.mjs --dry-run      # liste l'ordre, sans DB
//
// Les fichiers sont idempotents (CREATE OR REPLACE / IF NOT EXISTS / DROP
// POLICY IF EXISTS) → réapplication sûre. Sortie ≠ 0 à la 1re erreur.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migration';
const dryRun = process.argv.includes('--dry-run');

// Même tri déterministe que scripts/validate-migrations.mjs.
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`✖ Aucun fichier .sql dans ${DIR}`);
  process.exit(1);
}

if (dryRun) {
  console.log(`Ordre d'application (${files.length} fichiers) :`);
  files.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2, '0')}. ${f}`));
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL || process.argv[2];
if (!connectionString) {
  console.error('✖ DATABASE_URL manquant (env ou 1er argument).');
  process.exit(1);
}

// `pg` est une devDependency — importée dynamiquement pour que `--dry-run`
// fonctionne même sans la dépendance installée.
const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString });

await client.connect();
try {
  for (const f of files) {
    const sql = readFileSync(join(DIR, f), 'utf8');
    process.stdout.write(`→ ${f} ... `);
    await client.query(sql);
    console.log('ok');
  }
  console.log(`\n✓ ${files.length} migrations appliquées.`);
} catch (err) {
  console.error(`\n✖ Échec : ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
