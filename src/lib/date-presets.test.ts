import { describe, it, expect } from 'vitest';
import { todayStr, tomorrowStr, nextWeekStr, buildDatePresets } from './date-presets';

// Mercredi 8 juillet 2026 (getDay() === 3)
const WED = new Date(2026, 6, 8, 15, 30);
// Dimanche 12 juillet 2026
const SUN = new Date(2026, 6, 12, 10, 0);

describe('date-presets (#25)', () => {
  it("todayStr retourne la date locale du jour", () => {
    expect(todayStr(WED)).toBe('2026-07-08');
  });

  it('tomorrowStr retourne J+1', () => {
    expect(tomorrowStr(WED)).toBe('2026-07-09');
  });

  it('nextWeekStr retourne le lundi de la semaine suivante', () => {
    expect(nextWeekStr(WED)).toBe('2026-07-13');
    expect(nextWeekStr(SUN)).toBe('2026-07-13');
  });

  it('buildDatePresets expose les 3 presets dans le bon ordre', () => {
    const presets = buildDatePresets(WED);
    expect(presets.map((p) => p.label)).toEqual(["Aujourd'hui", 'Demain', 'Lundi prochain']);
    expect(presets[0].value).toBe('2026-07-08');
  });
});
