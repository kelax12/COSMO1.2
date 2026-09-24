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
  // 2026-09-11 : 316 407 → **306 347 o**, et le plafond REDESCEND de 370 000 à
  // 323 000. `sonner` (10,1 ko gzip) sort du chemin critique : le `<Toaster>`
  // d'`App.tsx` est différé et tous les appels passent par la façade
  // `src/lib/toast.ts`, qui fait le SEUL `import('sonner')` du dépôt.
  //
  // 🔴 Le piège, mesuré, parce qu'il se reproduira : nettoyer le SHELL ne
  // suffit pas. Tant qu'une page lazy garde un import statique de `sonner`,
  // Rollup place le module dans l'ancêtre commun des chunks qui le partagent,
  // c'est-à-dire l'ENTRÉE. Et l'en sortir par `manualChunks` fait émettre à
  // Vite un `<link rel="modulepreload">` : l'entrée maigrit de 10 ko, le
  // chemin critique de 162 OCTETS. Le gain n'existe qu'avec zéro import
  // statique dans tout `src/`. Cliquet : `src/lib/toast.guard.test.ts`.
  //
  // ⚠️ Le plafond est posé ~5 % au-dessus du mesuré, et non ~1,5 % comme les
  // précédents : le critère de sortie de C-14 exige 5 % de marge sur les DEUX
  // budgets. Reposer le cliquet à 1,5 % rouvrirait l'item le jour même.
  critical: 323_000,

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
  // 2026-09-11 : 76 954 → **66 896 o**, plafond de 78 000 à 71 000. Même coupe
  // que ci-dessus, et `critique` a baissé d'autant (−10 060 o des deux côtés) :
  // c'est ce qui la distingue d'un déplacement.
  //
  // ⚠️ La mesure du 2026-09-04 annonçait 74 903 o (3,97 % de marge). Elle
  // n'avait pas été refaite depuis, et l'entrée avait REPRIS 2 051 o entre
  // temps — marge réelle au 2026-09-11 avant coupe : **1,34 %**. Un budget
  // qu'on ne remesure pas dérive dans le sens qui arrange.
  entry: 71_000,

  // Le plus gros chunk de page. `OrganizationPage` mesure ~64 ko.
  page: 70_000,
};

/**
 * ═══ C-85 · UN PLAFOND PAR CHUNK, POSÉ AU POIDS DU JOUR ═══════════
 *
 * 🔴 CE QUI MANQUAIT. Avant le 2026-09-20, un chunk hors chemin critique était
 * jugé par UN SEUL nombre (`BUDGETS.page`, 70 ko) — et cinq vendors en étaient
 * carrément dispensés, donc sans aucune borne. Conséquence : `TasksPage`
 * pouvait passer de 35 à 69 ko sans qu'un seul job bronche, et `vendor-charts`
 * de 117 à 400 sans qu'aucun ne le puisse. Le budget protégeait ce que tout le
 * monde télécharge, et laissait dériver ce que la moitié des visiteurs
 * téléchargent.
 *
 * CE QUE C'EST : un CLIQUET par chunk, posé au poids MESURÉ le 2026-09-20,
 * arrondi ~5 % au-dessus. Pas une cible ronde — la convention du dépôt, la
 * même que `vitest.config.ts` et que `critical` ci-dessus. Un plafond très
 * au-dessus du réel ne mesure rien.
 *
 * 🔴 NE JAMAIS REMONTER UN CHIFFRE POUR FAIRE PASSER LA CI. Il descend quand
 * la mesure descend, jamais l'inverse. La seule remontée légitime est celle
 * qu'`entry` documente : un chunk qui ABSORBE du code venu d'un autre, avec la
 * preuve que le total, lui, a baissé.
 *
 * ⚠️ LA CLÉ EST LE NOM DE BASE, ET LA MESURE EST UNE SOMME. Vite émet
 * plusieurs fichiers sous le même nom de base (huit `index-*`, deux `org-*`,
 * deux `landing-*`, deux `legal-*` au 2026-09-20, puis deux par document
 * légal depuis le 2026-09-24 : une locale par fichier, ou des barils de
 * modules). Juger le plus gros laisserait un neuvième baril arriver
 * gratuitement. On somme donc tous les fichiers d'un même nom, et le compte
 * est affiché dans le rapport.
 *
 * ⚠️ LE CHUNK D'ENTRÉE EST EXCLU de cette somme : il a son propre budget
 * (`BUDGETS.entry`), et il porte lui aussi le nom de base `index`. Le compter
 * deux fois ferait échouer la garde sur une addition, pas sur une dérive.
 *
 * Un chunk SANS entrée ici reste jugé par `BUDGETS.page` : un écran neuf n'a
 * pas à être déclaré pour exister, il a seulement à rester sous la borne
 * générique. Le jour où il la dépasse, c'est ici qu'on décide.
 */
