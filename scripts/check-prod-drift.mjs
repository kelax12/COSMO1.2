#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// check-prod-drift.mjs — Garde anti-dérive repo ↔ prod (audit 2026-06-10)
//
// Cause racine du pire finding de l'audit v2 : la prod tournait un
// stripe-webhook périmé et la migration 017 n'avait jamais été appliquée,
// alors que faille.md marquait ces fixes « corrigés ». Ce script rend la
// dérive DÉTECTABLE : il parse les objets attendus depuis
// supabase/migration/*.sql et les diffe contre une introspection LIVE.
//
// Usage (2 étapes, lecture seule côté prod) :
//   1. node scripts/check-prod-drift.mjs --print-sql
//      → affiche la requête d'introspection à exécuter sur la prod
//        (SQL editor, ou MCP execute_sql). Elle renvoie UNE ligne JSON.
//   2. node scripts/check-prod-drift.mjs <introspection.json>
//      → diffe et sort avec un code ≠ 0 si un objet attendu MANQUE en prod.
//
// Sémantique :
//   - MANQUANT en prod (attendu par le repo) → FAIL (migration non appliquée)
//   - EN TROP en prod (inconnu du repo)      → WARN (héritage dashboard),
//     sauf s'il est dans LEGACY_ALLOWLIST (objets pré-versionnement connus).
//
// Le parsing suit l'ordre des fichiers : un DROP retire l'objet du set
// attendu, un CREATE le (ré)ajoute — les migrations idempotentes
// (DROP IF EXISTS + CREATE) sont donc correctement traitées.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATION_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migration');

// Objets présents en prod AVANT le versionnement des migrations (créés via
// dashboard, jamais re-déclarés dans un fichier). Connus et assumés — ne pas
// les signaler comme dérive. Toute NOUVELLE entrée ici doit être justifiée.
const LEGACY_ALLOWLIST = {
  tables: new Set(['subscriptions', 'profiles']),
  functions: new Set([]),
  triggers: new Set([]),
  policies: new Set([
    'users can delete own requests@@friend_requests',
    // SELECT subscriptions : créée en dashboard (ère pré-versionnement) ;
    // 013/015 n'ont déclaré que les DROP de la policy UPDATE.
    'users can read own subscription@@subscriptions',
  ]),
};

// Policies attendues sous un nom, présentes en prod sous un AUTRE nom
// fonctionnellement équivalent (tables créées en dashboard avant que les
// fichiers 001-007 soient écrits avec la convention « read »). La protection
// existe — seul le libellé diffère. repo → prod.
const EQUIVALENT_POLICIES = new Map([
  ['users can read own tasks@@tasks', 'users can view own tasks@@tasks'],
  ['users can read own habits@@habits', 'users can view own habits@@habits'],
  ['users can read own events@@events', 'users can view own events@@events'],
  ['users can read own okrs@@okrs', 'users can view own okrs@@okrs'],
  ['users can read own lists@@lists', 'users can view own lists@@lists'],
  ['users can read own categories@@categories', 'users can view own categories@@categories'],
  ['users can read own friends@@friends', 'users can view own friends@@friends'],
  // 007 → remplacée par le modèle unifié shared_tasks_* (019/036)
  ['friends can read their shared tasks@@shared_tasks', 'shared_tasks_select@@shared_tasks'],
]);

// Objets « fresh-install only » : déclarés par les migrations de
// reconstruction mais ABSENTS de la prod historique, et qu'on n'applique PAS
// volontairement (divergence assumée, vérifiée live 2026-06-10) :
// - update_*_updated_at : les tables prod n'ont PAS de colonne updated_at
//   (sauf profiles/subscriptions/key_results) → poser le trigger casserait
//   tous les UPDATE.
// - seed_default_categories + son trigger : activer le seed auto changerait
//   le comportement prod (l'app gère le cas zéro-catégorie côté client).
const FRESH_INSTALL_ONLY = new Set([
  'triggers: update_tasks_updated_at',
  'triggers: update_events_updated_at',
  'triggers: update_habits_updated_at',
  'triggers: update_lists_updated_at',
  'triggers: update_okrs_updated_at',
  'triggers: on_auth_user_created_seed_categories',
  'functions: seed_default_categories',
]);

