import { describe, it, expect } from 'vitest';
import { formatTime, formatTimeShort } from './format';

describe('formatTime', () => {
  it('formats minutes only when under an hour', () => {
    expect(formatTime(45)).toBe('45min');
    expect(formatTime(0)).toBe('0min');
  });
  it('formats whole hours', () => {
    expect(formatTime(60)).toBe('1h');
    expect(formatTime(120)).toBe('2h');
  });
  it('formats hours and minutes, zero-padding minutes < 10', () => {
    expect(formatTime(90)).toBe('1h30');
    expect(formatTime(65)).toBe('1h05');
  });
  it('rounds fractional minutes', () => {
    expect(formatTime(45.4)).toBe('45min');
    expect(formatTime(90.2)).toBe('1h30');
  });
  it('formatTimeShort matches formatTime', () => {
    expect(formatTimeShort(90)).toBe(formatTime(90));
  });
});
