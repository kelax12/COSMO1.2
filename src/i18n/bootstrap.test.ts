import { describe, it, expect } from 'vitest';
import { localeSwitchTarget, resolveRouterBootstrap, suggestedLocale } from './bootstrap';
import { ALL_LOCALES, DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './locale';

/** Une locale servie qui n'est pas celle par défaut (l'anglais en phase 2). */
const SECONDARY = SUPPORTED_LOCALES.find((l) => l !== DEFAULT_LOCALE) as Locale;
/** Une locale connue mais pas encore ouverte (l'espagnol en phase 2). */
const UNOPENED = ALL_LOCALES.find((l) => !SUPPORTED_LOCALES.includes(l));

/** Entrée minimale — les sources externes sont toujours injectées explicitement. */
const at = (pathname: string, extra: Partial<Parameters<typeof resolveRouterBootstrap>[0]> = {}) =>
  resolveRouterBootstrap({
    pathname,
    storedLocale: null,
    ...extra,
  });

describe('resolveRouterBootstrap — locale par défaut', () => {
  it('sert la racine sans préfixe', () => {
    expect(at('/')).toEqual({ locale: DEFAULT_LOCALE, basename: '/', replaceUrl: null });
  });

  it('sert un chemin applicatif sans préfixe', () => {
    expect(at('/tasks')).toEqual({ locale: DEFAULT_LOCALE, basename: '/', replaceUrl: null });
  });
});

describe('resolveRouterBootstrap — canonicalisation du préfixe par défaut', () => {
  it(`retire le préfixe /${DEFAULT_LOCALE} redondant`, () => {
    // Deux URLs pour un même contenu = duplicate content, et `hreflang` ne peut
    // désigner qu'une seule version.
    expect(at(`/${DEFAULT_LOCALE}/tasks`)).toEqual({
      locale: DEFAULT_LOCALE,
      basename: '/',
      replaceUrl: '/tasks',
    });
  });

  it('ramène le préfixe seul à la racine', () => {
    expect(at(`/${DEFAULT_LOCALE}`).replaceUrl).toBe('/');
  });

  it('préserve query string et fragment', () => {
    expect(
      at(`/${DEFAULT_LOCALE}/tasks`, { search: '?filter=today', hash: '#top' }).replaceUrl
    ).toBe('/tasks?filter=today#top');
  });
});

describe('resolveRouterBootstrap — préfixe d’une locale servie', () => {
  it('fait loi sur la préférence enregistrée', () => {
    // Un lien partagé doit s'ouvrir dans SA langue, sinon l'URL ne décrit plus
    // son propre contenu.
    expect(at(`/${SECONDARY}/tasks`, { storedLocale: DEFAULT_LOCALE })).toEqual({
      locale: SECONDARY,
      basename: `/${SECONDARY}`,
      replaceUrl: null,
    });
  });

  it('gère le préfixe seul', () => {
    expect(at(`/${SECONDARY}`)).toEqual({
      locale: SECONDARY,
      basename: `/${SECONDARY}`,
      replaceUrl: null,
    });
  });

  it('ne redirige jamais une URL déjà préfixée', () => {
    expect(at(`/${SECONDARY}/about`).replaceUrl).toBeNull();
  });
});

describe('resolveRouterBootstrap — racine : préférence explicite seulement', () => {
  it('ne redirige JAMAIS selon la langue du navigateur (Googlebot rend en en-US)', () => {
    // Une redirection par langue du navigateur ferait voir l'accueil français
    // en anglais aux robots : la racine reste française sans préférence choisie.
    const result = at('/');
    expect(result.locale).toBe(DEFAULT_LOCALE);
    expect(result.replaceUrl).toBeNull();
  });

  it('redirige vers la préférence enregistrée au sélecteur de langue', () => {
    const result = at('/', { storedLocale: SECONDARY });
    expect(result.locale).toBe(SECONDARY);
    expect(result.basename).toBe(`/${SECONDARY}`);
    expect(result.replaceUrl).toBe(`/${SECONDARY}/`);
  });

  it('reste en français si la préférence enregistrée est le français', () => {
    expect(at('/', { storedLocale: DEFAULT_LOCALE }).replaceUrl).toBeNull();
  });

  it('préserve query string et fragment lors de la redirection', () => {
    expect(at('/', { storedLocale: SECONDARY, search: '?ref=x' }).replaceUrl).toBe(
      `/${SECONDARY}/?ref=x`
    );
  });

  it('ne redirige PAS un chemin profond non préfixé', () => {
    // Un lien français partagé reste français, même chez un anglophone :
    // l'absence de préfixe signifie toujours « locale par défaut ».
    const result = at('/a-propos', { storedLocale: SECONDARY });
    expect(result.locale).toBe(DEFAULT_LOCALE);
    expect(result.basename).toBe('/');
    expect(result.replaceUrl).toBeNull();
  });
});

describe('resolveRouterBootstrap — locale connue mais non ouverte', () => {
  it.runIf(UNOPENED)('ne prétend pas la servir et laisse la route tomber en 404', () => {
    // `basename` reste à la racine, donc aucune route ne matche `es/tasks` et le
    // fallback `*` répond 404. Comportement voulu, pas un accident.
    const result = at(`/${UNOPENED}/tasks`);
    expect(result.locale).toBe(DEFAULT_LOCALE);
    expect(result.basename).toBe('/');
    expect(result.replaceUrl).toBeNull();
  });
});

describe('resolveRouterBootstrap — segments qui ne sont pas des locales', () => {
  it('ne prend pas un token d’invitation pour un préfixe', () => {
    // Avaler ce chemin casserait le parcours d'acquisition par lien de partage.
    expect(at('/invite/abc123')).toEqual({
      locale: DEFAULT_LOCALE,
      basename: '/',
      replaceUrl: null,
    });
  });

  it('laisse passer un segment de deux lettres qui n’est pas une locale', () => {
    expect(at('/de/tasks').basename).toBe('/');
  });
});

describe('localeSwitchTarget', () => {
  const url = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

  it('préfixe un chemin applicatif', () => {
    expect(localeSwitchTarget(SECONDARY, url('/tasks'))).toBe(`/${SECONDARY}/tasks`);
  });

  it('retire le préfixe pour revenir à la locale par défaut', () => {
    expect(localeSwitchTarget(DEFAULT_LOCALE, url(`/${SECONDARY}/tasks`))).toBe('/tasks');
  });

  it('traduit le slug public au passage', () => {
    expect(localeSwitchTarget(SECONDARY, url('/a-propos'))).toBe(`/${SECONDARY}/about`);
    expect(localeSwitchTarget(DEFAULT_LOCALE, url(`/${SECONDARY}/about`))).toBe('/a-propos');
  });

  it('préserve query string et fragment', () => {
    expect(localeSwitchTarget(SECONDARY, url('/tasks', '?f=1', '#x'))).toBe(
      `/${SECONDARY}/tasks?f=1#x`
    );
  });

  it('reste stable si la langue est déjà la bonne', () => {
    expect(localeSwitchTarget(SECONDARY, url(`/${SECONDARY}/tasks`))).toBe(`/${SECONDARY}/tasks`);
  });
});

describe('suggestedLocale — bandeau à la place de la redirection', () => {
  it('propose la langue du navigateur au visiteur qui n’a rien choisi', () => {
    expect(suggestedLocale(DEFAULT_LOCALE, null, SECONDARY)).toBe(SECONDARY);
  });
  it('ne propose rien si la page est déjà dans cette langue, ou si une préférence existe', () => {
    expect(suggestedLocale(DEFAULT_LOCALE, null, DEFAULT_LOCALE)).toBeNull();
    expect(suggestedLocale(DEFAULT_LOCALE, DEFAULT_LOCALE, SECONDARY)).toBeNull();
  });
  it('ne propose jamais une locale non servie', () => {
    if (UNOPENED) expect(suggestedLocale(DEFAULT_LOCALE, null, UNOPENED)).toBeNull();
  });
});
