import { describe, it, expect } from 'vitest';
import { periodDelta, rollingPair } from './period-delta';

describe('periodDelta — maquette 194', () => {
  it('sans période précédente, aucun écart', () => {
    expect(periodDelta(120, 0)).toEqual({ kind: 'none' });
  });
  it('hausse et baisse en pourcentage arrondi', () => {
    expect(periodDelta(112, 100)).toEqual({ kind: 'up', pct: 12 });
    expect(periodDelta(75, 100)).toEqual({ kind: 'down', pct: 25 });
  });
  it('égalité', () => {
    expect(periodDelta(100, 100)).toEqual({ kind: 'same' });
  });
});

describe('rollingPair', () => {
  it('7 jours : la semaine glissante et celle d’avant, sans recouvrement', () => {
    const { current, previous } = rollingPair(new Date(2026, 9, 10, 15), 7);
    expect(current.start).toEqual(new Date(2026, 9, 4));
    expect(current.end).toEqual(new Date(2026, 9, 10));
    expect(previous.start).toEqual(new Date(2026, 8, 27));
    expect(previous.end).toEqual(new Date(2026, 9, 3));
  });
});
