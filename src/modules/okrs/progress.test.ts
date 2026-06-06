import { describe, it, expect } from 'vitest';
import { recalcProgress } from './progress';
import type { KeyResult } from './types';

// Fabrique un KR minimal — seuls current/target comptent pour le calcul.
const kr = (currentValue: number, targetValue: number): KeyResult => ({
  id: Math.random().toString(36).slice(2),
  title: 'kr',
  unit: 'u',
  currentValue,
  targetValue,
  estimatedTime: 0,
  completed: false,
  completedAt: null,
});

describe('recalcProgress', () => {
  it('liste vide → 0 % et non complété', () => {
    expect(recalcProgress([])).toEqual({ progress: 0, completed: false });
  });

  it('un seul KR à mi-parcours → 50 %', () => {
    expect(recalcProgress([kr(50, 100)])).toEqual({ progress: 50, completed: false });
  });

  it('moyenne de plusieurs KR', () => {
    // 100 % + 0 % + 50 % = 150 / 3 = 50 %
    expect(recalcProgress([kr(10, 10), kr(0, 10), kr(5, 10)]).progress).toBe(50);
  });

  it('borne chaque KR à 100 % même en dépassement', () => {
    // 200 % plafonné à 100 % → moyenne 100 %
    expect(recalcProgress([kr(20, 10), kr(10, 10)]).progress).toBe(100);
  });

  it('completed=true uniquement si tous les KR atteignent leur cible', () => {
    expect(recalcProgress([kr(10, 10), kr(5, 5)]).completed).toBe(true);
    expect(recalcProgress([kr(10, 10), kr(4, 5)]).completed).toBe(false);
  });

  it('dépassement de cible compte comme complété', () => {
    expect(recalcProgress([kr(12, 10)]).completed).toBe(true);
  });

  it('garde anti division par zéro : targetValue=0 contribue 0 % (faille B17)', () => {
    const res = recalcProgress([kr(5, 0)]);
    expect(Number.isNaN(res.progress)).toBe(false);
    expect(res.progress).toBe(0);
    // Un KR à cible 0 ne peut jamais compter comme complété.
    expect(res.completed).toBe(false);
  });

  it('targetValue négatif contribue 0 % et n’est jamais complété', () => {
    const res = recalcProgress([kr(5, -3)]);
    expect(res.progress).toBe(0);
    expect(res.completed).toBe(false);
  });

  it('mix KR valide + KR cible 0 : moyenne sans NaN', () => {
    // 100 % + 0 % (cible 0) = 100 / 2 = 50 %
    const res = recalcProgress([kr(10, 10), kr(99, 0)]);
    expect(res.progress).toBe(50);
    expect(res.completed).toBe(false); // le KR cible 0 casse la complétion
  });

  it('arrondit à l’entier', () => {
    // 1/3 = 33.33 % → 33
    expect(recalcProgress([kr(1, 3)]).progress).toBe(33);
  });
});
