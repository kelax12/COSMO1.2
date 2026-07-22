// @vitest-environment jsdom
//
// Assertions volontairement écrites en DOM natif : `@testing-library/jest-dom`
// n'est pas installé dans ce projet, et l'ajouter pour trois matchers de confort
// ne se justifie pas.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ListRow from './ListRow';
import SectionHeader from './SectionHeader';
import Segmented from './Segmented';
import TouchTarget from './TouchTarget';
import MobileScreen from './MobileScreen';

describe('MobileScreen', () => {
  it('réserve plus de place en bas quand la page a un FAB', () => {
    const { container, rerender } = render(<MobileScreen>contenu</MobileScreen>);
    const screenEl = () => container.firstElementChild as HTMLElement;
    expect(screenEl().className).toContain('pb-[calc(64px+env(safe-area-inset-bottom)+24px)]');

    rerender(<MobileScreen hasFab>contenu</MobileScreen>);
    expect(screenEl().className).toContain('pb-[calc(64px+env(safe-area-inset-bottom)+88px)]');
  });

  it('utilise 100dvh et jamais 100vh (Safari iOS rogne sinon le contenu)', () => {
    const { container } = render(<MobileScreen>contenu</MobileScreen>);
    const className = (container.firstElementChild as HTMLElement).className;
    expect(className).toContain('min-h-[100dvh]');
    expect(className).not.toContain('100vh');
  });

  it('permet de retirer la gouttière pour un contenu bord à bord', () => {
    const { container } = render(<MobileScreen gutter={false}>contenu</MobileScreen>);
    expect((container.firstElementChild as HTMLElement).className).not.toContain('px-gutter');
  });
});

describe('ListRow', () => {
  it('affiche titre et meta', () => {
    render(<ListRow title="Réviser le devis" meta="Demain · 45 min" />);
    expect(screen.getByText('Réviser le devis')).toBeTruthy();
    expect(screen.getByText('Demain · 45 min')).toBeTruthy();
  });

  it("n'est un bouton que si elle est cliquable", () => {
    const { rerender } = render(<ListRow title="Inerte" />);
    expect(screen.queryByRole('button')).toBeNull();

    rerender(<ListRow title="Cliquable" onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('est activable au clavier (Entrée et Espace), et rien d’autre', () => {
    const onClick = vi.fn();
    render(<ListRow title="Cliquable" onClick={onClick} />);
    const row = screen.getByRole('button');

    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(row, { key: 'a' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('respecte la cible tactile minimale', () => {
    render(<ListRow title="Ligne" onClick={vi.fn()} />);
    expect(screen.getByRole('button').className).toContain('min-h-touch');
  });

  it('affiche le filet de couleur uniquement quand une couleur est fournie', () => {
    const { container, rerender } = render(<ListRow title="Sans filet" />);
    expect(container.querySelector('[aria-hidden]')).toBeNull();

    rerender(<ListRow title="Avec filet" railColor="#ef4444" />);
    const rail = container.querySelector('[aria-hidden]') as HTMLElement;
    expect(rail).toBeTruthy();
    expect(rail.style.backgroundColor).toBe('rgb(239, 68, 68)');
  });
});

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
