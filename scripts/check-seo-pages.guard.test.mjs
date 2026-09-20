// ═══════════════════════════════════════════════════════════════════
// TÉMOIN — la garde SEO (C-98)
// ═══════════════════════════════════════════════════════════════════
//
// Une garde neuve repart avec un témoin. Celle-ci lit `dist/`, donc elle est
// exactement du genre à rendre « ✓ tout va bien » sur zéro page mesurée : un
// glob cassé, un `dist/` absent, une expression qui ne matche plus, et le
// verdict reste vert. Même famille que `check-bundle-budget`.
//
// Le témoin monte donc des `dist/` SYNTHÉTIQUES et lance la vraie garde en
// sous-processus, une fois par défaut qu'elle doit voir.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import { cheminDeLoc, sansLocale, lireBalises, listerPages } from './check-seo-pages.mjs';

const GARDE = join(process.cwd(), 'scripts', 'check-seo-pages.mjs');
const BASE = 'https://thecosmo.app';

/** Une page prérendue plausible : quatre balises + hreflang réciproques. */
function page({ chemin, alternates = [], robots = '' }) {
  const liens = alternates
    .map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${BASE}${a.chemin}">`)
    .join('');
  return (
    '<!doctype html><html><head>'
    + `<title>Titre de ${chemin}</title>`
    + `<meta name="description" content="Description de ${chemin}">`
    + `<link rel="canonical" href="${BASE}${chemin}">`
    + (robots ? `<meta name="robots" content="${robots}">` : '')
    + liens
    + '</head><body><div id="seo-fallback">contenu</div></body></html>'
  );
}

/**
 * Monte un `dist/` synthétique.
 *
 * ⚠️ Il faut au moins 10 pages et 10 URLs : la garde refuse de conclure en
 * dessous, précisément pour ne pas rendre un vert sur un build incomplet.
 * Le témoin doit donc dépasser ce plancher, sinon il mesurerait ce refus-là
 * au lieu de mesurer la règle qu'il cible.
 */
function monterDist({ pages, locs }) {
  const racine = mkdtempSync(join(tmpdir(), 'c98-'));
  const dist = join(racine, 'dist');
  mkdirSync(dist, { recursive: true });
  for (const [chemin, html] of Object.entries(pages)) {
    const dossier = chemin === '/' ? dist : join(dist, chemin.slice(1));
    mkdirSync(dossier, { recursive: true });
    writeFileSync(join(dossier, 'index.html'), html);
  }
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0"?><urlset>${locs.map((l) => `<url><loc>${BASE}${l}</loc></url>`).join('')}</urlset>`,
  );
  return racine;
}

