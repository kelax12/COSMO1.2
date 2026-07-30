#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// i18n-check.mjs — garde CI sur les catalogues de traduction
//
// Le moteur de traduction retombe clé par clé sur le catalogue de référence
// (`fr`) : un catalogue traduit incomplet n'affiche donc JAMAIS de clé brute…
// mais ne se voit pas non plus. Ce script est la seule protection réelle contre
// un catalogue qui part en prod à moitié traduit.
//
// Vérifications :
//   1. Parité des clés entre `fr` (référence) et chaque locale présente
//      — clés manquantes (ERREUR) et clés orphelines (ERREUR : soit une faute
//      de frappe, soit un reliquat après renommage côté `fr`).
//   2. Parité des variables `{{var}}` d'une clé à l'autre — une traduction qui
//      perd un `{{count}}` produit un message faux, pas seulement inélégant.
//   3. Complétude des pluriels : toute clé `_one` exige un `_other`, et les
//      catégories CLDR de la locale sont signalées si absentes (WARN, car
//      `_other` sert de filet).
//   4. Cohérence du jeu de locales : `SUPPORTED_LOCALES` (src/i18n/locale.ts)
//      ⇄ dossiers présents dans src/locales/ ⇄ `lang` de index.html.
//   5. Clés référencées dans le code (`t('…')` / `tp('…')`) mais absentes du
//      catalogue de référence.
//
// Codes de sortie : 1 si au moins une ERREUR, 0 sinon (les WARN n'échouent pas).
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = 'src/locales';
const LOCALE_MODULE = 'src/i18n/locale.ts';
const INDEX_HTML = 'index.html';
const SRC_DIR = 'src';

let errors = 0;
let warnings = 0;
const err = (scope, msg) => { console.error(`✖ ${scope}: ${msg}`); errors++; };
const warn = (scope, msg) => { console.warn(`⚠ ${scope}: ${msg}`); warnings++; };

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/** Aplatit un catalogue JSON en `Map<'a.b.c', 'valeur'>`. */
function flatten(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else if (typeof value === 'string') {
      out.set(path, value);
    } else {
      err(path, `valeur non textuelle (${Array.isArray(value) ? 'array' : typeof value})`);
    }
  }
  return out;
}

/** Variables `{{var}}` présentes dans un message, triées. */
function variablesOf(message) {
  const found = new Set();
  for (const match of message.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) found.add(match[1]);
  return [...found].sort();
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(path, `JSON invalide — ${e.message}`);
    return null;
  }
}

/** Extrait un tableau de locales déclaré dans locale.ts. */
function extractLocaleList(source, constName) {
  const re = new RegExp(`${constName}[^=]*=\\s*\\[([^\\]]*)\\]`);
  const match = source.match(re);
  if (!match) return null;
  return [...match[1].matchAll(/'([a-z]{2})'/g)].map((m) => m[1]);
}

// ──────────────────────────────────────────────────────────────────
// (4) Cohérence du jeu de locales
// ──────────────────────────────────────────────────────────────────

if (!existsSync(LOCALE_MODULE)) {
  err(LOCALE_MODULE, 'module de locale introuvable');
  process.exit(1);
}

const localeSource = readFileSync(LOCALE_MODULE, 'utf8');
const allLocales = extractLocaleList(localeSource, 'ALL_LOCALES');
const supportedLocales = extractLocaleList(localeSource, 'SUPPORTED_LOCALES');

if (!allLocales || !supportedLocales) {
  err(LOCALE_MODULE, 'ALL_LOCALES / SUPPORTED_LOCALES illisibles (la forme du tableau a changé ?)');
  process.exit(1);
}

const REFERENCE_LOCALE = supportedLocales[0];

for (const locale of supportedLocales) {
  if (!allLocales.includes(locale)) {
    err(LOCALE_MODULE, `\`${locale}\` est servie mais absente de ALL_LOCALES`);
  }
  const dir = join(LOCALES_DIR, locale);
  if (!existsSync(dir)) {
    err(dir, `locale servie sans dossier de catalogues`);
  }
}

// `lang` de index.html — doit correspondre à la locale de référence, car c'est
// la valeur servie avant que le JS ait pu appliquer quoi que ce soit.
if (existsSync(INDEX_HTML)) {
  const html = readFileSync(INDEX_HTML, 'utf8');
  const langMatch = html.match(/<html[^>]*\blang="([^"]+)"/);
  if (!langMatch) {
    err(INDEX_HTML, 'attribut lang absent de <html>');
  } else if (langMatch[1] !== REFERENCE_LOCALE) {
    err(INDEX_HTML, `lang="${langMatch[1]}" alors que la locale de référence est \`${REFERENCE_LOCALE}\``);
  }
}

// ──────────────────────────────────────────────────────────────────
// (1)(2)(3) Parité des catalogues
// ──────────────────────────────────────────────────────────────────

const referenceDir = join(LOCALES_DIR, REFERENCE_LOCALE);
if (!existsSync(referenceDir)) {
  err(referenceDir, 'catalogue de référence introuvable');
  process.exit(1);
}