// ─── Parsing des migrations ─────────────────────────────────────────

function parseExpected() {
  const files = readdirSync(MIGRATION_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const expected = {
    tables: new Set(),
    functions: new Set(),
    triggers: new Set(),
    policies: new Set(), // "policy@@table"
  };

  const norm = (s) => s.replace(/^public\./i, '').replace(/"/g, '').toLowerCase();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATION_DIR, file), 'utf8')
      // Retire les commentaires pour ne pas matcher du SQL documenté
      .replace(/--[^\n]*/g, '');

    // L'ordre intra-fichier compte (DROP IF EXISTS puis CREATE) : on traite
    // les statements séquentiellement.
    for (const stmt of sql.split(';')) {
      let m;
      if ((m = stmt.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/i))) {
        expected.tables.add(norm(m[1]));
      } else if ((m = stmt.match(/drop\s+table\s+(?:if\s+exists\s+)?([\w."]+)/i))) {
        expected.tables.delete(norm(m[1]));
      } else if ((m = stmt.match(/create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/i))) {
        expected.functions.add(norm(m[1]));
      } else if ((m = stmt.match(/drop\s+function\s+(?:if\s+exists\s+)?([\w."]+)/i))) {
        expected.functions.delete(norm(m[1]));
      } else if ((m = stmt.match(/create\s+trigger\s+([\w."]+)/i))) {
        expected.triggers.add(norm(m[1]));
      } else if ((m = stmt.match(/drop\s+trigger\s+(?:if\s+exists\s+)?([\w."]+)/i))) {
        expected.triggers.delete(norm(m[1]));
      } else if ((m = stmt.match(/create\s+policy\s+"([^"]+)"\s+on\s+([\w."]+)/i))) {
        expected.policies.add(`${m[1].toLowerCase()}@@${norm(m[2])}`);
      } else if ((m = stmt.match(/drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+([\w."]+)/i))) {
        expected.policies.delete(`${m[1].toLowerCase()}@@${norm(m[2])}`);
      }
    }

    // Cas spécial : triggers créés dans un bloc DO $$ ... $$ (migration 010
    // boucle sur plusieurs tables). Le split(';') casse les blocs DO, on
    // rattrape les EXECUTE format('CREATE TRIGGER %s ...') ailleurs : ces
    // triggers portent le préfixe trg_prevent_user_id_change_<table>.
    const doBlock = sql.match(/do\s+\$\$[\s\S]*?\$\$/gi) ?? [];
    for (const block of doBlock) {
      const fmt = block.match(/create\s+trigger\s+%?I?([\w%]*)/i);
      if (fmt) {
        // Trigger dynamique — non vérifiable statiquement par nom exact.
        // On le note via le marqueur '<dynamic>' (ignoré au diff, compté).
        expected.triggers.add('<dynamic:' + file + '>');
      }
    }
  }

  return expected;
}

// ─── SQL d'introspection (lecture seule) ────────────────────────────

const INTROSPECTION_SQL = `
SELECT json_build_object(
  'tables', (
    SELECT coalesce(json_agg(tablename ORDER BY tablename), '[]'::json)
    FROM pg_tables WHERE schemaname = 'public'
  ),
  'functions', (
    SELECT coalesce(json_agg(DISTINCT p.proname ORDER BY p.proname), '[]'::json)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ),
  'triggers', (
    -- 'auth' inclus : trg_create_profile_on_signup / trg_sync_profile_on_update
    -- vivent sur auth.users (migrations 018/032).
    SELECT coalesce(json_agg(DISTINCT t.tgname ORDER BY t.tgname), '[]'::json)
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'auth') AND NOT t.tgisinternal
  ),
  'policies', (
    SELECT coalesce(json_agg(lower(polname) || '@@' || lower(c.relname) ORDER BY 1), '[]'::json)
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  )
) AS introspection;
`.trim();

// ─── Diff ───────────────────────────────────────────────────────────

function diff(expected, actual) {
  const result = { missing: [], extra: [], assumed: [], dynamicTriggers: 0 };

  // Noms prod « consommés » par une équivalence — à ne pas re-signaler en extra.
  const accountedInProd = new Set();

  for (const kind of ['tables', 'functions', 'triggers', 'policies']) {
    const act = new Set((actual[kind] ?? []).map((s) => String(s).toLowerCase()));
    for (const exp of expected[kind]) {
      if (exp.startsWith('<dynamic:')) { result.dynamicTriggers++; continue; }
      if (act.has(exp)) continue;
      // Équivalence de nom (protection présente sous un autre libellé)
      const equiv = kind === 'policies' ? EQUIVALENT_POLICIES.get(exp) : undefined;
      if (equiv && act.has(equiv)) { accountedInProd.add(equiv); continue; }
      // Divergence assumée (fresh-install only)
      if (FRESH_INSTALL_ONLY.has(`${kind}: ${exp}`)) { result.assumed.push(`${kind}: ${exp}`); continue; }
      result.missing.push(`${kind}: ${exp}`);
    }
    for (const a of act) {
      if (expected[kind].has(a) || accountedInProd.has(a) || LEGACY_ALLOWLIST[kind]?.has(a)) continue;
      // Les triggers dynamiques (DO $$) matchent par préfixe connu.
      if (kind === 'triggers' && a.startsWith('trg_prevent_user_id_change')) continue;
      // Triggers RI/contraintes posés par Postgres lui-même
      if (kind === 'triggers' && a.startsWith('ri_constrainttrigger')) continue;
      result.extra.push(`${kind}: ${a}`);
    }
  }
  return result;
}

// ─── Main ───────────────────────────────────────────────────────────

const arg = process.argv[2];

if (arg === '--print-sql') {
  console.log(INTROSPECTION_SQL);
  process.exit(0);
}

if (!arg) {
  console.error('Usage: check-prod-drift.mjs --print-sql | <introspection.json>');
  process.exit(2);
}

const expected = parseExpected();
const raw = JSON.parse(readFileSync(arg, 'utf8'));
// Tolère le format brut MCP/SQL editor : [{ introspection: {...} }] ou {...}
const actual = Array.isArray(raw) ? (raw[0].introspection ?? raw[0]) : (raw.introspection ?? raw);

const { missing, extra, assumed, dynamicTriggers } = diff(expected, actual);

console.log(`Attendu (repo) : ${expected.tables.size} tables, ${expected.functions.size} fonctions, ` +
  `${expected.triggers.size} triggers (${dynamicTriggers} dynamiques), ${expected.policies.size} policies`);
console.log(`Prod (live)    : ${actual.tables?.length ?? 0} tables, ${actual.functions?.length ?? 0} fonctions, ` +
  `${actual.triggers?.length ?? 0} triggers, ${actual.policies?.length ?? 0} policies`);

if (assumed.length) {
  console.log('\nℹ️  Divergences ASSUMÉES (fresh-install only, cf. FRESH_INSTALL_ONLY) :');
  for (const a of assumed.sort()) console.log('   ' + a);
}

if (extra.length) {
  console.log('\n⚠️  EN TROP en prod (héritage dashboard, à versionner ou à supprimer) :');
  for (const e of extra.sort()) console.log('   ' + e);
}

if (missing.length) {
  console.error('\n❌ MANQUANT en prod (migration versionnée NON appliquée — c\'est la dérive 017 !) :');
  for (const m of missing.sort()) console.error('   ' + m);
  console.error('\n→ Appliquer la migration concernée (MCP apply_migration / SQL editor), puis relancer.');
  process.exit(1);
}

console.log('\n✅ Aucun objet attendu ne manque en prod.' + (extra.length ? ` (${extra.length} objet(s) hors-repo signalés ci-dessus)` : ''));
