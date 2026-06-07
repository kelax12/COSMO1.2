import { describe, it, expect } from 'vitest';
import { isDailyAdLimitError } from './ad-limit';

describe('isDailyAdLimitError', () => {
  it('matches the RPC message', () => {
    expect(isDailyAdLimitError({ message: 'Daily ad-credit limit reached (20 per 24h)' })).toBe(true);
  });

  it('matches the check_violation code', () => {
    expect(isDailyAdLimitError({ code: '23514' })).toBe(true);
  });

  it('rejects other Postgres errors', () => {
    expect(isDailyAdLimitError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isDailyAdLimitError({ message: 'Rate limit: wait' })).toBe(false);
  });

  it('is safe on non-error values', () => {
    expect(isDailyAdLimitError(null)).toBe(false);
    expect(isDailyAdLimitError(undefined)).toBe(false);
    expect(isDailyAdLimitError('boom')).toBe(false);
    expect(isDailyAdLimitError(42)).toBe(false);
  });
});
