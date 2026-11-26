// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import OkrGeneratorPage from './OkrGeneratorPage';
import { OKR_DOMAINES } from '@/content/okr-generator.mjs';

vi.mock('@/lib/useSeoMeta', () => ({ useSeoMeta: () => {} }));

// Outil gratuit sans compte (plan SEO C7) : l'OKR construit doit survivre au
// rechargement, rester sous 5 résultats clés, et résister à un stockage abîmé.
const KEY = 'cosmo_outil_okr';
const monter = () => render(<MemoryRouter><OkrGeneratorPage /></MemoryRouter>);
const resultat = (c: HTMLElement) => c.querySelector('section[aria-labelledby="okr-resultat"]') as HTMLElement;

describe('générateur d’OKR', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('chaque domaine a 2 objectifs et 6 résultats clés complets, en fr et en', () => {
    for (const d of OKR_DOMAINES) {
      for (const l of ['fr', 'en'] as const) {
        expect(d[l].objectifs.length).toBe(2);
        expect(d[l].kr.length).toBe(6);
        for (const k of d[l].kr) expect(k.every((x) => x.length > 0)).toBe(true);
      }
    }
  });

  it('compose un OKR, le plafonne à 5 résultats clés et le retrouve après rechargement', () => {
    const { container, unmount } = monter();
    fireEvent.change(container.querySelector('#okr-objectif')!, { target: { value: 'Retrouver la forme' } });
    const cases = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    cases.forEach((c) => fireEvent.click(c));
    expect(resultat(container).querySelectorAll('li').length).toBe(5);
    expect(cases[5].disabled).toBe(true);

    fireEvent.change(container.querySelector('#kr-cible-0')!, { target: { value: '40' } });
    unmount();
    const second = monter();
    expect(resultat(second.container).textContent).toContain('Retrouver la forme');
    expect((second.container.querySelector('#kr-cible-0') as HTMLInputElement).value).toBe('40');
  });

  it('résiste à un stockage abîmé', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ domaine: 'inconnu', objectif: 42, krs: [{ texte: '' }, 'x', { texte: 'ok', unite: 'u', depart: '1', cible: '2' }] }));
    const { container } = monter();
    expect(resultat(container).querySelectorAll('li').length).toBe(1);
    cleanup();
    window.localStorage.setItem(KEY, '{pas du json');
    expect(monter().container.querySelector('#okr-objectif')).not.toBeNull();
  });
});
