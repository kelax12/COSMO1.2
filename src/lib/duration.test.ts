import { describe, it, expect } from 'vitest';
import { formatDurationMinutes } from './duration';

describe('formatDurationMinutes — maquette 139', () => {
  it('minutes seules sous une heure', () => {
    expect(formatDurationMinutes(45)).toBe('45 min');
    expect(formatDurationMinutes(0)).toBe('0 min');
  });
  it('heures pleines', () => {
    expect(formatDurationMinutes(120)).toBe('2 h');
  });
  it('heures et minutes, minutes sur deux chiffres, sans « min »', () => {
    expect(formatDurationMinutes(90)).toBe('1 h 30');
    expect(formatDurationMinutes(65)).toBe('1 h 05');
    expect(formatDurationMinutes(236)).toBe('3 h 56');
  });
  it('arrondit, et ne rend jamais une durée négative ni NaN', () => {
    expect(formatDurationMinutes(89.6)).toBe('1 h 30');
    expect(formatDurationMinutes(-10)).toBe('0 min');
    expect(formatDurationMinutes(Number.NaN)).toBe('0 min');
  });
});
