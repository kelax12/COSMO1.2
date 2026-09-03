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
 * `critical` est celui qui compte : c'est le JavaScript que tout visiteur
 * télécharge, y compris celui qui rebondit. Les chunks lazy ne sont payés que
 * par ceux qui ouvrent l'écran correspondant.
 */
const BUDGETS = {
  // ── LE budget qui compte ──
  //
  // Somme gzip du chunk d'entrée ET de tout ce que `dist/index.html` précharge.
  // C'est ce qu'un visiteur télécharge avant de voir quoi que ce soit, y compris
  // celui qui arrive sur la landing et repart.
  //
  // Mesuré 393 850 o le 2026-08-26. Plafond ~1,5 % au-dessus.
  //
  // ⚠️ Ce budget a REMPLACÉ « taille du chunk d'entrée » comme mesure
  // principale, et le remplacement vient d'une erreur réelle : en sortant les
  // primitives Radix de leur chunk groupé, l'entrée a GROSSI de 19 ko pendant
  // que le chemin critique MAIGRISSAIT de 26 ko. L'ancienne mesure aurait
  // refusé une amélioration. Une garde qui mesure le mauvais nombre est pire
  // qu'une garde absente : elle donne tort à la bonne décision.
  // 2026-08-28 : 393 850 → **373 043 o** (364,3 ko). Deux leviers, tous deux
  // payés par TOUS les visiteurs :
  //   • zod (131,8 ko bruts) sort de l'entrée — garde UX chargée à la première
  //     écriture, pas à l'ouverture (`src/lib/validation/lazy.ts`) ;
  //   • le `<TooltipProvider>` d'`App.tsx` était REDONDANT (le composant
  //     `Tooltip` fournit déjà le sien) et traînait `@radix-ui/react-tooltip`
  //     + tout `floating-ui`, 113 ko bruts, pour un seul consommateur lazy.
  // Plafond reposé ~1,6 % au-dessus du mesuré.
  // 2026-09-02 : 373 043 → **364 500 o**, et le plafond REDESCEND de 379 000 à
  // 370 000. Les dépôts de DÉMONSTRATION du mode entreprise sont sortis du
  // chemin critique (`src/lib/demo-repositories.ts`) : ils pesaient 52 ko bruts
  // que tout visiteur téléchargeait, y compris celui qui repart de la landing
  // sans jamais se connecter. Le reste des dépôts de démo, 72 ko bruts encore
  // dans l'entrée, attend la séparation interface / implémentation locale que
  // six modules n'ont pas.
  critical: 370_000,

  // Mesure secondaire, conservée pour attraper le cas inverse : une entrée qui
  // enfle sans que le nombre de préchargements bouge. Le plafond est passé de
  // 92 à 112 ko le 2026-08-26, et c'est la SEULE fois où remonter un plafond
  // est la bonne réponse : l'entrée a absorbé du code qui était préchargé à
  // côté, donc le total a baissé. Vérifier `critical` avant de toucher à
  // celui-ci.
  // 2026-08-28 : 106,9 → **77 312 o** (75,5 ko), et le plafond REDESCEND de
  // 112 000 à 79 000. C'est le remboursement de la seule fois où ce dépôt a
  // relevé un plafond pour absorber une dérive — le cliquet joue dans les deux
  // sens, il attrape la dette PUIS enregistre son remboursement.
  //
  // 🔴 Toujours vérifier `critical` avant de toucher à celui-ci : sortir un
  // module de l'entrée sans le sortir du chemin critique ne gagne rien.
  // 2026-09-03 : 77 312 → **77 379 o**, plafond de 79 000 à 78 000. Même coupe
  // que ci-dessus (les dépôts de démo entreprise sortent du chemin critique).
  //
  // ⚠️ Le cliquet a failli être RELEVÉ la veille pour absorber les 2,5 ko d'un
  // lot de correctifs. Les deux mesures montaient, donc ce n'était pas le cas
  // d'absorption qui l'autorise : couper d'abord était la bonne réponse, et la
  // coupe a rendu 5,1 ko, deux fois ce qu'il fallait.
  //
  // 🔴 Le chiffre ci-dessus n'est PAS celui qu'annonçait la première version de
  // ce commentaire (75 798). Il datait d'un arbre de la veille au soir ; le lot
  // a continué de grossir de 1,6 ko pendant la nuit. Un plafond posé sur une
  // mesure périmée est un plafond faux, même quand il est plus bas — celui-ci
  // aurait fait échouer la CI sur une valeur que plus rien ne mesurait.
  entry: 78_000,

  // Le plus gros chunk de page. `OrganizationPage` mesure ~64 ko.
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

// Le chemin critique = l'entrée PLUS tout ce que le HTML précharge. On le lit
// dans `dist/index.html` plutôt que de le déduire des noms de fichiers : c'est
// le navigateur qui décide de ce qu'il télécharge, pas nos conventions de
// nommage. C'est exactement ce qui avait laissé passer `vendor-charts`, un
// chunk « lazy » de 117 ko préchargé pour tout le monde.
const preloaded = [
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+)"/g),
].map((m) => m[1]);

