// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn(() => Promise.resolve({ data: true, error: null }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])) } }));

import { AFFILIATE_STORAGE_KEY } from '@/lib/affiliation';
import { claimAffiliate, _resetAffiliateClaimedForTests } from './affiliate-claim';

const fresh = new Date(Date.now() - 60_000).toISOString();
const old = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();

beforeEach(() => {
  rpc.mockClear();
  localStorage.clear();
  _resetAffiliateClaimedForTests();
});

function setAff(slug: string) {
  localStorage.setItem(AFFILIATE_STORAGE_KEY, JSON.stringify({ slug, at: Date.now() }));
}

describe('claimAffiliate', () => {
  it('envoie le slug pour un compte neuf, SANS consentement', () => {
    setAff('jean');
    claimAffiliate({ id: 'u1', created_at: fresh });
    expect(rpc).toHaveBeenCalledWith('claim_affiliate', { p_slug: 'jean' });
  });

  it('une seule fois par utilisateur', () => {
    setAff('jean');
    claimAffiliate({ id: 'u1', created_at: fresh });
    claimAffiliate({ id: 'u1', created_at: fresh });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rien pour un compte ancien ou sans slug", () => {
    setAff('jean');
    claimAffiliate({ id: 'u2', created_at: old });
    localStorage.clear();
    claimAffiliate({ id: 'u3', created_at: fresh });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('ne jette jamais, même si la RPC rejette', async () => {
    rpc.mockImplementationOnce(() => Promise.reject(new Error('down')));
    setAff('jean');
    expect(() => claimAffiliate({ id: 'u4', created_at: fresh })).not.toThrow();
    await Promise.resolve();
  });
});
