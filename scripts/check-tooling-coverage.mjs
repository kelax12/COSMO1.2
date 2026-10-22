// ═══════════════════════════════════════════════════════════════════
// C-82 — la couverture de `scripts/`, et la garde qui l'empêche de mentir
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER N'EST PAS UNE SIMPLE LIGNE `thresholds` DANS
// `vitest.tooling.config.ts`.
//
// Mesuré le 2026-09-20 en posant la config : le provider v8 a écrit
//
//     Failed to parse .../scripts/apply-migrations.mjs. Excluding it from coverage.
//     Failed to parse .../scripts/check-rls-advisors.mjs. Excluding it from coverage.
//     Failed to parse .../scripts/i18n-check.mjs. Excluding it from coverage.
//
// …puis a rendu un rapport et un pourcentage, sans échouer. Trois fichiers,
// dont DEUX GARDES DE CI, étaient sortis du périmètre en silence, et le
// chiffre affiché décrivait un périmètre dont personne n'avait annoncé la
// réduction. C'est mot pour mot la classe de défaut de `scripts/CLAUDE.md` :
// « ne jamais laisser une garde sauter silencieusement une moitié de son
// travail ».
//
// LA CAUSE, ISOLÉE PAR EXPÉRIENCE ET NON PAR LECTURE : le SHEBANG. Retirer la
// ligne `#!/usr/bin/env node` de ces trois fichiers fait passer le nombre de
// « Failed to parse » de 3 à 0, toutes choses égales par ailleurs. Node retire
// le shebang ; la chaîne Rollup qui ré-analyse le fichier pour remapper la
// couverture, elle, ne le retire pas.
//
// ⚠️ DOUZE AUTRES SCRIPTS portaient un shebang sans échouer, ce qui a d'abord
// fait croire la théorie fausse : ils sont IMPORTÉS par un témoin, donc ils
// passent par le pipeline d'import de Vite (qui retire le shebang) et non par
// le chemin « fichier non couvert ». Le piège était donc latent sur tous, et
// se serait déclenché le jour où l'un d'eux perdrait son témoin.
//
// ✅ CORRIGÉ À LA SOURCE le 2026-09-20 : les quinze shebangs de `scripts/**`
// ont été retirés. Ils étaient DÉCORATIFS — vérifié, chaque script est lancé
// par `node scripts/x.mjs` depuis `package.json` ou un workflow, jamais en
// exécutable. La règle ci-dessous interdit leur retour.
//
// CE QUE CETTE GARDE FAIT, dans cet ordre :
//   1. elle recalcule la liste des fichiers ATTENDUS dans le rapport ;
//   2. elle échoue si l'un d'eux en est absent — un fichier ne peut plus
//      sortir du périmètre sans que quelqu'un le décide ;
//   3. elle échoue si un fichier du périmètre porte un shebang, sans aucune
//      dispense possible : le défaut du 2026-09-20 ne peut donc pas se
//      reproduire par un fichier NEUF ;
//   4. elle applique les seuils, qui sont un CLIQUET.
//
// ❌ NE JAMAIS BAISSER UN SEUIL POUR FAIRE PASSER LA CI. Un dépassement dit
//    qu'un script manque de tests, pas que la borne est trop haute.
// ❌ NE JAMAIS REMETTRE UN SHEBANG pour faire taire cette garde, ni ajouter
//    le fichier à `coverage.exclude` : la bonne correction est de retirer le
//    shebang, qui ne sert à rien tant que le script est lancé par `node`.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RACINE = process.cwd();
const RAPPORT = join(RACINE, 'coverage-tooling', 'coverage-summary.json');


