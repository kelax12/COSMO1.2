// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn(() => Promise.resolve({ data: true, error: null }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])) } }));

import { FIRST_TOUCH_STORAGE_KEY } from '@/lib/attribution';
import {
  claimAcquisitionSource,
  isFreshAccount,
  _resetClaimedForTests,
  CLAIM_WINDOW_MS,
} from './acquisition-claim';

const NOW = Date.now();
const fresh = new Date(NOW - 60_000).toISOString();
const old = new Date(NOW - 2 * 24 * 3600 * 1000).toISOString();

function setFirstTouch(value: object) {
  localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(value));
}

beforeEach(() => {
  rpc.mockClear();
  localStorage.clear();
  _resetClaimedForTests();
});

describe('isFreshAccount', () => {
  it('vrai sous une heure, faux au-delà ou sans date', () => {
    expect(isFreshAccount(fresh)).toBe(true);
    expect(isFreshAccount(new Date(NOW - CLAIM_WINDOW_MS - 1000).toISOString())).toBe(false);
    expect(isFreshAccount(undefined)).toBe(false);
    expect(isFreshAccount('pas une date')).toBe(false);
  });
});

describe('claimAcquisitionSource', () => {
  it('compte Google neuf avec ?ref= : envoie source et campagne', () => {
    setFirstTouch({ source: 'tiktok', campaign: 'reels', ts: NOW });
    claimAcquisitionSource({ id: 'u1', created_at: fresh });
    expect(rpc).toHaveBeenCalledWith('claim_acquisition_source', {
      p_source: 'tiktok',
      p_campaign: 'reels',
    });
  });

  it('une seule fois par utilisateur (SIGNED_IN refire au refresh de token)', () => {
    setFirstTouch({ source: 'tiktok', ts: NOW });
    claimAcquisitionSource({ id: 'u1', created_at: fresh });
    claimAcquisitionSource({ id: 'u1', created_at: fresh });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('claim_acquisition_source', { p_source: 'tiktok', p_campaign: null });
  });

  it("compte ancien : aucune requête, même avec une attribution", () => {
    setFirstTouch({ source: 'tiktok', ts: NOW });
    claimAcquisitionSource({ id: 'u2', created_at: old });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sans attribution : aucune requête', () => {
    claimAcquisitionSource({ id: 'u3', created_at: fresh });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("une valeur forgée dans localStorage ne franchit pas la frontière", () => {
    setFirstTouch({ source: 'Tik Tok<script>', ts: NOW });
    claimAcquisitionSource({ id: 'u4', created_at: fresh });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("un échec réseau ne lève rien", async () => {
    rpc.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    setFirstTouch({ source: 'tiktok', ts: NOW });
    expect(() => claimAcquisitionSource({ id: 'u5', created_at: fresh })).not.toThrow();
    await Promise.resolve();
  });
});
