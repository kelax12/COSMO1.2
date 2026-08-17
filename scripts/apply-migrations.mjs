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

/**
 * Émet une annotation GitHub Actions.
 *
 * Les LOGS d'un run ne sont lisibles qu'authentifié — même sur un dépôt public.
 * Les ANNOTATIONS, elles, s'affichent sur la page du job sans connexion. Sans
 * elles, un échec ici ne dit rien de plus que « Process completed with exit
 * code 1 » à qui n'a pas accès au dépôt.
 *
 * ⚠️ Annoter TOUTES les sorties non nulles, y compris les gardes précoces
 * ci-dessous : c'est précisément une garde précoce muette (`DATABASE_URL`
 * absente) qui a rendu ce job indiagnosticable pendant deux mois.
 */
function annotate(file, message) {
  if (!process.env.GITHUB_ACTIONS) return;
  // Les sauts de ligne cassent une annotation : la commande workflow est
  // délimitée par la fin de ligne. `%0A` est la forme échappée attendue.
  const escaped = String(message).replace(/%/g, '%25').replace(/\r?\n/g, '%0A');
  // Sans fichier (échec de connexion), pas de `file=` : une annotation qui
  // pointe un chemin vide s'affiche sans lien et brouille la lecture.
  const location = file ? ` file=${DIR}/${file}` : '';
  console.log(`::error${location}::${escaped}`);
}

// Même tri déterministe que scripts/validate-migrations.mjs.
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`✖ Aucun fichier .sql dans ${DIR}`);
  annotate('', `Aucun fichier .sql dans ${DIR}`);
  process.exit(1);
}

if (dryRun) {
  console.log(`Ordre d'application (${files.length} fichiers) :`);
  files.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2, '0')}. ${f}`));
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL || process.argv[2];
if (!connectionString) {
  // Liste les variables réellement présentes : si `supabase status -o env`
  // change ses noms de clés (le workflow installe `version: latest`), le
  // remap du workflow produit une valeur VIDE sans que l'étape échoue, et
  // c'est ici qu'on s'en aperçoit. Noms seulement — jamais les valeurs, qui
  // contiennent la service_role key.
  const seen = Object.keys(process.env)
    .filter((k) => /^(SUPABASE|DB|API|ANON|SERVICE|DATABASE|POSTGRES)/.test(k))
    .sort();
  console.error('✖ DATABASE_URL manquant (env ou 1er argument).');
  console.error(`  Variables liées présentes : ${seen.join(', ') || '(aucune)'}`);
  annotate(
    '',
    `DATABASE_URL vide : le remap de « supabase status -o env » n'a rien produit. `
    + `Variables liées presentes : ${seen.join(', ') || '(aucune)'}`,
  );
  process.exit(1);
}

// `pg` est une devDependency — importée dynamiquement pour que `--dry-run`
// fonctionne même sans la dépendance installée.
const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString });

// La connexion échoue AVANT toute migration quand `DATABASE_URL` est mal
// remappée depuis `supabase status -o env` (les noms de clés de la CLI ont
// bougé au fil des versions, et le workflow installe `version: latest`).
// Sans ce catch, l'échec sortait en rejet non géré : pas d'annotation, pas de
// message, indiscernable d'un échec SQL.
try {
  await client.connect();
} catch (err) {
  const safe = String(err.message).replace(/:\/\/[^@]*@/, '://***@'); // jamais le mot de passe
  console.error(`\n✖ Connexion impossible : ${safe}`);
  annotate('', `Connexion a la base impossible (DATABASE_URL) — ${safe}`);
  process.exit(1);
}

let current = null;
try {
  for (const f of files) {
    current = f;
    const sql = readFileSync(join(DIR, f), 'utf8');
    process.stdout.write(`→ ${f} ... `);
    await client.query(sql);
    console.log('ok');
  }
  console.log(`\n✓ ${files.length} migrations appliquées.`);
} catch (err) {
  // `err.position` situe le caractère fautif dans le fichier ; `err.detail` et
  // `err.hint` portent souvent la vraie cause (dépendance manquante, extension
  // absente de la stack locale…). Tout remonter : c'est le seul endroit où
  // l'information existe.
  const detail = [
    err.message,
    err.detail && `detail: ${err.detail}`,
    err.hint && `hint: ${err.hint}`,
    err.code && `sqlstate: ${err.code}`,
    err.position && `position: ${err.position}`,
  ].filter(Boolean).join('\n');

  console.error(`\n✖ Échec sur ${current} :\n${detail}`);
  annotate(current, `Replay impossible sur base vierge — ${detail}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
