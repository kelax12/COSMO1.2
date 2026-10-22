import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTICLES, articleLocales } from './content/blog/index.mjs';
import { isSupportedLocale } from './i18n/locale';
import { localizePath } from './i18n/routes';

// Image Open Graph par page (2026-10-12).
//
// `prerender.mjs` retombe sur og-card.png quand `public/og/<clé>.jpg` manque :
// le site ne casse pas, mais un article neuf repartirait avec la vignette de
// l'accueil, ce que cette passe a corrigé. Cette garde rend l'oubli visible
// pour les ARTICLES, la seule famille de pages qui grossit au fil de l'eau.
// Correctif quand elle rougit : `npm run build` puis
// `node scripts/capture-og-images.mjs`, et commiter `public/og/`.

const ROOT = join(__dirname, '..');
const prerender = readFileSync(join(ROOT, 'prerender.mjs'), 'utf8');
const script = readFileSync(join(ROOT, 'scripts', 'capture-og-images.mjs'), 'utf8');

const ogKey = (path: string) => path.replace(/^\/+|\/+$/g, '').replace(/\//g, '_') || 'home';

describe('images Open Graph par page', () => {
  it('le prérendu et le script calculent la MÊME clé de fichier', () => {
    const KEY = "path.replace(/^\\/+|\\/+$/g, '').replace(/\\//g, '_') || 'home'";
    expect(prerender).toContain(KEY);
    expect(script).toContain(KEY);
  });

  it('chaque article publié a sa vignette, dans chaque langue indexable', () => {
    const missing: string[] = [];
    for (const article of ARTICLES) {
      for (const locale of articleLocales(article)) {
        if (!isSupportedLocale(locale)) continue;
        const key = ogKey(localizePath(`/blog/${article.slug}`, locale));
        if (!existsSync(join(ROOT, 'public', 'og', `${key}.jpg`))) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });
});
