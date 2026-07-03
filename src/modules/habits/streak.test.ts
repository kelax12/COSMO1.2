import { describe, it, expect } from 'vitest';
import { calculateStreakWithJoker } from './streak';

const NOW = new Date(2026, 6, 10, 12, 0, 0); // 10 juillet 2026

const key = (daysAgo: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA');
};

const completionsFor = (daysAgo: number[]) =>
  Object.fromEntries(daysAgo.map(n => [key(n), true]));

describe('calculateStreakWithJoker', () => {
  it('aucune complétion → streak 0, pas de joker', () => {
    expect(calculateStreakWithJoker({}, NOW)).toEqual({ streak: 0, jokerUsed: false, jokerDates: [] });
  });

  it('série simple sans trou (aujourd\'hui + 4 jours)', () => {
    const r = calculateStreakWithJoker(completionsFor([0, 1, 2, 3, 4]), NOW);
    expect(r.streak).toBe(5);
    expect(r.jokerUsed).toBe(false);
  });

  it('aujourd\'hui pas encore coché → la série d\'hier tient', () => {
    const r = calculateStreakWithJoker(completionsFor([1, 2, 3]), NOW);
    expect(r.streak).toBe(3);
    expect(r.jokerUsed).toBe(false);
  });

  it('un jour manqué est absorbé par le joker', () => {
    // coché aujourd'hui, manqué hier, coché les 3 jours d'avant
    const r = calculateStreakWithJoker(completionsFor([0, 2, 3, 4]), NOW);
    expect(r.streak).toBe(4);
    expect(r.jokerUsed).toBe(true);
    // La date du jour manqué couvert par le joker est exposée pour l'UI.
    expect(r.jokerDates).toEqual([key(1)]);
  });

  it('deux jours manqués dans la même semaine cassent la série', () => {
    const r = calculateStreakWithJoker(completionsFor([0, 2, 4, 5]), NOW);
    // jour 1 = joker ; jour 3 = 2ᵉ manque en < 7 jours → stop après jour 2
    expect(r.streak).toBe(2);
  });

  it('un manque par semaine espacé de 7+ jours est toléré', () => {
    // manqués : il y a 3 jours et il y a 11 jours — fenêtres distinctes
    const days = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 12, 13];
    const r = calculateStreakWithJoker(completionsFor(days), NOW);
    expect(r.streak).toBe(12);
    expect(r.jokerUsed).toBe(true);
  });

  it('vieille série interrompue depuis longtemps → streak 0', () => {
    const r = calculateStreakWithJoker(completionsFor([10, 11, 12]), NOW);
    expect(r.streak).toBe(0);
  });
});
