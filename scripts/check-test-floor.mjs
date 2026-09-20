// ═══════════════════════════════════════════════════════════════════
// C-83 — un test supprimé avec le code qu'il gardait ne laisse aucune trace
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Aucune garde ne relie un test à sa raison d'être. Supprimer
// une fonctionnalité et son fichier de test dans le même commit fait baisser
// le total, et un total qui baisse ne fait échouer aucun job. Ce dépôt a déjà
// vécu la version voisine de ce défaut : un correctif ÉCRIT et jamais commité
// (C-76, C-78), un fichier de test non suivi par git qui faussait tout
// recomptage (`e2e/CLAUDE.md`).
//
// La couverture ne l'attrape pas : elle mesure un RATIO. Retirer un module et
// son test fait à peu près bouger les deux côtés de la fraction.
//
// CE QUE CETTE GARDE FAIT : un PLANCHER À CLIQUET, sur le modèle exact des
// budgets de bundle et des seuils de couverture du dépôt. Trois nombres :
//
//   · fichiers de test  — celui qui attrape la suppression d'un fichier ;
//   · cas de test       — celui qui attrape le vidage d'un fichier qu'on
//                         garde par politesse ;
//   · témoins (`*.guard.test.*`) — compté À PART, parce que c'est la famille
//     qui garde les autres gardes, et celle dont la disparition est la plus
//     silencieuse.
//
// 🔴 CE QU'ELLE NE PROUVE PAS : qu'un test teste quelque chose. Un plancher
// est un plancher. Elle interdit la disparition, pas la complaisance.
//
// ❌ NE JAMAIS BAISSER UN PLANCHER POUR FAIRE PASSER LA CI. La suppression
//    d'un test est une décision, et elle doit s'écrire ici, avec sa raison et
//    sa date — pas se constater après coup dans un diff de trois cents lignes.
// ✅ Les remonter après un ajout de tests est attendu : `--update` recale les
//    trois nombres sur le mesuré et réécrit le fichier de planchers.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RACINE = process.cwd();
const PLANCHERS = join(RACINE, 'scripts', 'test-floor.json');

/** Les arbres qui portent des tests, et les extensions qui en sont. */
const ARBRES = ['src', 'scripts', 'e2e', 'eslint-rules'];
const EST_UN_TEST = /\.(test|spec)\.(ts|tsx|mjs)$/;
/**
 * Un TÉMOIN, dans les deux conventions de nommage du dépôt.
 *
 * 🔴 `[.-]guard` et pas `\.guard`, et ce n'est pas de la largesse : deux
 * témoins existants portent un TIRET (`src/i18n/en-ca-guard.test.ts`,
 * `src/stripe-org-404-guard.test.ts`). Une expression qui n'accepte que le
 * point les comptait comme des tests ordinaires, donc le plancher des témoins
 * — la famille qui garde les autres gardes — était posé DEUX TROP BAS, et
 * leur suppression ne l'aurait pas fait rougir. Trouvé le 2026-09-20 en
 * recoupant le compte de ce script avec `git ls-files`, jamais par la lecture.
 */
const EST_UN_TEMOIN = /[.-]guard\.(test|spec)\.(ts|tsx|mjs)$/;

/** Dossiers ignorés partout : ils ne portent pas de test du produit. */
const IGNORES = new Set(['node_modules', 'dist', 'coverage', 'coverage-tooling', '.worktrees']);

export function listerTests(racine = RACINE) {
  const out = [];
  const marcher = (rep) => {
    for (const entree of readdirSync(rep)) {
      if (IGNORES.has(entree)) continue;
      const chemin = join(rep, entree);
      if (statSync(chemin).isDirectory()) marcher(chemin);
      else if (EST_UN_TEST.test(entree)) out.push(relative(racine, chemin).split(sep).join('/'));
    }
  };
  for (const arbre of ARBRES) {
    const base = join(racine, arbre);
    if (existsSync(base)) marcher(base);
  }
  return out.sort();
}

/**
 * Le nombre de CAS dans un fichier.
 *
 * ⚠️ Comptage TEXTUEL, et il faut dire ce qu'il vaut. Il compte les
 * `it(`/`test(` en début d'expression, y compris ceux d'une boucle `for`
 * (qui en produiront plusieurs à l'exécution) : le chiffre est donc un
 * minorant du nombre réel de cas joués. C'est sans importance pour un
 * PLANCHER — ce qui compte est qu'il soit stable et qu'il baisse quand on
 * retire des cas.
 *
 * ❌ Ne pas « améliorer » ça en lançant `vitest --list` : il faudrait démarrer
 *    la suite entière pour obtenir un nombre, et cette garde doit rester
 *    instantanée pour tourner avant chaque commit.
 *
 * Les `it.skip` et `test.skip` sont comptés à part : un cas désactivé n'est
 * pas un cas supprimé, mais ce n'est pas non plus un cas qui garde quoi que
 * ce soit. Les masquer ferait d'un `skip` massif une baisse invisible.
 */
