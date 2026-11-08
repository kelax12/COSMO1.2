// Sitemap : `lastmod` = date de CONTENU, et une entrée par (chemin × locale
// publiée), chacune portant les `xhtml:link` de TOUTES les versions du groupe,
// elle-même comprise. Google exige cette réciprocité dans le sitemap comme dans
// le <head> : un groupe déclaré à sens unique est ignoré en entier, en silence.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from '@/i18n/locale';
import { ARTICLES } from '../src/content/blog/index.mjs';
import { USE_CASES } from '../src/content/use-cases.mjs';
import { DEFAULT_LOCALE, canonicalUrl, routeSlug, sitemapAlternates } from '../src/i18n/seo-urls.mjs';
import { CONTENT_LASTMOD, DIST } from './config.ts';
import { availableLocales } from './page.ts';
import { HOME_ROUTE, ROUTES } from './routes.ts';

/** La date de l'index du blog est celle de son article le plus récemment modifié. */
const BLOG_LASTMOD = ARTICLES.reduce((max: string, a) => (a.dateModified > max ? a.dateModified : max), '');

const sitemapEntry = (path: string, locale: Locale, alternates: Locale[], lastmod: string, changefreq: string, priority: string): string => {
  const alt = sitemapAlternates(path, alternates);
  return (
    `  <url>\n    <loc>${canonicalUrl(path, locale)}</loc>\n` +
    (alt ? `${alt}\n` : '') +
    `    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`
  );
};

/** Développe un chemin sur toutes ses locales publiées. */
const sitemapGroup = (path: string, alternates: Locale[], lastmod: string, changefreq: string, priority: string): string =>
  alternates.map((locale) => sitemapEntry(path, locale, alternates, lastmod, changefreq, priority)).join('');

const localesOf = (routePath: string): Locale[] => {
  const route = ROUTES.find((r) => r.path === routePath);
  return route ? availableLocales(route) : [DEFAULT_LOCALE];
};

/**
 * Les URLs générées. La home et le guide passent par `sitemapGroup` comme les
 * autres, et non par le socle `public/sitemap.xml`, qui ne sait porter qu'une
 * URL par page : il ne pourrait ni émettre `/en/…`, ni porter les `xhtml:link`
 * réciproques.
 */
function generatedUrls(): string {
  return (
    sitemapGroup('/', availableLocales(HOME_ROUTE), CONTENT_LASTMOD['/'], 'weekly', '1.0') +
    sitemapGroup('/guide', localesOf('/guide'), CONTENT_LASTMOD['/guide'], 'monthly', '0.8') +
    // Priorité 0.9 : c'est la page qui porte l'offre payante, juste sous la home.
    sitemapGroup('/entreprise-presentation', localesOf('/entreprise-presentation'), CONTENT_LASTMOD['/entreprise-presentation'], 'monthly', '0.9') +
    sitemapGroup('/a-propos', localesOf('/a-propos'), CONTENT_LASTMOD['/a-propos'], 'yearly', '0.5') +
    // L'index du blog change quand un article change : sa date EST la plus
    // récente des `dateModified` du registre.
    sitemapGroup('/blog', localesOf('/blog'), BLOG_LASTMOD, 'weekly', '0.8') +
    ARTICLES.map((a) => sitemapGroup(`/blog/${a.slug}`, localesOf(`/blog/${a.slug}`), a.dateModified, 'monthly', '0.7')).join('') +
    USE_CASES.map((u) => {
      const path = `/${routeSlug(u.routeId, DEFAULT_LOCALE)}`;
      return sitemapGroup(path, localesOf(path), u.dateModified, 'monthly', '0.7');
    }).join('')
  );
}

/** Enrichit `dist/sitemap.xml` (copie du socle public/) ; un échec n'arrête pas le build. */
export function enrichSitemap(): void {
  const sitemapPath = join(DIST, 'sitemap.xml');
  try {
    let sitemap = readFileSync(sitemapPath, 'utf8');
    // Déclaration du namespace xhtml, requise dès qu'on émet des `xhtml:link`.
    if (!sitemap.includes('xmlns:xhtml')) {
      sitemap = sitemap.replace(/<urlset([^>]*)>/, '<urlset$1 xmlns:xhtml="http://www.w3.org/1999/xhtml">');
    }
    const generated = generatedUrls();
    sitemap = sitemap.replace('</urlset>', `${generated}</urlset>`);
    writeFileSync(sitemapPath, sitemap, 'utf8');
    const urlCount = (generated.match(/<loc>/g) ?? []).length;
    console.log(`  sitemap → ${urlCount} URLs générées (blog, à-propos, use-cases), lastmod = dates de contenu`);
  } catch (err) {
    console.warn(`  ⚠ dist/sitemap.xml non enrichi, ${(err as Error).message}`);
  }
}