const PLAFONDS_PAR_CHUNK = {
  'vendor-charts': 123_500, // 117 533 o — recharts + d3, lazy (Statistiques, dashboard, guide)
  'vendor-calendar': 89_500, // 85 067 o — @fullcalendar + locales-all, lazy, /agenda
  index: 89_500, // 84 893 o sur 8 barils de modules, chunk d'entrée EXCLU
  'vendor-react': 76_000, // 72 074 o — socle non découpable
  'vendor-supabase': 59_500, // 56 254 o — requis dès la première requête
  'vendor-gsap': 57_500, // 54 737 o — gsap + plugins, lazy, landing uniquement
  'sentry-client': 52_000, // 49 320 o — chargé APRÈS le premier rendu (C-13 · C-14)
  'vendor-animation': 52_000, // 49 245 o — framer-motion
  TasksPage: 37_000, // 35 039 o — la plus grosse page du produit
  'vendor-utils': 33_000, // 31 053 o
  org: 30_000, // 28 494 o sur 2 chunks
  TaskModal: 29_000, // 27 183 o
  landing: 24_000, // 22 853 o sur 2 chunks
  'dropdown-menu': 22_000, // 20 526 o
  HabitsPage: 21_000, // 19 873 o
  LandingPage: 21_000, // 19 740 o
  DashboardPage: 20_500, // 19 175 o
  'vendor-query': 18_500, // 17 599 o
  AgendaPage: 18_500, // 17 468 o
  OrganizationPage: 18_000, // 16 686 o
  TeamProjectsTab: 17_000, // 15 992 o
  UseCasePage: 16_500, // 15 591 o
  // 🔴 `legal` (plafond 15 500) a DISPARU le 2026-09-24 : c'est un DÉCOUPAGE,
  // pas une remontée. La passe de conformité l'avait porté à 18 527 o
  // (9 722 fr + 8 805 en, remesuré au build de `3360a455`), et CHAQUE page
  // contractuelle le téléchargeait en entier pour afficher un seul de ses
  // trois documents. Un namespace par document désormais (`src/i18n/catalog.ts`).
  // Ce que télécharge UNE page, fr / en (en = repli fr + en) :
  //   CGU              9 722 → 4 959 o   ·   18 527 → 9 452 o
  //   Confidentialité  9 722 → 5 061 o   ·   18 527 → 9 609 o
  //   Mentions légales 9 722 → 1 500 o   ·   18 527 → 2 829 o
  // ⚠️ La SOMME des quatre clés ci-dessous (21 428 o) dépasse l'ancien
  // `legal` : quatre fichiers compressés séparément se paient un en-tête gzip
  // chacun. Personne ne télécharge cette somme, aucune page ne charge plus
  // d'un document. Ne pas « regrouper pour économiser » sur ce chiffre-là.
  legalPrivacy: 9_900, // 9 378 o sur 2 chunks (fr + en)
  legalTerms: 9_700, // 9 221 o sur 2 chunks
  legalNotice: 2_800, // 2 598 o sur 2 chunks
  legalShared: 300, // 231 o sur 2 chunks : « Retour » et « Dernière mise à jour »
  OKRPage: 15_000, // 14 192 o
  'vendor-router': 14_500, // 13 729 o
  TeamTaskModal: 14_500, // 13 345 o
  EnterpriseTrack: 13_500, // 12 790 o
  'vendor-ogl': 13_500, // 12 643 o
  types: 13_000, // 12 304 o
  StatisticsPage: 13_000, // 12 015 o
};

