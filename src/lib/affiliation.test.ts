// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AFFILIATE_STORAGE_KEY,
  AFFILIATE_TTL_MS,
  normalizeAffiliateSlug,
  captureAffiliate,
  readAffiliateSlug,
  _resetAffiliatePingForTests,
} from './affiliation';
import { clearAttributionTraces } from './attribution';

const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

function visit(search: string) {
  window.history.replaceState(null, '', `/${search}`);
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
  _resetAffiliatePingForTests();
  visit('');
});

describe('normalizeAffiliateSlug', () => {
  it('accepte un slug valide, refuse le reste', () => {
    expect(normalizeAffiliateSlug('jean-42')).toBe('jean-42');
    expect(normalizeAffiliateSlug('a')).toBeNull();
    expect(normalizeAffiliateSlug('A_B')).toBeNull();
    expect(normalizeAffiliateSlug('x'.repeat(41))).toBeNull();
    expect(normalizeAffiliateSlug('<script>')).toBeNull();
    expect(normalizeAffiliateSlug(null)).toBeNull();
  });
});

describe('captureAffiliate', () => {
  it('stocke le slug SANS consentement', () => {
    visit('?aff=jean');
    captureAffiliate();
    expect(readAffiliateSlug()).toBe('jean');
    expect(localStorage.getItem('cosmo_cookie_consent')).toBeNull();
  });

  it('dernier clic gagnant', () => {
    visit('?aff=jean');
    captureAffiliate();
    _resetAffiliatePingForTests();
    visit('?aff=marie');
    captureAffiliate();
    expect(readAffiliateSlug()).toBe('marie');
  });

  it('ignore un slug invalide et garde le précédent', () => {
    visit('?aff=jean');
    captureAffiliate();
    visit('?aff=BAD!');
    captureAffiliate();
    expect(readAffiliateSlug()).toBe('jean');
  });

  it('expire après 30 jours', () => {
    localStorage.setItem(
      AFFILIATE_STORAGE_KEY,
      JSON.stringify({ slug: 'jean', at: Date.now() - AFFILIATE_TTL_MS - 1 }),
    );
    expect(readAffiliateSlug()).toBeNull();
  });

  it('re-valide à la lecture', () => {
    localStorage.setItem(AFFILIATE_STORAGE_KEY, JSON.stringify({ slug: 'BAD!', at: Date.now() }));
    expect(readAffiliateSlug()).toBeNull();
    localStorage.setItem(AFFILIATE_STORAGE_KEY, '{oops');
    expect(readAffiliateSlug()).toBeNull();
  });

  it('ping le clic une seule fois par chargement', () => {
    visit('?aff=jean');
    captureAffiliate();
    captureAffiliate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/functions/v1/affiliation-api/click');
    expect(JSON.parse(init.body as string)).toEqual({ slug: 'jean' });
  });

  it('ne ping pas sans ?aff= valide', () => {
    visit('?aff=x');
    captureAffiliate();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ne casse rien si fetch ou le stockage jettent', () => {
    vi.stubGlobal('fetch', () => { throw new Error('boom'); });
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    visit('?aff=jean');
    expect(() => captureAffiliate()).not.toThrow();
    spy.mockRestore();
  });

  it('survit à clearAttributionTraces', () => {
    visit('?aff=jean');
    captureAffiliate();
    clearAttributionTraces(window.localStorage);
    expect(readAffiliateSlug()).toBe('jean');
  });
});
