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
    // Des CLÉS de catalogue, jamais des libellés : les presets sont rendus par
    // les deux pickers du produit, en français comme en anglais (point 5).
    expect(presets.map((p) => p.labelKey)).toEqual([
      'datePicker.today',
      'datePicker.tomorrow',
      'datePicker.nextMonday',
    ]);
    expect(presets[0].value).toBe('2026-07-08');
  });
});
