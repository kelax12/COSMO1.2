// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTheme, defaultTheme, isTheme, resolveInitialTheme } from './theme';

/** jsdom ne fournit pas matchMedia — on le stubbe par test. */
function stubViewport({ width, prefersDark }: { width: number; prefersDark: boolean }) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark') ? prefersDark : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('isTheme', () => {
  it('accepte les 4 thèmes et rejette le reste', () => {
    expect(['light', 'dark', 'gris', 'noir'].every(isTheme)).toBe(true);
    expect(isTheme('black')).toBe(false);
    expect(isTheme('midnight')).toBe(false);
    expect(isTheme('glass')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe('defaultTheme', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('choisit le thème gris sur mobile, quelle que soit la préférence système', () => {
    stubViewport({ width: 375, prefersDark: false });
    expect(defaultTheme()).toBe('gris');
  });

  it('suit la préférence système sur desktop', () => {
    stubViewport({ width: 1440, prefersDark: true });
    expect(defaultTheme()).toBe('dark');
    stubViewport({ width: 1440, prefersDark: false });
    expect(defaultTheme()).toBe('light');
  });
});

describe('resolveInitialTheme', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('privilégie toujours le choix explicite de l’utilisateur', () => {
    stubViewport({ width: 375, prefersDark: false });
    localStorage.setItem('theme', 'light');
    expect(resolveInitialTheme()).toBe('light');
  });

  it('privilégie noir même si l’ancien défaut mobile était gris', () => {
    stubViewport({ width: 375, prefersDark: false });
    localStorage.setItem('theme', 'noir');
    expect(resolveInitialTheme()).toBe('noir');
  });

  it.each(['black', 'midnight', 'monochrome'])(
    'migre l’ancien thème « %s » vers gris, en base comme en retour',
    (legacy) => {
      stubViewport({ width: 1440, prefersDark: false });
      localStorage.setItem('theme', legacy);

      expect(resolveInitialTheme()).toBe('gris');
      // Sans réécriture, l'utilisateur retomberait sur `light` au prochain
      // démarrage puisque la valeur stockée resterait invalide.
      expect(localStorage.getItem('theme')).toBe('gris');
    },
  );

  it('ignore une valeur corrompue et retombe sur le défaut', () => {
    stubViewport({ width: 1440, prefersDark: false });
    localStorage.setItem('theme', 'glass');
    expect(resolveInitialTheme()).toBe('light');
  });
});

describe('applyTheme', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('html');
  });

  it('light ne pose aucune classe', () => {
    applyTheme(root, 'light');
    expect(root.className).toBe('');
  });

  it('dark pose dark seul', () => {
    applyTheme(root, 'dark');
    expect([...root.classList]).toEqual(['dark']);
  });

  it('gris pose dark + gris', () => {
    applyTheme(root, 'gris');
    expect([...root.classList].sort()).toEqual(['dark', 'gris']);
  });

  it('noir pose dark + noir', () => {
    applyTheme(root, 'noir');
    expect([...root.classList].sort()).toEqual(['dark', 'noir']);
  });

  it('purge les classes du thème précédent', () => {
    applyTheme(root, 'noir');
    applyTheme(root, 'light');
    expect(root.className).toBe('');
  });

  it('purge les reliquats d’anciens thèmes', () => {
    root.classList.add('glass', 'test', 'monochrome', 'midnight', 'black');
    applyTheme(root, 'dark');
    expect([...root.classList]).toEqual(['dark']);
  });
});
