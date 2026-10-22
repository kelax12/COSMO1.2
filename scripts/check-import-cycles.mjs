// ═══════════════════════════════════════════════════════════════════
// C-103 — aucune garde de dépendances CIRCULAIRES, et `wc -l` comme seul
// proxy de complexité
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Un cycle d'imports entre modules ne casse ni le build ni un
// test : Rollup le résout, Vite aussi, et le symptôme n'apparaît qu'à
// l'exécution, sous la forme d'un `undefined` au moment où un module lit un
// export d'un module qui ne s'est pas encore évalué. C'est le bug qu'on ne
// reproduit pas, parce qu'il dépend de l'ORDRE d'évaluation, donc du
// découpage en chunks, donc du build.
//
// Le second volet de l'item, la mesure de COUPLAGE, est traité plus bas : il
// est RAPPORTÉ, pas bloquant, et la raison de cet arbitrage est écrite.
//
// ── POURQUOI PAS `madge` NI `import/no-cycle` ───────────────────────
//
// `eslint-plugin-import` et `madge` font ce travail. Les deux ajoutent une
// dépendance et réécrivent `package-lock.json`, sur un dépôt qui a déjà
// tranché ce compromis en écrivant sa propre règle ESLint plutôt que
// d'installer `eslint-plugin-eslint-comments` (cf. `eslint.config.js`,
// `cosmo/exhaustive-deps-justified`). Le détecteur ci-dessous fait cent
// lignes et n'a besoin de rien.
//
// ⚠️ CE QU'IL NE VOIT PAS, et c'est la limite honnête d'un détecteur
// statique de cette taille :
//   · les `import()` DYNAMIQUES ne comptent pas comme arêtes — et c'est
//     juste : un import différé ne crée pas de cycle d'évaluation, c'est
//     même la façon de le casser (cf. la façade `@/lib/toast`) ;
//   · les imports de TYPE PUR (`import type`) ne comptent pas : ils sont
//     effacés à la compilation, donc gratuits à l'exécution ;
//   · les chemins qu'aucune règle de résolution simple ne rend (alias exotique,
//     extension inhabituelle) sont IGNORÉS — et leur nombre est IMPRIMÉ. Un
//     résolveur qui échouerait sur la moitié du dépôt rendrait « 0 cycle » en
//     n'ayant construit aucun graphe : le chiffre des non-résolus est ce qui
//     empêche de lire ce zéro-là comme une bonne nouvelle.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';

const RACINE = process.cwd();
const SRC = join(RACINE, 'src');

/** Extensions tentées dans l'ordre, pour un chemin sans extension. */
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];

const IGNORES = new Set(['node_modules', '__test__']);

/** Tous les modules de `src/`, hors tests. */
export function listerModules(racine = SRC) {
  const out = [];
  const marcher = (rep) => {
    for (const entree of readdirSync(rep)) {
      if (IGNORES.has(entree)) continue;
      const chemin = join(rep, entree);
      if (statSync(chemin).isDirectory()) marcher(chemin);
      else if (
        EXTENSIONS.some((e) => entree.endsWith(e))
        && !/\.(test|spec)\.[a-z]+$/.test(entree)
        && !entree.endsWith('.d.ts')
      ) {
        out.push(chemin);
      }
    }
  };
  marcher(racine);
  return out.sort();
}

/**
 * Les spécificateurs importés STATIQUEMENT par un fichier.
 *
 * ⚠️ `import type { X } from` est écarté : effacé à la compilation, il ne
 * crée aucune dépendance d'exécution, donc aucun cycle d'évaluation. Le
 * compter transformerait la garde en interdiction de se référencer entre
 * types, ce qui est parfaitement légitime.
 */
export function importsStatiques(source) {
  const sansCommentaires = source
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(String.fromCharCode(10))
    .map((l) => {
      const at = l.indexOf('//');
      return at === -1 ? l : l.slice(0, at);
    })
    .join(String.fromCharCode(10));

  const out = [];
  const re = /(?:^|\n)\s*(import|export)(\s[^;]*?)?\sfrom\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(sansCommentaires)) !== null) {
    const clause = m[2] ?? '';
    if (/^\s+type\s/.test(clause)) continue; // `import type … from`
    out.push(m[3]);
  }
  // `import 'module'` sans clause : effet de bord, donc arête réelle.
  const nus = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  while ((m = nus.exec(sansCommentaires)) !== null) out.push(m[1]);
  return out;
}

