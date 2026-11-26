// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import EisenhowerToolPage from './EisenhowerToolPage';

vi.mock('@/lib/useSeoMeta', () => ({ useSeoMeta: () => {} }));

// Outil gratuit sans compte (plan SEO C7) : ce qui compte pour le visiteur, c'est
// que sa matrice survive au rechargement et qu'une donnée abîmée ne la casse pas.
const KEY = 'cosmo_outil_eisenhower';
const monter = () =>
  render(
    <MemoryRouter>
      <EisenhowerToolPage />
    </MemoryRouter>,
  );
const caseDe = (c: HTMLElement, q: string) => c.querySelector(`section[aria-labelledby="titre-${q}"]`) as HTMLElement;

describe('outil matrice d’Eisenhower', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('ajoute une tâche dans la case choisie, la déplace, puis la retrouve après rechargement', () => {
    const { container, unmount } = monter();
    fireEvent.change(container.querySelector('#outil-tache')!, { target: { value: 'Préparer le comité' } });
    fireEvent.change(container.querySelector('#outil-case')!, { target: { value: 'q1' } });
    fireEvent.submit(container.querySelector('form')!);
    expect(caseDe(container, 'q1').textContent).toContain('Préparer le comité');

    const deplacer = caseDe(container, 'q1').querySelector('select') as HTMLSelectElement;
    fireEvent.change(deplacer, { target: { value: 'q2' } });
    expect(caseDe(container, 'q1').textContent).not.toContain('Préparer le comité');
    expect(caseDe(container, 'q2').textContent).toContain('Préparer le comité');

    unmount();
    const second = monter();
    expect(caseDe(second.container, 'q2').textContent).toContain('Préparer le comité');
  });

  it('ignore un stockage abîmé ou des entrées invalides sans planter', () => {
    window.localStorage.setItem(KEY, JSON.stringify([{ id: 'a', text: 'ok', q: 'q3' }, { id: 'b', text: 'x', q: 'q9' }, 'n’importe quoi']));
    const { container } = monter();
    expect(caseDe(container, 'q3').textContent).toContain('ok');
    expect(container.textContent).not.toContain('q9');

    cleanup();
    window.localStorage.setItem(KEY, '{pas du json');
    const autre = monter();
    expect(autre.container.querySelector('#outil-tache')).not.toBeNull();
  });

  it('n’ajoute pas une tâche vide', () => {
    const { container } = monter();
    fireEvent.change(container.querySelector('#outil-tache')!, { target: { value: '   ' } });
    fireEvent.submit(container.querySelector('form')!);
    expect(container.querySelectorAll('li').length).toBe(0);
  });
});
