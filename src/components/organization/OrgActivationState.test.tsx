// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { OrgActivationState } from './OrgActivationState';

const renderPhase = (phase: 'waiting' | 'timeout' | 'welcome', onClose = vi.fn()) =>
  render(
    <MemoryRouter>
      <OrgActivationState phase={phase} tierLabel="Équipe" membersHref="/entreprise/members" onClose={onClose} />
    </MemoryRouter>,
  );

describe('OrgActivationState', () => {
  it('attente : message d activation, annoncé', () => {
    renderPhase('waiting');
    expect(screen.getByRole('status').textContent).toMatch(/activation en cours/i);
  });

  it('délai dépassé : rassure sur le paiement et donne un recours', () => {
    renderPhase('timeout');
    expect(screen.getByText(/votre paiement est bien reçu/i)).toBeTruthy();
    expect(screen.getByText(/contact@thecosmo\.app/)).toBeTruthy();
  });

  it('bienvenue : nomme le palier, mène aux membres, se ferme', () => {
    const onClose = vi.fn();
    renderPhase('welcome', onClose);
    expect(screen.getByText('Bienvenue dans le plan Équipe')).toBeTruthy();
    expect(screen.getByRole('link', { name: /inviter des membres/i }).getAttribute('href')).toBe('/entreprise/members');
    fireEvent.click(screen.getByRole('button', { name: /fermer/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('bienvenue : l orbite est décorative (aria-hidden) et seul le texte est annoncé', () => {
    const { container } = renderPhase('welcome');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('status').querySelector('a, button')).toBeNull();
  });
});