function lancer(racine) {
  const r = spawnSync(process.execPath, [GARDE], {
    cwd: racine,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { code: r.status, sortie: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * Les chemins déclarés `HORS_SITEMAP` par la garde.
 *
 * 🔴 Le site synthétique DOIT les porter. La garde échoue sur une dispense
 * PÉRIMÉE — une entrée qui ne correspond à aucune page réelle —, et c'est
 * voulu : une liste de dispenses mortes cesse d'être relue. Mais ça veut dire
 * qu'un dist synthétique qui les ignorerait serait rouge pour CETTE raison, et
 * chaque cas de ce fichier mesurerait la mauvaise chose. Même piège que dans
 * le témoin du budget de bundle, rencontré le même jour.
 */
const DISPENSES = [
  '/login/',
  '/signup/',
  '/cgu/',
  '/mentions-legales/',
  '/politique-confidentialite/',
  '/en/terms/',
  '/en/legal-notice/',
  '/en/privacy-policy/',
];

/** Un site sain : 12 articles bilingues au sitemap + les pages dispensées. */
function siteSain(modifications = {}) {
  const pages = {};
  const locs = [];
  // Les pages dispensées : prérendues, absentes du sitemap, sans hreflang.
  for (const chemin of DISPENSES) pages[chemin] = page({ chemin });
  for (let i = 0; i < 6; i += 1) {
    const fr = `/p${i}/`;
    const en = `/en/p${i}/`;
    pages[fr] = page({ chemin: fr, alternates: [{ lang: 'fr', chemin: fr }, { lang: 'en', chemin: en }] });
    pages[en] = page({ chemin: en, alternates: [{ lang: 'fr', chemin: fr }, { lang: 'en', chemin: en }] });
    locs.push(fr, en);
  }
  return modifications.transformer ? modifications.transformer({ pages, locs }) : { pages, locs };
}

function avec(config, verifier) {
  const racine = monterDist(config);
  try {
    verifier(lancer(racine));
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

describe('témoin — garde SEO (C-98)', () => {
  it('les fonctions de lecture lisent vraiment', () => {
    // Sabotage le plus simple : un extracteur qui rend toujours vide ferait
    // passer tous les contrôles de présence… à l'envers (il les ferait
    // échouer), mais un extracteur trop laxiste les ferait tous passer.
    const b = lireBalises(page({ chemin: '/x/', alternates: [{ lang: 'en', chemin: '/en/x/' }] }));
    expect(b.title).toBe('Titre de /x/');
    expect(b.description).toBe('Description de /x/');
    expect(b.canonical).toBe(`${BASE}/x/`);
    expect(b.hreflang).toEqual([{ lang: 'en', href: `${BASE}/en/x/` }]);
    expect(lireBalises('<html><head></head></html>')).toEqual({
      title: '',
      description: '',
      canonical: '',
      robots: '',
      hreflang: [],
    });
  });

  it('`sansLocale` retire le prefixe, et seulement lui', () => {
    expect(sansLocale('/en/guide/')).toBe('/guide/');
    expect(sansLocale('/guide/')).toBe('/guide/');
    expect(sansLocale('/en/')).toBe('/');
    // 🔴 Le piège : `/entreprise-presentation/` commence par « en » sans être
    // une locale. Un `startsWith('/en')` sans le slash le mutilerait.
    expect(sansLocale('/entreprise-presentation/')).toBe('/entreprise-presentation/');
  });

  it('`cheminDeLoc` normalise la barre finale', () => {
    expect(cheminDeLoc(`${BASE}/guide`)).toBe('/guide/');
    expect(cheminDeLoc(`${BASE}/guide/`)).toBe('/guide/');
    expect(cheminDeLoc(`${BASE}/`)).toBe('/');
  });

  it('`listerPages` trouve les pages et ignore les actifs', () => {
    const racine = mkdtempSync(join(tmpdir(), 'c98l-'));
    try {
      const dist = join(racine, 'dist');
      mkdirSync(join(dist, 'guide'), { recursive: true });
      mkdirSync(join(dist, 'assets'), { recursive: true });
      writeFileSync(join(dist, 'index.html'), '<html></html>');
      writeFileSync(join(dist, 'guide', 'index.html'), '<html></html>');
      // Un `index.html` dans `assets/` n'est pas une page : s'il était compté,
      // la garde exigerait des balises d'un artefact de build.
      writeFileSync(join(dist, 'assets', 'index.html'), '<html></html>');
      expect(listerPages(dist)).toEqual(['/', '/guide/']);
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('un site sain passe', () => {
    avec(siteSain(), ({ code, sortie }) => {
      expect(sortie).toContain('Sitemap et prérendu se correspondent');
      expect(sortie).toMatch(/pages prérendues\s+: 20/);
      expect(code).toBe(0);
    });
  });

  it('une page PRERENDUE hors sitemap et non declaree fait rougir', () => {
    const { pages, locs } = siteSain();
    avec({ pages, locs: locs.filter((l) => l !== '/p3/') }, ({ code, sortie }) => {
      expect(code).toBe(1);
      expect(sortie).toContain('absente(s) du sitemap');
      expect(sortie).toContain('/p3/');
    });
  });

  it('une URL du sitemap SANS page prerendue fait rougir', () => {
    // Le défaut le plus coûteux des deux : Google reçoit la coquille vide.
    const { pages, locs } = siteSain();
    avec({ pages, locs: [...locs, '/fantome/'] }, ({ code, sortie }) => {
      expect(code).toBe(1);
      expect(sortie).toContain('SANS page prérendue');
      expect(sortie).toContain('/fantome/');
    });
  });

  it('une balise manquante fait rougir', () => {
    const { pages, locs } = siteSain();
    pages['/p2/'] = pages['/p2/'].replace(/<title>[^<]*<\/title>/, '');
    avec({ pages, locs }, ({ code, sortie }) => {
      expect(code).toBe(1);
      expect(sortie).toContain('sans balise obligatoire');
      expect(sortie).toContain('title');
    });
  });

  it('un `canonical` qui pointe ailleurs fait rougir', () => {
    const { pages, locs } = siteSain();
    pages['/p1/'] = pages['/p1/'].replace(
      `<link rel="canonical" href="${BASE}/p1/">`,
      `<link rel="canonical" href="${BASE}/p0/">`,
    );
    avec({ pages, locs }, ({ code, sortie }) => {
      expect(code).toBe(1);
      expect(sortie).toContain('ne désigne pas sa propre page');
    });
  });

  it('un `hreflang` NON RECIPROQUE fait rougir', () => {
    // 🔴 Le mode de défaillance silencieux : Google ignore le groupe entier,
    // sans rien signaler. C'est celui pour lequel une garde vaut le plus.
    const { pages, locs } = siteSain();
    pages['/en/p4/'] = page({
      chemin: '/en/p4/',
      alternates: [{ lang: 'en', chemin: '/en/p4/' }], // ne rend plus la main au fr
    });
    avec({ pages, locs }, ({ code, sortie }) => {
      expect(code).toBe(1);
      expect(sortie).toContain('non réciproque');
    });
  });

  it('une page `noindex` AU SITEMAP fait rougir', () => {
    const { pages, locs } = siteSain();
    pages['/p5/'] = page({
      chemin: '/p5/',
      alternates: [{ lang: 'fr', chemin: '/p5/' }, { lang: 'en', chemin: '/en/p5/' }],
      robots: 'noindex, nofollow',
    });
    avec({ pages, locs }, ({ code, sortie }) => {
      expect(code).toBe(1);
      expect(sortie).toContain('noindex');
    });
  });

  it('un build INCOMPLET fait rougir au lieu de conclure', () => {
    // 🔴 Le contrôle anti-« garde qui répond sans mesurer ». Deux pages, deux
    // URLs : tout se correspond, et pourtant la garde doit refuser de dire
    // que tout va bien — un build à deux pages n'est pas ce site.
    avec(
      {
        pages: {
          '/': page({ chemin: '/' }),
          '/guide/': page({ chemin: '/guide/' }),
          // Les dispenses restent posées : sinon la garde rougirait sur elles
          // et non sur le plancher qu'on vient mesurer.
          ...Object.fromEntries(DISPENSES.map((c) => [c, page({ chemin: c })])),
        },
        locs: ['/', '/guide/'],
      },
      ({ code, sortie }) => {
        expect(code).toBe(1);
        // La garde nomme celui des deux qui est incomplet : ici le sitemap
        // (2 URLs), les pages dispensees portant le compte de pages a 10.
        expect(sortie).toContain('est incomplet');
      },
    );
  });

  it('sans `dist`, la garde ECHOUE au lieu de se taire', () => {
    const vide = mkdtempSync(join(tmpdir(), 'c98v-'));
    try {
      const { code, sortie } = lancer(vide);
      expect(code).toBe(1);
      expect(sortie).toContain('introuvable');
      expect(sortie).not.toContain('se correspondent');
    } finally {
      rmSync(vide, { recursive: true, force: true });
    }
  });
});
