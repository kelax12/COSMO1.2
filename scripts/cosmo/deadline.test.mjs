import { describe, it, expect } from 'vitest';
import { deadlineToTimestamp, deadlineEndOfDay, deadlineDayKey } from './deadline.mjs';

// Le CLI est le chemin d'ecriture dans le VRAI compte de production : c'etait
// le 4e chemin d'ecriture divergent du risque R-01, et son commentaire
// affirmait une parite avec le repository applicatif qu'il n'avait plus.
describe('deadline du CLI (R-01)', () => {
  it('convertit un jour saisi en instant de minuit LOCAL, jamais UTC', () => {
    const iso = deadlineToTimestamp('2026-09-02');
    // L'aller-retour redonne le jour saisi, quel que soit le fuseau de la
    // machine — c'est la seule assertion qui tient sur un runner en UTC.
    expect(deadlineDayKey(iso)).toBe('2026-09-02');
    expect(new Date(iso).getFullYear()).toBe(2026);
    expect(new Date(iso).getMonth()).toBe(8);
    expect(new Date(iso).getDate()).toBe(2);
    expect(new Date(iso).getHours()).toBe(0);
  });

  it('rend la borne haute au dernier instant du jour local', () => {
    const iso = deadlineEndOfDay('2026-09-02');
    expect(deadlineDayKey(iso)).toBe('2026-09-02');
    expect(new Date(iso).getHours()).toBe(23);
    expect(new Date(iso).getMinutes()).toBe(59);
  });

  it('encadre bien la journee : debut <= fin, et un jour complet entre les deux', () => {
    const start = new Date(deadlineToTimestamp('2026-09-02')).getTime();
    const end = new Date(deadlineEndOfDay('2026-09-02')).getTime();
    expect(end - start).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('relit un jour VECU, pas le jour UTC (le piege de .slice(0, 10))', () => {
    // Minuit local en UTC+2 : l'instant porte la veille en UTC.
    expect(deadlineDayKey('2026-09-01T22:00:00.000Z')).toBe(
      new Date('2026-09-01T22:00:00.000Z').toLocaleDateString('en-CA'),
    );
  });

  it('laisse passer une valeur vide comme NULL', () => {
    expect(deadlineToTimestamp('')).toBeNull();
    expect(deadlineToTimestamp(null)).toBeNull();
    expect(deadlineDayKey('')).toBe('');
  });

  it('rend une cle de jour telle quelle (team_tasks.deadline est une date)', () => {
    expect(deadlineDayKey('2026-09-02')).toBe('2026-09-02');
  });
});
