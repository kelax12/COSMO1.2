// ═══════════════════════════════════════════════════════════════════
// Témoins des instantanés du prérendu (vague 14.4, COD-04)
//
// L'audit citait cinq défauts du HTML servi : `<h1>` en double, JSON-LD
// modifié, texte tronqué, `hreflang` faux, `canonical` faux. Chacun a ici son
// témoin : un faux `dist/` conforme est figé en instantané, puis abîmé d'UN
// défaut, et la comparaison doit le dire. Deux témoins vérifient aussi que la
// normalisation n'avale rien d'autre que l'empreinte des assets et la date du
// build, et que la mise à jour n'a jamais lieu toute seule.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { comparer, mettreAJour, normaliser } from './prerender-snapshots.mjs';
import { executer } from './check-prerender-snapshots.mjs';

const JSONLD = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q ?', acceptedAnswer: { '@type': 'Answer', text: 'La réponse.' } }] });

/** Une page prérendue conforme, réduite à ce que l'audit surveille. */
const page = ({ h1 = '<h1>Guide</h1>', ld = JSONLD, corps = '<p>Premier paragraphe.</p>\n<p>Dernier paragraphe, la fin de la page.</p>', canonical = 'https://thecosmo.app/guide', hreflang = 'fr-FR', asset = 'index-Bx3kQ9aZ' } = {}) => `<!doctype html>
<html lang="fr" data-prerendered>
  <head>
    <title>Guide</title>
    <link rel="canonical" href="${canonical}" />
    <script type="module" src="/assets/${asset}.js"></script>
    <link rel="alternate" hreflang="${hreflang}" href="https://thecosmo.app/guide" />
    <link rel="alternate" hreflang="en-US" href="https://thecosmo.app/en/guide" />
    <script type="application/ld+json" id="faq">${ld}</script>
  </head>
  <body>
    <div id="seo-fallback">${h1}
${corps}</div>
  </body>
</html>
`;

const RSS = (date) => `<rss><channel><lastBuildDate>${date}</lastBuildDate><item>a</item></channel></rss>\n`;

let dist;
let instantanes;

const ecrire = (chemin, texte) => {
  mkdirSync(join(dist, chemin, '..'), { recursive: true });
  writeFileSync(join(dist, chemin), texte, 'utf8');
};

/** Un faux dist complet : deux pages et les quatre fichiers hors pages. */
const poser = (surcharges = {}) => {
  ecrire('index.html', surcharges['index.html'] ?? page({ h1: '<h1>Accueil</h1>' }));
  ecrire('guide/index.html', surcharges['guide/index.html'] ?? page());
  ecrire('app.html', '<html><meta name="robots" content="noindex" /></html>\n');
  ecrire('sitemap.xml', '<urlset></urlset>\n');
  ecrire('rss.xml', surcharges['rss.xml'] ?? RSS('Sun, 08 Nov 2026 12:00:00 GMT'));
  ecrire('llms.txt', '# Cosmo\n');
  ecrire('assets/index-Bx3kQ9aZ.js', 'console.log(1)');
};

beforeEach(() => {
  const racine = mkdtempSync(join(tmpdir(), 'cosmo-instantanes-'));
  dist = join(racine, 'dist');
  instantanes = join(racine, 'instantanes');
  mkdirSync(dist);
  poser();
  mettreAJour(dist, instantanes);
});

afterEach(() => rmSync(join(dist, '..'), { recursive: true, force: true }));

const ecartsApres = (surcharges) => {
  poser(surcharges);
  return comparer(dist, instantanes);
};

describe('instantanés du prérendu : ils cassent sur ce que l’audit cite', () => {
  it('témoin de base : le build qui a servi à figer l’instantané est identique', () => {
    expect(comparer(dist, instantanes)).toEqual([]);
  });

  it('un <h1> en double', () => {
    const ecarts = ecartsApres({ 'guide/index.html': page({ h1: '<h1>Guide</h1>\n<h1>Guide</h1>' }) });
    expect(ecarts.map((e) => e.cle)).toEqual(['pages/guide.html']);
    expect(ecarts[0].nature).toBe('different');
  });

  it('un JSON-LD modifié', () => {
    const faux = JSONLD.replace('La réponse.', 'Une autre réponse.');
    expect(ecartsApres({ 'guide/index.html': page({ ld: faux }) }).map((e) => e.cle)).toEqual(['pages/guide.html']);
  });

  it('un texte tronqué', () => {
    const ecarts = ecartsApres({ 'guide/index.html': page({ corps: '<p>Premier paragraphe.</p>' }) });
    expect(ecarts.map((e) => e.cle)).toEqual(['pages/guide.html']);
  });

  it('un hreflang faux', () => {
    expect(ecartsApres({ 'guide/index.html': page({ hreflang: 'fr' }) }).map((e) => e.cle)).toEqual(['pages/guide.html']);
  });

  it('un canonical faux', () => {
    const ecarts = ecartsApres({ 'guide/index.html': page({ canonical: 'https://thecosmo.app/' }) });
    expect(ecarts.map((e) => e.cle)).toEqual(['pages/guide.html']);
    expect(ecarts[0].detail.obtenu).toContain('canonical');
  });

  it('une page prérendue en plus, sans instantané', () => {
    poser();
    ecrire('nouveau/index.html', page());
    expect(comparer(dist, instantanes)).toEqual([{ cle: 'pages/nouveau.html', nature: 'sans-instantane' }]);
  });

  it('une page disparue du prérendu, instantané orphelin', () => {
    rmSync(join(dist, 'guide'), { recursive: true });
    expect(comparer(dist, instantanes)).toEqual([{ cle: 'pages/guide.html', nature: 'orphelin' }]);
  });

  it('un fichier hors pages absent fait échouer, il ne passe pas à vide', () => {
    rmSync(join(dist, 'sitemap.xml'));
    expect(() => comparer(dist, instantanes)).toThrow(/sitemap\.xml absent/);
  });

  it('un dist absent fait échouer en le disant', () => {
    expect(() => comparer(join(dist, 'inexistant'), instantanes)).toThrow(/absent/);
  });
});

