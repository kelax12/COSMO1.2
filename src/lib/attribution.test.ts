// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  captureFirstTouch,
  readFirstTouch,
  normalizeSourceValue,
  FIRST_TOUCH_STORAGE_KEY,
} from './attribution';

/** Réécrit window.location.search sans quitter la page (jsdom). */
function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
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
  setSearch('');
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

  it('ne fait rien sans paramètre de source', () => {
    setSearch('?foo=bar');
    captureFirstTouch();
    expect(readFirstTouch()).toBeNull();
    expect(localStorage.getItem(FIRST_TOUCH_STORAGE_KEY)).toBeNull();
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