/**
 * Les seuils, posés AU RÉEL MESURÉ le 2026-09-20, ~1 point en dessous — la
 * convention de `vitest.config.ts`. Ils sont un CLIQUET : ils ne peuvent que
 * monter.
 *
 * Mesure de la pose, périmètre COMPLET (29 fichiers sur 29) :
 *   statements 23,12 · branches 25,37 · functions 35,35 · lines 23,33
 *
 * ⚠️ Ces chiffres étaient PLUS BAS que ceux du premier essai
 * (27,60 / 29,46 / 40,07 / 27,75), et ce n'était pas une régression : le
 * premier essai mesurait 26 fichiers sur 29, les trois plus gros non couverts
 * étant précisément ceux qui échouaient à l'analyse. Un périmètre qui
 * rétrécit fait MONTER un pourcentage — c'est ce qui rend ce mode de
 * défaillance si confortable, et c'est pour ça que le contrôle de complétude
 * passe AVANT les seuils.
 *
 * ── REMONTÉE DU 2026-09-20 au soir ──────────────────────────────────
 *
 * Le périmètre est passé de 29 à 47 fichiers (les treize gardes du § 12
 * d'`a-faire-code.md`), et la couverture a d'abord CHUTÉ à 20,30 % — les
 * nouveaux scripts arrivant sans témoin.
 *
 * 🔴 Le seuil n'a PAS été baissé. `scripts/gardes-posture.guard.test.mjs` a
 * été écrit : 39 cas sur les fonctions PURES des sept gardes qui
 * interrogent la production (SQL construit, plan extrait, référence
 * comparée, `fetch` injecté). Mesure après :
 *   statements 26,73 · branches 27,18 · functions 42,47 · lines 26,70
 * soit PLUS HAUT qu'avant l'élargissement, sur un périmètre une fois et
 * demie plus grand.
 *
 * ⚠️ CE QUE CE POURCENTAGE SOUS-ESTIME, et il faut le savoir avant de le
 * lire : plusieurs scripts affichent 0 % alors qu'ils ONT un témoin
 * (`i18n-scan`, `i18n-identical`, `check-docs-budget`, `check-bundle-budget`).
 * Leur témoin les lance en SOUS-PROCESSUS — la seule façon de tester un
 * script qui lit `dist/` et sort en `process.exit` —, et le provider v8
 * n'instrumente pas un sous-processus. Le chiffre mesure donc ce qui est
 * testé EN PROCESSUS, pas ce qui est testé.
 * ❌ Ne pas « corriger » ça en réécrivant ces témoins : ils mesurent le
 *    comportement réel du script, ce qui vaut mieux qu'un pourcentage.
 */
const SEUILS = {
  statements: 25,
  branches: 26,
  functions: 41,
  lines: 25,
};

/** Les motifs du `coverage.include` / `coverage.exclude` de la config jumelle. */
const INCLUS = [
  { dossier: 'scripts', ext: '.mjs' },
  { dossier: 'eslint-rules', ext: '.js' },
];

/**
 * Doit rester le miroir exact du `coverage.exclude` de
 * `vitest.tooling.config.ts`. Deux listes valent mieux qu'une divergence
 * silencieuse : le témoin `check-tooling-coverage.guard.test.mjs` vérifie
 * qu'elles décrivent le même périmètre.
 */
const EXCLUS = [
  /\.(test|spec)\.mjs$/,
  /^scripts\/_c5\d-.*probe\.mjs$/,
  /^scripts\/visual-audit.*\.mjs$/,
  /^scripts\/capture-.*\.mjs$/,
  /^scripts\/profile-landing\.mjs$/,
  /^scripts\/landing-.*-probe\.mjs$/,
  /^scripts\/analyze-entry\.mjs$/,
  /^scripts\/diagnose-rls-state\.mjs$/,
  /^scripts\/optimize-images\.mjs$/,
];

/** Liste récursive des fichiers d'un dossier, en chemins POSIX relatifs. */
export function lister(racine, dossier, ext) {
  const base = join(racine, dossier);
  if (!existsSync(base)) return [];
  const out = [];
  const marcher = (rep) => {
    for (const entree of readdirSync(rep)) {
      if (entree === 'node_modules') continue;
      const chemin = join(rep, entree);
      if (statSync(chemin).isDirectory()) marcher(chemin);
      else if (chemin.endsWith(ext)) out.push(relative(racine, chemin).split(sep).join('/'));
    }
  };
  marcher(base);
  return out.sort();
}

