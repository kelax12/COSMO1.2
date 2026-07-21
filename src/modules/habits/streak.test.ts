import { describe, it, expect } from 'vitest';
import { calculateStreak } from './streak';

const NOW = new Date(2026, 6, 10, 12, 0, 0); // 10 juillet 2026

const key = (daysAgo: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA');
};

const completionsFor = (daysAgo: number[]) =>
  Object.fromEntries(daysAgo.map(n => [key(n), true]));

describe('calculateStreak', () => {
  it('aucune complétion → streak 0', () => {
    expect(calculateStreak({}, NOW)).toBe(0);
  });

  it('série simple sans trou (aujourd\'hui + 4 jours)', () => {
    expect(calculateStreak(completionsFor([0, 1, 2, 3, 4]), NOW)).toBe(5);
  });

  it('aujourd\'hui pas encore coché → la série d\'hier tient', () => {
    expect(calculateStreak(completionsFor([1, 2, 3]), NOW)).toBe(3);
  });

  it('un jour manqué remet la série à zéro depuis ce point', () => {
    // coché aujourd'hui, manqué hier → seul aujourd'hui compte
    expect(calculateStreak(completionsFor([0, 2, 3, 4]), NOW)).toBe(1);
  });

  it('vieille série interrompue depuis longtemps → streak 0', () => {
    expect(calculateStreak(completionsFor([10, 11, 12]), NOW)).toBe(0);
  });
});
