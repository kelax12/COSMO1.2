import { describe, expect, it } from 'vitest';
import type { TeamTask } from '@/modules/team-projects';
import { comparedWindows, percentDelta, periodFlow } from './team-stats.helpers';

const task = (p: Partial<TeamTask>): TeamTask => ({ completed: false, createdAt: null, completedAt: null, ...p }) as TeamTask;

describe('comparaison de période (reco UI n° 38)', () => {
  const now = new Date(2026, 8, 30, 12);

  it('borne la fenêtre précédente à la même durée, juste avant', () => {
    const w = comparedWindows('7', now)!;
    expect(w.previous[1]).toEqual(w.current[0]);
    expect(w.current[1].getTime() - w.current[0].getTime()).toBe(w.previous[1].getTime() - w.previous[0].getTime());
    expect(comparedWindows('all', now)).toBeNull();
  });

  it('compte créations et complétions DANS la fenêtre seulement', () => {
    const from = new Date(2026, 8, 1);
    const to = new Date(2026, 8, 10);
    const tasks = [
      task({ createdAt: '2026-09-02T10:00:00', completed: true, completedAt: '2026-09-05T10:00:00' }),
      task({ createdAt: '2026-08-20T10:00:00', completed: true, completedAt: '2026-09-03T10:00:00' }),
      task({ createdAt: '2026-09-12T10:00:00' }),
      task({ createdAt: '2026-09-04T10:00:00', completed: false, completedAt: '2026-09-05T10:00:00' }),
    ];
    expect(periodFlow(tasks, from, to)).toEqual({ created: 2, completed: 2 });
  });

  it('ne calcule pas de variation sur une base nulle', () => {
    expect(percentDelta(5, 0)).toBeNull();
    expect(percentDelta(12, 10)).toBe(20);
    expect(percentDelta(7, 10)).toBe(-30);
  });
});
