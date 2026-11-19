// Budget de bundle : lit le build RÉEL (`dist/`) et le compare aux cliquets ci-dessous.
// Usage : `npm run build && npm run check:bundle` · `npm run check:bundle -- --report` (n'échoue pas).
// 🔴 Ne jamais remonter un plafond pour faire passer la CI : il descend avec la mesure ; franchi,
// c'est le bundle qui maigrit (leviers : `docs/PERFORMANCE.md`). Historique des cliquets :
// `docs/archive/outillage-recits-2026-11-19.md`.

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
  // ── LE budget qui compte : gzip de l'entrée + tout ce que `dist/index.html` précharge, payé par
  // chaque visiteur. Il a remplacé « taille de l'entrée », qui refusait une coupe réelle du chemin
  // critique dès que l'entrée grossissait.
  // 🔴 Un module importé en statique par une seule page lazy revient dans l'entrée (ancêtre commun
  // Rollup) : le gain n'existe qu'avec zéro import statique (cliquet `src/lib/toast.guard.test.ts`).
  // ~5 % au-dessus du mesuré (306 347 o le 2026-09-11), marge exigée par la sortie de C-14.
  critical: 323_000,

  // Mesure secondaire : une entrée qui enfle sans que les préchargements bougent. Seule remontée
  // légitime : l'entrée absorbe du code préchargé à côté ET `critical` baisse ; vérifier `critical`
  // d'abord. Remesurer le jour même avant de reposer : une mesure périmée dérive dans le sens qui
  // arrange. 67 141 o le 2026-10-01.
  entry: 70_500,

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
 * deux `landing-*`, deux `legal-*` au 2026-09-20 : ce sont des barils de
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
  'vendor-pdf': 133_000, // 126 418 o — jsPDF, chargé au seul clic sur « Exporter en PDF » du rapport d'activité (2026-10-19)
  'vendor-gsap': 57_500, // 54 737 o — gsap + plugins, lazy, landing uniquement
  'sentry-client': 52_000, // 49 320 o — chargé APRÈS le premier rendu (C-13 · C-14)
  'vendor-animation': 52_000, // 49 245 o — framer-motion
  TasksPage: 37_000, // 35 039 o — la plus grosse page du produit
  'vendor-utils': 33_000, // 31 342 o le 2026-10-22 (32 854 avant) : parseur et formatRelative des locales date-fns retirés, cf. vite.config.ts. Plafond laissé, la marge est de 5,0 % tout juste
  org: 25_000, // 23 722 o sur 2 chunks (2026-10-01 : 40 6xx → 23 722, sections de /entreprise passées dans `orgAdmin`)
  TaskModal: 29_000, // 27 183 o
  landing: 13_800, // 13 083 o sur 2 chunks (2026-10-03 : le parcours entreprise passe dans `landingEnterprise`, 24 000 avant)
  landingEnterprise: 14_200, // 13 462 o sur 2 chunks — texte du parcours entreprise, chargé avec `EnterpriseTrack`
  'dropdown-menu': 22_000, // 20 526 o
  HabitsPage: 21_000, // 19 873 o
  LandingPage: 21_000, // 19 740 o
  DashboardPage: 20_500, // 19 175 o
  'vendor-query': 12_700, // 12 066 o (2026-10-03 : la virtualisation sort dans `vendor-virtual`, 18 500 avant)
  'vendor-virtual': 7_600, // 7 206 o — @tanstack/react-virtual + virtual-core, lazy (/tasks, Tâches entreprise)
  AgendaPage: 18_300, // 17 310 o le 2026-10-22 (18 278 avant) : tutoriel, panneau et pastille de revue chargés à part ; 18 500 jusque-là
  OrganizationPage: 18_000, // 16 686 o
  TeamProjectsTab: 17_000, // 15 992 o
  UseCasePage: 16_500, // 15 591 o
  // ⚖️ RELEVÉ SUR ARBITRAGE D'AXEL le 2026-10-22, comme le 2026-10-13 : identification de l'éditeur
  // (EI, SIREN, téléphone, LCEN art. 1-1, `e2e7679f`). Chargé par la seule page mentions légales.
  // 3 800 depuis le 2026-10-25, décision d'Axel : les coordonnées du médiateur de la consommation
  // (mentions légales s5 p2, imposées par la Société Médiation Professionnelle, Conso. L616-1)
  // portent le catalogue à 3,6 ko. TEXTE LÉGAL OBLIGATOIRE, pas du code à alléger.
  // 3 500 du 2026-10-22 au 10-25 (≈ 3 330 o), 3 000 avant (2 693 o le 2026-10-01).
  legal: 3_800,
  // ⚖️ RELEVÉS SUR ARBITRAGE D'AXEL le 2026-10-13, pas pour faire passer la CI : l'audit juridique
  // du jour a ajouté de l'information DUE (RGPD art. 13, C. conso L111-1, L224-25-1). Ces deux
  // catalogues ne sont chargés que par leur page légale, jamais sur le chemin critique.
  // Relevé de nouveau sur arbitrage d'Axel le 2026-10-22 : section 7 ter « Prospection » (RGPD art. 14,
  // `899f707f`) et identification du responsable (art. 13.1.a, `e2e7679f`).
  legalPrivacy: 13_000, // ≈ 12 760 o sur 2 chunks le 2026-10-22 ; 12 200 du 2026-10-13 au 10-22, 9 900 avant
  // 14 000 depuis le 2026-11-02, décision d'Axel : les CGV de vente réécrites le 2026-11-01
  // (`d765d9c5`, art. 5, 5 bis, 5 ter, 9, 10, 11 : rétractation L221-18 à L221-28, résiliation,
  // garantie de conformité L224-25-12) portent le catalogue à 13,4 ko sur 2 chunks. TEXTE LÉGAL
  // OBLIGATOIRE, pas du code à alléger ; chargé par la seule page CGU.
  // 11 000 du 2026-10-25 au 11-02 (article 12 bis, médiation, Conso. L616-1), 10 300 du
  // 2026-10-13 au 10-25, 9 700 avant.
  legalTerms: 14_000,
  OKRPage: 15_000, // 14 192 o
  'vendor-router': 14_500, // 13 729 o
  TeamTaskModal: 12_000, // 11 437 o (2026-10-01 : commentaires et arbre de catégories chargés à la demande)
  EnterpriseTrack: 13_500, // 12 790 o
  'vendor-ogl': 13_500, // 12 643 o
  types: 13_000, // 12 304 o
  StatisticsPage: 10_800, // 10 181 o le 2026-10-22 (12 977 avant) : modale Premium et heatmap chargées à part ; 13 000 jusque-là
};

