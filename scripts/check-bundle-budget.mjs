// Budget de bundle, le seul budget du dépôt qui n'était mesuré par AUCUNE garde.
//
// Tous les autres ont fini par obtenir un cliquet (taille des fichiers, échelle
// typographique, échelle z-index, mouvement des feuilles, couverture de tests).
// Celui-ci non, et c'est le seul qui ait reculé sans que rien ne le signale :
// +5 ko gzip sur le chunk d'entrée en UNE journée le 2026-08-25, pour une marge
// de 11 ko. Les mesures étaient dans `docs/PERFORMANCE.md`, donc dans un
// Markdown, donc invérifiables, exactement le motif que ce dépôt documente
// depuis des semaines : *une règle qu'aucun script ne mesure recule à chaque
// vague de features.*
//
// Ce script lit le build RÉEL (`dist/`) et compare au cliquet ci-dessous.
//
// Usage :
//   npm run build && npm run check:bundle
//   npm run check:bundle -- --report   (affiche tout, ne fait échouer rien)
//
// 🔴 **Ne jamais remonter un plafond pour faire passer la CI.** La règle est
// celle de `vitest.config.ts` : un plafond ne descend que quand la mesure
// descend. S'il est franchi, c'est le bundle qui doit maigrir, le levier est
// documenté dans `docs/PERFORMANCE.md`.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const ASSETS = join(ROOT, 'dist', 'assets');

/**
 * Plafonds en OCTETS GZIP, posés au-dessus du mesuré avec une marge courte.
 *
 * `entry` est le seul qui compte vraiment : c'est le JavaScript que tout
 * visiteur télécharge, y compris celui qui rebondit. Les chunks lazy ne sont
 * payés que par ceux qui ouvrent l'écran correspondant.
 */
const BUDGETS = {
  // Mesuré 87 216 o le 2026-08-25, contre 138 987 o le matin même : découpage
  // des catalogues i18n par page, puis sortie de `clsx` du chunk
  // `vendor-charts`. Plafond posé ~5 % au-dessus.
  //
  // Le budget PRODUIT reste 150 000 o (docs/PERFORMANCE.md) : c'est la limite
  // au-delà de laquelle le premier rendu devient perceptiblement lent sur un
  // mobile de milieu de gamme. Ce cliquet est plus strict exprès, il défend la
  // marge qu'on vient de gagner au lieu d'attendre qu'elle soit consommée.
  entry: 92_000,
  // Le plus gros chunk de page. `OrganizationPage` mesure 64 169 o.
  page: 70_000,
};

/**
 * Chunks vendor autorisés à dépasser le budget de page, avec la raison.
 *
 * Chacun est LAZY : il ne touche pas le chemin critique. La liste est
 * explicite pour qu'ajouter une grosse dépendance demande de l'écrire ici,
 * c'est-à-dire de la justifier.
 */
const EXEMPT = {
  'vendor-charts': 'recharts + d3, lazy : Statistiques, graphique du dashboard, guide',
  'vendor-calendar': '@fullcalendar + locales-all, lazy, /agenda uniquement',
  'vendor-gsap': 'gsap + plugins, lazy, landing uniquement',
  'vendor-react': 'react + react-dom, socle non découpable',
  'vendor-supabase': 'client Supabase, requis dès la première requête',
};

const KB = (n) => `${(n / 1000).toFixed(1)} ko`;

if (!existsSync(ASSETS)) {
  console.error(
    'dist/assets introuvable. Ce contrôle mesure le build RÉEL :\n' +
      '  npm run build && npm run check:bundle'
  );
  process.exit(1);
}

const files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
const measured = files
  .map((name) => ({
    name,
    // `name-HASH.js` → `name`. Le hash change à chaque build, pas le budget.
    //
    // ⚠️ `{8}` exactement, pas `{8,}` : le hash Vite est en base64url et peut
    // contenir un tiret (`C-bIaeYw`), donc un quantificateur gourmand mange le
    // nom lui-même, `vendor-charts-DMeWk7Ji.js` devenait `vendor`, et les
    // exemptions ne matchaient plus rien.
    base: name.replace(/-[A-Za-z0-9_-]{8}\.js$/, ''),
    gzip: gzipSync(readFileSync(join(ASSETS, name))).length,
  }))
  .sort((a, b) => b.gzip - a.gzip);

// Le chunk d'entrée est celui référencé par index.html, pas simplement le plus
// gros `index-*.js` : Vite en émet plusieurs (barrels de modules), et prendre
// le mauvais mesurerait un chunk lazy en croyant surveiller le critical path.
const html = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8');
const entryMatch = /<script[^>]+src="\/assets\/(index-[A-Za-z0-9_-]+\.js)"/.exec(html);
const entry = entryMatch ? measured.find((m) => m.name === entryMatch[1]) : null;

const errors = [];
const report = [];

if (!entry) {
  errors.push("Chunk d'entrée introuvable dans dist/index.html, le contrôle ne mesure rien.");
} else {
  report.push(`entry  ${entry.name}  ${KB(entry.gzip)}  (plafond ${KB(BUDGETS.entry)})`);
  if (entry.gzip > BUDGETS.entry) {
    errors.push(
      `Chunk d'entrée : ${KB(entry.gzip)} > ${KB(BUDGETS.entry)}.\n` +
        `  C'est le JavaScript que TOUT visiteur télécharge.\n` +
        `  Leviers dans docs/PERFORMANCE.md, ne pas remonter le plafond.`
    );
  }
}

for (const m of measured) {
  if (entry && m.name === entry.name) continue;
  if (EXEMPT[m.base]) {
    report.push(`exempt ${m.base.padEnd(22)} ${KB(m.gzip)}  (${EXEMPT[m.base]})`);
    continue;
  }
  if (m.gzip > BUDGETS.page) {
    errors.push(
      `Chunk \`${m.base}\` : ${KB(m.gzip)} > ${KB(BUDGETS.page)}.\n` +
        `  Soit il faut le découper, soit c'est une dépendance vendor à ajouter\n` +
        `  à EXEMPT dans ce fichier : AVEC sa raison.`
    );
  }
}

if (process.argv.includes('--report')) {
  for (const m of measured.slice(0, 20)) console.log(`${KB(m.gzip).padStart(9)}  ${m.name}`);
  console.log('');
}

for (const line of report) console.log(line);

if (errors.length) {
  console.error('\nBudget de bundle dépassé :\n');
  for (const e of errors) console.error(`  ${e}\n`);
  process.exit(1);
}

const total = measured.reduce((s, m) => s + m.gzip, 0);
console.log(
  `\nBudget de bundle respecté, ${measured.length} chunks, ${KB(total)} gzip au total.`
);
