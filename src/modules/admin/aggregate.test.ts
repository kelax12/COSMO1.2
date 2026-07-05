import { describe, it, expect } from 'vitest';
import {
  chooseGranularity,
  fillMissingDays,
  aggregateWeekly,
  toCumulative,
  DAY_THRESHOLD,
} from './aggregate';
import type { DailyPoint } from './types';

const pt = (day: string, count: number): DailyPoint => ({ day, count });

describe('chooseGranularity', () => {
  it('renvoie day pour une série vide ou un seul point', () => {
    expect(chooseGranularity([])).toBe('day');
    expect(chooseGranularity([pt('2026-01-01', 1)])).toBe('day');
  });

  it('renvoie day sous le seuil, week au-delà', () => {
    expect(chooseGranularity([pt('2026-01-01', 1), pt('2026-03-01', 1)])).toBe('day'); // 59 j
    expect(chooseGranularity([pt('2026-01-01', 1), pt('2026-06-01', 1)])).toBe('week'); // 151 j
  });

  it(`bascule exactement au-delà de ${DAY_THRESHOLD} jours`, () => {
    expect(chooseGranularity([pt('2026-01-01', 1), pt('2026-05-01', 1)])).toBe('day'); // 120 j pile
    expect(chooseGranularity([pt('2026-01-01', 1), pt('2026-05-02', 1)])).toBe('week'); // 121 j
  });
});

describe('fillMissingDays', () => {
  it('série vide → []', () => {
    expect(fillMissingDays([], '2026-01-10')).toEqual([]);
  });

  it('zéro-fill les trous jusqu à endDay inclus', () => {
    const out = fillMissingDays([pt('2026-01-01', 2), pt('2026-01-03', 1)], '2026-01-04');
    expect(out).toEqual([
      pt('2026-01-01', 2),
      pt('2026-01-02', 0),
      pt('2026-01-03', 1),
      pt('2026-01-04', 0),
    ]);
  });

  it('franchit une fin de mois sans décalage (pas de parse UTC)', () => {
    const out = fillMissingDays([pt('2026-01-31', 1)], '2026-02-02');
    expect(out.map((p) => p.day)).toEqual(['2026-01-31', '2026-02-01', '2026-02-02']);
  });
});

describe('aggregateWeekly', () => {
  it('regroupe par lundi ISO et somme', () => {
    // 2026-01-05 est un lundi ; 2026-01-11 le dimanche de la même semaine.
    const out = aggregateWeekly([
      pt('2026-01-05', 1),
      pt('2026-01-07', 2),
      pt('2026-01-11', 3),
      pt('2026-01-12', 4), // lundi suivant
    ]);
    expect(out).toEqual([pt('2026-01-05', 6), pt('2026-01-12', 4)]);
  });

  it('semaine à cheval sur le changement d année', () => {
    // 2025-12-29 est un lundi ; le 2026-01-01 (jeudi) tombe dans son bucket.
    const out = aggregateWeekly([pt('2025-12-30', 1), pt('2026-01-01', 2)]);
    expect(out).toEqual([pt('2025-12-29', 3)]);
  });

  it('série vide → []', () => {
    expect(aggregateWeekly([])).toEqual([]);
  });
});

describe('toCumulative', () => {
  it('cumule les counts en préservant les jours', () => {
    const out = toCumulative([pt('2026-01-01', 2), pt('2026-01-02', 0), pt('2026-01-03', 5)]);
    expect(out).toEqual([pt('2026-01-01', 2), pt('2026-01-02', 2), pt('2026-01-03', 7)]);
  });

  it('série vide → []', () => {
    expect(toCumulative([])).toEqual([]);
  });
});
