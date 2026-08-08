#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// i18n-scan.mjs — inventaire des chaînes NON traduites
//
// Complément de `i18n-check.mjs` : celui-ci vérifie que les catalogues
// existants sont cohérents ; celui-là dit ce qu'il RESTE à extraire.
//
// Heuristique volontairement large (texte JSX, attributs textuels, toasts,
// littéraux accentués) : il vaut mieux un faux positif qu'une chaîne oubliée.
// Ne fait donc PAS échouer la CI — c'est un outil de pilotage, lancé à la main :
//
//   npm run i18n:scan
//
// Sortie : nombre de fichiers et de chaînes restantes, puis le détail trié par
// volume décroissant, pour attaquer le chantier par les plus gros morceaux.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = /(__test__|showcase|\.test\.|\.spec\.)/;

function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'locales') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !SKIP.test(p)) out.push(p);
  }
  return out;
}

// Toutes les voyelles accentuées du français, PAS seulement les plus courantes.
// La version précédente omettait `â` : « tâches » — le mot le plus fréquent de
// l'app — était donc invisible pour le scan, et avec lui toute chaîne qui ne
// contenait pas d'autre accent (« Toutes les tâches », « Tâches de… »).
const ACC = '[éèêëàâäçùûüôöîïœÉÈÊËÀÂÄÇÙÛÔÖÎÏŒ]';
const PATTERNS = [
  new RegExp(`>\\s*([^<>{}\\n]*${ACC}[^<>{}\\n]*?)\\s*<`, 'g'),
  new RegExp(`(?:title|aria-label|placeholder|label|actionLabel|description|alt)=["']([^"']*${ACC}[^"']*)["']`, 'g'),
  new RegExp(`(?:toast\\.\\w+|showUndoToast|confirm)\\(\\s*['"\`]([^'"\`]*${ACC}[^'"\`]*)['"\`]`, 'g'),
];

const rows = [];
for (const f of walk('src')) {
  const s = readFileSync(f, 'utf8');
  const hits = new Set();
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      const v = m[1].trim();
      if (!v || v.length < 3) continue;
      if (/^[\d\s%·—–\-+.,:/()€]+$/.test(v)) continue;
      hits.add(v);
    }
  }
  if (hits.size > 0) rows.push([hits.size, f.replace(/\\/g, '/')]);
}
rows.sort((a, b) => b[0] - a[0]);
console.log('FICHIERS:', rows.length, '| CHAINES UNIQUES:', rows.reduce((s, r) => s + r[0], 0));
for (const [n, f] of rows) console.log(String(n).padStart(4), f);
