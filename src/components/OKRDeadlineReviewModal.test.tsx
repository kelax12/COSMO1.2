// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { OKR } from '@/modules/okrs';

vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));

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

import OKRDeadlineReviewModal from './OKRDeadlineReviewModal';

const dayKey = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const makeOkr = (over: Partial<OKR> = {}): OKR =>
  ({
    id: 'okr-1',
    title: 'Lancer la V2',
    description: 'Objectif du trimestre',
    category: 'cat-1',
    startDate: dayKey(-30),
    endDate: dayKey(-1),
    progress: 0,
    completed: false,
    keyResults: [
      { id: 'kr-1', title: 'Pages écrites', currentValue: 5, targetValue: 10, estimatedTime: 30, completed: false },
      { id: 'kr-2', title: 'Tests verts', currentValue: 0, targetValue: 0, estimatedTime: 0, completed: false },
    ],
    ...over,
  }) as unknown as OKR;

const categories = [{ id: 'cat-1', name: 'Produit', color: 'blue' }];
const noTarget = { current: null };

const mount = (okr: OKR | null, over: Partial<React.ComponentProps<typeof OKRDeadlineReviewModal>> = {}) => {
  const onClose = vi.fn();
  const onValidate = vi.fn();
  const utils = render(
    <OKRDeadlineReviewModal
      okr={okr}
      categories={categories}
      flyTargetRef={noTarget}
      onClose={onClose}
      onValidate={onValidate}
      resolveColor={(c) => `#${c}`}
      {...over}
    />,
  );
  return { onClose, onValidate, ...utils };
};

describe('OKRDeadlineReviewModal', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('ne rend rien sans objectif', () => {
    mount(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('prend pour nom accessible le titre de l’objectif et indique sa catégorie', () => {
    mount(makeOkr());
    expect(screen.getByRole('dialog', { name: /Lancer la V2/ })).toBeTruthy();
    expect(screen.getByText('Produit')).toBeTruthy();
  });

  it('distingue une échéance dépassée d’une échéance du jour', () => {
    const { unmount } = mount(makeOkr({ endDate: dayKey(-3) }));
    expect(screen.getByText('deadlineReview.overdue')).toBeTruthy();
    unmount();
    mount(makeOkr({ endDate: new Date().toISOString() }));
    expect(screen.getByText('deadlineReview.dueToday')).toBeTruthy();
  });

  it('bloque le défilement de la page tant que la fenêtre est ouverte et le rend à la fermeture', () => {
    const { rerender } = mount(makeOkr());
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <OKRDeadlineReviewModal
        okr={null}
        categories={categories}
        flyTargetRef={noTarget}
        onClose={vi.fn()}
        onValidate={vi.fn()}
        resolveColor={(c) => c}
      />,
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('recalcule la progression globale quand on corrige un résultat clé (cible nulle = 0 %, sans division)', () => {
    mount(makeOkr());
    // (50 % + 0 %) / 2 = 25 %
    expect(screen.getByText('25%')).toBeTruthy();
    fireEvent.change(screen.getByRole('spinbutton', { name: /Pages écrites/ }), { target: { value: '10' } });
    // (100 % + 0 %) / 2 = 50 %
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('n’affiche la durée d’un résultat clé que si elle est définie, et le temps total attendu', () => {
    mount(makeOkr());
    expect(screen.getByText('30min')).toBeTruthy();
    expect(screen.getAllByText(/min$/)).toHaveLength(1);
    // 5 × 30 = 150 min faites sur 10 × 30 = 300 min.
    expect(screen.getByText('card.timeSpent')).toBeTruthy();
  });

  it('valide sans animation quand la cible de vol est absente, avec progression et complétion à jour', () => {
    const { onValidate } = mount(makeOkr());
    fireEvent.change(screen.getByRole('spinbutton', { name: /Pages écrites/ }), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'deadlineReview.validate' }));
    expect(onValidate).toHaveBeenCalledTimes(1);
    const updated = onValidate.mock.calls[0][0] as OKR;
    expect(updated.completed).toBe(true);
    expect(updated.progress).toBe(50);
    expect(updated.keyResults[0]).toMatchObject({ currentValue: 10, completed: true });
  });

  it('avec une cible de vol, bloque le bouton pendant l’animation et ne valide qu’une seule fois', async () => {
    const target = document.createElement('button');
    document.body.appendChild(target);
    const { onValidate, onClose } = mount(makeOkr(), { flyTargetRef: { current: target } });
    const validate = screen.getByRole('button', { name: 'deadlineReview.validate' }) as HTMLButtonElement;
    fireEvent.click(validate);
    expect(validate.disabled).toBe(true);

    // Pendant le vol, Échap et le voile ne ferment pas.
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    await waitFor(() => expect(onValidate).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 1000));
    expect(onValidate).toHaveBeenCalledTimes(1);
    target.remove();
  });

  it('se ferme par la croix, par le voile et par Échap en phase d’édition', () => {
    const { onClose } = mount(makeOkr());
    fireEvent.click(screen.getByRole('button', { name: 'deadlineReview.close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
