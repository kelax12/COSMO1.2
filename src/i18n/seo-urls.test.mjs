import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BCP47_TAG,
  INDEXABLE_LOCALES,
  ROUTE_SLUGS,
  SITE_ORIGIN,
  canonicalUrl,
  HREFLANG,
  hreflangLinks,
  localizePath,
  routeSlug,
  sitemapAlternates,
} from './seo-urls.mjs';
import { localizePath as appLocalizePath, ROUTE_SLUGS as appRouteSlugs } from './routes.ts';
import { SUPPORTED_LOCALES } from './locale.ts';

const ALL = Object.keys(BCP47_TAG);
const ROUTE_IDS = Object.keys(ROUTE_SLUGS);

// ──────────────────────────────────────────────────────────────────
// Parité avec l'implémentation applicative
//
// C'est LE test qui compte : `prerender/` calcule les `canonical` et les
// `hreflang`, l'app calcule les URLs réellement servies. S'ils divergent, on
// déclare canonique une URL qui n'existe pas — un bug qu'on ne découvre qu'en
// Search Console, des semaines plus tard.
// ──────────────────────────────────────────────────────────────────
describe('parité avec src/i18n/routes.ts', () => {
  it('lit la même table de slugs', () => {
    expect(ROUTE_SLUGS).toEqual(appRouteSlugs);
  });

  const CASES = [
    '/',
    '/tasks',
    '/a-propos',
    '/mentions-legales',
    '/cgu',
    '/blog',
    '/blog/matrice-eisenhower',
    '/invite/abc123',
    '/en/about',
    '/es/acerca-de',
  ];

  it.each(CASES)('localizePath("%s") est identique dans les deux implémentations', (path) => {
    for (const locale of ALL) {
      expect(localizePath(path, locale), `${path} → ${locale}`).toBe(
        appLocalizePath(path, locale)
      );
    }
  });
});

describe('localizePath', () => {
  it('ne préfixe jamais la locale par défaut', () => {
    expect(localizePath('/tasks', 'fr')).toBe('/tasks');
    expect(localizePath('/', 'fr')).toBe('/');
  });

  it('traduit le slug public et préfixe', () => {
    expect(localizePath('/a-propos', 'en')).toBe('/en/about');
    expect(localizePath('/a-propos', 'es')).toBe('/es/acerca-de');
  });

  it('est idempotente', () => {
    for (const locale of ALL) {
      const once = localizePath('/mentions-legales', locale);
      expect(localizePath(once, locale)).toBe(once);
    }
  });

  it('ne traduit que le premier segment', () => {
    expect(localizePath('/blog/matrice-eisenhower', 'en')).toBe('/en/blog/matrice-eisenhower');
  });
});

describe('routeSlug', () => {
  it('résout chaque route dans chaque langue', () => {
    for (const routeId of ROUTE_IDS) {
      for (const locale of ALL) {
        expect(routeSlug(routeId, locale), `${routeId}/${locale}`).toBeTruthy();
      }
    }
  });

  it('retourne null pour une route inconnue', () => {
    expect(routeSlug('inexistante', 'fr')).toBeNull();
  });
});

describe('canonicalUrl', () => {
  it('produit une URL absolue', () => {
    expect(canonicalUrl('/a-propos', 'fr')).toBe(`${SITE_ORIGIN}/a-propos`);
    expect(canonicalUrl('/a-propos', 'en')).toBe(`${SITE_ORIGIN}/en/about`);
  });

  it('garde la barre oblique finale de la racine', () => {
    expect(canonicalUrl('/', 'fr')).toBe(`${SITE_ORIGIN}/`);
  });
});

describe('hreflangLinks', () => {
  it('déclare toujours x-default vers la locale par défaut', () => {
    const links = hreflangLinks('/a-propos');
    expect(links).toContain(`hreflang="x-default" href="${SITE_ORIGIN}/a-propos"`);
  });

  it('inclut la version courante — les alternates doivent être réciproques', () => {
    // Google ignore silencieusement tout le groupe si une version ne se déclare
    // pas elle-même.
    const links = hreflangLinks('/a-propos');
    expect(links).toContain(`hreflang="${HREFLANG.fr}" href="${SITE_ORIGIN}/a-propos"`);
  });

  it('n’annonce jamais une locale non indexable', () => {
    // Déclarer une alternate vers une page non indexée (ou inexistante) est une
    // erreur Search Console.
    const links = hreflangLinks('/a-propos', ALL);
    for (const locale of ALL) {
      if (INDEXABLE_LOCALES.includes(locale)) continue;
      expect(links).not.toContain(`hreflang="${HREFLANG[locale]}"`);
    }
  });

  it('produit une déclaration par locale indexable, plus x-default', () => {
    const count = (hreflangLinks('/a-propos', ALL).match(/rel="alternate"/g) ?? []).length;
    expect(count).toBe(INDEXABLE_LOCALES.length + 1);
  });

  it('ne déclare rien quand aucune locale disponible n’est indexable', () => {
    expect(hreflangLinks('/a-propos', [])).toBe('');
  });
});

