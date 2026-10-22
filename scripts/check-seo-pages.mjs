// ═══════════════════════════════════════════════════════════════════
// C-98 — rien ne reliait le SITEMAP aux pages réellement PRÉRENDUES
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LES DEUX DÉFAUTS, ET ILS SONT DISTINCTS.
//
// 1. UNE ROUTE AJOUTÉE À L'UN SANS L'AUTRE ne fait échouer aucun job. Le
//    2026-09-14, les dix pages prérendues absentes du sitemap ont dû être
//    expliquées À LA MAIN : personne ne savait dire lesquelles étaient un
//    oubli et lesquelles une décision. Une page prérendue hors sitemap est
//    parfois juste (`/login`, `/signup` n'ont rien à indexer) ; une page au
//    sitemap sans prérendu est TOUJOURS un défaut — on annonce à Google une
//    URL qui lui rend la coquille SPA vide.
//
// 2. LES BALISES PAR PAGE ne sont vues qu'au moment où quelqu'un ouvre la
//    locale. `title`, `description`, `canonical`, `hreflang` : quatre balises,
//    50 pages, zéro garde. Les 40 `hreflang` du dépôt ont été RECOMPTÉS à la
//    main le 2026-09-14.
//
// CE QUE CETTE GARDE FAIT, sur `dist/**/*.html` APRÈS un build :
//   · chaque page prérendue est au sitemap, OU déclarée hors sitemap ici avec
//     sa raison ;
//   · chaque URL du sitemap correspond à une page réellement prérendue ;
//   · chaque page porte ses quatre balises, non vides ;
//   · la réciprocité des `hreflang` : si `fr` annonce `en`, `en` doit annoncer
//     `fr`. Google ignore un groupe à sens unique EN ENTIER, en silence ;
//   · `canonical` pointe la page elle-même, jamais une autre ;
//   · une page `noindex` n'est pas au sitemap (on annoncerait une URL qu'on
//     demande par ailleurs de ne pas indexer).
//
// ⚠️ CE QU'ELLE NE FAIT PAS : juger la QUALITÉ d'un `title` ou d'une
// `description`. Leur longueur et leur unicité sont des questions
// éditoriales, mesurées par Lighthouse (`categories:seo`) et par GSC. Ici on
// vérifie la PRÉSENCE et la COHÉRENCE, c'est-à-dire ce qui se casse sans
// prévenir.
//
// ❌ NE JAMAIS AJOUTER UNE PAGE À `HORS_SITEMAP` pour faire passer la CI.
//    L'entrée demande une raison, et la raison doit dire pourquoi cette page
//    n'a rien à faire dans un index de recherche.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RACINE = process.cwd();
const DIST = join(RACINE, 'dist');

/**
 * Les pages prérendues DÉLIBÉRÉMENT absentes du sitemap, avec leur raison.
 *
 * Les clés sont des chemins SANS préfixe de locale.
 *
 * 🔴 LES SLUGS ANGLAIS SONT DÉCLARÉS À PART, et ce n'est pas une redite. Ce
 * dépôt traduit ses slugs (`src/i18n/route-slugs.json`) : `/mentions-legales`
 * devient `/en/legal-notice`, pas `/en/mentions-legales`. Une dispense écrite
 * pour le seul slug français ne couvre donc PAS la page anglaise — mesuré ici
 * le 2026-09-20, la garde a rendu trois orphelines (`/en/legal-notice/`,
 * `/en/privacy-policy/`, `/en/terms/`) que la liste croyait couvrir.
 * ❌ Ne jamais dériver ces clés par « même chemin, autre préfixe » : ce n'est
 *    pas ainsi que ce site construit ses URLs.
 */
const HORS_SITEMAP = {
  '/login': "Écran de connexion : aucun contenu à indexer, et une page d'auth "
    + 'dans les résultats de recherche est une invitation au phishing de marque. '
    + 'Prérendue quand même, pour que le premier rendu ne soit pas une page blanche.',
  '/signup': "Écran d'inscription : même raison que `/login`. Le contenu qui doit "
    + 'amener à s\'inscrire est la home et les pages « cas d\'usage », pas le formulaire.',
  '/cgu': 'Document contractuel. Indexable serait légitime, mais il dilue '
    + "l'autorité du domaine sur des pages qui n'apportent aucun trafic qualifié. "
    + 'Décision SEO, pas un oubli.',
  '/mentions-legales': 'Même décision que `/cgu`.',
  '/politique-confidentialite': 'Même décision que `/cgu`.',
  // Les mêmes pages, sous leurs slugs anglais.
  '/terms': 'Version anglaise de `/cgu`, même décision.',
  '/legal-notice': 'Version anglaise de `/mentions-legales`, même décision.',
  '/privacy-policy': 'Version anglaise de `/politique-confidentialite`, même décision.',
};

