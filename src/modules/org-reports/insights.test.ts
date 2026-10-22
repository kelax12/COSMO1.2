import { describe, expect, it } from 'vitest';
import { eventMinutes } from './insights';

describe('eventMinutes', () => {
  it('ne rend jamais une durée négative', () => {
    expect(eventMinutes({ start: '2026-10-01T10:00:00Z', end: '2026-10-01T11:30:00Z' })).toBe(90);
    expect(eventMinutes({ start: '2026-10-01T11:00:00Z', end: '2026-10-01T10:00:00Z' })).toBe(0);
  });
});
