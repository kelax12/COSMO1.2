import { describe, it, expect } from 'vitest';
import { ALL_LOCALES, DEFAULT_LOCALE, type Locale } from './locale';
import {
  ROUTE_SLUGS,
  SITE_ORIGIN,
  canonicalUrl,
  localizePath,
  routeIdFromSlug,
  routeSlug,
  stripLocalePrefix,
  type RouteId,
} from './routes';

const ROUTE_IDS = Object.keys(ROUTE_SLUGS) as RouteId[];

describe('ROUTE_SLUGS', () => {
  it('définit un slug pour chaque locale connue', () => {
    for (const routeId of ROUTE_IDS) {
      for (const locale of ALL_LOCALES) {
        expect(ROUTE_SLUGS[routeId][locale], `${routeId}/${locale}`).toBeTruthy();
      }
    }
  });

  it('n’utilise jamais deux fois le même slug', () => {
    // Une collision rendrait `routeIdFromSlug` ambigu et enverrait le
    // sélecteur de langue sur la mauvaise page.
    const seen = new Set<string>();
    for (const routeId of ROUTE_IDS) {
      for (const locale of ALL_LOCALES) {
        const slug = ROUTE_SLUGS[routeId][locale];
        expect(seen.has(slug), `slug dupliqué : ${slug}`).toBe(false);
        seen.add(slug);
      }
    }
  });

  it('n’utilise pas de slug qui ressemble à un préfixe de locale', () => {
    for (const routeId of ROUTE_IDS) {
      for (const locale of ALL_LOCALES) {
        expect(ALL_LOCALES).not.toContain(ROUTE_SLUGS[routeId][locale] as Locale);
      }
    }
  });
});

describe('routeSlug / routeIdFromSlug', () => {
  it('résout le slug d’une route dans une locale', () => {
    expect(routeSlug('about', 'fr')).toBe('a-propos');
    expect(routeSlug('about', 'en')).toBe('about');
    expect(routeSlug('about', 'es')).toBe('acerca-de');
  });

  it('retrouve la route depuis un slug de n’importe quelle langue', () => {
    expect(routeIdFromSlug('a-propos')).toBe('about');
    expect(routeIdFromSlug('privacy-policy')).toBe('privacy');
    expect(routeIdFromSlug('condiciones')).toBe('terms');
  });

  it('retourne null pour un slug inconnu', () => {
    expect(routeIdFromSlug('tasks')).toBeNull();
    expect(routeIdFromSlug('')).toBeNull();
  });

  it('fait l’aller-retour pour toutes les routes et locales', () => {
    for (const routeId of ROUTE_IDS) {
      for (const locale of ALL_LOCALES) {
        expect(routeIdFromSlug(routeSlug(routeId, locale))).toBe(routeId);
      }
    }
  });
});

describe('stripLocalePrefix', () => {
  it('retire un préfixe de locale', () => {
    expect(stripLocalePrefix('/en/tasks')).toEqual({ locale: 'en', path: '/tasks' });
    expect(stripLocalePrefix('/es/a-propos')).toEqual({ locale: 'es', path: '/a-propos' });
  });

  it('gère un préfixe seul', () => {
    expect(stripLocalePrefix('/en')).toEqual({ locale: 'en', path: '/' });
  });

  it('laisse intact un chemin sans préfixe', () => {
    expect(stripLocalePrefix('/tasks')).toEqual({ locale: null, path: '/tasks' });
    expect(stripLocalePrefix('/')).toEqual({ locale: null, path: '/' });
  });

  it('ne prend pas un token d’invitation pour une locale', () => {
    expect(stripLocalePrefix('/invite/abc123')).toEqual({ locale: null, path: '/invite/abc123' });
  });
});

describe('localizePath', () => {
  it('ne préfixe jamais la locale par défaut', () => {
    expect(localizePath('/tasks', DEFAULT_LOCALE)).toBe('/tasks');
    expect(localizePath('/', DEFAULT_LOCALE)).toBe('/');
  });

  it('préfixe les autres locales', () => {
    expect(localizePath('/tasks', 'en')).toBe('/en/tasks');
    expect(localizePath('/', 'en')).toBe('/en/');
  });

  it('traduit le slug public au passage', () => {
    expect(localizePath('/a-propos', 'en')).toBe('/en/about');
    expect(localizePath('/a-propos', 'es')).toBe('/es/acerca-de');
    expect(localizePath('/mentions-legales', 'en')).toBe('/en/legal-notice');
  });

  it('canonicalise un chemin déjà préfixé vers la locale par défaut', () => {
    expect(localizePath('/en/about', DEFAULT_LOCALE)).toBe('/a-propos');
    expect(localizePath('/en/tasks', DEFAULT_LOCALE)).toBe('/tasks');
  });

  it('passe d’une locale préfixée à une autre', () => {
    expect(localizePath('/en/about', 'es')).toBe('/es/acerca-de');
  });

  it('est idempotente', () => {
    for (const locale of ALL_LOCALES) {
      const once = localizePath('/a-propos', locale);
      expect(localizePath(once, locale)).toBe(once);
    }
  });

  it('ne traduit que le premier segment', () => {
    // `/blog/:slug` — le slug d'article n'est pas un slug de route.
    expect(localizePath('/blog/matrice-eisenhower', 'en')).toBe('/en/blog/matrice-eisenhower');
  });

  it('préserve query string et fragment', () => {
    expect(localizePath('/tasks?filter=today', 'en')).toBe('/en/tasks?filter=today');
    expect(localizePath('/a-propos#equipe', 'en')).toBe('/en/about#equipe');
  });

  it('laisse intacts les chemins techniques', () => {
    expect(localizePath('/invite/abc123', 'en')).toBe('/en/invite/abc123');
    expect(localizePath('/invite/abc123', DEFAULT_LOCALE)).toBe('/invite/abc123');
  });
});

describe('canonicalUrl', () => {
  it('produit une URL absolue', () => {
    expect(canonicalUrl('/a-propos', DEFAULT_LOCALE)).toBe(`${SITE_ORIGIN}/a-propos`);
    expect(canonicalUrl('/a-propos', 'en')).toBe(`${SITE_ORIGIN}/en/about`);
  });

  it('garde la barre oblique finale de la racine', () => {
    // `prerender.mjs` et `useSeoMeta` doivent produire exactement la même
    // chaîne, sinon le canonical et le hreflang se contredisent.
    expect(canonicalUrl('/', DEFAULT_LOCALE)).toBe(`${SITE_ORIGIN}/`);
  });

  it('locale inconnue → chemin rendu tel quel, sans préfixe inventé', () => {
    // Garde de robustesse : `localizePath` est une fonction PURE appelée avec
    // des valeurs qui peuvent venir d'une URL ou d'un localStorage trafiqué.
    // Elle doit rendre le chemin inchangé plutôt que fabriquer un `/de/…`
    // qui n'existe dans aucune table de slugs.
    expect(localizePath('/tasks', 'de' as Locale)).toBe('/tasks');
    expect(localizePath('/', '' as Locale)).toBe('/');
  });
});
