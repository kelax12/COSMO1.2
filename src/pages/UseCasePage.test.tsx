// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import UseCasePage from './UseCasePage';

// `useSeoMeta` touche au <head> réel et n'apporte rien ici.
vi.mock('@/lib/useSeoMeta', () => ({ useSeoMeta: () => {} }));

/**
 * Une page use-case doit se rendre AVEC OU SANS barre finale.
 *
 * ⚠️ Ce que ce test protège n'est pas une préférence de style d'URL. React
 * Router fait déjà correspondre `/pour-freelances/` à la route
 * `/pour-freelances` : la page se montait, puis se perdait toute seule en
 * cherchant la fiche du slug « pour-freelances/ » — et renvoyait vers
 * l'accueil. Mesuré en production le 2026-08-29, pas déduit.
 *
 * Le cas est celui de l'acquisition : les annuaires normalisent presque tous
 * les URL avec une barre finale. Un backlink durement obtenu envoyait donc son
 * visiteur sur la page d'accueil, et rien ne l'aurait signalé.
 */
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>ACCUEIL</p>} />
        <Route path="/pour-freelances" element={<UseCasePage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('UseCasePage — tolérance à la barre finale', () => {
  it('rend la page sans barre finale', () => {
    renderAt('/pour-freelances');
    expect(screen.queryByText('ACCUEIL')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBeTruthy();
  });

  it('rend la MÊME page avec une barre finale', () => {
    renderAt('/pour-freelances/');
    expect(screen.queryByText('ACCUEIL')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBeTruthy();
  });

  it('renvoie bien à l’accueil pour un slug inconnu', () => {
    render(
      <MemoryRouter initialEntries={['/pour-personne']}>
        <Routes>
          <Route path="/" element={<p>ACCUEIL</p>} />
          <Route path="/pour-personne" element={<UseCasePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('ACCUEIL')).toBeTruthy();
  });
});
