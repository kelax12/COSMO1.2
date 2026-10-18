// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import PolitiqueConfidentialitePage from './PolitiqueConfidentialitePage';

vi.mock('@/lib/useSeoMeta', () => ({ useSeoMeta: () => {} }));

/**
 * 🔴 L'ancre `#prospection` est visée par CHAQUE email de prospection
 * (information de l'art. 14 RGPD, traitement T11 du registre). La renommer ou
 * la perdre enverrait chaque personne prospectée en haut d'une politique où
 * elle ne trouve pas ce qui la concerne, sans qu'aucun lien ne casse.
 */
describe('PolitiqueConfidentialitePage · section prospection', () => {
  it('porte la section sous l’ancre stable #prospection, et y défile', () => {
    // jsdom n'implémente pas le défilement.
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    const { container } = render(
      <MemoryRouter initialEntries={['/politique-confidentialite#prospection']}>
        <PolitiqueConfidentialitePage />
      </MemoryRouter>,
    );
    const section = container.querySelector('#prospection');
    expect(section).not.toBeNull();
    expect(section?.querySelector('h2')?.textContent).toMatch(/prospection/i);
    expect(scrolled).toEqual([section]);
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(10);
  });
});
