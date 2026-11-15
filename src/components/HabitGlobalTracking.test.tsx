// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Habit } from '@/modules/habits';
import HabitGlobalTracking from './HabitGlobalTracking';

let state: { data: Habit[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('@/modules/habits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/habits')>()),
  useHabits: () => state,
}));

const dayKey = (offset: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
};

const makeHabit = (over: Partial<Habit> = {}): Habit =>
  ({
    id: 'h1',
    name: 'Lecture',
    frequency: 'daily',
    estimatedTime: 20,
    color: 'green',
    icon: 'book',
    completions: {},
    createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
    ...over,
  }) as Habit;

describe('HabitGlobalTracking', () => {
  beforeEach(() => {
    state = { data: [], isLoading: false };
  });

  it('chargement : pas de titre, juste le squelette', () => {
    state = { data: [], isLoading: true };
    render(<HabitGlobalTracking />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it("sans habitude : message d'état vide", () => {
    render(<HabitGlobalTracking />);
    expect(screen.getByText(/habitude/i)).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('affiche le pourcentage du jour : 100 % pour une habitude cochée aujourd\'hui', () => {
    state = { data: [makeHabit({ completions: { [dayKey(0)]: true } })], isLoading: false };
    render(<HabitGlobalTracking />);
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(1);
  });

  it("période « Tout » sur 120 jours : pagination, et les boutons de page respectent les bornes", () => {
    state = { data: [makeHabit()], isLoading: false };
    render(<HabitGlobalTracking />);
    const prev = screen.getByRole('button', { name: /pr[ée]c/i }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: /suiv/i }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    expect(screen.getByText(/^1 \/ \d+$/)).toBeTruthy();
    fireEvent.click(next);
    expect(screen.getByText(/^2 \/ \d+$/)).toBeTruthy();
    expect(prev.disabled).toBe(false);
    fireEvent.click(prev);
    expect(screen.getByText(/^1 \/ \d+$/)).toBeTruthy();
  });

  it('semaine : navigation précédent/suivant bornée à aujourd\'hui, retour à « Tout » la masque', () => {
    state = { data: [makeHabit()], isLoading: false };
    render(<HabitGlobalTracking />);
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }));
    const periodNav = () =>
      screen.getAllByRole('button').filter((b) => b.querySelector('svg') && b.className.includes('border'));
    const [prev, next] = periodNav() as HTMLButtonElement[];
    expect(next.disabled).toBe(true);
    fireEvent.click(prev);
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Mois' }));
    expect(screen.getAllByRole('button').filter((b) => b.className.includes('border')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Tout' }));
    expect(screen.queryByText(/Semaine du/)).toBeNull();
  });

  it("un jour avant la création de l'habitude affiche une case grisée sans pourcentage", () => {
    state = { data: [makeHabit({ createdAt: new Date().toISOString() })], isLoading: false };
    render(<HabitGlobalTracking />);
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }));
    const cells = document.querySelectorAll('.opacity-20.bg-slate-300');
    expect(cells.length).toBeGreaterThan(0);
  });
});
