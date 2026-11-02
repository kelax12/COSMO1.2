// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrgPrecontractualPictos } from './OrgPrecontractualPictos';

describe('OrgPrecontractualPictos', () => {
  it('quatre pictos et le texte légal COMPLET, sans repli', () => {
    render(<OrgPrecontractualPictos interval="monthly" />);
    const zone = screen.getByRole('region', { name: /l'essentiel du contrat/i });
    expect(within(zone).getAllByRole('listitem')).toHaveLength(4);
    expect(within(zone).getByText('Sans engagement')).toBeTruthy();
    expect(within(zone).getByText(/reconduit automatiquement à chaque échéance/i)).toBeTruthy();
    expect(within(zone).getByText(/droit de rétractation de 14 jours/i)).toBeTruthy();
  });

  it('en annuel, le premier picto annonce l engagement et le rappel', () => {
    render(<OrgPrecontractualPictos interval="yearly" />);
    expect(screen.getByText('Un an, rappel 45 jours avant')).toBeTruthy();
    expect(screen.queryByText('Sans engagement')).toBeNull();
  });
});
