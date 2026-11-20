// ═══════════════════════════════════════════════════════════════════
// C-99 — le CORPS des pages prérendues en `en` n'est comparé à rien
// ═══════════════════════════════════════════════════════════════════
//
// Trois contrôles que `i18n:check` (clés seules) ne fait pas :
//   1. PLURIELS : chaque locale traduite porte exactement les catégories que
//      `Intl.PluralRules` demandera (`many` en fr, `few` en hr) ; une forme
//      manquante retombe en silence sur le français, une forme en trop est morte.
//   2. LOCALES DÉCLARÉES dans `route-slugs.json` mais non servies.
//   3. VOLUME de texte par page prérendue (`--pages`, après `npm run build`) :
//      une traduction tronquée passe partout ailleurs. Sans l'option, la garde
//      DIT qu'elle ne l'a pas mesuré.
//
// ❌ NE JAMAIS BAISSER UN PLANCHER DE VOLUME. Une page qui maigrit est soit
//    une traduction perdue, soit une décision éditoriale — et une décision
//    éditoriale se recale explicitement, par `--update`.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { estLance } from './ops-alert.mjs';

const RACINE = process.cwd();
const DIST = join(RACINE, 'dist');
const LOCALES_DIR = join(RACINE, 'src', 'locales');
const PLANCHERS = join(RACINE, 'scripts', 'i18n-pages-floor.json');

/** Les locales réellement SERVIES et indexables. */
const LOCALES_SERVIES = ['fr', 'en', 'hr']; // miroir de SUPPORTED_LOCALES (src/i18n/locale.ts)

/** La table de correspondance des slugs localisés. Une seule, partagée. */
const SLUGS = JSON.parse(
  readFileSync(join(RACINE, 'src', 'i18n', 'route-slugs.json'), 'utf8'),
);

/**
 * Ce qu'une page anglaise doit peser par rapport à sa française, au minimum.
 *
 * 0,5 et pas 0,9 : une traduction anglaise est structurellement plus courte
 * (pas d'articles contractés, moins de périphrases), et l'écart mesuré sur ce
 * site tourne autour de −10 %. Ce seuil n'attrape donc pas une traduction
 * serrée : il attrape une traduction TRONQUÉE, une section oubliée, un corps
 * resté vide.
 */
const RATIO_MIN_EN = 0.5;

// ── Les catalogues ─────────────────────────────────────────────────

/** Aplatit un catalogue JSON en `chemin.pointé → valeur`. */
export function aplatir(objet, prefixe = '') {
  const out = {};
  for (const [k, v] of Object.entries(objet)) {
    const cle = prefixe ? `${prefixe}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, aplatir(v, cle));
    else out[cle] = v;
  }
  return out;
}

/**
 * Lit un JSON, ou rend `null` s'il n'existe pas. Pas d'`existsSync` avant la
 * lecture : vérifier puis lire le même chemin est une course (CodeQL
 * js/file-system-race, M-60), et l'absence se lit dans l'erreur elle-même.
 */
function lireJsonOuNull(chemin) {
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (e) {
    if (e?.code === 'ENOENT') return null;
    throw e;
  }
}

/** Tous les catalogues d'une locale, aplatis et préfixés par leur namespace. */
export function catalogue(locale, racine = LOCALES_DIR) {
  const dossier = join(racine, locale);
  if (!existsSync(dossier)) return {};
  const out = {};
  for (const f of readdirSync(dossier).filter((f) => f.endsWith('.json'))) {
    const ns = f.replace(/\.json$/, '');
    for (const [k, v] of Object.entries(aplatir(JSON.parse(readFileSync(join(dossier, f), 'utf8'))))) {
      out[`${ns}.${k}`] = v;
    }
  }
  return out;
}

/** Les catégories CLDR réellement attendues pour une locale. */
export function categoriesAttendues(locale) {
  // `Intl.PluralRules` fait autorité — pas une liste écrite de tête. Le
  // français a `one`/`many`/`other`, l'anglais `one`/`other`.
  return new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
}

/**
 * Les locales TRADUITES : chaque dossier de `src/locales/` hors la référence.
 * Une locale sans dossier (pas encore traduite) n'est pas contrôlée : c'est
 * un état de transition, pas une panne. Ajouter `src/locales/hr/` suffit à la
 * faire entrer dans la garde, sans toucher à ce fichier.
 */
export function localesTraduites(racine = LOCALES_DIR, reference = 'fr') {
  if (!existsSync(racine)) return [];
  return readdirSync(racine, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== reference)
    .map((d) => d.name)
    .sort();
}

/**
 * Formes plurielles manquantes et mortes, locale par locale.
 *
 * `cats` porte un catalogue aplati par locale, référence comprise. Chaque
 * racine plurielle de la référence doit exister dans chaque locale traduite
 * avec EXACTEMENT les catégories que `Intl.PluralRules(locale)` demandera :
 * `one`/`other` en anglais, `one`/`few`/`other` en croate. Une catégorie en
 * trop (un `_many` recopié du français) est MORTE : le moteur ne la demandera
 * jamais.
 */
export function verifierPluriels(cats, reference = 'fr') {
  const manquants = [];
  const morts = [];
  const plurielsRef = grouperPluriels(cats[reference] ?? {});
  for (const [locale, cat] of Object.entries(cats)) {
    if (locale === reference) continue;
    const pluriels = grouperPluriels(cat);
    const attendu = categoriesAttendues(locale);
    for (const racine of plurielsRef.keys()) {
      const formes = pluriels.get(racine);
      if (!formes) {
        manquants.push(`${racine} : aucune forme plurielle en \`${locale}\``);
        continue;
      }
      for (const c of attendu) {
        if (!formes.has(c)) manquants.push(`${racine}_${c} : absent de \`${locale}\``);
      }
      for (const c of formes) {
        if (!attendu.has(c)) morts.push(`${racine}_${c} : \`${locale}\` n'a pas la catégorie \`${c}\``);
      }
    }
  }
  const attenduRef = categoriesAttendues(reference);
  for (const [racine, formes] of plurielsRef) {
    for (const c of attenduRef) {
      if (!formes.has(c)) manquants.push(`${racine}_${c} : absent de \`${reference}\` (référence)`);
    }
  }
  return { manquants, morts };
}

