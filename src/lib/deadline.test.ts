import { describe, it, expect } from 'vitest';
import {
  deadlineDayKey,
  deadlineFromDayKey,
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
      expect(deadlineDayKey(deadlineFromDayKey(day, pref), pref)).toBe(day);
    }
  });

  it('« pas d’échéance » reste « pas d’échéance »', () => {
    expect(deadlineFromDayKey('', manual(-4))).toBe('');
    expect(deadlineFromDayKey(undefined, manual(-4))).toBe('');
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
    const stored = deadlineFromDayKey(today, pref);
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
    const stored = deadlineFromDayKey('2020-01-01', manual(-4));
    expect(isOverdue(stored, true, manual(-4), now)).toBe(false);
    expect(isOverdue(stored, false, manual(-4), now)).toBe(true);
  });

  it('hier est en retard, demain ne l’est pas', () => {
    const pref = manual(-4);
    expect(daysUntilDeadline(deadlineFromDayKey('2026-09-01', pref), pref, now)).toBe(-1);
    expect(daysUntilDeadline(deadlineFromDayKey('2026-09-03', pref), pref, now)).toBe(1);
    expect(isOverdue(deadlineFromDayKey('2026-09-01', pref), false, pref, now)).toBe(true);
    expect(isOverdue(deadlineFromDayKey('2026-09-03', pref), false, pref, now)).toBe(false);
  });

  it('à 00 h 01 la tâche du jour n’est pas encore en retard', () => {
    // L’ancienne règle comparait des INSTANTS : minuit local étant déjà passé
    // d’une minute, la ligne passait en rouge dès le premier instant du jour.
    const pref = manual(-4);
    const justAfterMidnight = new Date('2026-09-02T04:01:00.000Z'); // 00 h 01 à UTC-4
    const stored = deadlineFromDayKey('2026-09-02', pref);
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
