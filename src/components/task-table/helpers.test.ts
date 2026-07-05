import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDeadlineSmart } from './helpers';

// Mercredi 8 juillet 2026
const NOW = new Date(2026, 6, 8, 12, 0);

describe('formatDeadlineSmart — dates relatives (#28)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aujourd'hui / demain / hier", () => {
    expect(formatDeadlineSmart('2026-07-08')).toBe("Aujourd'hui");
    expect(formatDeadlineSmart('2026-07-09')).toBe('Demain');
    expect(formatDeadlineSmart('2026-07-07')).toBe('Hier');
  });

  it('sous 7 jours futurs : jour de la semaine', () => {
    expect(formatDeadlineSmart('2026-07-10')).toBe('vendredi');
    expect(formatDeadlineSmart('2026-07-13')).toBe('lundi');
  });

  it('retard récent : « il y a X j »', () => {
    expect(formatDeadlineSmart('2026-07-05')).toBe('il y a 3 j');
  });

  it('au-delà de ±7 jours : date absolue', () => {
    expect(formatDeadlineSmart('2026-07-20')).toBe('20 juillet');
    expect(formatDeadlineSmart('2026-06-20')).toBe('20 juin');
  });

  it('valeurs invalides : tiret', () => {
    expect(formatDeadlineSmart(undefined)).toBe('—');
    expect(formatDeadlineSmart('')).toBe('—');
    expect(formatDeadlineSmart('garbage')).toBe('—');
  });
});
