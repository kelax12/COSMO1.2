import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Régression : au refresh ou au moindre plantage au démarrage, l'utilisateur
// voyait le mur de texte SEO du prerender à la place d'un écran de chargement.
//
// Le contenu SEO est injecté par prerender.mjs DANS #root, où il reste peint
// tant que React n'a pas commité son premier render — donc pour toujours si le
// bundle 404 (chunk périmé après redéploiement) ou si le boot lève.
//
// Le masquage doit rester 100 % CSS. La CSP de vercel.json est
// `script-src 'self'`, sans 'unsafe-inline' ni nonce : un <script> inline est
// bloqué en prod alors qu'il passe en local (pas de CSP sur le serveur de dev).
// C'est le piège qui a fait échouer les correctifs précédents en silence.

const ROOT = join(__dirname, '..');
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
const prerender = readFileSync(join(ROOT, 'prerender.mjs'), 'utf8');

describe('écran de démarrage (index.html)', () => {
  it("n'utilise AUCUN <script> inline — la CSP `script-src 'self'` les bloque en prod", () => {
    // Les commentaires HTML parlent de <script> : on les retire avant de scanner.
    const markup = indexHtml.replace(/<!--[\s\S]*?-->/g, '');
    // Seuls les <script src=...> et les blocs JSON-LD (non exécutables) passent.
    const inlineScripts = [...markup.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter(
      (m) => !/type="application\/ld\+json"/.test(m[1])
    );
    expect(inlineScripts.map((m) => m[0])).toEqual([]);
  });

  it('rend un #boot-screen à l’intérieur de #root, effacé par React au premier render', () => {
    const root = indexHtml.match(/<div id="root">([\s\S]*?)<\/div>\s*<!--/);
    expect(root).not.toBeNull();
    expect(root![1]).toContain('id="boot-screen"');
  });

  it('masque le contenu SEO par défaut en CSS', () => {
    expect(indexHtml).toMatch(/#seo-fallback\{display:none/);
  });

  it('réaffiche le contenu SEO et retire le spinner quand le JS est coupé', () => {
    expect(indexHtml).toMatch(
      /<noscript>\s*<style>#boot-screen\{display:none\}#seo-fallback\{display:block\}html\[data-prerendered\] #seo-fallback img\{display:inline\}<\/style>\s*<\/noscript>/
    );
  });
});

describe('C-116 · peindre le prérendu, mais seulement sur une page prérendue', () => {
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
    rewrites: { source: string; destination: string }[];
  };

  it('peint #seo-fallback et masque le spinner sous html[data-prerendered]', () => {
    expect(indexHtml).toMatch(/html\[data-prerendered\] #boot-screen\{display:none\}/);
    expect(indexHtml).toMatch(/html\[data-prerendered\] #seo-fallback\{display:block/);
  });

  it("ne télécharge pas les captures du fallback peint : elles partaient avant le LCP", () => {
    expect(indexHtml).toMatch(/html\[data-prerendered\] #seo-fallback img\{display:none\}/);
    // `display:none` ne suffit à éviter la requête que sur une image lazy.
    const eager = [...prerender.matchAll(/<img (?![^>]*loading="lazy")[^>]*>/g)].map((m) => m[0].slice(0, 80));
    expect(eager).toEqual([]);
  });

  it("n'expose pas l'attribut dans la coquille source : les routes de l'app gardent le spinner", () => {
    expect(indexHtml).not.toMatch(/<html[^>]*data-prerendered/);
  });

  it('le prérendu pose data-prerendered et écrit une coquille vierge app.html', () => {
    expect(prerender).toContain("'<html data-prerendered'");
    expect(prerender).toMatch(/writeFileSync\(join\(DIST, 'app\.html'\), appShell/);
  });

  it("app.html sort en noindex sans canonical vers la home (sinon toute URL inconnue est un soft-404 indexable)", () => {
    expect(prerender).toContain(`'<meta name="robots" content="noindex" />'`);
    expect(prerender).toContain(`'<link rel="canonical" />'`);
    // Les deux motifs remplacés doivent exister dans la source, sinon le
    // prérendu lève : on vérifie ici qu'ils y sont encore.
    expect(indexHtml).toMatch(/<meta name="robots" content="index[^"]*" \/>/);
    expect(indexHtml).toContain('<link rel="canonical" href="https://thecosmo.app/" />');
  });

  it("le rewrite SPA sert app.html, jamais la home prérendue (la landing s'afficherait sur /dashboard)", () => {
    const spa = vercel.rewrites.find((r) => r.source.includes('assets/'));
    expect(spa?.destination).toBe('/app.html');
  });
});

describe('prerender.mjs', () => {
  it('injecte le contenu SEO dans #seo-fallback (masqué), pas en HTML nu', () => {
    expect(prerender).toContain('<div id="seo-fallback">');
    // L'ancien bug : un <div style="..."> visible, sans aucun garde-fou CSS.
    expect(prerender).not.toMatch(/<div style="font-family:sans-serif/);
  });

  it('ne retire que le <noscript> du <body>, pas celui du <head>', () => {
    // Un /<noscript>[\s\S]*?<\/noscript>/ non ancré emporterait le <noscript>
    // du <head> — celui qui réaffiche le contenu SEO sans JS.
    expect(prerender).toContain('<noscript id="seo-noscript">');
  });

  it('cible un marqueur #root qui survit à la présence du boot-screen', () => {
    // L'ancien marqueur `<div id="root"></div>` ne matche plus depuis que
    // #root contient le spinner → injection SEO silencieusement sautée.
    expect(prerender).not.toContain("const marker = '<div id=\"root\"></div>'");
  });
});
