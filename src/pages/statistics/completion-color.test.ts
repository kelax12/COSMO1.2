import { describe, it, expect } from 'vitest';
import { completionColor, completionHue } from './completion-color';

describe('completionHue', () => {
  it('va du rouge au vert', () => {
    expect(completionHue(0)).toBe(0);
    expect(completionHue(50)).toBe(70);
    expect(completionHue(100)).toBe(140);
  });

  it('est monotone : un meilleur taux ne recule jamais vers le rouge', () => {
    for (let rate = 1; rate <= 100; rate++) {
      expect(completionHue(rate)).toBeGreaterThanOrEqual(completionHue(rate - 1));
    }
  });

  it('borne les entrées hors [0, 100] au lieu de sortir de la roue', () => {
    expect(completionHue(-20)).toBe(0);
    expect(completionHue(140)).toBe(140);
    expect(completionHue(Number.NaN)).toBe(0);
  });
});

describe('completionColor', () => {
  it('ne fait varier que la teinte', () => {
    expect(completionColor(0)).toBe('hsl(0, 68%, 45%)');
    expect(completionColor(100)).toBe('hsl(140, 68%, 45%)');
  });
});
