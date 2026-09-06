// @vitest-environment jsdom
//
// Assertions volontairement écrites en DOM natif : `@testing-library/jest-dom`
// n'est pas installé dans ce projet, et l'ajouter pour trois matchers de confort
// ne se justifie pas.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SectionHeader from './SectionHeader';
import Segmented from './Segmented';
import TouchTarget from './TouchTarget';
import BottomSheet from './BottomSheet';

describe('SectionHeader', () => {
  it('affiche le compte à côté du titre', () => {
    render(<SectionHeader title="En retard" count={3} />);
    expect(screen.getByRole('heading', { name: /En retard/ })).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('affiche bien un compte à zéro (0 n’est pas « absent »)', () => {
    render(<SectionHeader title="Terminées" count={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});

describe('Segmented', () => {
  const OPTIONS = [
    { value: 'week' as const, label: 'Sem.', ariaLabel: 'Semaine' },
    { value: 'month' as const, label: 'Mois' },
  ];

  it('marque une seule option comme sélectionnée', () => {
    render(
      <Segmented options={OPTIONS} value="week" onChange={vi.fn()} ariaLabel="Vue du calendrier" />,
    );
    expect(screen.getByRole('radio', { name: 'Semaine' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Mois' }).getAttribute('aria-checked')).toBe('false');
  });

  it('notifie le changement au clic sur une option inactive', () => {
    const onChange = vi.fn();
    render(
      <Segmented options={OPTIONS} value="week" onChange={onChange} ariaLabel="Vue du calendrier" />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Mois' }));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it("ne renotifie pas quand on reclique l'option déjà active", () => {
    const onChange = vi.fn();
    render(
      <Segmented options={OPTIONS} value="week" onChange={onChange} ariaLabel="Vue du calendrier" />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Semaine' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respecte la cible tactile sur chaque segment', () => {
    render(
      <Segmented options={OPTIONS} value="week" onChange={vi.fn()} ariaLabel="Vue du calendrier" />,
    );
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.className).toContain('min-h-touch');
    }
  });
});

describe('TouchTarget', () => {
  it('garantit une zone tactile de 44×44px', () => {
    render(<TouchTarget aria-label="Filtrer">i</TouchTarget>);
    const { className } = screen.getByRole('button', { name: 'Filtrer' });
    expect(className).toContain('min-h-touch');
    expect(className).toContain('min-w-touch');
  });

  it('est de type button par défaut (ne soumet pas un formulaire parent)', () => {
    render(<TouchTarget aria-label="Filtrer">i</TouchTarget>);
    expect(screen.getByRole('button', { name: 'Filtrer' }).getAttribute('type')).toBe('button');
  });
});

describe('BottomSheet', () => {
  it("ne rend rien tant qu'elle n'est pas ouverte", () => {
    render(<BottomSheet open={false} onClose={vi.fn()} ariaLabel="Choix">contenu</BottomSheet>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('affiche son contenu une fois ouverte, avec le bon libellé accessible', () => {
    render(<BottomSheet open onClose={vi.fn()} ariaLabel="Choix">contenu du sheet</BottomSheet>);
    const dialog = screen.getByRole('dialog', { name: 'Choix' });
    expect(dialog).toBeTruthy();
    expect(screen.getByText('contenu du sheet')).toBeTruthy();
  });

  it('ferme au clic sur le fond, pas au clic sur le panneau', () => {
    const onClose = vi.fn();
    render(<BottomSheet open onClose={onClose} ariaLabel="Choix">contenu</BottomSheet>);
    fireEvent.click(screen.getByText('contenu'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
