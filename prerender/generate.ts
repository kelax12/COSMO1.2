// Génération et écriture des pages : une par (route × locale publiée), puis la
// home, qui porte en plus son FAQPage.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from '@/i18n/locale';
import { localizePath } from '../src/i18n/seo-urls.mjs';
import { DIST } from './config.ts';
import { closeContentCopy, injectContentCopy, injectHeroCopy } from './copies.ts';
import { faqSchemaFor, ld } from './ld.ts';
import { availableLocales, buildPage } from './page.ts';
import { HOME_ROUTE, ROUTES } from './routes.ts';
import { verifierPage } from './verify.ts';
import type { Route } from './types.ts';

/** Ajoute la copie peinte avant React qui convient à la route. */
async function withCopy(page: string, route: Route, locale: Locale, path: string): Promise<string> {
  if (route.heroTrack) return injectHeroCopy(page, locale, route.heroTrack);
  if (route.copy) return injectContentCopy(page, locale, route.copy, path);
  return page;
}

/** Écrit `dist/<chemin>/index.html` pour chaque route et chaque locale publiée. Retourne le nombre de pages. */
export async function generateRoutes(html: string): Promise<number> {
  let count = 0;
  for (const route of ROUTES) {
    const alternates = availableLocales(route);
    if (alternates.length === 0) {
      console.warn(`  ⚠ ${route.path}, aucune locale complète (méta + contenu), route ignorée`);
      continue;
    }
    for (const locale of alternates) {
      const path = localizePath(route.path, locale);
      const dir = join(DIST, path);
      mkdirSync(dir, { recursive: true });
      const sortie = await withCopy(buildPage(html, route, locale, alternates), route, locale, path);
      verifierPage(sortie, path, route.path);
      writeFileSync(join(dir, 'index.html'), sortie, 'utf8');
      count++;
      console.log(`  prerendered ${path}/index.html`);
    }
  }
  // Le serveur Vite du rendu des copies ne sert plus.
  await closeContentCopy();
  return count;
}

/**
 * La home est publiée dans chaque locale qui a un corps écrit, et son FAQPage
 * suit la locale de la page : un balisage français sur une page anglaise
 * ferait diverger le schéma et le contenu visible.
 */
export function generateHome(html: string): void {
  const alternates = availableLocales(HOME_ROUTE);
  for (const locale of alternates) {
    let home = injectHeroCopy(buildPage(html, HOME_ROUTE, locale, alternates), locale, 'perso');
    if (!home.includes('"FAQPage"')) {
      home = home.replace('</head>', `    ${ld(faqSchemaFor(locale), 'faq-schema')}\n  </head>`);
      console.log(`  injected FAQPage JSON-LD (${locale}) into index.html`);
    }
    verifierPage(home, localizePath('/', locale), '/');
    writeFileSync(join(DIST, localizePath('/', locale), 'index.html'), home, 'utf8');
  }
}
