// Quels namespaces i18n sont atteignables depuis le SHELL de l'application ?
//
// Le shell = tout ce qui est chargé sans franchir une frontière `lazy(() =>
// import(...))` depuis `src/App.tsx`. Ces fichiers rendent avant qu'aucune
// route n'ait été résolue : leurs namespaces doivent être dans le chunk
// d'entrée, sinon `t()` renvoie la clé brute à l'écran.
//
// Tout le reste peut être chargé à la demande, en parallèle du chunk de page.
//
// Usage : node scripts/i18n-shell-namespaces.mjs [--json]
//
// Ce script est la MESURE. La règle qui en découle est verrouillée par
// `src/i18n/lazy-namespaces.guard.test.ts`.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const EXTS = ['.ts', '.tsx', '.mjs'];

/** `@/x` et `./x` → chemin absolu réel, ou null si non résoluble. */
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // paquet npm

  for (const ext of ['', ...EXTS]) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  for (const ext of EXTS) {
    const candidate = join(base, 'index' + ext);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Imports d'un fichier, séparés en STATIQUES et DYNAMIQUES.
 *
 * Un `import()` dynamique est une frontière de chunk : ce qui est derrière ne
 * fait pas partie du shell. C'est exactement le critère qui nous intéresse, et
 * il est syntaxique, donc vérifiable sans bundler.
 */
// Mémo : `pageNamespaces()` refait un parcours complet par page (28 entrées),
// et chaque parcours relit les mêmes ~150 fichiers. Sans ce cache le test de
// garde dépasse le timeout de 5 s de Vitest.
const importsCache = new Map();

function readImports(file) {
  const cached = importsCache.get(file);
  if (cached) return cached;
  const parsed = parseImports(file);
  importsCache.set(file, parsed);
  return parsed;
}

function parseImports(file) {
  const code = readFileSync(file, 'utf8');
  const stat = [];
  const dyn = [];

  const staticRe = /^\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/gm;
  for (const m of code.matchAll(staticRe)) stat.push(m[1]);

  const bareRe = /^\s*import\s+['"]([^'"]+)['"]/gm;
  for (const m of code.matchAll(bareRe)) stat.push(m[1]);

  const dynRe = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of code.matchAll(dynRe)) dyn.push(m[1]);

  return { stat, dyn };
}

/**
 * Namespaces utilisés par un fichier.
 *
 * `renderOnly: true` ne compte que `useT('x')`, c'est-à-dire les appels qui ont
 * lieu PENDANT UN RENDU. La distinction n'est pas cosmétique, c'est elle qui
 * décide de ce qui doit rester dans le chunk d'entrée :
 *
 *   • `useT` est un hook : il s'exécute au premier rendu du composant. Si son
 *     catalogue n'est pas là, l'écran affiche la clé brute.
 *   • `translator('x')` / `getTranslator('x')` ne s'exécutent QUE dans un
 *     callback, un `onSuccess` de mutation ou un `onError`. À ce moment-là
 *     l'utilisateur a forcément traversé une route, et la route a attendu ses
 *     catalogues. Ces appels doivent donc être COUVERTS par une déclaration de
 *     route, mais ils ne forcent pas l'eager.
 *
 * Sans cette nuance, `src/modules/organizations/hooks.ts`, atteignable depuis
 * le shell via le barrel `@/modules/organizations` que `App.tsx` importe pour
 * `ActiveOrgProvider`, imposerait de garder `org` (50 ko, le plus gros
 * catalogue du dépôt) dans le chemin critique pour trois messages de toast.
 */
const nsCache = new Map();

export function namespacesOf(file, { renderOnly = false } = {}) {
  const cacheKey = `${renderOnly ? 'r' : 'a'}:${file}`;
  const hit = nsCache.get(cacheKey);
  if (hit) return hit;
  const found = computeNamespaces(file, renderOnly);
  nsCache.set(cacheKey, found);
  return found;
}

