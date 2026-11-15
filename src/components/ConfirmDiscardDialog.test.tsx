// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDiscardDialog from './ConfirmDiscardDialog';

vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));

// jsdom n'implemente pas `matchMedia` (lu par useBottomSheet / useSheetMotion).
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe('ConfirmDiscardDialog', () => {
  it('ne rend rien tant que la modale est fermée', () => {
    render(<ConfirmDiscardDialog isOpen={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByText('discard.title')).toBeNull();
  });

  it('« continuer » annule, « Abandonner » confirme, chacun une seule fois', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDiscardDialog isOpen onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'discard.keepEditing' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('un clic dans la feuille ne ferme pas, un clic sur le fond annule', () => {
    const onCancel = vi.fn();
    render(<ConfirmDiscardDialog isOpen onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('discard.body'));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Échap annule', () => {
    const onCancel = vi.fn();
    render(<ConfirmDiscardDialog isOpen onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
