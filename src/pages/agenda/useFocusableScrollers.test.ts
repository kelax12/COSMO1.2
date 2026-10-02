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

  // C-119, suite (2026-10-01) : dans la grille FullCalendar, une `region` (ou un simple élément
  // focalisable sans rôle de grille) coupe `grid > rowgroup > row` — deux
  // violations axe critiques. Le défileur DEVIENT le `rowgroup`.
  function inGrid(el: HTMLElement): { grid: HTMLElement; tbody: HTMLElement } {
    const grid = document.createElement('table');
    grid.setAttribute('role', 'grid');
    const tbody = document.createElement('tbody');
    tbody.setAttribute('role', 'rowgroup');
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'presentation');
    const td = document.createElement('td');
    td.setAttribute('role', 'presentation');
    td.appendChild(el);
    tr.appendChild(td);
    tbody.appendChild(tr);
    grid.appendChild(tbody);
    return { grid, tbody };
  }

  it('dans une grille, le défileur prend le rôle du rowgroup au lieu de region', () => {
    const el = scroller(true);
    const { grid, tbody } = inGrid(el);
    markScrollers(grid, 'Grille du calendrier');
    expect(el.getAttribute('role')).toBe('rowgroup');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('aria-label')).toBe('Grille du calendrier');
    expect(tbody.getAttribute('role')).toBe('presentation');
    // Aucun rowgroup imbriqué : un seul entre la grille et les rangées.
    expect(grid.querySelectorAll('[role="rowgroup"]')).toHaveLength(1);
  });

  it('rend son rôle au rowgroup de FullCalendar quand le défileur cesse de déborder', () => {
    const el = scroller(true);
    const { grid, tbody } = inGrid(el);
    markScrollers(grid, 'x');
    markScrollers(grid, 'x'); // idempotent : le tbody cédé reste reconnu
    expect(el.getAttribute('role')).toBe('rowgroup');
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 100 });
    markScrollers(grid, 'x');
    expect(el.hasAttribute('role')).toBe(false);
    expect(tbody.getAttribute('role')).toBe('rowgroup');
    expect(tbody.hasAttribute('data-rowgroup-yielded')).toBe(false);
  });

  it("garde le tbody cédé tant qu'un autre défileur y est encore un rowgroup", () => {
    const a = scroller(true);
    const { grid, tbody } = inGrid(a);
    const b = scroller(true);
    tbody.firstElementChild!.firstElementChild!.appendChild(b);
    markScrollers(grid, 'x');
    Object.defineProperty(a, 'scrollHeight', { configurable: true, value: 100 });
    markScrollers(grid, 'x');
    expect(b.getAttribute('role')).toBe('rowgroup');
    expect(tbody.getAttribute('role')).toBe('presentation');
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
