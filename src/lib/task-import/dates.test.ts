import { describe, it, expect } from 'vitest';
import { parseDay, parseRecurrence, mapPriority, instantToDay } from './dates';

const NOW = new Date(2026, 9, 8, 12, 0, 0); // 8 octobre 2026, heure locale

describe('parseDay', () => {
  it('ISO : jour seul, ou partie date d un horodatage sans fuseau', () => {
    expect(parseDay('2026-10-09', NOW)).toBe('2026-10-09');
    expect(parseDay('2026-10-09 15:00:00', NOW)).toBe('2026-10-09');
    expect(parseDay('2026/10/09', NOW)).toBe('2026-10-09');
  });

  it('formats écrits en anglais', () => {
    for (const s of ['9 Oct 2026', 'Oct 9 2026', 'Oct 9, 2026', 'October 9, 2026', 'October 9, 2026 3:00 PM', 'Fri 9 Oct 2026']) {
      expect(parseDay(s, NOW), s).toBe('2026-10-09');
    }
  });

  it('formats écrits en français', () => {
    for (const s of ['9 octobre 2026', '9 oct. 2026', 'vendredi 9 octobre 2026', '9 Octobre 2026 15:00']) {
      expect(parseDay(s, NOW), s).toBe('2026-10-09');
    }
  });

  it('jour/mois/année à l européenne', () => {
    expect(parseDay('09/10/2026', NOW)).toBe('2026-10-09');
    expect(parseDay('9.10.2026', NOW)).toBe('2026-10-09');
  });

  it('sans année : l année en cours', () => {
    expect(parseDay('Oct 9', NOW)).toBe('2026-10-09');
    expect(parseDay('9 octobre', NOW)).toBe('2026-10-09');
  });

  it('relatifs simples', () => {
    expect(parseDay('today', NOW)).toBe('2026-10-08');
    expect(parseDay('demain', NOW)).toBe('2026-10-09');
    expect(parseDay("aujourd'hui", NOW)).toBe('2026-10-08');
  });

  it('illisible ou vide : undefined', () => {
    expect(parseDay('', NOW)).toBeUndefined();
    expect(parseDay('next week', NOW)).toBeUndefined();
    expect(parseDay('every day', NOW)).toBeUndefined();
    expect(parseDay('31/02/2026', NOW)).toBeUndefined();
  });
});

describe('instantToDay', () => {
  it('ramène un instant au jour du fuseau donné', () => {
    expect(instantToDay('2026-10-09T22:00:00+0000', 'Europe/Paris')).toBe('2026-10-10');
    expect(instantToDay('2026-10-09T22:00:00.000Z', 'America/New_York')).toBe('2026-10-09');
  });
  it('illisible : undefined', () => {
    expect(instantToDay('pas une date', 'Europe/Paris')).toBeUndefined();
  });
});

describe('parseRecurrence', () => {
  it('textes anglais et français', () => {
    expect(parseRecurrence('every day')).toBe('daily');
    expect(parseRecurrence('every! day')).toBe('daily');
    expect(parseRecurrence('daily')).toBe('daily');
    expect(parseRecurrence('tous les jours')).toBe('daily');
    expect(parseRecurrence('every week')).toBe('weekly');
    expect(parseRecurrence('every monday')).toBe('weekly');
    expect(parseRecurrence('tous les lundis')).toBe('weekly');
    expect(parseRecurrence('chaque semaine')).toBe('weekly');
    expect(parseRecurrence('every month')).toBe('monthly');
    expect(parseRecurrence('tous les mois')).toBe('monthly');
  });
  it('RRULE à intervalle 1', () => {
    expect(parseRecurrence('FREQ=DAILY;INTERVAL=1')).toBe('daily');
    expect(parseRecurrence('RRULE:FREQ=WEEKLY')).toBe('weekly');
    expect(parseRecurrence('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=3')).toBe('monthly');
  });
  it('ce que COSMO ne sait pas répéter : none', () => {
    expect(parseRecurrence('FREQ=DAILY;INTERVAL=2')).toBe('none');
    expect(parseRecurrence('every 2 days')).toBe('none');
    expect(parseRecurrence('every other week')).toBe('none');
    expect(parseRecurrence('FREQ=YEARLY')).toBe('none');
    expect(parseRecurrence('')).toBe('none');
    expect(parseRecurrence('9 Oct 2026')).toBe('none');
  });
});

describe('mapPriority', () => {
  it('Todoist : 1 = p1 la plus haute, 4 = sans priorité', () => {
    expect(mapPriority('todoist', '1')).toBe(1);
    expect(mapPriority('todoist', '2')).toBe(2);
    expect(mapPriority('todoist', '3')).toBe(3);
    expect(mapPriority('todoist', '4')).toBe(0);
    expect(mapPriority('todoist', 'p2')).toBe(2);
    expect(mapPriority('todoist', '')).toBe(0);
  });
  it('TickTick : 5 haute, 3 moyenne, 1 basse, 0 aucune', () => {
    expect(mapPriority('ticktick', '5')).toBe(1);
    expect(mapPriority('ticktick', '3')).toBe(2);
    expect(mapPriority('ticktick', '1')).toBe(4);
    expect(mapPriority('ticktick', '0')).toBe(0);
  });
  it('CSV quelconque : nombres 1 à 5, ou mots', () => {
    expect(mapPriority('generic', '2')).toBe(2);
    expect(mapPriority('generic', 'High')).toBe(1);
    expect(mapPriority('generic', 'Haute')).toBe(1);
    expect(mapPriority('generic', 'P1')).toBe(1);
    expect(mapPriority('generic', 'Medium')).toBe(3);
    expect(mapPriority('generic', 'Moyenne')).toBe(3);
    expect(mapPriority('generic', 'Low')).toBe(5);
    expect(mapPriority('generic', 'Basse')).toBe(5);
    expect(mapPriority('generic', 'abc')).toBe(0);
    expect(mapPriority('generic', '9')).toBe(0);
  });
});
