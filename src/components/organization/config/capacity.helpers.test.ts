import { describe, it, expect } from 'vitest';
import { capacityLoad } from './capacity.helpers';

describe('capacityLoad', () => {
  it('sans capacité déclarée, ou nulle, rien n est jugé', () => {
    expect(capacityLoad(600, undefined)).toEqual({ weeks: null, over: false });
    expect(capacityLoad(600, 0)).toEqual({ weeks: null, over: false });
  });
  it('en semaines de travail, au-delà d une semaine = surcharge', () => {
    expect(capacityLoad(1200, 2400)).toEqual({ weeks: 0.5, over: false });
    expect(capacityLoad(2400, 2400)).toEqual({ weeks: 1, over: false });
    expect(capacityLoad(3000, 2400)).toEqual({ weeks: 1.3, over: true });
  });
});
