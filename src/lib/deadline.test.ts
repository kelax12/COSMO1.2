import { describe, it, expect } from 'vitest';
import {
  deadlineDayKey,
  storedDeadlineInstant,
  dayKeyFromStoredDeadline,
  deadlineLocalDate,
  daysUntilDeadline,
  isDueToday,
  isOverdue,
} from './deadline';
import type { TimezonePref } from './timezone';

const manual = (h: number): TimezonePref => ({ mode: 'manual', offsetHours: h });

// Les fuseaux qui comptent pour ce module : ceux où l'ancien code se trompait
// d'un jour (décalage négatif) et ceux où il avait raison par accident.
const ZONES: [string, number][] = [
  ['Guadeloupe UTC-4', -4],
  ['New York UTC-4', -4],
  ['Los Angeles UTC-7', -7],
  ['Honolulu UTC-10', -10],
  ['UTC', 0],
  ['Paris UTC+2', 2],
  ['Tokyo UTC+9', 9],
];

describe('aller-retour jour saisi ↔ échéance stockée', () => {
  it.each(ZONES)('%s : le jour saisi est le jour relu', (_l, offset) => {
    const pref = manual(offset);
    for (const day of ['2026-01-01', '2026-09-02', '2026-12-31']) {
      expect(deadlineDayKey(storedDeadlineInstant(day, pref), pref)).toBe(day);
    }
  });

  it('« pas d’échéance » reste « pas d’échéance »', () => {
    expect(storedDeadlineInstant('', manual(-4))).toBe('');
    expect(storedDeadlineInstant(undefined, manual(-4))).toBe('');
    expect(deadlineDayKey('', manual(-4))).toBe('');
    expect(deadlineDayKey(null, manual(-4))).toBe('');
  });

  it('une échéance d’équipe (date nue) traverse sans conversion', () => {
    // `team_tasks.deadline` est une `date` : elle ne porte pas d'instant, donc
    // la convertir la décalerait au lieu de la corriger.
    for (const [, offset] of ZONES) {
      expect(deadlineDayKey('2026-09-02', manual(offset))).toBe('2026-09-02');
    }
  });
});

describe('R-01 — la tâche du jour n’est ni en retard ni invisible', () => {
  // 2 septembre 2026, 15 h à Paris. Le même instant est le 2 septembre partout
  // dans les fuseaux testés, sauf Honolulu où il est encore le 2 au matin.
  const now = new Date('2026-09-02T13:00:00.000Z');

  it.each(ZONES)('%s : une échéance posée à aujourd’hui est due aujourd’hui', (_l, offset) => {
    const pref = manual(offset);
    const today = deadlineDayKey(now.toISOString(), pref);
    const stored = storedDeadlineInstant(today, pref);
    expect(isDueToday(stored, pref, now)).toBe(true);
    expect(isOverdue(stored, false, pref, now)).toBe(false);
    expect(daysUntilDeadline(stored, pref, now)).toBe(0);
  });

  it('l’ancienne écriture (minuit UTC) était bien lue la veille à l’ouest', () => {
    // Régression documentée : ce comportement est celui qu’on a corrigé.
    const legacy = new Date('2026-09-02').toISOString();
    expect(isDueToday(legacy, manual(-4), now)).toBe(false);
    expect(isOverdue(legacy, false, manual(-4), now)).toBe(true);
    // ... et il restait correct à Paris, d’où l’invisibilité du défaut.
    expect(isDueToday(legacy, manual(2), now)).toBe(true);
  });

  it('une tâche complétée n’est jamais en retard', () => {
    const stored = storedDeadlineInstant('2020-01-01', manual(-4));
    expect(isOverdue(stored, true, manual(-4), now)).toBe(false);
    expect(isOverdue(stored, false, manual(-4), now)).toBe(true);
  });

  it('hier est en retard, demain ne l’est pas', () => {
    const pref = manual(-4);
    expect(daysUntilDeadline(storedDeadlineInstant('2026-09-01', pref), pref, now)).toBe(-1);
    expect(daysUntilDeadline(storedDeadlineInstant('2026-09-03', pref), pref, now)).toBe(1);
    expect(isOverdue(storedDeadlineInstant('2026-09-01', pref), false, pref, now)).toBe(true);
    expect(isOverdue(storedDeadlineInstant('2026-09-03', pref), false, pref, now)).toBe(false);
  });

  it('à 00 h 01 la tâche du jour n’est pas encore en retard', () => {
    // L’ancienne règle comparait des INSTANTS : minuit local étant déjà passé
    // d’une minute, la ligne passait en rouge dès le premier instant du jour.
    const pref = manual(-4);
    const justAfterMidnight = new Date('2026-09-02T04:01:00.000Z'); // 00 h 01 à UTC-4
    const stored = storedDeadlineInstant('2026-09-02', pref);
    expect(isOverdue(stored, false, pref, justAfterMidnight)).toBe(false);
    expect(isDueToday(stored, pref, justAfterMidnight)).toBe(true);
  });

  it('une échéance illisible ne rend ni « aujourd’hui » ni « en retard »', () => {
    const pref = manual(-4);
    expect(Number.isNaN(daysUntilDeadline('bricolage', pref, now))).toBe(true);
    expect(isDueToday('bricolage', pref, now)).toBe(false);
    expect(isOverdue('bricolage', false, pref, now)).toBe(false);
    expect(isOverdue('', false, pref, now)).toBe(false);
  });
});