/** Résout un spécificateur en chemin absolu, ou `null` si hors du graphe. */
export function resoudre(specificateur, depuis, racine = RACINE) {
  let base;
  if (specificateur.startsWith('@/')) base = join(racine, 'src', specificateur.slice(2));
  else if (specificateur.startsWith('.')) base = resolve(dirname(depuis), specificateur);
  else return null; // paquet npm : hors du graphe interne

  const candidats = [
    base,
    ...EXTENSIONS.map((e) => base + e),
    ...EXTENSIONS.map((e) => join(base, `index${e}`)),
  ];
  for (const c of candidats) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/** Construit le graphe : chemin absolu → [chemins absolus]. */
export function construireGraphe(racine = RACINE) {
  const modules = listerModules(join(racine, 'src'));
  const graphe = new Map();
  let aretes = 0;
  let nonResolus = 0;
  for (const fichier of modules) {
    const cibles = [];
    for (const spec of importsStatiques(readFileSync(fichier, 'utf8'))) {
      if (!spec.startsWith('@/') && !spec.startsWith('.')) continue;
      const cible = resoudre(spec, fichier, racine);
      if (cible) {
        cibles.push(cible);
        aretes += 1;
      } else {
        nonResolus += 1;
      }
    }
    graphe.set(fichier, cibles);
  }
  return { graphe, aretes, nonResolus, modules };
}

/**
 * Tous les cycles élémentaires du graphe (parcours en profondeur avec pile).
 *
 * Rend une liste de chemins, chacun fermé sur lui-même.
 */
export function trouverCycles(graphe) {
  const etat = new Map(); // 0 = vierge, 1 = en cours, 2 = fini
  const pile = [];
  const cycles = [];
  const vus = new Set();

  const visiter = (n) => {
    etat.set(n, 1);
    pile.push(n);
    for (const voisin of graphe.get(n) ?? []) {
      if (!graphe.has(voisin)) continue;
      const e = etat.get(voisin) ?? 0;
      if (e === 0) visiter(voisin);
      else if (e === 1) {
        const debut = pile.indexOf(voisin);
        const cycle = pile.slice(debut);
        // Une même boucle se découvre par chacun de ses nœuds : on la
        // normalise pour ne la rapporter qu'une fois.
        const cle = [...cycle].sort().join('|');
        if (!vus.has(cle)) {
          vus.add(cle);
          cycles.push([...cycle, voisin]);
        }
      }
    }
    pile.pop();
    etat.set(n, 2);
  };

  for (const n of graphe.keys()) if ((etat.get(n) ?? 0) === 0) visiter(n);
  return cycles;
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  if (!existsSync(SRC)) {
    console.error('src/ introuvable.');
    process.exit(1);
  }

  const { graphe, aretes, nonResolus, modules } = construireGraphe();
  const rel = (p) => relative(RACINE, p).split(sep).join('/');

  console.log('Graphe d imports de `src/`');
  console.log(`  modules   : ${modules.length}`);
  console.log(`  arêtes    : ${aretes}`);
  console.log(`  non résolus : ${nonResolus}`);

  // 🔴 Le contrôle anti-« garde qui répond sans mesurer ». Un résolveur cassé
  // rendrait un graphe vide, donc « 0 cycle », donc un vert qui ne dit rien.
  const erreurs = [];
  if (modules.length < 100) {
    erreurs.push(`Seulement ${modules.length} modules trouvés : le parcours de src/ est cassé.`);
  }
  if (aretes < 200) {
    erreurs.push(`Seulement ${aretes} arêtes résolues : le résolveur est cassé, le graphe ne décrit rien.`);
  }
  if (nonResolus > aretes * 0.05) {
    erreurs.push(
      `${nonResolus} import(s) interne(s) non résolu(s) sur ${aretes + nonResolus} : au-delà de 5 %, `
        + 'le graphe a des trous et un « 0 cycle » ne vaut rien.',
    );
  }

  // ── Les cycles ───────────────────────────────────────────────────
  const cycles = trouverCycles(graphe);
  if (cycles.length > 0) {
    erreurs.push(
      `${cycles.length} cycle(s) d'imports :\n`
        + cycles
          .map((c) => `      ${c.map(rel).join('\n        → ')}`)
          .join('\n\n')
        + "\n    Un cycle ne casse ni le build ni un test : il rend un `undefined` à\n"
        + "    l'exécution, au moment où un module lit l'export d'un module pas encore\n"
        + '    évalué. Le casser par un `import()` différé, ou par un module tiers qui\n'
        + '    porte ce que les deux partagent.',
    );
  }

  // ── Le COUPLAGE, rapporté et non bloquant ────────────────────────
  //
  // 🔴 L'arbitrage, écrit plutôt que subi : l'énoncé de C-103 demande une
  // mesure de couplage ET dit qu'elle est « un arbitrage coût/valeur à rendre
  // avant d'être outillé ». Poser aujourd'hui un plafond de fan-in ou de
  // fan-out serait inventer un seuil sans savoir ce qu'il coûte à tenir — la
  // faute que `lighthouserc.json` a payée avec ses « seuils provisoires ».
  // Le chiffre est donc IMPRIMÉ, à côté du proxy `wc -l` qu'il complète, et
  // le plafond se posera quand quelqu'un l'aura lu deux fois.
  const fanOut = [...graphe].map(([f, c]) => [f, c.length]).sort((a, b) => b[1] - a[1]);
  const fanIn = new Map();
  for (const cibles of graphe.values()) {
    for (const c of cibles) fanIn.set(c, (fanIn.get(c) ?? 0) + 1);
  }
  const entrants = [...fanIn].sort((a, b) => b[1] - a[1]);

  console.log('\nCouplage (RAPPORTÉ, non bloquant — cf. l en-tête)');
  console.log('  fan-out le plus élevé (ce module importe le plus) :');
  for (const [f, n] of fanOut.slice(0, 5)) console.log(`    ${String(n).padStart(3)}  ${rel(f)}`);
  console.log('  fan-in le plus élevé (ce module est le plus importé) :');
  for (const [f, n] of entrants.slice(0, 5)) console.log(`    ${String(n).padStart(3)}  ${rel(f)}`);

  if (erreurs.length > 0) {
    console.error('\n✖ Graphe d imports :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Aucun cycle d imports.');
}
