#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// i18n-identical.mjs — cliquet sur les valeurs `en` restées en français
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Le moteur retombe clé par clé sur `fr` (catalogue de référence) : une valeur
// `en` jamais traduite ne s'affiche donc JAMAIS comme une clé brute. Elle
// s'affiche en français, dans une interface anglaise, et rien ne le signale.
// `i18n:check` ne voit que les CLÉS, jamais leur contenu : c'est exactement
// l'angle mort qui a laissé l'item C-21 ouvrir du 2026-08-14 au 2026-09-08 sur
// un chiffre que personne n'avait remesuré.
//
// Ce script compte les couples (fr, en) dont la valeur est IDENTIQUE et qui ne
// sont pas déclarés légitimes dans `i18n-identical-allowlist.json`.
//
// ⚠️ Une identité n'est pas forcément un défaut : « Description », « OKR »,
// « {{count}} min » ou « Cosmo » sont identiques et le resteront. La liste des
// légitimes existe pour que le prochain audit ne refasse pas le tri à la main.
//
// L'allowlist est VÉRIFIÉE, pas crue :
//   · une entrée dont la clé a disparu échoue (reliquat) ;
//   · une entrée dont les valeurs ne sont plus identiques échoue (elle a été
//     traduite : la déclaration n'a plus d'objet) ;
//   · une entrée dont la valeur `fr` a changé depuis sa déclaration échoue.
//     C'est le point le plus important : sans la valeur épinglée, renommer un
//     libellé ferait hériter en silence de la dispense accordée à l'ancien.
//
// Usage :  node scripts/i18n-identical.mjs [--list]
// Sortie : 1 si le cliquet est dépassé OU si l'allowlist est périmée, 0 sinon.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = 'src/locales';
const REFERENCE = 'fr';
const TARGET = 'en';
const ALLOWLIST = 'scripts/i18n-identical-allowlist.json';

// Cliquet : voir l'en-tête de ce fichier avant de toucher à ce nombre.
// ❌ Ne JAMAIS le relever pour faire passer la CI. Une identité nouvelle est
//    soit une traduction manquante (on traduit), soit une légitime (on la
//    DÉCLARE, avec sa catégorie et sa valeur).
const MAX_UNDECLARED = 0;

/** Aplatit un catalogue JSON en `Map<'a.b.c', 'valeur'>`. */
function flatten(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else if (typeof value === 'string') {
      out.set(path, value);
    }
  }
  return out;
}

const read = (locale, file) =>
  flatten(JSON.parse(readFileSync(join(LOCALES_DIR, locale, file), 'utf8')));

// ──────────────────────────────────────────────────────────────────
// 1. Allowlist
// ──────────────────────────────────────────────────────────────────
let allow = { categories: {}, entrees: {} };
if (existsSync(ALLOWLIST)) {
  allow = JSON.parse(readFileSync(ALLOWLIST, 'utf8'));
}
const categories = allow.categories ?? {};
const declared = new Map(Object.entries(allow.entrees ?? {}));

// ──────────────────────────────────────────────────────────────────
// 2. Mesure
// ──────────────────────────────────────────────────────────────────
const files = readdirSync(join(LOCALES_DIR, REFERENCE)).filter((f) => f.endsWith('.json'));

const identical = new Map();  // 'ns.cle' -> valeur
const perNamespace = [];
let comparable = 0;

for (const file of files) {
  const ns = file.replace(/\.json$/, '');
  if (!existsSync(join(LOCALES_DIR, TARGET, file))) continue;
  const fr = read(REFERENCE, file);
  const en = read(TARGET, file);
  let pairs = 0;
  let same = 0;
  for (const [key, value] of fr) {
    if (!en.has(key)) continue;      // parité des clés : c'est le travail d'i18n:check
    pairs++;
    if (en.get(key) !== value) continue;
    same++;
    identical.set(`${ns}.${key}`, value);
  }
  comparable += pairs;
  perNamespace.push({ ns, pairs, same });
}

