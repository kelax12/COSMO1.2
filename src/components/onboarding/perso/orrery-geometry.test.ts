import { describe, it, expect } from 'vitest';
import { ORRERY_VIEWBOX, PLANETS, outerTicks, planetPosition, planetStates } from './orrery-geometry';

describe('planétaire : géométrie', () => {
  it('aucune planète ni graduation ne sort du cadre', () => {
    for (const planet of PLANETS) {
      const { x, y } = planetPosition(planet);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(ORRERY_VIEWBOX.width);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(ORRERY_VIEWBOX.height);
    }
    for (const tick of outerTicks()) {
      for (const v of [tick.x1, tick.x2]) expect(v >= 0 && v <= ORRERY_VIEWBOX.width).toBe(true);
      for (const v of [tick.y1, tick.y2]) expect(v >= 0 && v <= ORRERY_VIEWBOX.height).toBe(true);
    }
  });

  it('chaque étape allume SA planète, éteint les suivantes et garde les précédentes', () => {
    expect(planetStates(0)).toEqual({ tasks: 'idle', agenda: 'idle', habits: 'idle', okr: 'idle' });
    expect(planetStates(1)).toEqual({ tasks: 'active', agenda: 'idle', habits: 'idle', okr: 'idle' });
    expect(planetStates(3)).toEqual({ tasks: 'done', agenda: 'done', habits: 'active', okr: 'idle' });
    expect(planetStates(5)).toEqual({ tasks: 'done', agenda: 'done', habits: 'done', okr: 'done' });
  });
});
