import { describe, it, expect } from 'vitest';
import {
  chooseGranularity,
  fillMissingDays,
  aggregateWeekly,
  toCumulative,
  rankSources,
  stackBySource,
  OTHER_SOURCE,
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

describe('rankSources', () => {
  it('trie par volume décroissant', () => {
    expect(rankSources({ tiktok: 3, reddit: 10, ph: 5 })).toEqual(['reddit', 'ph', 'tiktok']);
  });

  it('départage à volume égal par ordre alphabétique (rendu stable)', () => {
    expect(rankSources({ b: 2, a: 2 })).toEqual(['a', 'b']);
  });

  it('ignore les canaux à 0', () => {
    expect(rankSources({ tiktok: 3, mort: 0 })).toEqual(['tiktok']);
  });

  it(`fond les canaux résiduels dans ${OTHER_SOURCE} au-delà de max`, () => {
    const ranked = rankSources({ a: 5, b: 4, c: 3, d: 2 }, 2);
    expect(ranked).toEqual(['a', 'b', OTHER_SOURCE]);
  });
});

describe('stackBySource', () => {
  const p = (day: string, source: string, count: number) => ({ day, source, count });

  it('produit une clé par canal, 0 compris, triée par jour', () => {
    const out = stackBySource(
      [p('2026-01-02', 'tiktok', 2), p('2026-01-01', 'reddit', 1)],
      ['reddit', 'tiktok']
    );
    expect(out).toEqual([
      { day: '2026-01-01', reddit: 1, tiktok: 0 },
      { day: '2026-01-02', reddit: 0, tiktok: 2 },
    ]);
  });

  it(`agrège les canaux hors liste sous ${OTHER_SOURCE} quand il est présent`, () => {
    const out = stackBySource(
      [p('2026-01-01', 'x', 1), p('2026-01-01', 'y', 2)],
      ['reddit', OTHER_SOURCE]
    );
    expect(out).toEqual([{ day: '2026-01-01', reddit: 0, [OTHER_SOURCE]: 3 }]);
  });

  it('ignore les canaux hors liste quand il n’y a pas de fourre-tout', () => {
    expect(stackBySource([{ day: '2026-01-01', source: 'x', count: 1 }], ['reddit'])).toEqual([]);
  });

  it('série vide → []', () => {
    expect(stackBySource([], ['reddit'])).toEqual([]);
  });
});
