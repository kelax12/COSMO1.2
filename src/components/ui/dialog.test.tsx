// @vitest-environment jsdom
// Non-régression : DialogOverlay doit accepter un ref (React.forwardRef).
// Sans forwardRef, Radix Primitive.div.SlotClone passait un ref à une fonction
// component → warning React "Function components cannot be given refs".
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DialogOverlay } from './dialog';

describe('DialogOverlay', () => {
  it('exposes a displayName (forwardRef registered)', () => {
    // DialogPrimitive.Overlay.displayName is the source of truth.
    expect(DialogOverlay.displayName).toBe(DialogPrimitive.Overlay.displayName);
  });

  it('accepts a ref without React warning', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ref = React.createRef<HTMLDivElement>();
    // Wrap in DialogPrimitive.Root (required by Radix) with open=true so the
    // Overlay is actually mounted (it renders nothing when closed).
    render(
      <DialogPrimitive.Root open>
        <DialogPrimitive.Portal>
          <DialogOverlay ref={ref} />
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>,
    );

    const refWarnings = consoleSpy.mock.calls.filter(args =>
      typeof args[0] === 'string' &&
      args[0].includes('cannot be given refs'),
    );
    expect(refWarnings).toHaveLength(0);
    consoleSpy.mockRestore();
  });
});

// ── A-3 (2026-09-03) — le bouton de fermeture par défaut parlait anglais ──
//
// `DialogContent` monte, quand `showCloseButton` n'est pas désactivé, une
// croix dont le SEUL nom accessible était `<span class="sr-only">Close</span>`,
// écrit en dur dans la source shadcn amont. Sept composants du produit
// utilisent ce défaut : un lecteur d'écran francophone entendait « Close ».
// `i18n:scan` ne pouvait pas le voir — il cherche du FRANÇAIS en dur.
describe('DialogContent — bouton de fermeture par défaut', () => {
  it('porte un nom accessible traduit, jamais « Close »', async () => {
    const { DialogContent, DialogTitle } = await import('./dialog');
    const { getByRole } = render(
      <DialogPrimitive.Root open>
        <DialogContent>
          <DialogTitle>Titre</DialogTitle>
        </DialogContent>
      </DialogPrimitive.Root>,
    );
    const close = getByRole('button', { name: /fermer/i });
    expect(close).toBeTruthy();
    expect(close.textContent).not.toMatch(/close/i);
  });
});
