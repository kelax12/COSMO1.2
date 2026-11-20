// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Habit } from '@/modules/habits';

const mutate = vi.fn();
const navigate = vi.fn();
let habits: Habit[] = [];
let loading = false;
let mobile = false;

vi.mock('@/modules/habits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/habits')>()),
  useHabits: () => ({ data: habits, isLoading: loading }),
  useToggleHabitCompletion: () => ({ mutate }),
}));
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));
vi.mock('@/lib/hooks/use-mobile', () => ({ useIsMobile: () => mobile }));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && 'done' in vars ? `${key}:${vars.done}/${vars.total}` : key,
    tp: (key: string, n: number) => `${key}:${n}`,
  }),
}));

import TodayHabits from './TodayHabits';

const today = () => new Date().toLocaleDateString('en-CA');
const make = (over: Partial<Habit> = {}): Habit =>
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

/** Un jour de semaine qui n'est PAS aujourd'hui : l'habitude n'y est pas prévue. */
const otherWeekday = () => [(new Date().getDay() + 1) % 7];

describe('TodayHabits', () => {
  beforeEach(() => {
    mutate.mockClear();
    navigate.mockClear();
    habits = [];
    loading = false;
    mobile = false;
  });

  it('affiche un squelette de chargement', () => {
    loading = true;
    render(<TodayHabits />);
    expect(screen.getByText('todayHabits.loading')).toBeTruthy();
  });

  it('sans habitude, propose d’en créer une et mène à la page Habitudes', () => {
    render(<TodayHabits />);
    expect(screen.getByText('habits.empty')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'habits.create' }));
    expect(navigate).toHaveBeenCalledWith('/habits');
  });

  it('cocher une carte bascule la complétion du jour', () => {
    habits = [make()];
    render(<TodayHabits />);
    fireEvent.click(screen.getByText('Lecture'));
    expect(mutate).toHaveBeenCalledWith({ id: 'h1', date: today() });
  });

  it('célèbre quand tout ce qui est prévu est fait', () => {
    habits = [make({ completions: { [today()]: true } })];
    render(<TodayHabits />);
    expect(screen.getByText('habits.allDone:1/1')).toBeTruthy();
  });

  it('une habitude non prévue aujourd’hui est hors du décompte et non cochable', () => {
    habits = [make({ id: 'off', name: 'Natation', scheduledDays: otherWeekday() })];
    render(<TodayHabits />);
    // Aucune habitude due : pas de célébration, progression à 0/0.
    expect(screen.getByText('habits.progress:0/0')).toBeTruthy();
    fireEvent.click(screen.getByText('Natation'));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('range les habitudes non prévues après celles du jour', () => {
    habits = [
      make({ id: 'off', name: 'Natation', scheduledDays: otherWeekday() }),
      make({ id: 'on', name: 'Lecture' }),
    ];
    render(<TodayHabits />);
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Lecture', 'Natation']);
  });

  it('une coche déjà posée reste décochable même si le jour n’est plus prévu', () => {
    habits = [
      make({ name: 'Natation', scheduledDays: otherWeekday(), completions: { [today()]: true } }),
    ];
    render(<TodayHabits />);
    fireEvent.click(screen.getByText('Natation'));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('au-delà de la limite visible, « voir plus » déplie puis « voir moins » replie', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 400 });
    habits = Array.from({ length: 6 }, (_, i) => make({ id: `h${i}`, name: `Habitude ${i}` }));
    render(<TodayHabits />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /habits\.showMore:3/ }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: /habits\.showLess/ }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });

  describe('mobile', () => {
    beforeEach(() => {
      mobile = true;
    });

    it('liste d’abord ce qui reste, replie les faites sous un bouton qui les déplie', () => {
      habits = [
        make({ id: 'a', name: 'Lecture' }),
        make({ id: 'b', name: 'Sport', completions: { [today()]: true } }),
      ];
      render(<TodayHabits />);
      expect(screen.getByText('Lecture')).toBeTruthy();
      expect(screen.queryByText('Sport')).toBeNull();

      const fold = screen.getByRole('button', { name: /habits\.doneCount:1/ });
      expect(fold.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(fold);
      expect(fold.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('Sport')).toBeTruthy();
    });

    it('la pastille bascule la complétion, son nom dit l’action possible', () => {
      habits = [make({ name: 'Lecture' })];
      render(<TodayHabits />);
      const toggle = screen.getByRole('button', { name: 'today.markDone' });
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(toggle);
      expect(mutate).toHaveBeenCalledWith({ id: 'h1', date: today() });
    });

    it('le nom de l’habitude ouvre la page Habitudes', () => {
      habits = [make({ name: 'Lecture' })];
      render(<TodayHabits />);
      fireEvent.click(screen.getByText('Lecture'));
      expect(navigate).toHaveBeenCalledWith('/habits');
    });

    it('la pastille d’une habitude non prévue est désactivée', () => {
      habits = [make({ scheduledDays: otherWeekday() })];
      render(<TodayHabits />);
      expect((screen.getByRole('button', { name: 'today.markDone' }) as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
