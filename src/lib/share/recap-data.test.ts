import { describe, it, expect } from 'vitest';
import { buildRecap, computeStreak, formatMinutes, startOfWeek, RECAP_WEEKS } from './recap-data';
import type { Habit } from '@/modules/habits/types';
import type { Task } from '@/modules/tasks/types';

const habit = (completions: Record<string, boolean>, id = 'h1'): Habit => ({
  id,
  name: 'peu importe',
  frequency: 'daily',
  estimatedTime: 10,
  color: '#fff',
  icon: '✓',
  completions,
});

const task = (completedAt: string | undefined, completed = true): Task => ({
  id: Math.random().toString(36),
  name: 'peu importe',
  priority: 3,
  category: 'x',
  deadline: '2026-08-14',
  estimatedTime: 30,
  bookmarked: false,
  completed,
  completedAt,
});

// Vendredi 14 août 2026 → semaine du lundi 10 au dimanche 16.
const TODAY = new Date(2026, 7, 14);

describe('startOfWeek', () => {
  it('remonte au lundi, y compris un dimanche', () => {
    expect(startOfWeek(new Date(2026, 7, 14)).toLocaleDateString('en-CA')).toBe('2026-08-10');
    expect(startOfWeek(new Date(2026, 7, 16)).toLocaleDateString('en-CA')).toBe('2026-08-10');
    expect(startOfWeek(new Date(2026, 7, 10)).toLocaleDateString('en-CA')).toBe('2026-08-10');
  });
});

describe('computeStreak', () => {
  it('compte les jours consécutifs jusqu’à aujourd’hui', () => {
    const h = habit({ '2026-08-14': true, '2026-08-13': true, '2026-08-12': true });
    expect(computeStreak([h], TODAY)).toBe(3);
  });

  it('ne casse pas la série si la journée en cours est encore vide', () => {
    const h = habit({ '2026-08-13': true, '2026-08-12': true });
    expect(computeStreak([h], TODAY)).toBe(2);
  });

  it('vaut 0 sans habitude ni complétion', () => {
    expect(computeStreak([], TODAY)).toBe(0);
    expect(computeStreak([habit({})], TODAY)).toBe(0);
  });
});

describe('buildRecap', () => {
  it('borne la semaine au lundi et au dimanche', () => {
    const recap = buildRecap({ habits: [], tasks: [], today: TODAY });
    expect(recap.weekStart).toBe('2026-08-10');
    expect(recap.weekEnd).toBe('2026-08-16');
  });

  it('produit une grille de RECAP_WEEKS colonnes de 7 jours', () => {
    const recap = buildRecap({ habits: [], tasks: [], today: TODAY });
    expect(recap.grid).toHaveLength(RECAP_WEEKS);
    expect(recap.grid.every((column) => column.length === 7)).toBe(true);
  });

  it('laisse les jours futurs à null (case absente, pas case vide)', () => {
    const recap = buildRecap({ habits: [], tasks: [], today: TODAY });
    const lastWeek = recap.grid[RECAP_WEEKS - 1];
    expect(lastWeek[4]).toBe(0); // vendredi = aujourd'hui
    expect(lastWeek[5]).toBeNull(); // samedi
    expect(lastWeek[6]).toBeNull(); // dimanche
  });

  it('calcule le taux du jour comme cochées / suivies', () => {
    const recap = buildRecap({
      habits: [habit({ '2026-08-14': true }, 'a'), habit({}, 'b')],
      tasks: [],
      today: TODAY,
    });
    expect(recap.grid[RECAP_WEEKS - 1][4]).toBe(0.5);
  });

  it('ne compte que les tâches terminées DANS la semaine', () => {
    const recap = buildRecap({
      habits: [],
      tasks: [
        task('2026-08-11T09:00:00Z'),
        task('2026-08-16T12:00:00Z'),
        task('2026-08-09T10:00:00Z'), // dimanche précédent
        task(undefined), // terminée sans date : non comptée
        task('2026-08-12T10:00:00Z', false), // non terminée
      ],
      today: TODAY,
    });
    expect(recap.tasksCompleted).toBe(2);
  });

  it('remonte le nombre d’habitudes suivies et les minutes telles quelles', () => {
    const recap = buildRecap({ habits: [habit({})], tasks: [], minutes: 200, today: TODAY });
    expect(recap.habitCount).toBe(1);
    expect(recap.minutes).toBe(200);
  });
});

describe('formatMinutes', () => {
  it('formate en heures et minutes, jamais en minutes brutes', () => {
    expect(formatMinutes(200)).toBe('3 h 20');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(45)).toBe('45 min');
  });

  it('rend un tiret quand la donnée manque', () => {
    expect(formatMinutes(null)).toBe('—');
    expect(formatMinutes(0)).toBe('—');
  });
});
