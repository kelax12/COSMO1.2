// ═══════════════════════════════════════════════════════════════════
// i18n-identical.mjs — cliquet sur les valeurs traduites restées en français
//
// Le moteur retombe clé par clé sur `fr` : une valeur jamais traduite
// s'affiche en français, jamais comme clé brute, et `i18n:check` (clés seules)
// ne la voit pas. Ce script compte, pour CHAQUE locale de `src/locales/` hors
// `fr`, les valeurs IDENTIQUES au fr non déclarées dans
// la section `locales.<locale>` de `scripts/i18n-identical-allowlist.json` (une par langue : « Description »
// est légitime en anglais, pas en croate).
//
// L'allowlist est VÉRIFIÉE : clé disparue, valeurs devenues différentes, ou
// valeur `fr` changée depuis l'épinglage font échouer (sans valeur épinglée,
// un libellé renommé hériterait en silence de la dispense).
//
// Usage :  node scripts/i18n-identical.mjs [--list]
// Sortie : 1 si le cliquet est dépassé OU si une allowlist est périmée, dans
// n'importe quelle locale, 0 sinon.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = 'src/locales';
const REFERENCE = 'fr';

/** Allowlist unique, une section `locales.<locale>` par langue traduite. */
const ALLOWLIST = 'scripts/i18n-identical-allowlist.json';
const allowlistPath = (locale) => `${ALLOWLIST} § locales.${locale}`;
const ALLOW_ALL = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : {};

// ❌ Ne JAMAIS relever : on traduit, ou on DÉCLARE (catégorie + valeur).
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

/** Les locales traduites : chaque dossier de catalogues hors la référence. */
const targets = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== REFERENCE)
  .map((d) => d.name)
  .sort();

const files = readdirSync(join(LOCALES_DIR, REFERENCE)).filter((f) => f.endsWith('.json'));
const LIST = process.argv.includes('--list');

const staleAll = [];
const undeclaredAll = [];

for (const target of targets) {
  // ────────────────────────────────────────────────────────────────
  // 1. Allowlist de la locale
  // ────────────────────────────────────────────────────────────────
  const allow = { categories: ALLOW_ALL.categories, entrees: ALLOW_ALL.locales?.[target] };
  const categories = allow.categories ?? {};
  const declared = new Map(Object.entries(allow.entrees ?? {}));

  // ────────────────────────────────────────────────────────────────
  // 2. Mesure
  // ────────────────────────────────────────────────────────────────
  const identical = new Map();  // 'ns.cle' -> valeur
  const perNamespace = [];
  let comparable = 0;

  for (const file of files) {
    const ns = file.replace(/\.json$/, '');
    if (!existsSync(join(LOCALES_DIR, target, file))) continue;
    const fr = read(REFERENCE, file);
    const translated = read(target, file);
    let pairs = 0;
    let same = 0;
    for (const [key, value] of fr) {
      if (!translated.has(key)) continue;      // parité des clés : c'est le travail d'i18n:check
      pairs++;
      if (translated.get(key) !== value) continue;
      same++;
      identical.set(`${ns}.${key}`, value);
    }
    comparable += pairs;
    perNamespace.push({ ns, pairs, same });
  }

  // ────────────────────────────────────────────────────────────────
  // 3. Allowlist périmée
  // ────────────────────────────────────────────────────────────────
  for (const [id, entry] of declared) {
    if (!categories[entry?.categorie]) {
      staleAll.push([target, id, `catégorie inconnue : ${JSON.stringify(entry?.categorie)}`]);
      continue;
    }
    if (!identical.has(id)) {
      staleAll.push([target, id, 'la clé n\'existe plus, ou les deux valeurs diffèrent désormais']);
      continue;
    }
    const pinned = entry.valeur;
    const actual = identical.get(id);
    if (pinned !== actual) {
      staleAll.push([target, id, `valeur épinglée ${JSON.stringify(pinned)} ≠ ${JSON.stringify(actual)}`]);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 4. Rapport de la locale
  // ────────────────────────────────────────────────────────────────
  const undeclared = [...identical].filter(([id]) => !declared.has(id));
  for (const [id, value] of undeclared) undeclaredAll.push([target, id, value]);

  const ratio = comparable > 0 ? ((identical.size / comparable) * 100).toFixed(1) : '0.0';
  console.log(
    `[${target}] COUPLES COMPARABLES: ${comparable} | IDENTIQUES: ${identical.size} ` +
    `(${ratio}%) | ` +
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
    console.log(`\nNon déclarées (${target}) :`);
    for (const [id, value] of undeclared) console.log('       ·', id, '=', JSON.stringify(value));
  }
}

if (targets.length === 0) {
  console.log('Aucune locale traduite dans src/locales : rien à comparer.');
}

if (staleAll.length) {
  console.error(`\n✖ Allowlist périmée : ${staleAll.length} entrée(s).`);
  for (const [target, id, why] of staleAll) console.error(`       · [${target}] ${id} : ${why}`);
  console.error(
    'Retirer l\'entrée si la clé a été traduite ou supprimée ; ré-épingler la valeur\n' +
    'si le libellé français a changé — et REDÉCIDER à cette occasion, car une\n' +
    'dispense héritée sans relecture est une dispense qui ne mesure plus rien.',
  );
  process.exit(1);
}

if (undeclaredAll.length > MAX_UNDECLARED) {
  const parLocale = [...new Set(undeclaredAll.map(([t]) => t))];
  console.error(
    `\ni18n-identical : ${undeclaredAll.length} identité(s) non déclarée(s) > ${MAX_UNDECLARED} autorisée(s) ` +
    `(${parLocale.join(', ')}).\n` +
    '`npm run i18n:identical -- --list` dit LESQUELLES.\n' +
    'Traduire la valeur, ou la déclarer légitime dans\n' +
    `${parLocale.map(allowlistPath).join(', ')} (catégorie + valeur épinglée).\n` +
    'Ne PAS relever le seuil : le moteur retombe sur le français, donc rien\n' +
    'à l\'écran ne dira jamais qu\'une valeur n\'a pas été traduite.',
  );
  process.exit(1);
}

if (undeclaredAll.length < MAX_UNDECLARED) {
  console.log(
    `\n✅ ${MAX_UNDECLARED - undeclaredAll.length} identité(s) de moins que le seuil. ` +
    `Baisser MAX_UNDECLARED à ${undeclaredAll.length} dans scripts/i18n-identical.mjs.`,
  );
}
