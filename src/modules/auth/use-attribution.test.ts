// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

const h = vi.hoisted(() => ({
  calls: [] as string[],
  firstTouch: null as null | { source: string; campaign?: string },
  slug: null as null | string,
}));

vi.mock('./acquisition-claim', () => ({
  claimAcquisitionSource: (u: { id: string }) => h.calls.push(`acquisition:${u.id}`),
}));
vi.mock('./affiliate-claim', () => ({
  claimAffiliate: (u: { id: string }) => h.calls.push(`affiliate:${u.id}`),
}));
vi.mock('@/lib/attribution', () => ({
  readFirstTouch: () => {
    h.calls.push('readFirstTouch');
    return h.firstTouch;
  },
}));
vi.mock('@/lib/affiliation', () => ({
  readAffiliateSlug: () => {
    h.calls.push('readAffiliateSlug');
    return h.slug;
  },
}));

import { claimSessionAttribution, signupAttributionMetadata, useAttribution } from './use-attribution';
import { createAuthEvents } from './auth-events';

const asUser = (id: string) => ({ id }) as unknown as SupabaseUser;

beforeEach(() => {
  h.calls = [];
  h.firstTouch = null;
  h.slug = null;
});

describe('claimSessionAttribution', () => {
  it("rattache l'acquisition PUIS l'affiliation", () => {
    claimSessionAttribution(asUser('u1'));
    expect(h.calls).toEqual(['acquisition:u1', 'affiliate:u1']);
  });
});

describe('signupAttributionMetadata', () => {
  it("vide sans first-touch ni affilié (aucune clé, pas même à `undefined`)", () => {
    expect(signupAttributionMetadata()).toEqual({});
    expect(h.calls).toEqual(['readFirstTouch', 'readAffiliateSlug']);
  });

  it('porte le slug, la source et la campagne', () => {
    h.firstTouch = { source: 'tiktok', campaign: 'rentree' };
    h.slug = 'bde-lyon';
    expect(signupAttributionMetadata()).toEqual({
      affiliate_slug: 'bde-lyon',
      acquisition_source: 'tiktok',
      acquisition_campaign: 'rentree',
    });
  });

  it('omet la campagne absente', () => {
    h.firstTouch = { source: 'google' };
    expect(signupAttributionMetadata()).toEqual({ acquisition_source: 'google' });
  });
});

describe('useAttribution', () => {
  it("rattache à chaque sessionOpened, plus rien après démontage", () => {
    const events = createAuthEvents();
    const view = renderHook(() => useAttribution(events));
    events.emit('sessionOpened', asUser('u1'));
    events.emit('signedOut', undefined);
    view.unmount();
    events.emit('sessionOpened', asUser('u2'));
    expect(h.calls).toEqual(['acquisition:u1', 'affiliate:u1']);
  });
});
