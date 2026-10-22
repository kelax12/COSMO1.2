// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  captureFirstTouch,
  readFirstTouch,
  recordFallbackSource,
  normalizeSourceValue,
  FIRST_TOUCH_STORAGE_KEY,
  persistPendingFirstTouch,
  clearAttributionTraces,
  _pendingFirstTouchForTests,
} from './attribution';
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_AT_KEY } from './cookie-consent';

/** Les tests historiques supposent un visiteur qui a ACCEPTÉ (2026-10-13). */
function accept(): void {
  localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
  localStorage.setItem(COOKIE_CONSENT_AT_KEY, String(Date.now()));
}

/** Réécrit window.location.search sans quitter la page (jsdom). */
function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

/** Simule la page d'où vient le visiteur (jsdom laisse `referrer` vide). */
function setReferrer(url: string): void {
  Object.defineProperty(document, 'referrer', { value: url, configurable: true });
}

/**
 * Pose une entrée datée de `ageDays` jours. On vieillit la donnée plutôt que
 * l'horloge : les faux timers gèleraient aussi les `await import()` des hooks
 * globaux de `src/test/setup.ts`.
 */
function storeAged(source: string, ageDays: number): void {
  localStorage.setItem(
    FIRST_TOUCH_STORAGE_KEY,
    JSON.stringify({ source, ts: Date.now() - ageDays * 24 * 60 * 60 * 1000 })
  );
}

beforeEach(() => {
  localStorage.clear();
  clearAttributionTraces(localStorage);
  accept();
  setSearch('');
  setReferrer('');
});

// 🔴 Loi I&L art. 82 : la source finit sur le PROFIL, elle exige le consentement.
describe('sans consentement', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAttributionTraces(localStorage);
  });

  it("captureFirstTouch n'écrit RIEN sur l'appareil, retient en mémoire", () => {
    setSearch('?ref=tiktok');
    captureFirstTouch();
    expect(localStorage.getItem(FIRST_TOUCH_STORAGE_KEY)).toBeNull();
    expect(_pendingFirstTouchForTests()?.source).toBe('tiktok');
    expect(readFirstTouch()).toBeNull();
  });

  it('accepter ensuite pose la source retenue', () => {
    setSearch('?ref=tiktok');
    captureFirstTouch();
    accept();
    persistPendingFirstTouch();
    expect(readFirstTouch()?.source).toBe('tiktok');
    expect(_pendingFirstTouchForTests()).toBeNull();
  });

  it('refuser ensuite ne pose rien', () => {
    setSearch('?ref=tiktok');
    captureFirstTouch();
    localStorage.setItem(COOKIE_CONSENT_KEY, 'refused');
    persistPendingFirstTouch();
    clearAttributionTraces(localStorage);
    expect(localStorage.getItem(FIRST_TOUCH_STORAGE_KEY)).toBeNull();
    expect(_pendingFirstTouchForTests()).toBeNull();
  });

  it("une valeur posée AVANT le correctif n'est pas lue sans consentement", () => {
    storeAged('tiktok', 1);
    expect(readFirstTouch()).toBeNull();
  });

  it("recordFallbackSource n'écrit rien", () => {
    recordFallbackSource('demo');
    expect(localStorage.getItem(FIRST_TOUCH_STORAGE_KEY)).toBeNull();
  });

  it('clearAttributionTraces efface la valeur stockée', () => {
    storeAged('tiktok', 1);
    clearAttributionTraces(localStorage);
    expect(localStorage.getItem(FIRST_TOUCH_STORAGE_KEY)).toBeNull();
  });
});

describe('normalizeSourceValue', () => {
  it('met en minuscules et coupe les espaces', () => {
    expect(normalizeSourceValue('  TikTok  ')).toBe('tiktok');
  });

  it('accepte lettres, chiffres, tiret et underscore', () => {
    expect(normalizeSourceValue('annuaire_bde-2026')).toBe('annuaire_bde-2026');
  });

  it('rejette une valeur hors whitelist plutôt que de la nettoyer', () => {
    // On préfère perdre l'attribution que de laisser passer du contenu
    // arbitraire venu de l'URL vers la metadata signup.
    expect(normalizeSourceValue('<script>alert(1)</script>')).toBeNull();
    expect(normalizeSourceValue('tik tok')).toBeNull();
    expect(normalizeSourceValue('produit@canal')).toBeNull();
    expect(normalizeSourceValue('café')).toBeNull();
  });

  it('tronque à 40 caractères', () => {
    expect(normalizeSourceValue('a'.repeat(60))).toBe('a'.repeat(40));
  });

  it('renvoie null sur vide / absent', () => {
    expect(normalizeSourceValue('')).toBeNull();
    expect(normalizeSourceValue('   ')).toBeNull();
    expect(normalizeSourceValue(null)).toBeNull();
    expect(normalizeSourceValue(undefined)).toBeNull();
  });
});

