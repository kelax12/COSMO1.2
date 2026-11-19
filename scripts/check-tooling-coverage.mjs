// C-82 · couverture de `scripts/`, et la garde qui l'empêche de mentir. Dans cet ordre :
//   1. recalcule les fichiers ATTENDUS dans le rapport ; 2. échoue si l'un manque (v8 en sort un
//      fichier qu'il n'analyse pas, et le pourcentage MONTE) ; 3. échoue sur un shebang dans le
//      périmètre (cause de ces sorties, sans dispense) ; 4. applique les seuils, un CLIQUET.
// ❌ Baisser un seuil pour faire passer la CI : un script manque de tests. ❌ Remettre un shebang
//    ou ajouter le fichier à `coverage.exclude`. Récit : `docs/archive/outillage-recits-2026-11-19.md`.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RACINE = process.cwd();
const RAPPORT = join(RACINE, 'coverage-tooling', 'coverage-summary.json');

/**
 * Cliquet, posé au réel mesuré ~1 point en dessous ; il ne fait que monter. ⚠️ Un script testé en
 * SOUS-PROCESSUS affiche 0 % (v8 n'instrumente pas un sous-processus) : ne pas réécrire ces témoins.
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
  /^scripts\/capture-.*\.mjs$/,
  /^scripts\/landing-.*-probe\.mjs$/,
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