// ──────────────────────────────────────────────────────────────────
// 3. Allowlist périmée
// ──────────────────────────────────────────────────────────────────
const stale = [];
for (const [id, entry] of declared) {
  if (!categories[entry?.categorie]) {
    stale.push([id, `catégorie inconnue : ${JSON.stringify(entry?.categorie)}`]);
    continue;
  }
  if (!identical.has(id)) {
    stale.push([id, 'la clé n\'existe plus, ou les deux valeurs diffèrent désormais']);
    continue;
  }
  const pinned = entry.valeur;
  const actual = identical.get(id);
  if (pinned !== actual) {
    stale.push([id, `valeur épinglée ${JSON.stringify(pinned)} ≠ ${JSON.stringify(actual)}`]);
  }
}

// ──────────────────────────────────────────────────────────────────
// 4. Rapport
// ──────────────────────────────────────────────────────────────────
const undeclared = [...identical].filter(([id]) => !declared.has(id));
const LIST = process.argv.includes('--list');

console.log(
  `COUPLES COMPARABLES: ${comparable} | IDENTIQUES: ${identical.size} ` +
  `(${((identical.size / comparable) * 100).toFixed(1)}%) | ` +
  `DÉCLARÉES LÉGITIMES: ${identical.size - undeclared.length} | NON DÉCLARÉES: ${undeclared.length}`,
);

const undeclaredByNs = new Map();
for (const [id] of undeclared) {
  const ns = id.slice(0, id.indexOf('.'));
  undeclaredByNs.set(ns, (undeclaredByNs.get(ns) ?? 0) + 1);
}

for (const { ns, pairs, same } of perNamespace.sort((a, b) => b.same - a.same)) {
  if (same === 0) continue;
  const nd = undeclaredByNs.get(ns) ?? 0;
  console.log(
    `${String(same).padStart(4)} / ${String(pairs).padEnd(5)} ` +
    `${((same / pairs) * 100).toFixed(1).padStart(5)}%  ${ns}` +
    (nd ? `  ← ${nd} NON DÉCLARÉE(S)` : ''),
  );
}

if (undeclared.length && LIST) {
  console.log('\nNon déclarées :');
  for (const [id, value] of undeclared) console.log('       ·', id, '=', JSON.stringify(value));
}

if (stale.length) {
  console.error(`\n✖ Allowlist périmée : ${stale.length} entrée(s).`);
  for (const [id, why] of stale) console.error(`       · ${id} : ${why}`);
  console.error(
    'Retirer l\'entrée si la clé a été traduite ou supprimée ; ré-épingler la valeur\n' +
    'si le libellé français a changé — et REDÉCIDER à cette occasion, car une\n' +
    'dispense héritée sans relecture est une dispense qui ne mesure plus rien.',
  );
  process.exit(1);
}

if (undeclared.length > MAX_UNDECLARED) {
  console.error(
    `\ni18n-identical : ${undeclared.length} identité(s) non déclarée(s) > ${MAX_UNDECLARED} autorisée(s).\n` +
    '`npm run i18n:identical -- --list` dit LESQUELLES.\n' +
    'Traduire la valeur `en`, ou la déclarer légitime dans\n' +
    `${ALLOWLIST} (catégorie + valeur épinglée).\n` +
    'Ne PAS relever le seuil : le moteur retombe sur le français, donc rien\n' +
    'à l\'écran ne dira jamais qu\'une valeur n\'a pas été traduite.',
  );
  process.exit(1);
}

if (undeclared.length < MAX_UNDECLARED) {
  console.log(
    `\n✅ ${MAX_UNDECLARED - undeclared.length} identité(s) de moins que le seuil. ` +
    `Baisser MAX_UNDECLARED à ${undeclared.length} dans scripts/i18n-identical.mjs.`,
  );
}
