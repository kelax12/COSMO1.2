// Flux dérivés des registres : `rss.xml` (blog) et les sections générées de
// `llms.txt`. Tous deux restent dans la langue de référence.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTICLES, articlesFor } from '../src/content/blog/index.mjs';
import { USE_CASES } from '../src/content/use-cases.mjs';
import { DEFAULT_LOCALE, routeSlug } from '../src/i18n/seo-urls.mjs';
import { BASE, DIST, TODAY } from './config.ts';

const rfc822 = (d: string): string => new Date(`${d}T12:00:00Z`).toUTCString();

/**
 * Le flux reste FRANÇAIS, et c'est un choix, pas un oubli : un `<channel>` porte
 * UNE `<language>`, et un lecteur RSS ne négocie pas la langue. Ouvrir l'anglais
 * demanderait un second flux à son propre URL, déclaré par son propre
 * `<link rel="alternate">` : le jour où l'anglais a une audience.
 */
export function writeRss(): void {
  const rssItems = articlesFor(DEFAULT_LOCALE)
    .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1))
    .map(
      (a) =>
        `    <item>\n      <title><![CDATA[${a.title}]]></title>\n      <link>${BASE}/blog/${a.slug}</link>\n      <guid isPermaLink="true">${BASE}/blog/${a.slug}</guid>\n      <pubDate>${rfc822(a.datePublished)}</pubDate>\n      <description><![CDATA[${a.description}]]></description>\n    </item>`
    )
    .join('\n');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Cosmo, Productivité, OKR, habitudes et time-blocking</title>
    <link>${BASE}/blog</link>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Guides pratiques sur la méthode OKR, le suivi d'habitudes, le time-blocking et la productivité personnelle. Par l'équipe de Cosmo.</description>
    <language>fr-FR</language>
    <lastBuildDate>${rfc822(TODAY)}</lastBuildDate>
${rssItems}
  </channel>
</rss>
`;
  writeFileSync(join(DIST, 'rss.xml'), rss, 'utf8');
  console.log(`  rss.xml → ${rssItems.split('<item>').length - 1} articles (${DEFAULT_LOCALE})`);
}

/**
 * llms.txt décrit le site dans sa langue de référence : un même document ne peut
 * pas lister deux fois chaque page sans devenir illisible pour ce qu'il est, un
 * sommaire. Un fichier absent n'arrête pas le build.
 */
export function enrichLlms(): void {
  try {
    const llmsPath = join(DIST, 'llms.txt');
    const llms = readFileSync(llmsPath, 'utf8');
    const llmsGenerated =
      `\n## Articles du blog\n\n` +
      articlesFor(DEFAULT_LOCALE)
        .map((a) => `- [${a.title}](${BASE}/blog/${a.slug}) : ${a.description}`)
        .join('\n') +
      `\n\n## Cas d'usage\n\n` +
      USE_CASES.filter((u) => u.locales[DEFAULT_LOCALE])
        .map((u) => {
          const c = u.locales[DEFAULT_LOCALE];
          return `- [${c?.title}](${BASE}/${routeSlug(u.routeId, DEFAULT_LOCALE)}) : ${c?.description}`;
        })
        .join('\n') +
      `\n\n## Autres pages\n\n- [Blog](${BASE}/blog)\n- [À propos](${BASE}/a-propos)\n- [Flux RSS](${BASE}/rss.xml)\n`;
    writeFileSync(llmsPath, llms.trimEnd() + '\n' + llmsGenerated, 'utf8');
    console.log(`  llms.txt → +${ARTICLES.length} articles, +${USE_CASES.length} cas d'usage`);
  } catch {
    console.warn('  ⚠ dist/llms.txt introuvable, llms.txt non enrichi');
  }
}
