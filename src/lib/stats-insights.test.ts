import { describe, it, expect } from 'vitest';
import { bestDayInsight, fragileHabitInsight, momentumInsight, buildInsights } from './stats-insights';
import type { Task } from '@/modules/tasks';
import type { Habit } from '@/modules/habits';

// Mercredi 8 juillet 2026
const NOW = new Date(2026, 6, 8, 15, 0);

const makeTask = (completedAt: string, id: string): Task => ({
  id,
  name: `t-${id}`,
  priority: 1,
  category: '',
  deadline: '',
  estimatedTime: 0,
  bookmarked: false,
  completed: true,
  completedAt,
});

const makeHabit = (
  name: string,
  completions: Record<string, boolean>,
  extra: Partial<Habit> = {},
): Habit => ({
  id: name,
  name,
  frequency: 'daily',
  estimatedTime: 10,
  color: '#000',
  icon: '✓',
  completions,
  ...extra,
});

/** Les 7 jours de la fenêtre, cochés. */
const fullWeek = (): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(NOW);
    d.setDate(d.getDate() - i);
    out[d.toLocaleDateString('en-CA')] = true;
  }
  return out;
};

describe('stats-insights (#34)', () => {
  it('bestDayInsight : identifie le jour dominant (≥5 complétions)', () => {
    // 4 complétions le mardi 7 juillet + 2 le lundi 6 juillet (local, midi)
    const tasks = [
      makeTask('2026-07-07T10:00:00', 'a'),
      makeTask('2026-07-07T11:00:00', 'b'),
      makeTask('2026-07-07T12:00:00', 'c'),
      makeTask('2026-07-07T13:00:00', 'd'),
      makeTask('2026-07-06T10:00:00', 'e'),
      makeTask('2026-07-06T11:00:00', 'f'),
    ];
    // 2 = mardi. Le module rend un FAIT, jamais une phrase : c'est la page qui
    // met en mots via le catalogue (revue du 2026-09-02, point 6).
    expect(bestDayInsight(tasks, NOW)).toEqual({ kind: 'bestDay', weekday: 2, share: 67 });
  });

  it('bestDayInsight : null si moins de 5 complétions (pas assez de données)', () => {
    const tasks = [makeTask('2026-07-07T10:00:00', 'a')];
    expect(bestDayInsight(tasks, NOW)).toBeNull();
  });

  it("fragileHabitInsight : repère l'habitude la plus manquée (≥3 oublis)", () => {
    const habits = [
      makeHabit('Lecture', fullWeek()),            // 0 oubli
      makeHabit('Sport', { '2026-07-08': true }),  // 6 oublis
    ];
    expect(fragileHabitInsight(habits, NOW)).toEqual({
      kind: 'fragileHabit',
      name: 'Sport',
      missed: 6,
    });
  });

  it('fragileHabitInsight : null sans habitude ou sans oubli notable', () => {
    expect(fragileHabitInsight([], NOW)).toBeNull();
  });

  // ── Point 26 de la revue ────────────────────────────────────────────
  it("ne compte pas les jours ANTÉRIEURS à la création de l'habitude", () => {
    // Créée hier : la fenêtre utile fait 2 jours, on ne peut pas lui reprocher
    // 6 oublis. L'ancienne version affichait « 6 oublis cette semaine ».
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const habit = makeHabit('Sport', {}, { createdAt: yesterday.toISOString() });
    expect(fragileHabitInsight([habit], NOW)).toBeNull();
  });

  it('respecte la FRÉQUENCE : une habitude hebdomadaire cochée une fois est tenue', () => {
    const habit = makeHabit('Bilan', { '2026-07-06': true }, { frequency: 'weekly' });
    expect(fragileHabitInsight([habit], NOW)).toBeNull();
  });

  it('une habitude MENSUELLE ne se juge pas sur 7 jours', () => {
    const habit = makeHabit('Comptabilité', {}, { frequency: 'monthly' });
    expect(fragileHabitInsight([habit], NOW)).toBeNull();
  });

  it('une habitude quotidienne ancienne et jamais cochée reste signalée', () => {
    const old = new Date(NOW);
    old.setDate(old.getDate() - 60);
    const habit = makeHabit('Sport', {}, { createdAt: old.toISOString() });
    expect(fragileHabitInsight([habit], NOW)).toEqual({
      kind: 'fragileHabit',
      name: 'Sport',
      missed: 7,
    });
  });

  it('momentumInsight : détecte la progression', () => {
    const tasks = [
      // Semaine courante (2–8 juillet) : 6 complétions
      ...[1, 2, 3, 4, 5, 6].map((i) => makeTask(`2026-07-0${Math.min(2 + (i % 6), 8)}T10:0${i}:00`, `c${i}`)),
      // Semaine précédente (25 juin – 1er juillet) : 2 complétions
      makeTask('2026-06-27T10:00:00', 'p1'),
      makeTask('2026-06-28T10:00:00', 'p2'),
    ];
    const insight = momentumInsight(tasks, NOW);
    expect(insight?.kind).toBe('momentumUp');
  });

  it('buildInsights : filtre les nulls', () => {
    expect(buildInsights([], [], NOW)).toEqual([]);
  });
});
