import { describe, it, expect } from 'vitest';
import { getSnoozeOptions } from './snooze';

const local = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d).toLocaleDateString('en-CA');

describe('getSnoozeOptions', () => {
  it('mercredi → demain jeudi, week-end samedi, semaine prochaine lundi', () => {
    const now = new Date(2026, 6, 1); // mercredi 1er juillet 2026
    const [tomorrow, weekend, nextWeek] = getSnoozeOptions(now);
    expect(tomorrow.deadline).toBe(local(2026, 7, 2));
    expect(weekend.deadline).toBe(local(2026, 7, 4));
    expect(nextWeek.deadline).toBe(local(2026, 7, 6));
  });

  it('samedi → week-end = samedi suivant (jamais aujourd\'hui)', () => {
    const now = new Date(2026, 6, 4); // samedi 4 juillet 2026
    const [tomorrow, weekend, nextWeek] = getSnoozeOptions(now);
    expect(tomorrow.deadline).toBe(local(2026, 7, 5));
    expect(weekend.deadline).toBe(local(2026, 7, 11));
    expect(nextWeek.deadline).toBe(local(2026, 7, 6));
  });

  it('lundi → semaine prochaine = lundi suivant', () => {
    const now = new Date(2026, 6, 6); // lundi 6 juillet 2026
    const [, , nextWeek] = getSnoozeOptions(now);
    expect(nextWeek.deadline).toBe(local(2026, 7, 13));
  });
});
