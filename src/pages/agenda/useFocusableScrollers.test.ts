// @vitest-environment jsdom
// C-119 · témoin : seul un défileur qui déborde devient un arrêt de tabulation nommé.
import { describe, expect, it } from 'vitest';
import { markScrollers } from './useFocusableScrollers';

function scroller(overflowing: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fc-scroller';
  el.style.overflowY = 'auto';
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: overflowing ? 900 : 100 });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: 100 });
  return el;
}

describe('markScrollers (C-119)', () => {
  it('rend focalisable et nomme un défileur qui déborde', () => {
    const root = document.createElement('div');
    const el = scroller(true);
    root.appendChild(el);
    markScrollers(root, 'Grille du calendrier');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Grille du calendrier');
  });

  it("n'ajoute aucun arrêt de tabulation à un défileur qui ne déborde pas", () => {
    const root = document.createElement('div');
    const el = scroller(false);
    root.appendChild(el);
    markScrollers(root, 'Grille du calendrier');
    expect(el.hasAttribute('tabindex')).toBe(false);
  });

  it("retire l'arrêt quand le défileur cesse de déborder", () => {
    const root = document.createElement('div');
    const el = scroller(true);
    root.appendChild(el);
    markScrollers(root, 'x');
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 100 });
    markScrollers(root, 'x');
    expect(el.hasAttribute('tabindex')).toBe(false);
    expect(el.hasAttribute('role')).toBe(false);
  });
});