/**
 * Chunks vendor autorisés à dépasser `BUDGETS.page`, avec la raison.
 *
 * ⚠️ « Exempt » NE VEUT PLUS DIRE « sans borne » depuis C-85. Chacun de ces
 * cinq a désormais son plafond dans `PLAFONDS_PAR_CHUNK`, et une exemption
 * sans plafond est refusée par le contrôle de cohérence plus bas : c'était la
 * porte par laquelle 117 ko pouvaient en devenir 400.
 *
 * Chacun est LAZY ou incompressible : il ne touche pas le chemin critique, ou
 * il n'est pas découpable. La liste reste explicite pour qu'ajouter une grosse
 * dépendance demande de l'écrire ici, c'est-à-dire de la justifier.
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

// ── C-85 · jugement PAR NOM DE BASE, somme des fichiers, entrée exclue ──
const parBase = new Map();
for (const m of measured) {
  if (entry && m.name === entry.name) continue; // budget propre : `BUDGETS.entry`
  const e = parBase.get(m.base) ?? { gzip: 0, fichiers: 0 };
  e.gzip += m.gzip;
  e.fichiers += 1;
  parBase.set(m.base, e);
}

// Une exemption SANS plafond est le trou que C-85 vient de fermer : elle
// rendait le chunk illimité. Ce contrôle interdit de le rouvrir par distraction.
for (const base of Object.keys(EXEMPT)) {
  if (!(base in PLAFONDS_PAR_CHUNK)) {
    errors.push(
      `\`${base}\` est EXEMPT du budget de page sans plafond propre dans\n` +
        `  PLAFONDS_PAR_CHUNK : il serait alors SANS AUCUNE BORNE. Lui poser un\n` +
        `  plafond au poids mesuré, ou retirer son exemption.`
    );
  }
}
// Un plafond qui ne correspond plus à aucun chunk décrit un état périmé, et
// une liste qu'on ne peut plus relire est une liste qu'on cesse de croire.
//
// ⚠️ Le contrôle d'EXISTENCE regarde TOUS les chunks, entrée comprise, alors
// que la SOMME budgétée l'exclut. Sans cette distinction, le jour où Vite
// n'émettrait plus qu'un seul `index-*` (celui de l'entrée), la garde
// annoncerait que le chunk `index` « n'existe plus » alors qu'il est sous nos
// yeux — et on retirerait son plafond pour faire taire la CI.
const basesPresentes = new Set(measured.map((m) => m.base));
for (const base of Object.keys(PLAFONDS_PAR_CHUNK)) {
  if (!basesPresentes.has(base)) {
    errors.push(
      `\`${base}\` a un plafond dans PLAFONDS_PAR_CHUNK mais n'existe plus dans\n` +
        `  le build : retirer la ligne (ou vérifier que le chunk n'a pas été renommé).`
    );
  }
}

for (const [base, { gzip, fichiers }] of [...parBase].sort((a, b) => b[1].gzip - a[1].gzip)) {
  const propre = PLAFONDS_PAR_CHUNK[base];
  const plafond = propre ?? BUDGETS.page;
  const suffixe = fichiers > 1 ? ` (${fichiers} chunks)` : '';
  if (propre && gzip >= 12_000) {
    const marge = (((plafond - gzip) / plafond) * 100).toFixed(1);
    report.push(
      `chunk  ${base.padEnd(22)} ${KB(gzip).padStart(9)}${suffixe}  ` +
        `(plafond ${KB(plafond)}, marge ${marge} %)${EXEMPT[base] ? ` — ${EXEMPT[base]}` : ''}`
    );
  }
  if (gzip > plafond) {
    errors.push(
      propre
        ? `Chunk \`${base}\` : ${KB(gzip)} > son plafond propre ${KB(plafond)}${suffixe}.\n` +
            `  🔴 Ce plafond est un CLIQUET posé au poids mesuré le 2026-09-20.\n` +
            `  Ne pas le remonter : c'est le chunk qui doit maigrir. Leviers dans\n` +
            `  docs/PERFORMANCE.md.`
        : `Chunk \`${base}\` : ${KB(gzip)} > ${KB(BUDGETS.page)}${suffixe}.\n` +
            `  Soit il faut le découper, soit c'est une dépendance vendor à ajouter\n` +
            `  à EXEMPT dans ce fichier : AVEC sa raison ET son plafond propre.`
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
//
// ⚠️ RÉÉCRIT le 2026-09-04, parce que la garde s'était mise à parler d'un chunk
// qui n'existe plus. Sentry est désormais chargé APRÈS le premier rendu
// (arbitrage C-13 · C-14) : il n'est plus dans `vendor-sentry`, plus dans le
// chemin critique, et plus préchargé depuis `index.html`. La garde cherchait
// `vendor-sentry`, ne le trouvait plus, et affichait « si Sentry a été retiré
// volontairement… » — une phrase FAUSSE et rassurante sur un build où Sentry
// est bien présent. Exactement le défaut qu'elle existe pour empêcher.
//
// Ce qu'elle protège aujourd'hui n'est plus le chiffrage du chemin critique
// (Sentry n'y est plus, la variable ne le change donc plus), mais un fait plus
// simple : **le build mesuré expédie-t-il réellement Sentry ?** Sans la
// variable, `startMonitoring` reste derrière `if (sentryDsn)`, la branche
// devient du code mort, et le chunk disparaît entièrement. Un budget vert sur
// un artefact d'où le monitoring a été éliminé ne dit rien du produit.
const sentry = measured.find((m) => m.base.startsWith('sentry-client'));
const SENTRY_FLOOR = 20_000;
if (!sentry) {
  errors.push(
    [
      'Aucun chunk `sentry-client` dans le build : Sentry n’est pas expédié.',
      '  Cause la plus probable : `VITE_SENTRY_DSN` absente au moment du build.',
      '  Vite la remplace par `undefined` À LA COMPILATION, la branche',
      '  `if (sentryDsn)` de main.tsx devient du code mort, et Rollup élimine',
      '  tout le chargement différé. Poser la variable (n’importe quelle valeur',
      '  non vide suffit, elle ne décide que de la forme du bundle), puis relancer.',
      '  Si Sentry a été retiré VOLONTAIREMENT, supprimer ce contrôle ici.',
    ].join('\n')
  );
} else if (sentry.gzip < SENTRY_FLOOR) {
  errors.push(
    [
      `Chunk \`sentry-client\` anormalement petit (${KB(sentry.gzip)}) : le SDK a`,
      '  probablement été élagué à tort. Attendu ~48 ko gzip.',
    ].join('\n')
  );
} else {
  // ⚠️ Le SENS de ce chiffre a changé, et le rappeler évite de le relire comme
  // avant : ce chunk est LAZY, il ne pèse plus sur le premier chargement. Il
  // est mesuré ici pour qu'un retour en arrière (import statique, préchargement
  // réintroduit) se voie dans `critique`, pas pour être budgété.
  report.push(`ℹ️  sentry-client ${KB(sentry.gzip)} — chargé APRÈS le premier rendu, hors chemin critique.`);
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
