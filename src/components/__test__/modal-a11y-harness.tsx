// Harnais jsdom partage par `modal-a11y.radix-surfaces*.test.tsx` (FRO-01) : les criteres (a) a (e)
// mesures sur un composant REEL monte. Pas un test lui-meme.
//
// ⚠️ jsdom ne simule pas Tab natif : le piege est mesure en emettant Tab sur le dernier puis le
// premier element focalisable. Ce n'est PAS une mesure de navigateur ni de lecteur d'ecran.
import { useState, type ReactNode } from 'react';
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { installFocusHistory } from '@/lib/focus-history';

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }),
  });
}

// jsdom n'implemente pas ResizeObserver (lu par OKRModalSheet) : absence de l'environnement, pas du produit.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
}

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 60)); });

/** Un declencheur qui monte `children(close)` : la forme d'un parent reel. */
export function WithTrigger({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Declencheur</button>
      {open && children(() => setOpen(false))}
    </div>
  );
}

/** `[nom, rendu, ouvertParSonPropreBouton]`. */
export type Surface = [string, () => ReactNode, boolean?];

function open(selfOpening: boolean): HTMLElement {
  const trigger = selfOpening
    ? screen.getAllByRole('button')[0]
    : screen.getByRole('button', { name: 'Declencheur' });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return trigger;
}

const anyDialog = (): HTMLElement =>
  (screen.queryByRole('alertdialog') ?? screen.getByRole('dialog')) as HTMLElement;

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="switch"], [role="combobox"]';

export function measureSurfaces(label: string, surfaces: Surface[]): void {
  beforeAll(() => installFocusHistory());
  afterEach(cleanup);

  describe.each(surfaces)(`${label} · %s`, (_name, make, selfOpening = false) => {
    it('(a) le focus entre dans la surface', async () => {
      render(make()); open(selfOpening); await tick();
      expect(anyDialog().contains(document.activeElement)).toBe(true);
      expect(document.activeElement).not.toBe(document.body);
    });

    it('(b) Tab et Maj+Tab restent dans la surface', async () => {
      render(make()); open(selfOpening); await tick();
      const d = anyDialog();
      const items = Array.from(d.querySelectorAll<HTMLElement>(FOCUSABLE));
      expect(items.length).toBeGreaterThan(0);
      act(() => items[items.length - 1].focus());
      fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
      expect(d.contains(document.activeElement)).toBe(true);
      act(() => items[0].focus());
      fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });
      expect(d.contains(document.activeElement)).toBe(true);
    });

    it('(c) Echap ferme et (d) le focus revient au declencheur', async () => {
      render(make()); const trigger = open(selfOpening); await tick();
      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
      await tick();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('(e) role, aria-modal et nom accessible', async () => {
      render(make()); open(selfOpening); await tick();
      const d = anyDialog();
      expect(['dialog', 'alertdialog']).toContain(d.getAttribute('role'));
      expect(d.getAttribute('aria-modal')).toBe('true');
      const labelledBy = d.getAttribute('aria-labelledby');
      const name = d.getAttribute('aria-label') ?? (labelledBy ? document.getElementById(labelledBy)?.textContent : null);
      expect((name ?? '').trim().length).toBeGreaterThan(0);
    });
  });
}