describe('normalisation : l’empreinte des assets et la date du build, rien d’autre', () => {
  it('une autre empreinte d’asset ne casse rien', () => {
    expect(ecartsApres({ 'guide/index.html': page({ asset: 'index-Zz9_-aQ1' }) })).toEqual([]);
  });

  it('une autre date de build du flux RSS ne casse rien', () => {
    expect(ecartsApres({ 'rss.xml': RSS('Mon, 09 Nov 2026 12:00:00 GMT') })).toEqual([]);
  });

  it('une date de contenu qui bouge casse (le RSS ne perd que lastBuildDate)', () => {
    const ecarts = ecartsApres({ 'rss.xml': RSS('Sun, 08 Nov 2026 12:00:00 GMT').replace('<item>a', '<pubDate>Mon, 09 Nov 2026</pubDate><item>a') });
    expect(ecarts.map((e) => e.cle)).toEqual(['fichiers/rss.xml']);
  });

  it('seul un motif d’empreinte sous /assets/ est normalisé', () => {
    expect(normaliser('<script src="/assets/index-Bx3kQ9aZ.js">')).toBe('<script src="/assets/index-[empreinte].js">');
    expect(normaliser('/assets/vendor-react-DkQ2_x-1.js')).toBe('/assets/vendor-react-[empreinte].js');
    // Hors /assets/ ou sans extension d'asset : intact.
    expect(normaliser('<a href="/guide-Bx3kQ9aZ.js">')).toContain('Bx3kQ9aZ');
    expect(normaliser('data-id="deadbeef-12345678"')).toContain('12345678');
    expect(normaliser('/assets/index-Bx3kQ9a.js')).toContain('Bx3kQ9a');
  });
});

describe('mise à jour : explicite, jamais automatique', () => {
  const lancer = (args, env = {}) => executer({ args, env, dist, instantanes });

  it('comparer ne réécrit jamais un instantané', () => {
    poser({ 'guide/index.html': page({ canonical: 'https://thecosmo.app/' }) });
    const avant = readFileSync(join(instantanes, 'pages/guide.html'), 'utf8');
    const r = lancer([]);
    expect(r.code).toBe(1);
    expect(r.texte).toContain('pages/guide.html');
    expect(r.texte).toContain('npm run prerender:instantanes:maj');
    expect(readFileSync(join(instantanes, 'pages/guide.html'), 'utf8')).toBe(avant);
  });

  it('la mise à jour est refusée en CI', () => {
    poser({ 'guide/index.html': page({ canonical: 'https://thecosmo.app/' }) });
    const avant = readFileSync(join(instantanes, 'pages/guide.html'), 'utf8');
    const r = lancer(['--mettre-a-jour'], { CI: 'true' });
    expect(r.code).toBe(1);
    expect(r.texte).toMatch(/refusée en CI/);
    expect(readFileSync(join(instantanes, 'pages/guide.html'), 'utf8')).toBe(avant);
  });

  it('la mise à jour explicite réécrit, retire les orphelins, puis la comparaison passe', () => {
    poser({ 'guide/index.html': page({ canonical: 'https://thecosmo.app/' }) });
    rmSync(join(dist, 'guide'), { recursive: true });
    ecrire('autre/index.html', page());
    const r = lancer(['--mettre-a-jour']);
    expect(r.code).toBe(0);
    expect(existsSync(join(instantanes, 'pages/guide.html'))).toBe(false);
    expect(existsSync(join(instantanes, 'pages/autre.html'))).toBe(true);
    expect(lancer([]).code).toBe(0);
  });

  it('une comparaison rouge dit l’écart, la ligne, et la commande de mise à jour', () => {
    poser({ 'guide/index.html': page({ hreflang: 'fr' }) });
    const r = lancer([]);
    expect(r.code).toBe(1);
    expect(r.texte).toMatch(/pages\/guide\.html : ligne \d+/);
    expect(r.texte).toContain('hreflang');
  });
});
