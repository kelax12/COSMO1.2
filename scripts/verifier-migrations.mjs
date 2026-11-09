// ═══════════════════════════════════════════════════════════════════
// verifier-migrations.mjs · LA CLI A-T-ELLE APPLIQUE TOUT `supabase/migrations/` ? (ROB-02, V8.2)
//
// Depuis le 2026-11-09, la base des jobs CI (contrat-donnees, rls-integration,
// E2E sur Supabase local, volume) n'est plus rejouee par un chargeur maison :
// `supabase start` applique `supabase/migrations/` (la baseline, puis les
// migrations posterieures) et inscrit chaque version a son ledger local
// `supabase_migrations.schema_migrations`. Ce script relit ce ledger et
// echoue si une version du dossier y manque, ou s'il en porte une qui n'a pas
// de fichier : une base qui ne contient pas ce que le dossier decrit ne juge
// rien. Il remplace `apply-migrations.mjs` (rejeu de `supabase/migration/`,
// historique fige, lisible a l'historique git).
//
// Usage :
//   DATABASE_URL=postgres://... node scripts/verifier-migrations.mjs
//   node scripts/verifier-migrations.mjs --dry-run     # l'ordre, sans base
//
// Les ANNOTATIONS GitHub s'affichent sur la page du job sans connexion ; les
// journaux d'un run, non. Toute sortie non nulle en porte une.
// ⚠️ Pas de shebang : le temoin importe ce module (cf. `scripts/CLAUDE.md`).
// ═══════════════════════════════════════════════════════════════════
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const DOSSIER = 'supabase/migrations';
const RE = /^(\d{14})_[a-z0-9_]+\.sql$/;

function annoter(message) {
  if (!process.env.GITHUB_ACTIONS) return;
  const echappe = String(message).replace(/%/g, '%25').replace(/\r?\n/g, '%0A');
  console.log(`::error title=Migrations de la CLI::${echappe}`);
}

/** Les fichiers du dossier, dans l'ordre de la CLI ; un nom hors format est une erreur. */
export function lireDossier(racine = process.cwd()) {
  const sql = readdirSync(join(racine, DOSSIER)).filter((f) => f.endsWith('.sql')).sort();
  const invalides = sql.filter((f) => !RE.test(f));
  return { fichiers: sql.filter((f) => RE.test(f)), invalides };
}

/** Ecarts entre le dossier et le ledger local : versions absentes, versions en trop. */
export function comparerLedger(fichiers, versions) {
  const attendues = fichiers.map((f) => f.slice(0, 14));
  const vues = new Set(versions.map(String));
  return {
    manquantes: fichiers.filter((f) => !vues.has(f.slice(0, 14))),
    enTrop: [...vues].filter((v) => !attendues.includes(v)).sort(),
  };
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { fichiers, invalides } = lireDossier();
  if (invalides.length) {
    const m = `nom hors format <14 chiffres>_snake_case.sql dans ${DOSSIER} : ${invalides.join(', ')} (la CLI l'ignorerait sans le dire)`;
    console.error(`✖ ${m}`);
    annoter(m);
    return 1;
  }
  if (fichiers.length === 0) {
    console.error(`✖ Aucune migration dans ${DOSSIER}`);
    annoter(`Aucune migration dans ${DOSSIER}`);
    return 1;
  }
  if (argv.includes('--dry-run')) {
    console.log(`Ordre d'application de la CLI (${fichiers.length} fichiers) :`);
    fichiers.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2, '0')}. ${f}`));
    return 0;
  }
  const url = env.DATABASE_URL || argv[0] || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (err) {
    const sur = String(err.message).replace(/:\/\/[^@]*@/, '://***@');
    console.error(`✖ Connexion impossible : ${sur}`);
    annoter(`Connexion a la base impossible (DATABASE_URL) : ${sur}`);
    return 1;
  }
  let versions;
  try {
    versions = (await client.query('select version from supabase_migrations.schema_migrations order by version')).rows.map((r) => r.version);
  } catch (err) {
    const m = `ledger local illisible (${err.message}) : \`supabase start\` n'a-t-il applique aucune migration ?`;
    console.error(`✖ ${m}`);
    annoter(m);
    return 1;
  } finally {
    await client.end();
  }
  const { manquantes, enTrop } = comparerLedger(fichiers, versions);
  if (manquantes.length || enTrop.length) {
    const m = [
      manquantes.length && `absentes du ledger local : ${manquantes.join(', ')}`,
      enTrop.length && `au ledger sans fichier : ${enTrop.join(', ')}`,
    ].filter(Boolean).join(' ; ');
    console.error(`✖ La base ne correspond pas a ${DOSSIER} : ${m}`);
    annoter(`La base ne correspond pas a ${DOSSIER} : ${m}`);
    return 1;
  }
  console.log(`✓ ${fichiers.length} migrations de ${DOSSIER} appliquees par la CLI (ledger local relu).`);
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  process.exitCode = await main();
}
