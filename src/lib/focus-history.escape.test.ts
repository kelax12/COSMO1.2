// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { escapeAttr, reconnected } from './focus-history';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const LIBELLES = ['Fermer', 'a"b', 'a\\b', 'liste[0]', 'a\\"]b', 'x] , y[', 'fin\\'];

describe('focus-history : libelle dans un selecteur (CodeQL 27, SEC-13)', () => {
  for (const mode of ['sans CSS.escape', 'avec CSS.escape']) {
    describe(mode, () => {
      it.each(LIBELLES)('retrouve un bouton recree dont le libelle est %j', (libelle) => {
        if (mode === 'avec CSS.escape') {
          vi.stubGlobal('CSS', { escape: (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) });
        } else {
          vi.stubGlobal('CSS', undefined);
        }
        const ancien = document.createElement('button');
        ancien.setAttribute('aria-label', libelle);
        document.body.appendChild(ancien);
        ancien.remove();
        const neuf = document.createElement('button');
        neuf.setAttribute('aria-label', libelle);
        document.body.appendChild(neuf);
        expect(() => reconnected(ancien)).not.toThrow();
        expect(reconnected(ancien)).toBe(neuf);
      });
    });
  }

  it('le repli echappe l\'antislash avant le guillemet', () => {
    vi.stubGlobal('CSS', undefined);
    expect(escapeAttr('a\\"b')).toBe('a\\\\\\"b');
  });
});
