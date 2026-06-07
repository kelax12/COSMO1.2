// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getAcknowledgedShares, acknowledgeShare } from './acknowledged-shares';

beforeEach(() => localStorage.clear());

describe('acknowledged-shares', () => {
  it('returns an empty set when nothing acknowledged', () => {
    expect(getAcknowledgedShares('u1').size).toBe(0);
  });

  it('persists and reads back acknowledged task ids', () => {
    acknowledgeShare('u1', 'task-a');
    acknowledgeShare('u1', 'task-b');
    const set = getAcknowledgedShares('u1');
    expect(set.has('task-a')).toBe(true);
    expect(set.has('task-b')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('is idempotent for the same task id', () => {
    acknowledgeShare('u1', 'task-a');
    acknowledgeShare('u1', 'task-a');
    expect(getAcknowledgedShares('u1').size).toBe(1);
  });

  it('scopes acknowledgements per user', () => {
    acknowledgeShare('u1', 'task-a');
    expect(getAcknowledgedShares('u2').size).toBe(0);
  });

  it('returns an empty set on corrupt JSON instead of throwing', () => {
    localStorage.setItem('cosmo_ack_shares_u1', '{not-json');
    expect(getAcknowledgedShares('u1').size).toBe(0);
  });

  it('falls back to an anon key when no userId is provided', () => {
    acknowledgeShare(undefined, 'task-anon');
    expect(getAcknowledgedShares(undefined).has('task-anon')).toBe(true);
    expect(localStorage.getItem('cosmo_ack_shares_anon')).toContain('task-anon');
  });
});
