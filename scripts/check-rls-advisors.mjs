#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// check-rls-advisors.mjs — garde CI sur les invariants RLS documentés
//
// POURQUOI CE SCRIPT EXISTE (audit architecture 2026-08-07, point H5)
//
// Le projet s'est fixé deux règles explicites dans CLAUDE.md :
//
//   1. `auth.uid()` TOUJOURS wrappé en `(select auth.uid())` — sinon Postgres
//      le ré-évalue PAR LIGNE scannée au lieu d'une fois par requête (mig. 043).
//   2. UNE SEULE policy PERMISSIVE par couple rôle+action — deux policies sont
//      évaluées séparément puis OR'ées, à chaque requête (mig. 049).
//
// Ces deux règles ont DÉJÀ régressé deux fois :
//   • mig. 059 (partage de listes) → 4 policies en `auth.uid()` nu
//   • mig. 082 (commentaires) → 2 policies en `auth.uid()` nu
//   • mig. 077 (agenda manager) → 2 policies PERMISSIVE de plus sur `events`
//
// Une règle qui ne vit que dans un fichier Markdown n'est pas une règle : c'est
// une intention. Ce script en fait une contrainte vérifiable.
//
// ── CE QU'IL VÉRIFIE ───────────────────────────────────────────────
//
// Analyse statique des `CREATE POLICY` de supabase/migration/*.sql, en tenant
// compte de l'HISTORIQUE : une policy re-créée par une migration ultérieure
// remplace la précédente (comme en base). L'état final de chaque policy est
// donc évalué, pas chaque occurrence isolément.
//
// Volontairement statique : la CI n'a pas d'accès à la prod, et un check qui
// exige des secrets finit désactivé. Pour un contrôle sur l'état RÉEL, les
// advisors Supabase restent la source de vérité (cf. AUDIT-ARCHITECTURE).
//
// Sortie : 1 si au moins une violation, 0 sinon.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'supabase/migration';

// ── Plancher : à partir de quelle migration la règle s'applique ─────
//
// La mig. 043 est celle qui a INTRODUIT la convention `(select auth.uid())`,
// et la 049 celle de la policy permissive unique. Les migrations antérieures
// sont, par construction, non conformes — les auditer n'apprendrait rien et
// rendrait cette gate rouge en permanence, donc ignorée (exactement le travers
// que l'audit pointe au sujet de la CI).
//
// Autre raison, plus dure : les fichiers de migration DIVERGENT de la prod
// (constaté dans CLAUDE.md et re-vérifié le 2026-08-07 — plusieurs policies de
// 001-007 n'existent plus en base sans qu'aucun DROP ne figure dans un
// fichier). Un modèle statique de l'historique complet est donc faux.
//
// Ce script est un CLIQUET : « aucune NOUVELLE violation à partir d'ici ».
// Pour l'état réel, la source de vérité reste les advisors Supabase
// (cf. AUDIT-ARCHITECTURE-2026-08-07.md).
const RULE_FLOOR = 43;

// `auth.uid()` NON précédé de `select ` (insensible à la casse et aux espaces).
const RAW_UID = /(?<!select\s{0,10})\bauth\.uid\(\)/i;

// Policies volontairement exemptées, avec justification obligatoire.
// Garder cette liste courte : chaque entrée est une dette assumée.
const EXEMPT = new Set([
  // (aucune aujourd'hui)
]);

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => Number.parseInt(f.slice(0, 3), 10) >= RULE_FLOOR);

/** État final par policy : clé `table.policy` → { file, cmd, body, permissive } */
const finalState = new Map();
/** Policies supprimées sans être recréées → à ne pas compter. */
const dropped = new Set();

for (const file of files) {
  const sql = readFileSync(join(DIR, file), 'utf8');

  // DROP POLICY "x" ON t  → la policy disparaît (elle peut être recréée juste après)
  for (const m of sql.matchAll(/DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"?([\w\s-]+?)"?\s+ON\s+(?:public\.)?(\w+)/gi)) {
    dropped.add(`${m[2]}.${m[1].trim()}`);
  }

  // CREATE POLICY "x" ON t [AS PERMISSIVE|RESTRICTIVE] FOR <cmd> ... ;
  for (const m of sql.matchAll(
    /CREATE\s+POLICY\s+"?([\w\s-]+?)"?\s+ON\s+(?:public\.)?(\w+)([\s\S]*?);/gi,
  )) {
    const [, rawName, table, body] = m;
    const name = rawName.trim();
    const key = `${table}.${name}`;
    dropped.delete(key);
    const cmd = (body.match(/FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)/i)?.[1] ?? 'ALL').toUpperCase();
    const restrictive = /AS\s+RESTRICTIVE/i.test(body);
    finalState.set(key, { file, table, name, cmd, body, restrictive });
  }
}

for (const key of dropped) finalState.delete(key);

let violations = 0;
const fail = (msg) => { console.error(`✖ ${msg}`); violations++; };

// ─── Règle 1 : auth.uid() wrappé (mig. 043) ─────────────────────────
for (const [key, p] of finalState) {
  if (EXEMPT.has(key)) continue;
  if (RAW_UID.test(p.body)) {
    fail(
      `${p.file} — policy "${p.name}" sur ${p.table} utilise auth.uid() NU.\n` +
      `    → remplacer par (select auth.uid()) : sans le wrapper, Postgres ré-évalue\n` +
      `      la fonction pour CHAQUE ligne scannée (advisor auth_rls_initplan, mig. 043).`,
    );
  }
}

// ─── Règle 2 : une seule policy PERMISSIVE par table+action (mig. 049) ──
const byTableCmd = new Map();
for (const [key, p] of finalState) {
  if (p.restrictive) continue; // les RESTRICTIVE se cumulent par conception
  const k = `${p.table}|${p.cmd}`;
  if (!byTableCmd.has(k)) byTableCmd.set(k, []);
  byTableCmd.get(k).push({ key, ...p });
}

for (const [k, list] of byTableCmd) {
  if (list.length < 2) continue;
  const [table, cmd] = k.split('|');
  fail(
    `${table} a ${list.length} policies PERMISSIVE pour ${cmd} : ` +
    `${list.map((p) => `"${p.name}"`).join(', ')}.\n` +
    `    → Postgres les évalue SÉPARÉMENT puis les OR à chaque requête.\n` +
    `      Fusionner en UNE policy dont le USING est le OR des deux (mig. 049).\n` +
    `      Ne JAMAIS élargir en ajoutant une policy : élargir le OR existant.`,
  );
}

console.log(
  `\nInvariants RLS : ${finalState.size} policies analysées dans ${files.length} migration(s), ` +
  `${violations} violation(s).`,
);
if (violations > 0) {
  console.error(
    '\nCes règles viennent de CLAUDE.md et ont déjà régressé deux fois.\n' +
    'Si une violation est délibérée, ajouter la clé `table.policy` à EXEMPT\n' +
    'dans ce script AVEC une justification écrite.',
  );
}
process.exit(violations > 0 ? 1 : 0);