const namespaces = readdirSync(referenceDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

if (namespaces.length === 0) err(referenceDir, 'aucun catalogue');

/** Catalogues aplatis de la locale de référence, par namespace. */
const reference = new Map();
for (const namespace of namespaces) {
  const json = readJson(join(referenceDir, `${namespace}.json`));
  if (json) reference.set(namespace, flatten(json));
}

// Les locales à contrôler = celles qui ont un dossier (une locale connue mais
// pas encore traduite ne doit pas faire échouer la CI : c'est un état de
// transition légitime entre deux phases).
const presentLocales = existsSync(LOCALES_DIR)
  ? readdirSync(LOCALES_DIR).filter((d) => statSync(join(LOCALES_DIR, d)).isDirectory()).sort()
  : [];

for (const dir of presentLocales) {
  if (!allLocales.includes(dir)) {
    err(join(LOCALES_DIR, dir), `dossier de catalogues pour une locale inconnue`);
  }
}

for (const locale of presentLocales) {
  if (locale === REFERENCE_LOCALE) continue;
  const dir = join(LOCALES_DIR, locale);

  for (const namespace of namespaces) {
    const scope = `${locale}/${namespace}`;
    const path = join(dir, `${namespace}.json`);
    if (!existsSync(path)) {
      err(scope, `catalogue absent (présent dans \`${REFERENCE_LOCALE}\`)`);
      continue;
    }
    const json = readJson(path);
    if (!json) continue;

    const translated = flatten(json);
    const expected = reference.get(namespace);
    if (!expected) continue;

    // (1) Clés manquantes / orphelines. Les variantes plurielles sont exclues
    // de la comparaison stricte : les catégories CLDR diffèrent d'une langue à
    // l'autre (l'espagnol a `many`, le français non), donc une parité exacte
    // serait fausse. Elles sont traitées en (3).
    const isPlural = (key) => /_(zero|one|two|few|many|other)$/.test(key);

    for (const key of expected.keys()) {
      if (isPlural(key)) continue;
      if (!translated.has(key)) err(scope, `clé manquante : ${key}`);
    }
    for (const key of translated.keys()) {
      if (isPlural(key)) continue;
      if (!expected.has(key)) err(scope, `clé orpheline : ${key}`);
    }

    // (2) Parité des variables interpolées.
    for (const [key, value] of translated) {
      const source = expected.get(key) ?? expected.get(key.replace(/_(zero|one|two|few|many|other)$/, '_other'));
      if (!source) continue;
      const expectedVars = variablesOf(source);
      const actualVars = variablesOf(value);
      const missing = expectedVars.filter((v) => !actualVars.includes(v));
      const extra = actualVars.filter((v) => !expectedVars.includes(v));
      if (missing.length) err(scope, `${key} : variable(s) perdue(s) {{${missing.join('}} {{')}}}`);
      if (extra.length) err(scope, `${key} : variable(s) inconnue(s) {{${extra.join('}} {{')}}}`);
    }

    // (3) Complétude des pluriels selon les catégories CLDR de la locale.
    checkPlurals(scope, locale, translated);
  }
}

// Les pluriels de la locale de référence elle-même doivent aussi être complets.
for (const namespace of namespaces) {
  const flat = reference.get(namespace);
  if (flat) checkPlurals(`${REFERENCE_LOCALE}/${namespace}`, REFERENCE_LOCALE, flat);
}

function checkPlurals(scope, locale, flat) {
  /** Bases plurielles présentes dans le catalogue. */
  const bases = new Set();
  for (const key of flat.keys()) {
    const match = key.match(/^(.*)_(zero|one|two|few|many|other)$/);
    if (match) bases.add(match[1]);
  }
  if (bases.size === 0) return;

  let categories;
  try {
    categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  } catch {
    warn(scope, `catégories CLDR indisponibles pour \`${locale}\``);
    return;
  }

  for (const base of bases) {
    // `_other` est le filet du moteur : sans lui, un compte dont la catégorie
    // manque retomberait sur la clé brute.
    if (!flat.has(`${base}_other`)) err(scope, `${base} : forme _other obligatoire absente`);
    for (const category of categories) {
      if (category === 'other') continue;
      if (!flat.has(`${base}_${category}`)) {
        warn(scope, `${base} : forme _${category} absente (repli sur _other)`);
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// (5) Clés référencées dans le code mais absentes du catalogue
// ──────────────────────────────────────────────────────────────────

/** Tous les fichiers .ts/.tsx de src/, hors tests. */
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'locales') continue;
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

/** Union de toutes les clés connues, tous namespaces confondus. */
const knownKeys = new Set();
for (const flat of reference.values()) {
  for (const key of flat.keys()) {
    knownKeys.add(key);
    knownKeys.add(key.replace(/_(zero|one|two|few|many|other)$/, ''));
  }
}

// `useT('ns')` fixe le namespace, mais on ne résout pas le flux de données ici :
// on vérifie l'appartenance à l'union des clés, ce qui attrape les fautes de
// frappe et les clés supprimées — l'appartenance au BON namespace est garantie
// par le typage TypeScript de `t()` (cf. src/i18n/catalog.ts).
const CALL_RE = /\bt[p]?\(\s*'([a-zA-Z0-9_.]+)'/g;

for (const file of sourceFiles(SRC_DIR)) {
  const source = readFileSync(file, 'utf8');
  if (!/\bfrom '@\/i18n/.test(source)) continue; // fichier sans traduction
  for (const match of source.matchAll(CALL_RE)) {
    const key = match[1];
    if (!key.includes('.')) continue; // pas une clé pointée — probable faux positif
    if (!knownKeys.has(key)) err(file, `clé inconnue référencée : ${key}`);
  }
}

// ──────────────────────────────────────────────────────────────────

const localeSummary = presentLocales.length ? presentLocales.join(', ') : 'aucune';
console.log(
  `\ni18n-check — ${namespaces.length} namespace(s), locales présentes : ${localeSummary} ` +
    `(référence : ${REFERENCE_LOCALE}) · ${errors} erreur(s), ${warnings} avertissement(s)`
);

process.exit(errors > 0 ? 1 : 0);
