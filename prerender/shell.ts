// La coquille de départ : `dist/index.html` fraîchement buildé (donc avec les
// bons hash d'assets), et `dist/app.html`, la coquille VIERGE de l'application.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTENT_LASTMOD, DIST } from './config.ts';

/** Lit `dist/index.html` et fixe le `dateModified` des JSON-LD globaux. */
export function readIndexHtml(): string {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  return html.replace(/"dateModified":\s*"[\d-]+"/g, `"dateModified": "${CONTENT_LASTMOD.site}"`);
}

const ROBOTS_INDEX = /<meta name="robots" content="index[^"]*" \/>/;
const CANONICAL_HOME = /<link rel="canonical" href="https:\/\/thecosmo\.app\/" \/>/;

/**
 * Coquille VIERGE de l'application, servie par le rewrite SPA de vercel.json à
 * toute URL sans fichier prérendu (/dashboard, /tasks…). Chaque page prérendue
 * porte `data-prerendered` sur <html> et SEULE elle peint son contenu (cf. le
 * <style> d'index.html) ; app.html garde le spinner.
 *
 * Elle sort en `noindex` et SANS cible de canonical : copie brute d'index.html,
 * elle déclarerait toute URL inconnue indexable et canonique de `/`, soit un
 * soft-404. Le <link> reste (sans href, donc ignoré des moteurs) parce que
 * `setCanonical()` de useSeoMeta en modifie un existant et n'en crée pas.
 */
export function writeAppShell(html: string): void {
  if (!ROBOTS_INDEX.test(html) || !CANONICAL_HOME.test(html)) {
    throw new Error('prerender: robots/canonical introuvables dans index.html, app.html resterait indexable');
  }
  const appShell = html
    .replace(ROBOTS_INDEX, '<meta name="robots" content="noindex" />')
    .replace(CANONICAL_HOME, '<link rel="canonical" />');
  writeFileSync(join(DIST, 'app.html'), appShell, 'utf8');
}
