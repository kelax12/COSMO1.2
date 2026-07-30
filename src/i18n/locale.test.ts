// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ALL_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  applyLocale,
  detectLocale,
  isLocale,
  isSupportedLocale,
  localeFromPathname,
  persistLocale,
  readStoredLocale,
  resolveInitialLocale,
} from './locale';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('invariants du jeu de locales', () => {
  it('sert un sous-ensemble des locales connues', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(ALL_LOCALES).toContain(locale);
    }
  });

  it('place la locale par défaut en tête des locales servies', () => {
    expect(SUPPORTED_LOCALES[0]).toBe(DEFAULT_LOCALE);
  });
});

describe('isLocale / isSupportedLocale', () => {
  it('accepte les locales connues', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('es')).toBe(true);
  });

  it('rejette tout le reste', () => {
    expect(isLocale('de')).toBe(false);
    expect(isLocale('FR')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it('distingue « connue » de « servie »', () => {
    // Le socle ne sert que le français : `en` est connue mais pas encore ouverte.
    expect(isLocale('en')).toBe(true);
    expect(isSupportedLocale('en')).toBe(SUPPORTED_LOCALES.includes('en'));
    expect(isSupportedLocale(DEFAULT_LOCALE)).toBe(true);
  });
});

describe('detectLocale', () => {
  it('retient la première langue servie de la liste', () => {
    expect(detectLocale(['fr-FR', 'en-US'])).toBe('fr');
  });

  it('ignore une langue non servie au profit de la suivante', () => {
    // `de` n'est pas servie : on ne doit pas retomber sur le défaut tant qu'une
    // langue servie figure plus loin dans les préférences.
    expect(detectLocale(['de-DE', 'fr'])).toBe('fr');
  });

  it('ne compare que la sous-étiquette primaire', () => {
    expect(detectLocale(['fr-CA'])).toBe('fr');
  });

  it('retombe sur le défaut quand aucune langue ne convient', () => {
    expect(detectLocale(['de', 'ja'])).toBe(DEFAULT_LOCALE);
    expect(detectLocale([])).toBe(DEFAULT_LOCALE);
  });

  it('lit navigator.languages sans argument', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([DEFAULT_LOCALE]);
    expect(detectLocale()).toBe(DEFAULT_LOCALE);
  });

  it('retombe sur navigator.language quand languages est vide', () => {
    // Vieux WebKit : `languages` peut être un tableau vide alors que `language`
    // est renseigné. Sans ce repli, iOS Safari perdait la détection.
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue(`${DEFAULT_LOCALE}-FR`);
    expect(detectLocale()).toBe(DEFAULT_LOCALE);
  });

  it('retombe sur le défaut quand le navigateur ne dit rien', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([]);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('');
    expect(detectLocale()).toBe(DEFAULT_LOCALE);
  });
});

describe('persistLocale / readStoredLocale', () => {
  it('relit ce qui a été persisté', () => {
    persistLocale('fr');
    expect(readStoredLocale()).toBe('fr');
  });

  it('retourne null sans préférence', () => {
    expect(readStoredLocale()).toBeNull();
  });

  it('ignore une valeur persistée invalide', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'klingon');
    expect(readStoredLocale()).toBeNull();
  });

  it('reste silencieux si localStorage est inaccessible', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('navigation privée stricte');
    });
    expect(() => persistLocale('fr')).not.toThrow();
  });
});

describe('localeFromPathname', () => {
  it('reconnaît un préfixe de locale connu', () => {
    expect(localeFromPathname('/en/tasks')).toBe('en');
    expect(localeFromPathname('/es')).toBe('es');
    expect(localeFromPathname('/fr/a-propos')).toBe('fr');
  });

  it('retourne null en absence de préfixe', () => {
    expect(localeFromPathname('/tasks')).toBeNull();
    expect(localeFromPathname('/')).toBeNull();
    expect(localeFromPathname('')).toBeNull();
  });

  it('ne confond pas un segment quelconque avec une locale', () => {
    // Régression à éviter : avaler `/invite/:token` casserait le parcours
    // d'acquisition par lien de partage.
    expect(localeFromPathname('/invite/abc123')).toBeNull();
    expect(localeFromPathname('/de/tasks')).toBeNull();
  });
});

describe('resolveInitialLocale', () => {
  it('donne priorité au préfixe de l’URL sur la préférence persistée', () => {
    persistLocale(DEFAULT_LOCALE);
    expect(resolveInitialLocale(`/${DEFAULT_LOCALE}/tasks`)).toBe(DEFAULT_LOCALE);
  });

  it('ignore un préfixe connu mais non servi', () => {
    // `/es/…` avant l'ouverture de l'espagnol : l'app ne sait pas rendre cette
    // locale, on retombe sur la préférence (le routeur répondra 404).
    const unsupported = ALL_LOCALES.find((l) => !SUPPORTED_LOCALES.includes(l));
    if (!unsupported) return; // toutes les locales sont ouvertes : rien à tester
    expect(resolveInitialLocale(`/${unsupported}/tasks`)).toBe(DEFAULT_LOCALE);
  });

  it('utilise la préférence persistée sans préfixe d’URL', () => {
    persistLocale(DEFAULT_LOCALE);
    expect(resolveInitialLocale('/tasks')).toBe(DEFAULT_LOCALE);
  });

  it('retombe sur la langue du navigateur sans préférence', () => {
    expect(resolveInitialLocale('/tasks')).toBe(detectLocale());
  });

  it('lit window.location.pathname sans argument', () => {
    // C'est la forme appelée par src/main.tsx avant le premier paint.
    expect(resolveInitialLocale()).toBe(detectLocale());
  });

  it('ignore une préférence persistée corrompue', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, '{}');
    expect(resolveInitialLocale('/tasks')).toBe(detectLocale());
  });

  it('reste utilisable si la lecture de localStorage jette', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('navigation privée stricte');
    });
    expect(resolveInitialLocale('/tasks')).toBe(detectLocale());
  });
});

describe('applyLocale', () => {
  it('pose lang et dir sur la racine', () => {
    const root = document.createElement('html');
    applyLocale(root, DEFAULT_LOCALE);
    expect(root.getAttribute('lang')).toBe(DEFAULT_LOCALE);
    expect(root.getAttribute('dir')).toBe('ltr');
  });

  it('remplace la locale précédente', () => {
    const root = document.createElement('html');
    root.setAttribute('lang', 'de');
    applyLocale(root, DEFAULT_LOCALE);
    expect(root.getAttribute('lang')).toBe(DEFAULT_LOCALE);
  });
});