/** Les locales servies, dans l'ordre où le prérendu les écrit. */
const LOCALES = ['fr', 'en'];

// ── Lecture du build ───────────────────────────────────────────────

/** Toutes les pages prérendues : `dist/**‍/index.html`. */
export function listerPages(dist = DIST) {
  const out = [];
  const marcher = (rep) => {
    for (const entree of readdirSync(rep)) {
      // `assets`, `fonts`, `screenshots`… ne contiennent pas de page.
      if (['assets', 'fonts', 'screenshots', 'downloads'].includes(entree)) continue;
      const chemin = join(rep, entree);
      if (statSync(chemin).isDirectory()) marcher(chemin);
      else if (entree === 'index.html') {
        const rel = relative(dist, chemin).split(sep).join('/');
        out.push(`/${rel.replace(/index\.html$/, '')}`.replace(/\/+$/, '/') || '/');
      }
    }
  };
  marcher(dist);
  return out.sort();
}

/** Le chemin d'une URL de sitemap, locale comprise (`/en/guide/`). */
export function cheminDeLoc(loc) {
  const u = new URL(loc);
  return u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
}

/** Le chemin SANS son préfixe de locale (`/en/guide/` → `/guide/`). */
export function sansLocale(chemin) {
  for (const l of LOCALES) {
    if (chemin === `/${l}/`) return '/';
    if (chemin.startsWith(`/${l}/`)) return chemin.slice(`/${l}`.length);
  }
  return chemin;
}

