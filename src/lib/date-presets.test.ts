import { describe, it, expect } from 'vitest';
import { todayStr, tomorrowStr, weekendStr, nextWeekStr, buildDatePresets } from './date-presets';

// Mercredi 8 juillet 2026 (getDay() === 3)
const WED = new Date(2026, 6, 8, 15, 30);
// Samedi 11 juillet 2026
const SAT = new Date(2026, 6, 11, 10, 0);
// Dimanche 12 juillet 2026
const SUN = new Date(2026, 6, 12, 10, 0);

describe('date-presets (#25)', () => {
  it("todayStr retourne la date locale du jour", () => {
    expect(todayStr(WED)).toBe('2026-07-08');
  });

  it('tomorrowStr retourne J+1', () => {
    expect(tomorrowStr(WED)).toBe('2026-07-09');
  });

  it('weekendStr depuis un mercredi retourne le samedi suivant', () => {
    expect(weekendStr(WED)).toBe('2026-07-11');
  });

  it('weekendStr depuis un samedi retourne le samedi SUIVANT', () => {
    expect(weekendStr(SAT)).toBe('2026-07-18');
  });

  it('weekendStr depuis un dimanche retourne le samedi suivant', () => {
    expect(weekendStr(SUN)).toBe('2026-07-18');
  });

  it('nextWeekStr retourne le lundi de la semaine suivante', () => {
    expect(nextWeekStr(WED)).toBe('2026-07-13');
    expect(nextWeekStr(SUN)).toBe('2026-07-13');
  });

  it('buildDatePresets expose les 4 presets dans le bon ordre', () => {
    const presets = buildDatePresets(WED);
    expect(presets.map((p) => p.label)).toEqual(["Aujourd'hui", 'Demain', 'Ce week-end', 'Semaine proch.']);
    expect(presets[0].value).toBe('2026-07-08');
  });
});
