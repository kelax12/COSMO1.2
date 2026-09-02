import { describe, it, expect } from 'vitest';
import { getSnoozeOptions } from './snooze';
import { deadlineDayKey } from '@/lib/deadline';
import type { TimezonePref } from '@/lib/timezone';

const manual = (h: number): TimezonePref => ({ mode: 'manual', offsetHours: h });

/** Le jour visé par une option, relu comme l'utilisateur le verra. */
const dayOf = (deadline: string, pref: TimezonePref) => deadlineDayKey(deadline, pref);

describe('getSnoozeOptions', () => {
  // Mercredi 1er juillet 2026, 12 h UTC : le même jour dans tous les fuseaux
  // testés, ce qui permet d'attendre exactement les mêmes dates partout.
  const wednesday = new Date('2026-07-01T12:00:00.000Z');

  const ZONES: [string, number][] = [
    ['Guadeloupe UTC-4', -4],
    ['Los Angeles UTC-7', -7],
    ['UTC', 0],
    ['Paris UTC+2', 2],
    ['Tokyo UTC+9', 9],
  ];

  it.each(ZONES)(
    '%s : mercredi → demain jeudi, week-end samedi, semaine prochaine lundi',
    (_l, offset) => {
      const pref = manual(offset);
      const [tomorrow, weekend, nextWeek] = getSnoozeOptions(wednesday, pref);
      expect(dayOf(tomorrow.deadline, pref)).toBe('2026-07-02');
      expect(dayOf(weekend.deadline, pref)).toBe('2026-07-04');
      expect(dayOf(nextWeek.deadline, pref)).toBe('2026-07-06');
    },
  );

  it("samedi → week-end = samedi suivant (jamais aujourd'hui)", () => {
    const pref = manual(-4);
    const saturday = new Date('2026-07-04T12:00:00.000Z');
    const [tomorrow, weekend, nextWeek] = getSnoozeOptions(saturday, pref);
    expect(dayOf(tomorrow.deadline, pref)).toBe('2026-07-05');
    expect(dayOf(weekend.deadline, pref)).toBe('2026-07-11');
    expect(dayOf(nextWeek.deadline, pref)).toBe('2026-07-06');
  });

  it('lundi → semaine prochaine = lundi suivant', () => {
    const pref = manual(2);
    const monday = new Date('2026-07-06T12:00:00.000Z');
    const [, , nextWeek] = getSnoozeOptions(monday, pref);
    expect(dayOf(nextWeek.deadline, pref)).toBe('2026-07-13');
  });

  it("rend un INSTANT à stocker, plus une date nue castée à minuit UTC", () => {
    // Régression R-01 : `'2026-07-02'` envoyé tel quel devenait minuit UTC,
    // donc le 1er au soir aux Antilles. On vérifie qu'on écrit bien un instant,
    // et que cet instant se relit au bon jour.
    const pref = manual(-4);
    const [tomorrow] = getSnoozeOptions(wednesday, pref);
    expect(tomorrow.deadline).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(tomorrow.deadline).not.toBe('2026-07-02');
    expect(dayOf(tomorrow.deadline, pref)).toBe('2026-07-02');
  });

  it('le report suit le fuseau choisi, pas celui de la machine', () => {
    // 2 juillet 01 h 00 à Paris = 1er juillet 21 h 00 en Guadeloupe. « Demain »
    // n'y désigne donc pas le même jour, et c'est exactement le point : régler
    // UTC-4 détache l'utilisateur du découpage métropolitain.
    const lateEvening = new Date('2026-07-01T23:00:00.000Z');
    expect(dayOf(getSnoozeOptions(lateEvening, manual(2))[0].deadline, manual(2))).toBe('2026-07-03');
    expect(dayOf(getSnoozeOptions(lateEvening, manual(-4))[0].deadline, manual(-4))).toBe('2026-07-02');
  });
});
