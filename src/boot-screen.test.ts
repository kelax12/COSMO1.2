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
      /<noscript>\s*<style>#boot-screen\{display:none\}#seo-fallback\{display:block\}<\/style>\s*<\/noscript>/
    );
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