/** Regroupe les clés plurielles par racine : `x_one`,`x_other` → `x`. */
export function grouperPluriels(cat) {
  const out = new Map();
  for (const cle of Object.keys(cat)) {
    const m = /^(.*)_(zero|one|two|few|many|other)$/.exec(cle);
    if (!m) continue;
    if (!out.has(m[1])) out.set(m[1], new Set());
    out.get(m[1]).add(m[2]);
  }
  return out;
}

// ── Les pages prérendues ───────────────────────────────────────────

/** Le texte indexable d'une page : le contenu de `#seo-fallback`. */
export function volumeIndexable(html) {
  const bloc = /<div[^>]+id="seo-fallback"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/body>|<div)/i.exec(html);
  const source = bloc ? bloc[1] : html;
  return source
    // Une fin de balise peut porter espaces, tabulations ou attributs, et le
    // navigateur l'accepte (CodeQL js/bad-tag-filter, M-60) : `[^>]*` les
    // couvre toutes, sinon leur contenu compterait comme du texte.
    .replace(/<script\b[\s\S]*?<\/script\b[^>]*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Toutes les pages prérendues : chemin → nombre de mots indexables. */
export function volumesParPage(dist = DIST) {
  const out = new Map();
  const marcher = (rep) => {
    // `withFileTypes` : le type vient de la même lecture que le nom, sans
    // `statSync` séparé entre les deux (CodeQL js/file-system-race, M-60).
    for (const d of readdirSync(rep, { withFileTypes: true })) {
      const entree = d.name;
      if (['assets', 'fonts', 'screenshots', 'downloads'].includes(entree)) continue;
      const chemin = join(rep, entree);
      if (d.isDirectory()) marcher(chemin);
      else if (entree === 'index.html') {
        const rel = relative(dist, chemin).split(sep).join('/');
        const url = `/${rel.replace(/index\.html$/, '')}`.replace(/\/+$/, '/') || '/';
        out.set(url, volumeIndexable(readFileSync(chemin, 'utf8')));
      }
    }
  };
  marcher(dist);
  return out;
}

/**
 * `/en/guide/` → `{ locale: 'en', nu: '/guide/' }`.
 *
 * 🔴 ET LE SLUG EST RAMENÉ À SA FORME FRANÇAISE. Sans ça, `/a-propos/` et
 * `/en/about/` sont deux pages SANS RAPPORT pour cette garde : le rapport de
 * volume fr↔en ne se calcule jamais, et la garde reste verte sur exactement
 * les pages dont le slug est traduit — c'est-à-dire les neuf pages
 * éditoriales, celles qui portent le contenu. Mesuré à la première pose des
 * planchers : le ratio ne tournait que sur les articles de blog et la home,
 * dont le slug ne change pas.
 *
 * `route-slugs.json` est la seule table de correspondance du dépôt, et c'est
 * déjà elle que le prérendu (`prerender/`) utilise : on ne recrée pas une seconde table.
 */
export function decouper(url, slugs = SLUGS) {
  let locale = 'fr';
  let nu = url;
  for (const l of LOCALES_SERVIES) {
    if (url === `/${l}/`) { locale = l; nu = '/'; break; }
    if (url.startsWith(`/${l}/`)) { locale = l; nu = url.slice(`/${l}`.length); break; }
  }
  if (locale !== 'fr') {
    const segment = nu.split('/')[1] ?? '';
    for (const trad of Object.values(slugs)) {
      if (trad[locale] === segment && trad.fr) {
        nu = nu.replace(`/${segment}`, `/${trad.fr}`);
        break;
      }
    }
  }
  return { locale, nu };
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement = estLance(import.meta.url);

if (estLanceDirectement) {
  const erreurs = [];
  const avecPages = process.argv.includes('--pages');

  // ═══ MOITIÉ 1 · les catalogues ═══════════════════════════════════
  const traduites = localesTraduites();
  const cats = Object.fromEntries(['fr', ...traduites].map((l) => [l, catalogue(l)]));
  const fr = cats.fr;

  // 🔴 Anti-« garde qui répond sans mesurer ».
  if (Object.keys(fr).length < 500) {
    erreurs.push(`Seulement ${Object.keys(fr).length} clé(s) lue(s) en fr : la lecture est cassée.`);
  }

  const { manquants, morts } = verifierPluriels(cats);

  console.log('i18n · pluriels');
  for (const l of ['fr', ...traduites]) {
    console.log(
      `  ${l} : ${grouperPluriels(cats[l]).size} racine(s) plurielle(s), `
        + `catégories CLDR {${[...categoriesAttendues(l)].join(',')}}`,
    );
  }

  if (manquants.length > 0) {
    erreurs.push(
      `${manquants.length} forme(s) plurielle(s) MANQUANTE(S) :\n`
        + manquants.slice(0, 20).map((m) => `      ${m}`).join('\n')
        + (manquants.length > 20 ? `\n      … et ${manquants.length - 20} autre(s)` : '')
        + '\n    Le moteur retombe clé par clé sur le français : une forme manquante\n'
        + "    affiche une phrase FRANÇAISE dans une interface traduite, sans jamais\n"
        + '    ressembler à une clé brute.',
    );
  }
  if (morts.length > 0) {
    erreurs.push(
      `${morts.length} forme(s) plurielle(s) MORTE(S) :\n`
        + morts.slice(0, 20).map((m) => `      ${m}`).join('\n')
        + '\n    `Intl.PluralRules` ne les demandera jamais. Elles donnent l illusion\n'
        + "    d'une traduction complète tout en n'étant jamais affichées.",
    );
  }

  // ── Une locale déclarée mais pas servie ─────────────────────────
  const slugs = SLUGS;
  const localesDeclarees = new Set();
  for (const v of Object.values(slugs)) for (const l of Object.keys(v)) localesDeclarees.add(l);
  const fantomes = [...localesDeclarees].filter((l) => !LOCALES_SERVIES.includes(l));
  console.log(`\ni18n · locales déclarées dans route-slugs.json : ${[...localesDeclarees].join(', ')}`);
  if (fantomes.length > 0) {
    // 🔎 IMPRIMÉ, PAS BLOQUANT — et il faut dire pourquoi. `es` est une
    // intention écrite (chantier i18n universel fr/en/es), pas une erreur. La
    // faire échouer obligerait à supprimer un travail commencé ; la taire
    // laisserait croire que la langue est servie. On la NOMME.
    console.log(
      `🔎 ${fantomes.length} locale(s) déclarée(s) et NON SERVIE(S) : ${fantomes.join(', ')}.\n`
        + '   Les slugs existent, aucune page n est prérendue, aucun catalogue n est\n'
        + '   complet. Ce n est pas une panne : c est un chantier ouvert (i18n\n'
        + '   universel). ⚠️ Tant que c est le cas, ne JAMAIS poser de\n'
        + '   `hreflang` vers ces slugs : on annoncerait à Google une page qui\n'
        + "   n'existe pas.",
    );
    // Chaque locale fantôme, pas seulement la première : avec `es` et `hr`
    // déclarées, ne lire que `fantomes[0]` laissait passer la seconde.
    for (const fantome of fantomes) {
      const catFantome = catalogue(fantome);
      if (Object.keys(catFantome).length > 0) {
        erreurs.push(
          `La locale \`${fantome}\` a un CATALOGUE (${Object.keys(catFantome).length} clés) `
            + "et n'est pas servie : soit elle s'ouvre, soit elle s'enlève. Un entre-deux "
            + 'se traduit à moitié et se périme entièrement.',
        );
      }
    }
  }

  // ═══ MOITIÉ 2 · le volume par page et par locale ══════════════════
  if (!avecPages) {
    console.log(
      '\n⚠️ MOITIÉ 2 NON JOUÉE : le volume de texte par page n a PAS été mesuré.\n'
        + '   Elle exige un build (`dist/`). Pour la jouer :\n'
        + '     npm run build && npm run i18n:pages -- --pages',
    );
  } else if (!existsSync(DIST)) {
    console.error('\n✖ `--pages` demandé et `dist/` absent. Construire d abord.');
    process.exit(1);
  } else {
    const volumes = volumesParPage();
    const parNu = new Map();
    for (const [url, mots] of volumes) {
      const { locale, nu } = decouper(url);
      if (!parNu.has(nu)) parNu.set(nu, {});
      parNu.get(nu)[locale] = mots;
    }

    const planchers = lireJsonOuNull(PLANCHERS);

    if (process.argv.includes('--update')) {
      const contenu = {
        _comment: [
          'C-99 — plancher de VOLUME de texte indexable, par page et par locale.',
          'Écrit par `node scripts/check-i18n-pages.mjs --pages --update`.',
          '🔴 Ne JAMAIS baisser un nombre pour faire passer la CI : une page qui',
          "maigrit est soit une traduction perdue, soit une décision éditoriale —",
          'et une décision se recale explicitement, en sachant ce qu on recale.',
        ],
        pose_le: new Date().toISOString().slice(0, 10),
        pages: Object.fromEntries([...parNu].sort()),
      };
      writeFileSync(PLANCHERS, `${JSON.stringify(contenu, null, 2)}\n`, 'utf8');
      console.log(`\n✓ Planchers recalés : ${parNu.size} page(s).`);
      process.exit(0);
    }

    if (!planchers) {
      erreurs.push(
        `${relative(RACINE, PLANCHERS)} absent. Le poser une première fois :\n`
          + '    npm run build && node scripts/check-i18n-pages.mjs --pages --update',
      );
    }

    console.log(`\ni18n · volume indexable, ${parNu.size} page(s) × ${LOCALES_SERVIES.length} locale(s)`);
    let maigres = 0;
    for (const [nu, parLocale] of [...parNu].sort()) {
      const ligne = LOCALES_SERVIES.map((l) => `${l} ${String(parLocale[l] ?? 0).padStart(5)}`).join('  ');
      const ratio = parLocale.fr > 0 && parLocale.en !== undefined ? parLocale.en / parLocale.fr : null;
      console.log(`  ${nu.padEnd(34)} ${ligne}${ratio === null ? '' : `  ratio ${ratio.toFixed(2)}`}`);

      if (ratio !== null && ratio < RATIO_MIN_EN) {
        maigres += 1;
        erreurs.push(
          `\`${nu}\` : la page \`en\` pèse ${parLocale.en} mots contre ${parLocale.fr} en \`fr\` `
            + `(ratio ${ratio.toFixed(2)}, plancher ${RATIO_MIN_EN}).\n`
            + '    Une traduction tronquée ne casse rien et ne ressemble à rien : la page\n'
            + '    s affiche, le prérendu tourne, `i18n:check` est vert. Google, lui, la\n'
            + '    traite comme du contenu mince.',
        );
      }
      const attendus = planchers?.pages?.[nu];
      if (!attendus) continue;
      for (const l of LOCALES_SERVIES) {
        const avant = attendus[l];
        const apres = parLocale[l];
        if (avant === undefined) continue;
        if (apres === undefined) {
          erreurs.push(`\`${nu}\` : la version \`${l}\` a DISPARU du prérendu (elle pesait ${avant} mots).`);
        } else if (apres < avant * 0.9) {
          erreurs.push(
            `\`${nu}\` (${l}) : ${apres} mots contre ${avant} au plancher du ${planchers.pose_le} `
              + `(−${Math.round((1 - apres / avant) * 100)} %).`,
          );
        }
      }
    }
    console.log(`  ${maigres} page(s) sous le ratio ${RATIO_MIN_EN}`);
  }

  if (erreurs.length > 0) {
    console.error('\n✖ i18n · pages et pluriels :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Pluriels complets, locales cohérentes'
    + (avecPages ? ', aucune page en recul.' : ' (volume non mesuré, cf. ci-dessus).'));
}