describe('détachement du fuseau de métropole', () => {
  it('deux réglages différents découpent la journée différemment', () => {
    // 2 septembre, 01 h 00 à Paris (UTC+2) = 1er septembre, 21 h 00 en
    // Guadeloupe (UTC-4). Quelqu'un aux Antilles qui règle UTC-4 voit bien sa
    // soirée du 1er, là où le réglage métropole la datait déjà du 2.
    const instant = '2026-09-01T23:00:00.000Z';
    expect(deadlineDayKey(instant, manual(2))).toBe('2026-09-02');
    expect(deadlineDayKey(instant, manual(-4))).toBe('2026-09-01');
  });
});

describe('dayKeyFromStoredDeadline : miroir de public.echeance_jour (mig. 251)', () => {
  it('une échéance saisie le 12 reste le 12, quel que soit le fuseau de son auteur', () => {
    expect(dayKeyFromStoredDeadline('2026-11-11T23:00:00.000Z')).toBe('2026-11-12'); // Paris
    expect(dayKeyFromStoredDeadline('2026-11-12T05:00:00.000Z')).toBe('2026-11-12'); // Montréal
    expect(dayKeyFromStoredDeadline('2026-11-11T15:00:00.000Z')).toBe('2026-11-12'); // Tokyo
    expect(dayKeyFromStoredDeadline('2026-11-12T00:00:00.000Z')).toBe('2026-11-12'); // ancien minuit UTC
    expect(dayKeyFromStoredDeadline('2026-07-11T22:00:00.000Z')).toBe('2026-07-12'); // Paris, été
    expect(dayKeyFromStoredDeadline('2026-11-11T18:30:00.000Z')).toBe('2026-11-12'); // Inde
  });

  it('chaque minuit écrit par storedDeadlineInstant se relit au même jour, de UTC-10 à UTC+13', () => {
    for (let h = -10; h <= 13; h += 1) {
      expect(dayKeyFromStoredDeadline(storedDeadlineInstant('2026-11-12', manual(h)))).toBe('2026-11-12');
    }
  });

  it('un instant quelconque (ancien report) est lu au jour de Paris', () => {
    expect(dayKeyFromStoredDeadline('2026-11-12T20:09:03.585Z')).toBe('2026-11-12');
    expect(dayKeyFromStoredDeadline('2026-11-12T23:30:12.345Z')).toBe('2026-11-13');
  });

  it('rend une clé de jour telle quelle, et rien pour une valeur absente ou invalide', () => {
    expect(dayKeyFromStoredDeadline('2026-11-12')).toBe('2026-11-12');
    expect(dayKeyFromStoredDeadline(null)).toBe('');
    expect(dayKeyFromStoredDeadline('pas-une-date')).toBe('');
  });
});

describe('deadlineLocalDate', () => {
  it('rend le jour à midi LOCAL, jamais minuit UTC (la veille à l ouest)', () => {
    const d = deadlineLocalDate('2026-11-12')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 12, 12]);
    expect(deadlineLocalDate('')).toBeNull();
  });
});
