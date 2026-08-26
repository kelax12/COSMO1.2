#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Garde du tableau de conformité de docs/LEGAL.md
//
// POURQUOI CE SCRIPT EXISTE
//
// Le bloc de synthèse de ce tableau a été faux TROIS fois dans la même
// journée du 2026-08-26, toujours pour la même raison : additionner de tête au
// lieu de recompter la source. Une des trois fois, douze lignes étaient même
// devenues invisibles au rendu Markdown pour s'être collées à la ligne
// précédente, et le total n'en disait rien.
//
// Un tableau de conformité dont le total ne correspond pas à ses propres
// lignes se disqualifie tout seul : c'est exactement le document qu'on
// présente en contrôle pour montrer qu'on sait où on en est.
//
// Ce que le script vérifie :
//   1. chaque ligne est bien une ligne Markdown à part entière (pas de
//      collage), en refusant tout `|| <ID> |` ;
//   2. aucun identifiant n'apparaît deux fois ;
//   3. les quatre nombres du bloc de synthèse correspondent aux lignes ;
//   4. le total annoncé correspond au nombre de lignes.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const FILE = 'docs/LEGAL.md';
const STATUSES = ['✅', '🟡', '❌', '⬜'];

const src = readFileSync(FILE, 'utf8');
const errors = [];

// 1. Collages — deux cellules de tableau accolées sans retour à la ligne.
const glued = [...src.matchAll(/\|\| ([A-F]\d+) \|/g)].map((m) => m[1]);
if (glued.length > 0) {
  errors.push(
    `${glued.length} ligne(s) collée(s) à la précédente, donc invisibles au rendu : ${glued.join(', ')}`,
  );
}

// 2. Les lignes du tableau.
const rows = [...src.matchAll(/^\| ([A-F]\d+) \| (.+?) \| (✅|🟡|❌|⬜) \|/gm)].map((m) => ({
  id: m[1],
  status: m[3],
}));

if (rows.length === 0) {
  errors.push('aucune ligne de tableau reconnue — le format a changé, ce script est à revoir');
}

const seen = new Set();
for (const { id } of rows) {
  if (seen.has(id)) errors.push(`identifiant en double : ${id}`);
  seen.add(id);
}

// 3. et 4. Le bloc de synthèse.
const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
for (const { status } of rows) counts[status] += 1;

// Les libellés sont des FRAGMENTS D'EXPRESSION RÉGULIÈRE, pas du texte brut :
// l'apostrophe peut être droite ou typographique selon l'éditeur qui a touché
// le document, et une garde qui échoue sur ce détail crie au loup.
const LABELS = {
  '✅': 'Bon',
  '🟡': 'Partiellement bon',
  '❌': 'À faire',
  '⬜': "Sans objet aujourd['’]hui",
};

for (const status of STATUSES) {
  const label = LABELS[status];
  const re = new RegExp(`\\| ${status} ${label} \\| \\*\\*(\\d+)\\*\\* \\|`);
  const m = src.match(re);
  if (!m) {
    errors.push(`ligne de synthèse introuvable pour le statut ${status}`);
    continue;
  }
  const declared = Number(m[1]);
  if (declared !== counts[status]) {
    errors.push(
      `synthèse « ${label} » annonce ${declared}, le tableau en contient ${counts[status]}`,
    );
  }
}

const totalMatch = src.match(/\| \*\*Total\*\* \| \*\*(\d+)\*\* \|/);
if (!totalMatch) {
  errors.push('ligne de total introuvable dans la synthèse');
} else if (Number(totalMatch[1]) !== rows.length) {
  errors.push(`total annoncé ${totalMatch[1]}, ${rows.length} ligne(s) réellement présentes`);
}

const summary = STATUSES.map((s) => `${s} ${counts[s]}`).join(' · ');

if (errors.length > 0) {
  console.error(`\n✖ ${FILE} — tableau de conformité incohérent\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\n  Décompte réel : ${summary} · total ${rows.length}\n`);
  process.exit(1);
}

console.log(`\nTableau de conformité cohérent : ${summary} · total ${rows.length}\n`);
