// ═══════════════════════════════════════════════════════════════════
// C-99 — le CORPS des pages prérendues en `en` n'est comparé à rien
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 TROIS ANGLES MORTS, MESURÉS UNE FOIS ET JAMAIS DEPUIS.
//
// 1. LE VOLUME DE TEXTE PAR PAGE ET PAR LOCALE. Les 50 pages ont été mesurées
//    UNE fois avant l'ouverture d'`en` à l'indexation (C-20), jamais depuis.
//    Une traduction tronquée ne casse rien : la page s'affiche, le prérendu
//    tourne, `i18n:check` est vert (il ne voit que les CLÉS). Google, lui,
//    voit une page anglaise trois fois plus courte que sa française et la
//    traite comme du contenu mince.
//
// 2. LES PLURIELS. Le moteur retombe clé par clé sur le français : un
//    `_other` anglais manquant affiche une phrase FRANÇAISE dans une
//    interface anglaise, sans jamais ressembler à une clé brute. C'est le
//    mécanisme exact de C-38, refermé une fois et jamais outillé pour les
//    formes plurielles.
//    ⚠️ Et il y a pire : le français a une catégorie `many` que l'anglais
//    n'a PAS (CLDR). Recopier les suffixes français en anglais produit des
//    clés mortes, et en oublier un produit un repli silencieux.
//
// 3. `es` FIGURE DANS `route-slugs.json` sans être servie ni indexable. Une
//    langue à moitié déclarée est une invitation à publier une page vide.
//
// ── CE QUE CETTE GARDE FAIT ─────────────────────────────────────────
//
// Elle est en DEUX MOITIÉS, et elles n'ont pas les mêmes prérequis :
//   · les PLURIELS et les LOCALES DÉCLARÉES se lisent dans les catalogues,
//     donc sur chaque PR, sans build ;
//   · le VOLUME se lit dans `dist/`, donc après `npm run build`. Passer
//     `--pages` le demande ; sans l'option, la garde le DIT au lieu de
//     laisser croire qu'elle a tout regardé.
//
// ❌ NE JAMAIS BAISSER UN PLANCHER DE VOLUME. Une page qui maigrit est soit
//    une traduction perdue, soit une décision éditoriale — et une décision
//    éditoriale se recale explicitement, par `--update`.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RACINE = process.cwd();
const DIST = join(RACINE, 'dist');
const LOCALES_DIR = join(RACINE, 'src', 'locales');
const PLANCHERS = join(RACINE, 'scripts', 'i18n-pages-floor.json');

/** Les locales réellement SERVIES et indexables. */
const LOCALES_SERVIES = ['fr', 'en'];

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
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Toutes les pages prérendues : chemin → nombre de mots indexables. */
export function volumesParPage(dist = DIST) {
  const out = new Map();
  const marcher = (rep) => {
    for (const entree of readdirSync(rep)) {
      if (['assets', 'fonts', 'screenshots', 'downloads'].includes(entree)) continue;
      const chemin = join(rep, entree);
      if (statSync(chemin).isDirectory()) marcher(chemin);
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
 * déjà elle que `prerender.mjs` utilise : on ne recrée pas une seconde table.
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

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const erreurs = [];
  const avecPages = process.argv.includes('--pages');

  // ═══ MOITIÉ 1 · les catalogues ═══════════════════════════════════
  const cats = Object.fromEntries(LOCALES_SERVIES.map((l) => [l, catalogue(l)]));
  const fr = cats.fr;
  const en = cats.en;

  // 🔴 Anti-« garde qui répond sans mesurer ».
  if (Object.keys(fr).length < 500) {
    erreurs.push(`Seulement ${Object.keys(fr).length} clé(s) lue(s) en fr : la lecture est cassée.`);
  }

  const plurielsFr = grouperPluriels(fr);
  const plurielsEn = grouperPluriels(en);
  const attenduFr = categoriesAttendues('fr');
  const attenduEn = categoriesAttendues('en');

  const manquants = [];
  const morts = [];
  for (const [racine, formesFr] of plurielsFr) {
    const formesEn = plurielsEn.get(racine);
    if (!formesEn) {
      manquants.push(`${racine} : aucune forme plurielle en \`en\``);
      continue;
    }
    for (const cat of attenduEn) {
      if (!formesEn.has(cat)) manquants.push(`${racine}_${cat} : absent de \`en\``);
    }
    for (const cat of formesEn) {
      // 🔴 `many` recopié du français en anglais : une clé MORTE, que
      // `Intl.PluralRules('en')` ne demandera jamais. Elle donne l'illusion
      // d'une traduction complète tout en n'étant jamais affichée.
      if (!attenduEn.has(cat)) morts.push(`${racine}_${cat} : \`en\` n'a pas la catégorie \`${cat}\``);
    }
  }
  for (const [racine, formesFr] of plurielsFr) {
    for (const cat of attenduFr) {
      if (!formesFr.has(cat)) manquants.push(`${racine}_${cat} : absent de \`fr\` (référence)`);
    }
  }

  console.log('i18n · pluriels');
  console.log(`  racines plurielles fr : ${plurielsFr.size}`);
  console.log(`  racines plurielles en : ${plurielsEn.size}`);
  console.log(`  catégories CLDR       : fr {${[...attenduFr].join(',')}} · en {${[...attenduEn].join(',')}}`);

  if (manquants.length > 0) {
    erreurs.push(
      `${manquants.length} forme(s) plurielle(s) MANQUANTE(S) :\n`
        + manquants.slice(0, 20).map((m) => `      ${m}`).join('\n')
        + (manquants.length > 20 ? `\n      … et ${manquants.length - 20} autre(s)` : '')
        + '\n    Le moteur retombe clé par clé sur le français : une forme manquante\n'
        + "    affiche une phrase FRANÇAISE dans l'interface anglaise, sans jamais\n"
        + '    ressembler à une clé brute.',
    );
  }
  if (morts.length > 0) {
    erreurs.push(
      `${morts.length} forme(s) plurielle(s) MORTE(S) en \`en\` :\n`
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
        + '   universel fr/en/es). ⚠️ Tant que c est le cas, ne JAMAIS poser de\n'
        + '   `hreflang` vers ces slugs : on annoncerait à Google une page qui\n'
        + "   n'existe pas.",
    );
    const catFantome = catalogue(fantomes[0]);
    if (Object.keys(catFantome).length > 0) {
      erreurs.push(
        `La locale \`${fantomes[0]}\` a un CATALOGUE (${Object.keys(catFantome).length} clés) `
          + "et n'est pas servie : soit elle s'ouvre, soit elle s'enlève. Un entre-deux "
          + 'se traduit à moitié et se périme entièrement.',
      );
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

    const planchers = existsSync(PLANCHERS) ? JSON.parse(readFileSync(PLANCHERS, 'utf8')) : null;

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