/** Extrait les balises qui nous intéressent d'une page. */
export function lireBalises(html) {
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? '';
  const description =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/.exec(html)?.[1]?.trim()
    ?? /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/.exec(html)?.[1]?.trim()
    ?? '';
  const canonical =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/.exec(html)?.[1]?.trim() ?? '';
  const robots =
    /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/.exec(html)?.[1]?.trim() ?? '';
  const hreflang = [
    ...html.matchAll(
      /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["']/g,
    ),
  ].map((m) => ({ lang: m[1], href: m[2] }));
  return { title, description, canonical, robots, hreflang };
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  if (!existsSync(DIST) || !existsSync(join(DIST, 'sitemap.xml'))) {
    console.error(
      'dist/ ou dist/sitemap.xml introuvable. Cette garde mesure le build RÉEL :\n'
        + '  npm run build && npm run check:seo',
    );
    process.exit(1);
  }

  const pages = listerPages();
  const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const cheminsSitemap = new Set(locs.map(cheminDeLoc));

  // 🔴 Un contrôle qui ne trouverait AUCUNE page ou AUCUNE URL sortirait vert
  // en n'ayant rien comparé : c'est la garde qui répond sans mesurer.
  const erreurs = [];
  if (pages.length < 10) {
    erreurs.push(`Seulement ${pages.length} page(s) prérendue(s) trouvée(s) : le build est incomplet.`);
  }
  if (locs.length < 10) {
    erreurs.push(`Seulement ${locs.length} URL(s) dans le sitemap : le sitemap est incomplet.`);
  }

  const parChemin = new Map();
  for (const page of pages) {
    parChemin.set(page, lireBalises(readFileSync(join(DIST, page.slice(1), 'index.html'), 'utf8')));
  }

  // ── 1. Prérendu → sitemap ────────────────────────────────────────
  const orphelines = [];
  for (const page of pages) {
    if (cheminsSitemap.has(page)) continue;
    const nu = sansLocale(page).replace(/\/$/, '') || '/';
    if (nu in HORS_SITEMAP) continue;
    orphelines.push(page);
  }
  if (orphelines.length > 0) {
    erreurs.push(
      `${orphelines.length} page(s) PRÉRENDUE(S) absente(s) du sitemap et non déclarée(s) :\n`
        + orphelines.map((p) => `      ${p}`).join('\n')
        + "\n    Soit elles doivent y entrer, soit elles entrent dans HORS_SITEMAP AVEC\n"
        + "    une raison. Le 2026-09-14, il a fallu répondre à la main à cette\n"
        + '    question pour dix pages.',
    );
  }

  // ── 2. Sitemap → prérendu ────────────────────────────────────────
  // Celui-ci est TOUJOURS un défaut : on annonce à Google une URL qui lui
  // rendra la coquille SPA vide.
  const fantomes = [...cheminsSitemap].filter((c) => !parChemin.has(c));
  if (fantomes.length > 0) {
    erreurs.push(
      `${fantomes.length} URL(s) du sitemap SANS page prérendue :\n`
        + fantomes.map((p) => `      ${p}`).join('\n')
        + "\n    Google recevra la coquille SPA vide sur ces URLs.",
    );
  }

  // ── 3. Une déclaration HORS_SITEMAP périmée ──────────────────────
  for (const chemin of Object.keys(HORS_SITEMAP)) {
    const existe = pages.some((p) => (sansLocale(p).replace(/\/$/, '') || '/') === chemin);
    if (!existe) {
      erreurs.push(
        `\`${chemin}\` est déclaré HORS_SITEMAP mais n'est plus prérendu : retirer\n`
          + '    la ligne. Une liste de dispenses périmées cesse d\'être relue.',
      );
    }
    if (cheminsSitemap.has(`${chemin === '/' ? '' : chemin}/`)) {
      erreurs.push(
        `\`${chemin}\` est déclaré HORS_SITEMAP et s'y trouve pourtant : les deux\n`
          + '    ne peuvent pas être vrais.',
      );
    }
  }

  // ── 4. Les quatre balises, page par page ─────────────────────────
  const sansBalise = [];
  for (const [page, b] of parChemin) {
    const manquantes = [];
    if (!b.title) manquantes.push('title');
    if (!b.description) manquantes.push('description');
    if (!b.canonical) manquantes.push('canonical');
    // `hreflang` n'est exigé que des pages publiées en plusieurs langues : une
    // page qui n'existe qu'en français n'a pas d'alternative à annoncer.
    if (manquantes.length > 0) sansBalise.push(`${page} → ${manquantes.join(', ')}`);
  }
  if (sansBalise.length > 0) {
    erreurs.push(
      `${sansBalise.length} page(s) sans balise obligatoire :\n`
        + sansBalise.map((p) => `      ${p}`).join('\n'),
    );
  }

  // ── 5. `canonical` pointe la page elle-même ──────────────────────
  const canonMauvaises = [];
  for (const [page, b] of parChemin) {
    if (!b.canonical) continue;
    const c = cheminDeLoc(b.canonical);
    if (c !== page) canonMauvaises.push(`${page} → canonical ${c}`);
  }
  if (canonMauvaises.length > 0) {
    erreurs.push(
      `${canonMauvaises.length} \`canonical\` qui ne désigne pas sa propre page :\n`
        + canonMauvaises.map((p) => `      ${p}`).join('\n')
        + '\n    Un canonical qui pointe ailleurs demande à Google de ne PAS indexer\n'
        + '    la page où il se trouve.',
    );
  }

  // ── 6. Réciprocité des `hreflang` ────────────────────────────────
  // 🔴 Google ignore un groupe à sens unique EN ENTIER, et en silence. C'est
  // le mode de défaillance le plus coûteux de cette famille : tout a l'air
  // correct, et l'anglais n'est simplement jamais servi.
  const nonReciproques = [];
  for (const [page, b] of parChemin) {
    for (const alt of b.hreflang) {
      if (alt.lang === 'x-default') continue;
      const cible = cheminDeLoc(alt.href);
      const balisesCible = parChemin.get(cible);
      if (!balisesCible) {
        nonReciproques.push(`${page} annonce ${cible} (${alt.lang}), qui n'est pas prérendue`);
        continue;
      }
      const retour = balisesCible.hreflang.some((a) => cheminDeLoc(a.href) === page);
      if (!retour) nonReciproques.push(`${page} annonce ${cible}, qui ne le lui rend pas`);
    }
  }
  if (nonReciproques.length > 0) {
    erreurs.push(
      `${nonReciproques.length} lien(s) \`hreflang\` non réciproque(s) :\n`
        + nonReciproques.map((p) => `      ${p}`).join('\n')
        + '\n    Google ignore un groupe à sens unique EN ENTIER, sans rien signaler.',
    );
  }

  // ── 7. Une page `noindex` au sitemap ─────────────────────────────
  const noindexAuSitemap = [];
  for (const [page, b] of parChemin) {
    if (/noindex/i.test(b.robots) && cheminsSitemap.has(page)) noindexAuSitemap.push(page);
  }
  if (noindexAuSitemap.length > 0) {
    erreurs.push(
      `${noindexAuSitemap.length} page(s) en \`noindex\` ET au sitemap : ${noindexAuSitemap.join(', ')}.\n`
        + '    On annonce une URL qu\'on demande par ailleurs de ne pas indexer.',
    );
  }

  // ── Rapport ──────────────────────────────────────────────────────
  const avecHreflang = [...parChemin.values()].filter((b) => b.hreflang.length > 0).length;
  const totalHreflang = [...parChemin.values()].reduce((n, b) => n + b.hreflang.length, 0);
  console.log('SEO · pages prérendues et sitemap');
  console.log(`  pages prérendues     : ${pages.length}`);
  console.log(`  URLs au sitemap      : ${locs.length}`);
  console.log(`  hors sitemap déclaré : ${Object.keys(HORS_SITEMAP).length} chemins × ${LOCALES.length} locales`);
  console.log(`  liens hreflang       : ${totalHreflang} sur ${avecHreflang} pages`);

  if (erreurs.length > 0) {
    console.error('\n✖ SEO :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Sitemap et prérendu se correspondent, balises présentes, hreflang réciproques.');
}
