// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Habit } from '@/modules/habits';
import HabitTable from './HabitTable';

const mutate = vi.fn();
let habits: Habit[] = [];

vi.mock('@/modules/habits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/habits')>()),
  useHabits: () => ({ data: habits }),
  useToggleHabitCompletion: () => ({ mutate }),
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
    ...over,
  }) as Habit;

describe('HabitTable', () => {
  beforeEach(() => {
    mutate.mockClear();
    habits = [];
  });

  it('rend le titre et une grille vide sans habitude', () => {
    render(<HabitTable />);
    expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('une ligne par habitude, sept cases sur la période « semaine », coche déjà faite visible', () => {
    habits = [makeHabit({ completions: { [dayKey(0)]: true } })];
    render(<HabitTable />);
    expect(screen.getByText('Lecture')).toBeTruthy();
    expect(screen.getByText('20 min')).toBeTruthy();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(7);
    expect(boxes.filter((b) => b.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });

  it('cliquer une case passée bascule la complétion (id + date)', () => {
    habits = [makeHabit()];
    render(<HabitTable />);
    const boxes = screen.getAllByRole('checkbox');
    // Dernière case = aujourd'hui, première = il y a six jours.
    fireEvent.click(boxes[0]);
    expect(mutate).toHaveBeenCalledWith({ id: 'h1', date: dayKey(-6) });
    fireEvent.click(boxes[6]);
    expect(mutate).toHaveBeenLastCalledWith({ id: 'h1', date: dayKey(0) });
  });

  it('un jour non prévu est verrouillé et ne déclenche rien', () => {
    const weekday = (new Date().getDay() + 1) % 7;
    habits = [makeHabit({ scheduledDays: [weekday] })];
    render(<HabitTable />);
    const locked = screen.getAllByRole('checkbox').filter((b) => (b as HTMLButtonElement).disabled);
    expect(locked.length).toBeGreaterThan(0);
    fireEvent.click(locked[0]);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('navigue entre les périodes : « suivant » désactivé sur la période courante, actif après recul', () => {
    habits = [makeHabit()];
    render(<HabitTable />);
    const next = screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.includes('nextPeriod')) as HTMLButtonElement | undefined;
    const prev = screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.includes('prevPeriod')) as HTMLButtonElement | undefined;
    // Les clés i18n sont résolues en français : on retrouve les boutons par position.
    const nav = (next ?? prev) ? [prev, next] : screen.getAllByRole('button').slice(0, 2);
    const [p, n] = nav as HTMLButtonElement[];
    expect(n.disabled).toBe(true);
    fireEvent.click(p);
    expect(n.disabled).toBe(false);
    fireEvent.click(n);
    expect(n.disabled).toBe(true);
  });

  it('changer de période : mois (30 cases) puis « tout » masque la navigation', () => {
    habits = [makeHabit({ createdAt: dayKey(-40) })];
    render(<HabitTable />);
    const periodButtons = screen.getAllByRole('button').filter((b) => b.className.includes('md:flex-none'));
    expect(periodButtons).toHaveLength(3);
    fireEvent.click(periodButtons[1]);
    expect(screen.getAllByRole('checkbox')).toHaveLength(30);
    fireEvent.click(periodButtons[2]);
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(40);
    // Période « tout » : plus de boutons précédent / suivant (3 périodes + le nom de l'habitude, qui ouvre l'édition).
    const buttonsWithoutCells = screen.getAllByRole('button');
    expect(buttonsWithoutCells).toHaveLength(4);
  });
});
