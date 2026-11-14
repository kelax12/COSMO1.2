import { describe, it, expect } from 'vitest';
import {
  isEveryDay,
  isHabitScheduledOn,
  nextScheduleHistory,
  normalizeScheduledDays,
  scheduledDaysOn,
  weekdayOfKey,
} from './schedule';

// 2026-11-09 est un lundi.
const MON = '2026-11-09';
const TUE = '2026-11-10';
const WED = '2026-11-11';
const SUN = '2026-11-15';

describe('weekdayOfKey', () => {
  it('lit la clé comme une date calendaire locale', () => {
    expect(weekdayOfKey(MON)).toBe(1);
    expect(weekdayOfKey(SUN)).toBe(0);
  });
});

describe('normalizeScheduledDays / isEveryDay', () => {
  it('trie, dédoublonne, borne à 0..6', () => {
    expect(normalizeScheduledDays([5, 1, 3, 1, 9, -1, 2.5])).toEqual([1, 3, 5]);
  });
  it('absent, vide et 7 jours valent tous les jours', () => {
    expect(isEveryDay(undefined)).toBe(true);
    expect(isEveryDay([])).toBe(true);
    expect(isEveryDay([0, 1, 2, 3, 4, 5, 6])).toBe(true);
    expect(isEveryDay([1, 3, 5])).toBe(false);
  });
});

describe('isHabitScheduledOn', () => {
  it('sans réglage : tous les jours', () => {
    expect(isHabitScheduledOn({}, TUE)).toBe(true);
  });
  it('Lun/Mer/Ven sans historique', () => {
    const h = { scheduledDays: [1, 3, 5] };
    expect(isHabitScheduledOn(h, MON)).toBe(true);
    expect(isHabitScheduledOn(h, TUE)).toBe(false);
    expect(isHabitScheduledOn(h, WED)).toBe(true);
  });
  it("l'historique daté juge chaque jour avec le réglage de CE jour", () => {
    const h = {
      scheduledDays: [1],
      scheduleHistory: [
        { from: '1970-01-01', days: [0, 1, 2, 3, 4, 5, 6] },
        { from: WED, days: [1] },
      ],
    };
    expect(isHabitScheduledOn(h, TUE)).toBe(true); // avant le changement
    expect(isHabitScheduledOn(h, WED)).toBe(false); // après
    expect(isHabitScheduledOn(h, '2026-11-16')).toBe(true); // lundi suivant
  });
  it('avant la première entrée : tous les jours', () => {
    const h = { scheduleHistory: [{ from: WED, days: [3] }] };
    expect(scheduledDaysOn(h, MON)).toEqual([]);
    expect(isHabitScheduledOn(h, TUE)).toBe(true);
  });
});

describe('nextScheduleHistory', () => {
  it('rien ne change : null (aucune écriture)', () => {
    expect(nextScheduleHistory({}, [0, 1, 2, 3, 4, 5, 6], WED)).toBeNull();
    expect(nextScheduleHistory({ scheduledDays: [1, 3] }, [3, 1], WED)).toBeNull();
  });
  it("date l'ancien réglage depuis l'origine, puis le nouveau d'aujourd'hui", () => {
    expect(nextScheduleHistory({}, [1, 3, 5], WED)).toEqual([
      { from: '1970-01-01', days: [0, 1, 2, 3, 4, 5, 6] },
      { from: WED, days: [1, 3, 5] },
    ]);
  });
  it('deux changements le même jour : le dernier remplace le premier', () => {
    const first = nextScheduleHistory({}, [1], WED)!;
    const second = nextScheduleHistory({ scheduledDays: [1], scheduleHistory: first }, [2], WED)!;
    expect(second).toEqual([
      { from: '1970-01-01', days: [0, 1, 2, 3, 4, 5, 6] },
      { from: WED, days: [2] },
    ]);
  });
  it('le passé reste jugé avec l’ancien réglage', () => {
    const history = nextScheduleHistory({ scheduledDays: [1, 3, 5] }, [2], WED)!;
    const h = { scheduledDays: [2], scheduleHistory: history };
    expect(isHabitScheduledOn(h, MON)).toBe(true);
    expect(isHabitScheduledOn(h, TUE)).toBe(false);
    expect(isHabitScheduledOn(h, '2026-11-17')).toBe(true); // mardi suivant
  });
});
