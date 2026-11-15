// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStatCards } from './useStatCards';
import type { Task } from '@/modules/tasks';
import type { CalendarEvent } from '@/modules/events';
import type { Habit } from '@/modules/habits';
import type { KRCompletion } from '@/modules/kr-completions';

const t = ((k: string, p?: Record<string, unknown>) => (p ? `${k}:${JSON.stringify(p)}` : k)) as never;
const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
};
const key = (d: Date) => d.toLocaleDateString('en-CA');
const noon = (offset = 0) => {
  const d = day(offset);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

const todayKey = key(day());
const done = (offset = 0) => ({ completed: true, completedAt: noon(offset) }) as Task;
const habit = (dates: string[]) => ({ completions: Object.fromEntries(dates.map(d => [d, true])) }) as unknown as Habit;
const kr = (offset = 0) => ({ completedAt: noon(offset) }) as KRCompletion;
const ev = (offset = 0) => ({ start: noon(offset) }) as CalendarEvent;

function cards(viewMode: 'day' | 'week' | 'month', over: Partial<Parameters<typeof useStatCards>[0]> = {}) {
  return renderHook(() =>
    useStatCards({ tasks: [], events: [], habits: [], krCompletions: [], viewMode, today: todayKey, t, ...over }),
  ).result.current;
}

describe('useStatCards', () => {
  it("jour : compteur de taches terminees quand rien n'est du aujourd'hui, graphe sur 7 jours", () => {
    const r = cards('day', { tasks: [done(), done(-1)], events: [ev()], krCompletions: [kr(), kr()] });
    expect(r.map(c => c.label)).toEqual(['stats.tasksCompleted', 'stats.agenda', 'stats.krCompleted', 'stats.habits']);
    expect(r[0].value).toBe(1);
    expect(r[0].chartData).toHaveLength(7);
    expect(r[1].value).toBe(1);
    expect(r[2].value).toBe(2);
    expect(r[3].value).toBe(0);
  });

  it('jour : format x/N pour les taches dues et les habitudes', () => {
    const due = (completed: boolean) => ({ deadline: noon(), completed }) as unknown as Task;
    const r = cards('day', {
      tasks: [due(true), due(false), due(false)],
      habits: [habit([todayKey]), habit([])],
    });
    expect(r[0].label).toBe('stats.tasksToday');
    expect(r[0].value).toBe('1/3');
    expect(r[3].value).toBe('1/2');
  });

  it('semaine : quatre semaines, libelles traduits, comptes de la semaine courante', () => {
    const r = cards('week', {
      tasks: [done(), done(-10)],
      events: [ev(), ev(-3)],
      habits: [habit([todayKey, key(day(-1))])],
      krCompletions: [kr()],
    });
    expect(r[0].chartData).toHaveLength(4);
    expect(r[0].chartData[3].date).toContain('chart.weekAbbr');
    expect(r[0].value).toBe(1);
    expect(r[1].value).toBeGreaterThanOrEqual(1);
    expect(r[2].value).toBe(1);
    expect(r[3].value).toBe(2);
  });

  it('mois : six mois, comptes du mois courant', () => {
    const r = cards('month', {
      tasks: [done()],
      events: [ev()],
      habits: [habit([todayKey])],
      krCompletions: [kr()],
    });
    expect(r[0].chartData).toHaveLength(6);
    expect(r[0].value).toBe(1);
    expect(r[1].value).toBe(1);
    expect(r[2].value).toBe(1);
    expect(r[3].value).toBe(1);
    expect(r[3].chartData.at(-1)?.value).toBe(1);
  });
});
