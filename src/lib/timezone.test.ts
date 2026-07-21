import { describe, it, expect } from 'vitest';
import {
  clampOffsetHours,
  displayShiftMs,
  toDisplayISO,
  fromDisplayISO,
  formatTimeInTz,
  timezoneLabel,
  type TimezonePref,
} from './timezone';

const DEFAULT: TimezonePref = { mode: 'default', offsetHours: 0 };
const manual = (h: number): TimezonePref => ({ mode: 'manual', offsetHours: h });

describe('clampOffsetHours', () => {
  it('bornes [0,14] et tronque', () => {
    expect(clampOffsetHours(-3)).toBe(0);
    expect(clampOffsetHours(2.9)).toBe(2);
    expect(clampOffsetHours(99)).toBe(14);
    expect(clampOffsetHours(NaN)).toBe(0);
  });
});

describe('mode défaut = identité', () => {
  const iso = '2026-07-21T12:00:00.000Z';
  it('ne décale rien', () => {
    expect(displayShiftMs(DEFAULT)).toBe(0);
    expect(toDisplayISO(iso, DEFAULT)).toBe(iso);
    expect(fromDisplayISO(iso, DEFAULT)).toBe(iso);
  });
});

describe('toDisplayISO / fromDisplayISO sont réciproques', () => {
  it('round-trip identité pour tout offset', () => {
    const iso = '2026-07-21T09:30:00.000Z';
    for (let h = 0; h <= 14; h++) {
      const pref = manual(h);
      const back = fromDisplayISO(toDisplayISO(iso, pref), pref);
      expect(new Date(back).getTime()).toBe(new Date(iso).getTime());
    }
  });
});

describe('affichage de l’heure murale dans le fuseau choisi', () => {
  const iso = '2026-07-21T12:00:00.000Z'; // 12:00 UTC
  const machineOffsetHours = -new Date(iso).getTimezoneOffset() / 60;

  it('choisir un offset = offset machine reproduit l’heure locale', () => {
    // Invariant machine-indépendant : si l'utilisateur fige exactement le fuseau
    // de sa machine, l'affichage doit être identique à l'heure locale.
    if (!Number.isInteger(machineOffsetHours)) return; // fuseau à minutes → non testé
    const pref = manual(machineOffsetHours);
    const local = new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    expect(formatTimeInTz(iso, pref)).toBe(local);
  });

  it('un offset supérieur d’1h à la machine avance l’heure affichée d’1h', () => {
    if (!Number.isInteger(machineOffsetHours)) return;
    const base = new Date(iso);
    const plusOne = formatTimeInTz(iso, manual(machineOffsetHours + 1));
    const expected = new Date(base.getTime() + 3_600_000)
      .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    expect(plusOne).toBe(expected);
  });
});

describe('formatTimeInTz', () => {
  it('mode défaut = heure locale', () => {
    const iso = '2026-07-21T12:00:00.000Z';
    const local = new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    expect(formatTimeInTz(iso, DEFAULT)).toBe(local);
  });
  it('deux offsets consécutifs diffèrent d’une heure', () => {
    const iso = '2026-07-21T12:00:00.000Z';
    const a = formatTimeInTz(iso, manual(3));
    const b = formatTimeInTz(iso, manual(4));
    expect(a).not.toBe(b);
  });
});

describe('timezoneLabel', () => {
  it('libellés lisibles', () => {
    expect(timezoneLabel(DEFAULT)).toBe('Heure locale');
    expect(timezoneLabel(manual(2))).toBe('UTC+2');
  });
});