const criticalNames = new Set(entry ? [entry.name, ...preloaded] : preloaded);
const critical = measured
  .filter((m) => criticalNames.has(m.name))
  .sort((a, b) => b.gzip - a.gzip);
const criticalTotal = critical.reduce((s, m) => s + m.gzip, 0);

if (!entry) {
  errors.push("Chunk d'entrée introuvable dans dist/index.html — le contrôle ne mesure rien.");
}

report.push(
  `critique  ${String(critical.length).padStart(2)} chunks  ${KB(criticalTotal).padStart(9)}  (plafond ${KB(BUDGETS.critical)})`
);
for (const m of critical) report.push(`   ${KB(m.gzip).padStart(9)}  ${m.base}`);

if (criticalTotal > BUDGETS.critical) {
  errors.push(
    [
      `Chemin critique : ${KB(criticalTotal)} > ${KB(BUDGETS.critical)}.`,
      `  C'est ce que TOUT visiteur télécharge avant de voir la page.`,
      ...critical.map((m) => `    ${KB(m.gzip).padStart(9)}  ${m.base}`),
      `  Leviers dans docs/PERFORMANCE.md. Ne pas remonter le plafond.`,
    ].join('\n')
  );
}

if (entry) {
  report.push(`entrée    ${KB(entry.gzip).padStart(9)}  (plafond ${KB(BUDGETS.entry)})`);
  if (entry.gzip > BUDGETS.entry) {
    errors.push(
      `Chunk d'entrée : ${KB(entry.gzip)} > ${KB(BUDGETS.entry)}.\n` +
        `  Vérifier d'abord \`critique\` ci-dessus : si le total a baissé, c'est\n` +
        `  que du code préchargé à côté a été absorbé, et c'est une bonne nouvelle.`
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

// ── Le build mesuré est-il celui qui part en production ? ────────────
//
// 🔴 Trouvé le 2026-09-02, et c'est le défaut le plus coûteux qu'ait porté
// cette garde : elle mesurait un bundle plus léger que celui livré, sans
// jamais le dire.
//
// `main.tsx` garde son `Sentry.init` derrière `if (sentryDsn)`. Quand
// `VITE_SENTRY_DSN` est absente, Vite la remplace par `undefined` À LA
// COMPILATION, la branche devient du code mort, et Rollup jette presque tout
// `@sentry/react`. Mesuré le même jour, même arbre, mêmes `node_modules`,
// seule la variable changeant :
//
//     avec DSN  →  vendor-sentry  145 740 o brut,  49 276 o gzip
//     sans DSN  →  vendor-sentry   11 633 o brut,   3 818 o gzip
//
// La CI construisait sans la variable. Le chemin critique était donc
// sous-estimé de ~45 ko gzip, et les attributions de bootup du job
// `lighthouse` étaient structurellement AVEUGLES à Sentry — on ne pouvait rien
// conclure sur son coût, ni dans un sens ni dans l'autre. Vercel, lui,
// construit avec la variable.
//
// Une garde qui mesure le mauvais artefact est pire qu'une garde absente : elle
// donne une réponse, et on la croit. D'où ce contrôle, qui refuse de valider un
// budget calculé sur une forme de bundle qui n'existe nulle part.
const sentry = measured.find((m) => m.base === 'vendor-sentry');
const SENTRY_FLOOR = 20_000;
if (sentry && sentry.gzip < SENTRY_FLOOR) {
  errors.push(
    `Build mesuré SANS \`VITE_SENTRY_DSN\` : vendor-sentry ne pèse que ${KB(sentry.gzip)}.\n` +
      `  Sans la variable, Vite élimine la branche \`Sentry.init\` et Rollup jette\n` +
      `  presque tout @sentry/react : le bundle mesuré n'est PAS celui livré, et le\n` +
      `  chemin critique est sous-estimé d'environ 45 ko gzip.\n` +
      `  Poser la variable au moment du build (n'importe quelle valeur non vide suffit,\n` +
      `  elle ne décide que de la forme du bundle), puis relancer.`
  );
} else if (!sentry) {
  report.push(
    'ℹ️  vendor-sentry absent du build : si Sentry a été retiré volontairement, ' +
      'supprimer le contrôle de plancher dans ce fichier.'
  );
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
