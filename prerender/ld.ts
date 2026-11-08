// JSON-LD et images Open Graph : tout ce qui décrit une page aux moteurs.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from '@/i18n/locale';
import { BCP47_TAG, canonicalUrl, localizePath } from '../src/i18n/seo-urls.mjs';
import { HOME_LABEL } from './chrome.ts';
import { BASE, DIST, ROOT, seoFor } from './config.ts';
import { requis } from './types.ts';

/** Balise `<script type="application/ld+json">`, avec son `id` éventuel. */
export const ld = (obj: unknown, id?: string): string =>
  `<script type="application/ld+json"${id ? ` id="${id}"` : ''}>${JSON.stringify(obj)}</script>`;

/**
 * Image Open Graph par page. `scripts/capture-og-images.mjs` rend
 * `public/og/<clé>.jpg` (commitées : le build Vercel n'a pas de navigateur).
 * Une page sans image retombe sur og-card.png : jamais d'image cassée. La clé
 * doit rester celle d'`ogKey()` du script.
 */
const ogKey = (path: string): string => path.replace(/^\/+|\/+$/g, '').replace(/\//g, '_') || 'home';

export const ogImageFor = (path: string, locale: Locale): string => {
  const key = ogKey(localizePath(path, locale));
  return existsSync(join(DIST, 'og', `${key}.jpg`)) ? `${BASE}/og/${key}.jpg` : `${BASE}/og-card.png`;
};

/** Fil d'Ariane à deux niveaux : accueil, puis la page. */
export const breadcrumb = (name: string, path: string, locale: Locale) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: HOME_LABEL[locale], item: canonicalUrl('/', locale) },
    { '@type': 'ListItem', position: 2, name, item: canonicalUrl(path, locale) },
  ],
});

export const guideArticle = (locale: Locale) => {
  const meta = requis(seoFor('guide', locale), `méta du guide en « ${locale} »`);
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: meta.title,
    description: meta.description,
    image: ogImageFor('/guide', locale),
    url: canonicalUrl('/guide', locale),
    inLanguage: BCP47_TAG[locale],
    datePublished: '2025-01-01',
    dateModified: '2026-05-31',
    author: { '@type': 'Organization', name: 'Cosmo', url: BASE },
    publisher: { '@type': 'Organization', name: 'Cosmo', url: BASE },
    mainEntityOfPage: canonicalUrl('/guide', locale),
    articleSection: ['Prise en main', 'Tâches', 'Habitudes', 'Agenda', 'OKR', 'Statistiques'],
  };
};

/**
 * FAQPage de la home, LUE dans le catalogue que rend l'application
 * (`faq.q1…qN`), pas recopiée ici : deux copies avaient divergé, et Google
 * compare un balisage FAQPage au contenu visible. Le schéma suit la LOCALE de la
 * page, pour la même raison.
 */
export const faqSchemaFor = (locale: Locale) => {
  const catalog: Record<string, string> = JSON.parse(
    readFileSync(join(ROOT, 'src/locales', locale, 'landing.json'), 'utf8')
  ).faq;

  const items = Object.keys(catalog)
    .filter((key) => /^q\d+$/.test(key))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map((qKey) => [catalog[qKey], catalog[`a${qKey.slice(1)}`]] as const)
    .filter(([question, answer]) => question && answer);

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
};