describe('captureFirstTouch', () => {
  it('capture ?ref=', () => {
    setSearch('?ref=tiktok');
    captureFirstTouch();
    expect(readFirstTouch()?.source).toBe('tiktok');
  });

  it('retombe sur utm_source si ref est absent, et garde utm_campaign', () => {
    setSearch('?utm_source=reddit&utm_campaign=lancement');
    captureFirstTouch();
    expect(readFirstTouch()).toMatchObject({ source: 'reddit', campaign: 'lancement' });
  });

  it('sans paramètre ni référent, note une arrivée directe (2026-10-18)', () => {
    setSearch('?foo=bar');
    setReferrer('');
    captureFirstTouch();
    expect(readFirstTouch()?.source).toBe('direct');
  });

  it('sans paramètre, déduit la source du site référent', () => {
    setReferrer('https://www.google.fr/');
    captureFirstTouch();
    expect(readFirstTouch()?.source).toBe('google');
  });

  it('un paramètre explicite prime sur le référent', () => {
    setSearch('?ref=tiktok');
    setReferrer('https://www.instagram.com/');
    captureFirstTouch();
    expect(readFirstTouch()?.source).toBe('tiktok');
  });

  it("un retour de connexion Google n'est pas une arrivée", () => {
    setReferrer('https://accounts.google.com/o/oauth2/auth');
    captureFirstTouch();
    expect(readFirstTouch()).toBeNull();
  });

  it("n'écrase JAMAIS une attribution existante (first-touch)", () => {
    setSearch('?ref=tiktok');
    captureFirstTouch();
    setSearch('?ref=reddit');
    captureFirstTouch();
    expect(readFirstTouch()?.source).toBe('tiktok');
  });

  it('ne stocke pas une valeur non conforme', () => {
    setSearch('?ref=' + encodeURIComponent('drop table users'));
    captureFirstTouch();
    expect(localStorage.getItem(FIRST_TOUCH_STORAGE_KEY)).toBeNull();
  });

  it('ne jette pas si localStorage est indisponible', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    setSearch('?ref=tiktok');
    expect(() => captureFirstTouch()).not.toThrow();
    spy.mockRestore();
  });
});

describe('recordFallbackSource', () => {
  it('pose la source quand rien n’est attribué', () => {
    recordFallbackSource('demo');
    expect(readFirstTouch()?.source).toBe('demo');
  });

  it('ne PRIME JAMAIS sur une campagne réelle', () => {
    // Un visiteur venu de ?ref=tiktok qui passe par la démo reste attribué à
    // TikTok : c'est TikTok qui l'a amené, la démo n'est qu'une étape.
    setSearch('?ref=tiktok');
    captureFirstTouch();
    recordFallbackSource('demo');
    expect(readFirstTouch()?.source).toBe('tiktok');
  });

  it('remplace une simple arrivée directe : la démo est plus précise', () => {
    captureFirstTouch();
    expect(readFirstTouch()?.source).toBe('direct');
    recordFallbackSource('demo');
    expect(readFirstTouch()?.source).toBe('demo');
  });

  it('ne remplace pas une source déduite du référent', () => {
    setReferrer('https://www.linkedin.com/feed/');
    captureFirstTouch();
    recordFallbackSource('demo');
    expect(readFirstTouch()?.source).toBe('linkedin');
  });

  it('remplace une attribution expirée', () => {
    storeAged('tiktok', 31);
    recordFallbackSource('demo');
    expect(readFirstTouch()?.source).toBe('demo');
  });

  it('rejette une source non conforme', () => {
    recordFallbackSource('pas valide !');
    expect(readFirstTouch()).toBeNull();
  });

  it('ne jette pas si localStorage est indisponible', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => recordFallbackSource('demo')).not.toThrow();
    spy.mockRestore();
  });
});

describe('readFirstTouch', () => {
  it('ignore une entrée de plus de 30 jours', () => {
    storeAged('tiktok', 29);
    expect(readFirstTouch()?.source).toBe('tiktok');

    storeAged('tiktok', 31);
    expect(readFirstTouch()).toBeNull();
  });

  it('laisse une entrée expirée être remplacée par une nouvelle capture', () => {
    storeAged('tiktok', 31);
    setSearch('?ref=reddit');
    captureFirstTouch();
    expect(readFirstTouch()?.source).toBe('reddit');
  });

  it('ignore un JSON corrompu', () => {
    localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, 'pas du json');
    expect(readFirstTouch()).toBeNull();
  });

  it('ignore une entrée sans les champs attendus', () => {
    localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify({ source: 'tiktok' }));
    expect(readFirstTouch()).toBeNull();
  });

  it('re-valide à la lecture une valeur trafiquée à la main', () => {
    // localStorage est modifiable par l'utilisateur : la garde de stockage ne
    // suffit pas, il faut aussi filtrer en sortie.
    localStorage.setItem(
      FIRST_TOUCH_STORAGE_KEY,
      JSON.stringify({ source: '<img onerror=x>', ts: Date.now() })
    );
    expect(readFirstTouch()).toBeNull();
  });

  it('ne jette pas si localStorage est indisponible', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => readFirstTouch()).not.toThrow();
    expect(readFirstTouch()).toBeNull();
    spy.mockRestore();
  });
});
