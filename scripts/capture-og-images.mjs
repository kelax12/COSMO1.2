/**
 * capture-og-images.mjs · une image Open Graph PAR PAGE prérendue.
 *
 * Avant le 2026-10-12, les 40 pages du sitemap partageaient `og-card.png` :
 * un article partagé sur LinkedIn ou Slack montrait la vignette de l'accueil,
 * en français, y compris pour une page anglaise. Ce script rend une carte
 * 1200×630 par page, titre de la page incrusté, dans la charte d'og-card.
 *
 * Usage : `npm run build` puis `node scripts/capture-og-images.mjs`.
 * Il lit les titres dans `dist/` (la source de vérité est donc le catalogue
 * `seo` et les articles, via le prérendu) et écrit `public/og/<clé>.jpg`.
 * JPEG et pas PNG : les dégradés pèsent ~180 ko en PNG, ~40 ko en JPEG.
 * Les PNG sont COMMITÉES : le build Vercel n'a pas de navigateur. Le prérendu
 * branche une image si elle existe et retombe sur og-card sinon, donc une page
 * ajoutée sans relancer ce script garde une vignette, juste générique.
 *
 * ⚠️ La clé doit rester celle d'`ogKey()` dans prerender.mjs.
 * L'accueil français garde og-card.png, dessinée à la main.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'public', 'og');
const ORIGIN = 'https://thecosmo.app';

export const ogKey = (path) => path.replace(/^\/+|\/+$/g, '').replace(/\//g, '_') || 'home';

const unescape = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Étiquette de rubrique, d'après le chemin. */
function section(path, en) {
  const p = path.replace(/^\/en(?=\/|$)/, '') || '/';
  if (p.startsWith('/blog')) return 'Blog';
  if (p === '/guide') return en ? 'User guide' : "Guide d'utilisation";
  if (/^\/(a-propos|about)$/.test(p)) return en ? 'About' : 'À propos';
  if (/^\/(entreprise-presentation|for-companies)$/.test(p)) return en ? 'For companies' : 'Entreprise';
  if (/^\/(pour|for)-/.test(p)) return en ? 'Use case' : "Cas d'usage";
  return en ? 'Productivity app' : 'Application de productivité';
}

function pagesFromSitemap() {
  const xml = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return urls
    .map((u) => new URL(u).pathname)
    .filter((p) => p !== '/')
    .map((path) => {
      const file = join(DIST, path, 'index.html');
      if (!existsSync(file)) throw new Error(`page du sitemap absente de dist/ : ${path}`);
      const html = readFileSync(file, 'utf8');
      const m = html.match(/<meta property="og:title" content="([^"]*)"/);
      if (!m) throw new Error(`og:title introuvable : ${path}`);
      const en = /^\/en(\/|$)/.test(path);
      // « | Cosmo » double le logo de la carte.
      const title = unescape(m[1]).replace(/\s*\|\s*Cosmo$/, '');
      return { path, key: ogKey(path), title, en };
    });
}

const fontData = readFileSync(join(ROOT, 'public', 'fonts', 'inter-var-latin.woff2')).toString('base64');
const fontExt = readFileSync(join(ROOT, 'public', 'fonts', 'inter-var-latin-ext.woff2')).toString('base64');

function card({ title, path, en }) {
  // Taille du titre selon sa longueur : un titre de 70 caractères doit tenir
  // sur trois lignes sans déborder sur le pied de carte.
  const size = title.length > 60 ? 58 : title.length > 42 ? 66 : 76;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${fontData}) format('woff2');font-weight:100 900;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215}
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${fontExt}) format('woff2');font-weight:100 900}
*{margin:0;box-sizing:border-box}
html,body{width:1200px;height:630px}
body{font-family:Inter,sans-serif;color:#f8fafc;background:radial-gradient(1000px 600px at 0% 0%,#1e2a4a 0%,transparent 60%),radial-gradient(800px 500px at 100% 100%,#2a1f4a 0%,transparent 60%),#0f172a;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid #1e293b}
.top{display:flex;align-items:center;gap:20px}
.logo{width:64px;height:64px;border-radius:16px;background:#1e40af;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:34px}
.brand{font-size:40px;font-weight:800;letter-spacing:-0.02em}
.pill{margin-left:auto;padding:10px 22px;border-radius:999px;font-size:22px;font-weight:600;color:#93c5fd;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.35)}
h1{font-size:${size}px;line-height:1.12;font-weight:800;letter-spacing:-0.025em;max-width:1040px;background:linear-gradient(90deg,#93c5fd,#c4b5fd 55%,#f9a8d4);-webkit-background-clip:text;background-clip:text;color:transparent;padding-bottom:6px}
.foot{display:flex;justify-content:space-between;align-items:center;font-size:24px;color:#94a3b8}
.foot b{color:#e2e8f0;font-weight:600}
</style></head><body>
<div class="top"><div class="logo">C</div><div class="brand">Cosmo</div><div class="pill">${escapeHtml(section(path, en))}</div></div>
<h1>${escapeHtml(title)}</h1>
<div class="foot"><span>${en ? 'Tasks · Habits · Calendar · OKRs' : 'Tâches · Habitudes · Agenda · OKR'}</span><b>${ORIGIN.replace('https://', '')}</b></div>
</body></html>`;
}

async function main() {
  const pages = pagesFromSitemap();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const p of pages) {
    await page.setContent(card(p), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(OUT, `${p.key}.jpg`), type: 'jpeg', quality: 85 });
    console.log(`  og/${p.key}.jpg  ${p.title}`);
  }
  await browser.close();
  console.log(`✓ ${pages.length} images OG écrites dans public/og/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
