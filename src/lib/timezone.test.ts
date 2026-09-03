import { describe, it, expect } from 'vitest';
import {
  clampOffsetHours,
  displayShiftMs,
  toDisplayISO,
  fromDisplayISO,
  formatTimeInTz,
  tzOffsetMinutes,
  dayKeyInTz,
  todayKeyInTz,
  dayStartInTz,
  dayStartISOInTz,
  dayEndInTz,
  addDaysToKey,
  weekdayOfKey,
  daysBetweenKeys,
  type TimezonePref,
} from './timezone';

const DEFAULT: TimezonePref = { mode: 'default', offsetHours: 0 };
const manual = (h: number): TimezonePref => ({ mode: 'manual', offsetHours: h });

describe('clampOffsetHours', () => {
  it('bornes signées [-12,14] et tronque', () => {
    expect(clampOffsetHours(-3)).toBe(-3);
    expect(clampOffsetHours(2.9)).toBe(2);
    expect(clampOffsetHours(-2.9)).toBe(-2);
    expect(clampOffsetHours(99)).toBe(14);
    expect(clampOffsetHours(-99)).toBe(-12);
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
  it('round-trip identité pour tout offset (UTC-12 à UTC+14)', () => {
    const iso = '2026-07-21T09:30:00.000Z';
    for (let h = -12; h <= 14; h++) {
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
  it('un offset négatif (UTC-N) diffère d’un offset positif (UTC+N)', () => {
    const iso = '2026-07-21T12:00:00.000Z';
    const west = formatTimeInTz(iso, manual(-5));
    const east = formatTimeInTz(iso, manual(5));
    expect(west).not.toBe(east);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Jours calendaires — la classe de bug R-01 (échéance décalée d'un jour)
// ═══════════════════════════════════════════════════════════════════
//
// Ces tests utilisent le mode 'manual', donc un décalage FIGÉ : ils décrivent
// le comportement pour un utilisateur en Guadeloupe (UTC-4), à Los Angeles
// (UTC-7) ou à Tokyo (UTC+9) sans dépendre du fuseau de la machine de CI.

describe('dayKeyInTz / dayStartInTz — aller-retour jour ↔ instant', () => {
  const zones: [string, number][] = [
    ['Guadeloupe UTC-4', -4],
    ['Los Angeles UTC-7', -7],
    ['Honolulu UTC-10', -10],
    ['UTC', 0],
    ['Paris été UTC+2', 2],
    ['Tokyo UTC+9', 9],
    ['Kiritimati UTC+14', 14],
  ];

  it.each(zones)('%s : jour → instant → jour est l’identité', (_label, offset) => {
    const pref = manual(offset);
    for (const day of ['2026-01-01', '2026-09-02', '2026-12-31']) {
      expect(dayKeyInTz(dayStartInTz(day, pref), pref)).toBe(day);
    }
  });

  it.each(zones)('%s : minuit local est bien le PREMIER instant du jour', (_label, offset) => {
    const pref = manual(offset);
    const start = dayStartInTz('2026-09-02', pref);
    expect(dayKeyInTz(start, pref)).toBe('2026-09-02');
    // Une milliseconde avant, on est encore la veille.
    expect(dayKeyInTz(new Date(start.getTime() - 1), pref)).toBe('2026-09-01');
  });

  it('l’ancien raccourci new Date(jour).toISOString() se relit la veille à l’ouest', () => {
    // Ce test documente le bug corrigé : il échouerait si on revenait en arrière.
    const legacy = new Date('2026-09-02').toISOString(); // minuit UTC
    expect(dayKeyInTz(legacy, manual(-4))).toBe('2026-09-01');
    // Le nouveau chemin, lui, rend bien le jour saisi.
    expect(dayKeyInTz(dayStartISOInTz('2026-09-02', manual(-4)), manual(-4))).toBe('2026-09-02');
  });

  it('dayEndInTz est la dernière milliseconde du jour', () => {
    const pref = manual(-4);
    const end = dayEndInTz('2026-09-02', pref);
    expect(dayKeyInTz(end, pref)).toBe('2026-09-02');
    expect(dayKeyInTz(new Date(end.getTime() + 1), pref)).toBe('2026-09-03');
    expect(end.getTime() - dayStartInTz('2026-09-02', pref).getTime()).toBe(86_400_000 - 1);
  });

  it('rend une valeur vide plutôt que NaN sur une entrée invalide', () => {
    expect(dayKeyInTz('pas une date', manual(0))).toBe('');
    expect(dayStartISOInTz('02/09/2026', manual(0))).toBe('');
    expect(Number.isNaN(dayStartInTz('', manual(0)).getTime())).toBe(true);
  });

  it('en mode défaut, suit le fuseau de la machine', () => {
    const now = new Date();
    expect(todayKeyInTz(DEFAULT, now)).toBe(now.toLocaleDateString('en-CA'));
  });
});

describe('arithmétique de clés de jour (sans fuseau ni heure d’été)', () => {
  it('addDaysToKey traverse les mois, les années et le 29 février', () => {
    expect(addDaysToKey('2026-09-02', 1)).toBe('2026-09-03');
    expect(addDaysToKey('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('addDaysToKey ne saute pas de jour au passage à l’heure d’été', () => {
    // 29 mars 2026 : bascule européenne. Un calcul en heure locale sauterait
    // ou doublerait une heure ; sur le calendrier UTC il n’y a rien à sauter.
    expect(addDaysToKey('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDaysToKey('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDaysToKey('2026-10-24', 1)).toBe('2026-10-25');
  });

  it('weekdayOfKey rend le bon jour de semaine', () => {
    expect(weekdayOfKey('2026-09-02')).toBe(3); // mercredi
    expect(weekdayOfKey('2026-09-06')).toBe(0); // dimanche
    expect(Number.isNaN(weekdayOfKey('nope'))).toBe(true);
  });

  it('daysBetweenKeys compte en jours calendaires, signé', () => {
    expect(daysBetweenKeys('2026-09-02', '2026-09-02')).toBe(0);
    expect(daysBetweenKeys('2026-09-02', '2026-09-05')).toBe(3);
    expect(daysBetweenKeys('2026-09-05', '2026-09-02')).toBe(-3);
    expect(daysBetweenKeys('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('tzOffsetMinutes', () => {
  it('compte à l’est de UTC, à l’inverse de getTimezoneOffset', () => {
    expect(tzOffsetMinutes(manual(2))).toBe(120);
    expect(tzOffsetMinutes(manual(-4))).toBe(-240);
    const now = new Date();
    expect(tzOffsetMinutes(DEFAULT, now)).toBe(-now.getTimezoneOffset());
  });
});
