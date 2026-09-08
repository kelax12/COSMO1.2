// @vitest-environment jsdom
//
// Assertions volontairement écrites en DOM natif : `@testing-library/jest-dom`
// n'est pas installé dans ce projet, et l'ajouter pour trois matchers de confort
// ne se justifie pas.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

// ═══════════════════════════════════════════════════════════════════
// C-53 · `BottomSheet` — les trois détecteurs, en jsdom faute de mieux
//
// 🔴 C'est la SEULE des dix surfaces câblées sur `useModalA11y` qu'aucun test
// de navigateur ne peut atteindre, et la raison n'est pas un oubli : son unique
// consommateur produit est `WeeklyRecapSheet`, monté derrière
// `WEEKLY_RECAP_ENABLED = false` (`src/pages/HabitsPage.tsx`). Aucun geste
// utilisateur n'ouvre cette feuille aujourd'hui.
//
// On mesure donc le composant RÉEL ici, sur les mêmes détecteurs que le harnais
// clavier (`e2e/a11y-keyboard-audit.spec.ts`) : entrée du focus, piège, Échap,
// plus `aria-modal`. Ce n'est pas équivalent à une mesure de navigateur — jsdom
// ne calcule aucune géométrie et ne simule aucune tabulation native — et
// `docs/ACCESSIBILITY.md` le dit comme tel plutôt que de compter cette surface
// avec les autres.
//
// ⚠️ Le jour où le drapeau repasse à `true`, cette couverture ne suffit plus :
// il faut une ligne dans le harnais clavier.
// ═══════════════════════════════════════════════════════════════════
describe('BottomSheet — C-53 (piège de focus)', () => {
  /**
   * jsdom ne simule aucune navigation séquentielle : le piège se mesure en
   * émettant le `keydown`, ce qui est justement le chemin que le défaut
   * d'origine empruntait.
   */
  const press = (key: string, shiftKey = false) =>
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
      );
    });

  const Sheet = ({ onClose = vi.fn() }: { onClose?: () => void }) => (
    <BottomSheet open onClose={onClose} ariaLabel="Choix">
      <button type="button">Premier</button>
      <button type="button">Dernier</button>
    </BottomSheet>
  );

  it('porte aria-modal, pas seulement role="dialog"', () => {
    render(<Sheet />);
    expect(screen.getByRole('dialog', { name: 'Choix' }).getAttribute('aria-modal')).toBe('true');
  });

  it('déplace le focus dans la feuille à l’ouverture (focusMovedIn)', async () => {
    render(<Sheet />);
    // Le hook déplace le focus après peinture (`requestAnimationFrame`).
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('boucle du dernier focalisable au premier (trapped)', async () => {
    render(<Sheet />);
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
    act(() => screen.getByRole('button', { name: 'Dernier' }).focus());
    press('Tab');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Premier' }));
  });

  it('Échap ferme, même quand le focus est SORTI de la feuille (escClosed)', async () => {
    const onClose = vi.fn();
    render(
      <>
        <button type="button">Derrière la feuille</button>
        <Sheet onClose={onClose} />
      </>,
    );
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))); });
    act(() => screen.getByRole('button', { name: 'Derrière la feuille' }).focus());
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