describe('sitemapAlternates', () => {
  it('porte x-default, comme le <head>', () => {
    expect(sitemapAlternates('/a-propos', ['fr', 'en'])).toContain(`hreflang="x-default" href="${SITE_ORIGIN}/a-propos"`);
  });

  it('déclare la langue seule, sans région', () => {
    // Le contenu ne vise aucun pays : `en-US` n'annoncerait rien au Royaume-Uni.
    const out = hreflangLinks('/a-propos', ['fr', 'en']) + sitemapAlternates('/a-propos', ['fr', 'en']);
    expect(out).not.toMatch(/hreflang="[a-z]{2}-[A-Z]{2}"/);
  });

  it('n’émet rien pour une page mono-langue', () => {
    // Les articles de blog restent français : un groupe d'alternates à une
    // seule entrée n'a aucun sens.
    expect(sitemapAlternates('/blog/matrice-eisenhower', ['fr'])).toBe('');
  });

  it('émet une entrée par locale quand il y en a plusieurs', () => {
    const out = sitemapAlternates('/a-propos', ALL);
    const expected = ALL.filter((l) => INDEXABLE_LOCALES.includes(l));
    if (expected.length < 2) {
      expect(out).toBe('');
      return;
    }
    for (const locale of expected) {
      expect(out).toContain(`hreflang="${HREFLANG[locale]}"`);
    }
  });
});

describe('cohérence avec le module applicatif', () => {
  it('n’indexe que des locales réellement servies', () => {
    // Indexer une locale que l'app ne sait pas rendre enverrait Google sur des
    // 404.
    for (const locale of INDEXABLE_LOCALES) {
      expect(SUPPORTED_LOCALES).toContain(locale);
    }
  });
});

describe('slug d’une autre langue : redirection 301 (vercel.json)', () => {
  // Sans elle, `/en/a-propos` rendait la coquille SPA en HTTP 200 (soft 404).
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const cible = new Map(vercel.redirects.map((r) => [r.source, r.destination]));
  const PREFIXE = { fr: '', en: '/en', hr: '/hr' };

  it('chaque slug étranger sous chaque préfixe servi redirige vers le bon slug', () => {
    for (const parLocale of Object.values(ROUTE_SLUGS)) {
      for (const [locale, prefixe] of Object.entries(PREFIXE)) {
        for (const slug of Object.values(parLocale)) {
          if (slug === parLocale[locale]) continue;
          expect(cible.get(`${prefixe}/${slug}`)).toBe(`${prefixe}/${parLocale[locale]}`);
        }
      }
    }
  });

  it('une locale non servie (`es`) redirige vers le français', () => {
    expect(cible.get('/es')).toBe('/');
    expect(cible.get('/es/')).toBe('/');
    expect(cible.get('/es/:path*')).toBe('/:path*');
  });
});

// ──────────────────────────────────────────────────────────────────
// Slugs d'articles traduits (plan SEO T4)
// ──────────────────────────────────────────────────────────────────
describe('slugs d articles traduits', () => {
  it('traduit le slug d article dans les deux sens, identique côté app', () => {
    expect(localizePath('/blog/matrice-eisenhower', 'hr')).toBe('/hr/blog/eisenhowerova-matrica');
    expect(localizePath('/hr/blog/eisenhowerova-matrica', 'fr')).toBe('/blog/matrice-eisenhower');
    expect(localizePath('/hr/blog/eisenhowerova-matrica', 'en')).toBe('/en/blog/matrice-eisenhower');
    for (const p of ['/blog/matrice-eisenhower', '/hr/blog/eisenhowerova-matrica', '/blog/objectifs-de-l-annee']) {
      for (const l of ALL) expect(appLocalizePath(p, l)).toBe(localizePath(p, l));
    }
  });

  it('chaque ancien slug croate a sa redirection 301 vers le nouveau', async () => {
    const { readFileSync } = await import('node:fs');
    const slugs = JSON.parse(readFileSync(new URL('./article-slugs.json', import.meta.url), 'utf8'));
    const { redirects } = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    for (const [canon, byLocale] of Object.entries(slugs)) {
      if (!byLocale.hr) continue;
      expect(redirects).toContainEqual({ source: `/hr/blog/${canon}`, destination: `/hr/blog/${byLocale.hr}`, permanent: true });
    }
  });
});