/** Le fichier commence-t-il par un shebang ? */
export function porteUnShebang(contenu) {
  return contenu.startsWith('#!');
}

/** Les fichiers attendus dans le rapport de couverture. */
export function fichiersAttendus(racine = RACINE) {
  return INCLUS.flatMap(({ dossier, ext }) => lister(racine, dossier, ext)).filter(
    (f) => !EXCLUS.some((re) => re.test(f)),
  );
}

// ── Exécution ──────────────────────────────────────────────────────
// `import.meta.url` : ce module est aussi IMPORTÉ par son témoin, qui ne doit
// pas déclencher le contrôle ni faire sortir le processus.
const estLanceDirectement =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const erreurs = [];

  if (!existsSync(RAPPORT)) {
    console.error(
      `✖ ${relative(RACINE, RAPPORT)} absent. Lancer d'abord :\n`
        + '    npx vitest run --config vitest.tooling.config.ts --coverage',
    );
    process.exit(1);
  }

  const rapport = JSON.parse(readFileSync(RAPPORT, 'utf8'));
  const dansLeRapport = new Set(
    Object.keys(rapport)
      .filter((k) => k !== 'total')
      .map((k) => relative(RACINE, k).split(sep).join('/')),
  );

  const attendus = fichiersAttendus();

  // ── 1. Un shebang, où que ce soit dans le périmètre ─────────────
  for (const f of attendus) {
    if (!porteUnShebang(readFileSync(join(RACINE, f), 'utf8'))) continue;
    erreurs.push(
      `${f} porte un shebang : le provider v8 ne saura pas l'analyser et l'exclura`
        + " EN SILENCE du rapport (mesuré le 2026-09-20). Le retirer — il est"
        + ' décoratif, ce script est lancé par `node`.',
    );
  }

  // ── 2. Un fichier ATTENDU et ABSENT du rapport ──────────────────
  // 🔴 Le contrôle SANS THÉORIE, celui qui ne dépend d'aucune hypothèse sur la
  // cause. Le shebang ci-dessus est la cause CONNUE ; celle-ci attrape les
  // suivantes, quelles qu'elles soient.
  const manquants = attendus.filter((f) => !dansLeRapport.has(f));
  if (manquants.length > 0) {
    erreurs.push(
      `${manquants.length} fichier(s) du périmètre absent(s) du rapport de couverture — `
        + 'ils en sont sortis SANS que personne le décide : '
        + manquants.join(', '),
    );
  }

  // ── 3. Les seuils ───────────────────────────────────────────────
  const total = rapport.total;
  const mesure = {};
  for (const cle of Object.keys(SEUILS)) {
    const pct = total[cle]?.pct ?? 0;
    mesure[cle] = pct;
    if (pct < SEUILS[cle]) {
      erreurs.push(
        `${cle} : ${pct.toFixed(2)} % < seuil ${SEUILS[cle]} %. `
          + '❌ Ne pas baisser le seuil : ajouter des tests.',
      );
    }
  }

  console.log('Couverture de l outillage (scripts/ + eslint-rules/)');
  console.log(
    `  mesuré   : statements ${mesure.statements?.toFixed(2)} · branches ${mesure.branches?.toFixed(2)}`
      + ` · functions ${mesure.functions?.toFixed(2)} · lines ${mesure.lines?.toFixed(2)}`,
  );
  console.log(
    `  seuils   : statements ${SEUILS.statements} · branches ${SEUILS.branches}`
      + ` · functions ${SEUILS.functions} · lines ${SEUILS.lines}`,
  );
  console.log(`  fichiers : ${attendus.length} attendus · ${dansLeRapport.size} dans le rapport`);

  if (erreurs.length > 0) {
    console.error('\n✖ Couverture de l outillage :');
    for (const e of erreurs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('\n✓ Couverture de l outillage : périmètre complet, seuils tenus.');
}
