// Prérendu statique des routes publiques (SEO). Point d'entrée de `npm run build`.
//
// L'app est une SPA Vite (rendu client). Les crawlers sociaux (Facebook,
// LinkedIn, X) n'exécutent PAS le JS : sans ce prérendu, un partage de /guide ou
// /signup afficherait toujours les méta de la home. Googlebot rend le JS mais
// avec délai.
//
// Il lit le dist/index.html FRAÎCHEMENT buildé (donc avec les bons hash
// d'assets), le clone pour chaque route publique en réécrivant le <head> (title,
// description, canonical, OG, Twitter, hreflang) + le JSON-LD de la route + un
// contenu indexable, puis écrit dist/<route>/index.html. Vercel sert ces
// fichiers statiques avant le rewrite SPA. Aucun navigateur au build.
//
// Exécuté par Node directement sur le TypeScript (suppression native des types) :
// node prerender/main.ts. Découpage : docs/SEO.md § Prérendu.
import { verifierLocalesIndexables } from './chrome.ts';
import { enrichLlms, writeRss } from './feeds.ts';
import { generateHome, generateRoutes } from './generate.ts';
import { enrichSitemap } from './sitemap.ts';
import { readIndexHtml, writeAppShell } from './shell.ts';

verifierLocalesIndexables();

const html = readIndexHtml();
writeAppShell(html);

const count = await generateRoutes(html);
generateHome(html);
enrichSitemap();
writeRss();
enrichLlms();

console.log(`✓ prerender done, ${count} routes + home (FAQ schema + contenu statique)`);