export function compterCas(contenu) {
  const sansCommentaires = contenu
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(String.fromCharCode(10))
    .map((l) => {
      const at = l.indexOf('//');
      return at === -1 ? l : l.slice(0, at);
    })
    .join(String.fromCharCode(10));
  const actifs = (sansCommentaires.match(/(^|[\s;{(])(it|test)\s*\(/g) ?? []).length;
  const ignores = (sansCommentaires.match(/(^|[\s;{(])(it|test)\.(skip|todo)\s*\(/g) ?? []).length;
  return { actifs, ignores };
}

export function mesurer(racine = RACINE) {
  const fichiers = listerTests(racine);
  let cas = 0;
  let ignores = 0;
  for (const f of fichiers) {
    const c = compterCas(readFileSync(join(racine, f), 'utf8'));
    cas += c.actifs;
    ignores += c.ignores;
  }
  return {
    fichiers: fichiers.length,
    temoins: fichiers.filter((f) => EST_UN_TEMOIN.test(f)).length,
    cas,
    ignores,
  };
}

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const mesure = mesurer();

  if (process.argv.includes('--update')) {
    const contenu = {
      _comment: [
        'C-83 — planchers à cliquet sur le nombre de tests. Écrits par',
        '`node scripts/check-test-floor.mjs --update`, jamais à la main.',
        '🔴 Ne JAMAIS baisser un de ces nombres pour faire passer la CI : la',
        'suppression d un test est une décision, elle s écrit avec sa raison.',
      ],
      pose_le: new Date().toISOString().slice(0, 10),
      fichiers: mesure.fichiers,
      temoins: mesure.temoins,
      cas: mesure.cas,
    };
    writeFileSync(PLANCHERS, `${JSON.stringify(contenu, null, 2)}\n`, 'utf8');
    console.log(`✓ planchers recalés : ${mesure.fichiers} fichiers · ${mesure.temoins} témoins · ${mesure.cas} cas`);
    process.exit(0);
  }

  if (!existsSync(PLANCHERS)) {
    console.error(
      `✖ ${relative(RACINE, PLANCHERS)} absent. Le poser une première fois :\n`
        + '    node scripts/check-test-floor.mjs --update',
    );
    process.exit(1);
  }

  const planchers = JSON.parse(readFileSync(PLANCHERS, 'utf8'));
  const erreurs = [];

  for (const cle of ['fichiers', 'temoins', 'cas']) {
    if (mesure[cle] < planchers[cle]) {
      erreurs.push(
        `${cle} : ${mesure[cle]} < plancher ${planchers[cle]} (posé le ${planchers.pose_le}).`,
      );
    }
  }

  console.log(`Plancher de tests (posé le ${planchers.pose_le})`);
  console.log(`  fichiers : ${mesure.fichiers} (plancher ${planchers.fichiers})`);
  console.log(`  témoins  : ${mesure.temoins} (plancher ${planchers.temoins})`);
  console.log(`  cas      : ${mesure.cas} (plancher ${planchers.cas})`);
  if (mesure.ignores > 0) {
    // Un `skip` n'est pas une suppression, mais ce n'est pas non plus une
    // garde : le chiffre est imprimé pour qu'il ne s'installe pas en silence.
    console.log(`  ⚠️ ${mesure.ignores} cas en \`skip\`/\`todo\` — désactivés, donc ne gardant rien.`);
  }

  if (erreurs.length > 0) {
    console.error('\n✖ Le nombre de tests a BAISSÉ :');
    for (const e of erreurs) console.error(`  - ${e}`);
    console.error(
      '\n  Un test supprimé avec le code qu il gardait ne laisse aucune trace :'
        + "\n  c'est exactement ce que ce plancher existe pour rendre visible."
        + '\n  ❌ Ne pas baisser le plancher pour faire passer la CI.'
        + '\n  ✅ Si la suppression est VOULUE, écrire pourquoi dans le commit,'
        + '\n     puis recaler : node scripts/check-test-floor.mjs --update',
    );
    process.exit(1);
  }
  console.log('\n✓ Aucun recul.');
}
