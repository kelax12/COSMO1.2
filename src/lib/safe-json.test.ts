// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { safeParse, safeParseArray, safeGetItem, safeSetItem, readJsonArray } from './safe-json';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('safe-json (règle B14)', () => {
  it('parse une valeur valide', () => {
    expect(safeParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('rend null sur une valeur corrompue plutôt que de lever', () => {
    expect(safeParse('{oops')).toBeNull();
  });

  it('rend null sur une valeur absente', () => {
    expect(safeParse(null)).toBeNull();
    expect(safeParse('')).toBeNull();
  });

  it('safeParseArray refuse ce qui n’est pas un tableau', () => {
    expect(safeParseArray('{"a":1}')).toBeNull();
    expect(safeParseArray('[1,2]')).toEqual([1, 2]);
  });

  // Le cas qui fait tomber un écran : `localStorage` lui-même jette
  // (Safari privé, cookies bloqués, webview). C'est `getItem` qui lève,
  // avant même le parse.
  it('survit à un localStorage qui JETTE à la lecture', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(safeGetItem('k')).toBeNull();
    expect(readJsonArray('k')).toBeNull();
  });

  it('survit à un localStorage qui JETTE à l’écriture (quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => safeSetItem('k', 'v')).not.toThrow();
  });
});