/**
 * Chunks vendor autorisés à dépasser `BUDGETS.page`, avec la raison.
 *
 * ⚠️ « Exempt » NE VEUT PLUS DIRE « sans borne » depuis C-85. Chacun de ces
 * six a désormais son plafond dans `PLAFONDS_PAR_CHUNK`, et une exemption
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
  'vendor-pdf': 'jsPDF, import() au clic sur « Exporter en PDF » du rapport d activité, jamais au chargement',
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

// 🔴 2026-10-15 · L'ENTRÉE D'`index.html` EST UN AMORÇAGE (`src/boot.ts`) : elle
// ne fait qu'un `import()` de l'application, après la première peinture du
// prérendu (LCP mobile). Lu sur le seul HTML, le chemin critique serait tombé à
// ~1 ko et la garde aurait répondu sans mesurer. Ce que l'amorçage charge
// d'office se lit dans SON code : la cible de l'`import("./x.js")` et la liste
// de préchargement que Vite y écrit (`__vite__mapDeps`, `"assets/x.js"`). Tout
// cela est chargé par tout visiteur, donc compté dans le chemin critique, et le
// chunk de l'application reprend le budget `entry` qu'il portait avant.
const entrySource = entry ? readFileSync(join(ASSETS, entry.name), 'latin1') : '';
const appMatch = /\bimport\(\s*["']\.\/([A-Za-z0-9_.-]+\.js)["']\s*\)/.exec(entrySource);
const app = appMatch ? measured.find((m) => m.name === appMatch[1]) ?? null : null;
const amorcees = [...entrySource.matchAll(/["']assets\/([A-Za-z0-9_.-]+\.js)["']/g)].map((m) => m[1]);
if (appMatch && !app) {
  errors.push(`L'amorçage importe \`${appMatch[1]}\`, introuvable dans dist/assets : le chemin critique ne mesure pas l'application.`);
}

const criticalNames = new Set([
  ...(entry ? [entry.name] : []),
  ...(app ? [app.name] : []),
  ...preloaded,
  ...amorcees,
]);
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

// Le budget `entry` juge le chunk de l'APPLICATION : celui qu'`index.html`
// exécute directement, ou celui que l'amorçage importe (cf. plus haut).
const entreeJugee = app ?? entry;
if (entreeJugee) {
  if (app && entry) report.push(`amorçage  ${KB(entry.gzip).padStart(9)}  (${entry.base}, compté dans le chemin critique)`);
  report.push(`entrée    ${KB(entreeJugee.gzip).padStart(9)}  (plafond ${KB(BUDGETS.entry)})`);
  if (entreeJugee.gzip > BUDGETS.entry) {
    errors.push(
      `Chunk d'entrée : ${KB(entreeJugee.gzip)} > ${KB(BUDGETS.entry)}.\n` +
        `  Vérifier d'abord \`critique\` ci-dessus : si le total a baissé, c'est\n` +
        `  que du code préchargé à côté a été absorbé, et c'est une bonne nouvelle.`
    );
  }
}

// ── C-85 · jugement PAR NOM DE BASE, somme des fichiers, entrée exclue ──
const parBase = new Map();
for (const m of measured) {
  if (entry && m.name === entry.name) continue; // budget propre : `BUDGETS.entry`
  if (app && m.name === app.name) continue; // idem, derrière l'amorçage
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