function computeNamespaces(file, renderOnly) {
  const code = readFileSync(file, 'utf8');
  const found = new Set();
  const re = renderOnly
    ? /\buseT\(\s*['"]([A-Za-z]+)['"]/g
    : /\b(?:useT|translator|getTranslator|resolveMessage)\(\s*['"]([A-Za-z]+)['"]/g;
  for (const m of code.matchAll(re)) found.add(m[1]);
  return found;
}

/**
 * Fichiers atteignables depuis `entry`.
 *
 * `followDynamic: false` (défaut) s'arrête aux frontières `import()`, c'est la
 * définition du SHELL. `followDynamic: true` traverse tout : c'est ce qu'il
 * faut pour une page, parce qu'un composant chargé paresseusement DANS la page
 * (`QuickAddBar`, `BugReportModal`, `EnterpriseTrack`…) rend quand même sous le
 * même toit, et affichera des clés brutes si son catalogue n'a pas été demandé.
 */
export function collectShellFiles(entry, { followDynamic = false, stopAt = new Set() } = {}) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const { stat, dyn } = readImports(file);
    const specs = followDynamic ? [...stat, ...dyn] : stat;
    for (const spec of specs) {
      const target = resolveImport(spec, file);
      if (!target || !target.startsWith(SRC) || seen.has(target)) continue;
      // `stopAt` = les modules qui portent DÉJÀ leur propre gate de namespaces
      // (les pages déclarées dans `App.tsx`). Sans cette coupure,
      // `src/lib/route-prefetch.ts`, qui `import()` chaque page au survol d'un
      // lien pour réchauffer le cache, ferait croire que `Layout` a besoin des
      // catalogues de TOUTES les pages. Précharger un module n'est pas le
      // rendre.
      if (target !== entry && stopAt.has(target)) continue;
      queue.push(target);
    }
  }
  return seen;
}

export function shellNamespaces() {
  const entry = join(SRC, 'App.tsx');
  // `main.tsx` monte l'app : ce qu'il importe statiquement est aussi du shell.
  const files = new Set([
    ...collectShellFiles(entry),
    ...collectShellFiles(join(SRC, 'main.tsx')),
  ]);

  const byNamespace = new Map();
  for (const file of files) {
    for (const ns of namespacesOf(file, { renderOnly: true })) {
      if (!byNamespace.has(ns)) byNamespace.set(ns, []);
      byNamespace.get(ns).push(file.slice(ROOT.length + 1).replace(/\\/g, '/'));
    }
  }
  return { files, byNamespace };
}

/**
 * Namespaces requis par une page lazy, sous-arbre COMPRIS.
 *
 * C'est la question qui décide de ce qu'une route doit déclarer : un composant
 * partagé profondément enfoui compte autant que la page elle-même, puisqu'il
 * rendra dans le même `<Suspense>`.
 */
export function namespacesForEntry(entryRelative, stopAt = gatedModules()) {
  const entry = join(ROOT, entryRelative);
  const found = new Set();
  for (const file of collectShellFiles(entry, { followDynamic: true, stopAt })) {
    for (const ns of namespacesOf(file)) found.add(ns);
  }
  return found;
}

/** Chemins absolus des modules déjà gatés par `lazyWithRetry` dans `App.tsx`. */
export function gatedModules() {
  const app = readFileSync(join(SRC, 'App.tsx'), 'utf8');
  const out = new Set();
  const re = /lazyWithRetry\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of app.matchAll(re)) {
    const target = resolveImport(m[1], join(SRC, 'App.tsx'));
    if (target) out.add(target);
  }
  return out;
}

/**
 * Toutes les pages lazy déclarées dans `App.tsx`, avec leurs namespaces.
 *
 * Calculé par POINT FIXE sur le graphe complet, et pas par un parcours séparé
 * par page. La version naïve refaisait un DFS de tout `src/` pour chacune des
 * 28 entrées : quelques secondes à vide, bien davantage sous l'instrumentation
 * de couverture, au point de dépasser le timeout du test de garde. Ici le
 * graphe est construit une fois, puis les ensembles de namespaces remontent
 * jusqu'à stabilisation, ce qui traite au passage les cycles d'imports sans
 * aucun cas particulier.
 */
export function pageNamespaces() {
  const entries = [...gatedModules()];

  // 1. Graphe fichier → enfants, en traversant les `import()` mais en
  //    s'arrêtant sur une page déjà gatée (elle porte SES propres namespaces).
  const graph = new Map();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (graph.has(file)) continue;
    const kids = [];
    const { stat, dyn } = readImports(file);
    for (const spec of [...stat, ...dyn]) {
      const target = resolveImport(spec, file);
      if (!target || !target.startsWith(SRC)) continue;
      if (target !== file && entries.includes(target)) continue;
      kids.push(target);
      if (!graph.has(target)) queue.push(target);
    }
    graph.set(file, kids);
  }

  // 2. Point fixe : les namespaces d'un fichier sont les siens plus ceux de ses
  //    enfants. Converge en quelques passes (19 namespaces au maximum).
  const memo = new Map();
  for (const file of graph.keys()) memo.set(file, new Set(namespacesOf(file)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [file, kids] of graph) {
      const set = memo.get(file);
      const before = set.size;
      for (const kid of kids) for (const ns of memo.get(kid) ?? []) set.add(ns);
      if (set.size !== before) changed = true;
    }
  }

  const out = new Map();
  for (const entry of entries) {
    const rel = entry.slice(ROOT.length + 1).replace(/\\/g, '/');
    out.set(rel, [...(memo.get(entry) ?? [])].sort());
  }
  return out;
}

// Détection « module principal » compatible Windows : `pathToFileURL` produit
// `file:///C:/…` là où une interpolation naïve donne `file://C:/…`.
const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const { files, byNamespace } = shellNamespaces();
  const sorted = [...byNamespace.entries()].sort((a, b) => b[1].length - a[1].length);

  const entryFlag = process.argv.indexOf('--entry');

  if (entryFlag !== -1 && process.argv[entryFlag + 1]) {
    // Diagnostic d'UN fichier : « de quels catalogues ce composant a-t-il
    // besoin ? ». Utile quand on déplace un composant d'une page à une autre.
    const target = process.argv[entryFlag + 1];
    console.log(`${target} → ${[...namespacesForEntry(target)].sort().join(' ') || '(aucun)'}`);
  } else if (process.argv.includes('--pages')) {
    for (const [page, ns] of pageNamespaces()) {
      console.log(`${page.padEnd(48)} ${ns.join(' ')}`);
    }
  } else if (process.argv.includes('--json')) {
    console.log(JSON.stringify(Object.fromEntries(sorted), null, 2));
  } else {
    console.log(`Fichiers du shell (sans franchir un import()) : ${files.size}\n`);
    console.log('Namespaces atteignables depuis le shell, donc OBLIGATOIREMENT eager :\n');
    for (const [ns, consumers] of sorted) {
      console.log(`  ${ns.padEnd(12)} ${String(consumers.length).padStart(3)} fichier(s)`);
      for (const c of consumers.slice(0, 4)) console.log(`               ${c}`);
      if (consumers.length > 4) console.log(`               … et ${consumers.length - 4} autre(s)`);
    }
  }
}
