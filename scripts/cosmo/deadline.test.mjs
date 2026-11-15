import { describe, it, expect } from 'vitest';
import { deadlineDayKey } from './deadline.mjs';

// Le CLI est le chemin d'ecriture dans le VRAI compte de production : c'etait
// le 4e chemin d'ecriture divergent du risque R-01, et son commentaire
// affirmait une parite avec le repository applicatif qu'il n'avait plus.
describe('deadline du CLI (R-01)', () => {
  it('relit le jour saisi comme la base (echeance_jour, mig. 251), pas le jour UTC', () => {
    // Minuit du 12 ecrit a Paris, a Montreal, a Tokyo, et l'ancien minuit UTC.
    expect(deadlineDayKey('2026-11-11T23:00:00.000Z')).toBe('2026-11-12');
    expect(deadlineDayKey('2026-11-12T05:00:00.000Z')).toBe('2026-11-12');
    expect(deadlineDayKey('2026-11-11T15:00:00.000Z')).toBe('2026-11-12');
    expect(deadlineDayKey('2026-11-12T00:00:00.000Z')).toBe('2026-11-12');
    // Instant quelconque (ancien report) : jour vecu a Paris.
    expect(deadlineDayKey('2026-11-12T22:30:12.345Z')).toBe('2026-11-12');
    expect(deadlineDayKey('2026-11-12T23:30:12.345Z')).toBe('2026-11-13');
  });

  it('laisse passer une valeur vide comme absente', () => {
    expect(deadlineDayKey('')).toBe('');
    expect(deadlineDayKey(null)).toBe('');
  });

  it('rend une cle de jour telle quelle (team_tasks.deadline est une date)', () => {
    expect(deadlineDayKey('2026-09-02')).toBe('2026-09-02');
  });
});
