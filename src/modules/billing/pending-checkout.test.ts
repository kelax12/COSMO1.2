// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  PENDING_CHECKOUT_KEY,
  clearPendingCheckout,
  readPendingCheckout,
  writePendingCheckout,
} from './pending-checkout';

describe('pending-checkout', () => {
  beforeEach(() => sessionStorage.clear());

  it('relit ce qui a été écrit pour la même organisation', () => {
    writePendingCheckout({ orgId: 'org-1', tierKey: 't20', interval: 'yearly', at: 1_000 });
    expect(readPendingCheckout('org-1', 2_000)).toEqual({ orgId: 'org-1', tierKey: 't20', interval: 'yearly', at: 1_000 });
  });

  it('ignore une autre organisation, un palier inconnu, une trace de plus de 30 min', () => {
    writePendingCheckout({ orgId: 'org-1', tierKey: 't20', interval: 'monthly', at: 0 });
    expect(readPendingCheckout('org-2', 1)).toBeNull();
    expect(readPendingCheckout('org-1', 30 * 60 * 1000 + 1)).toBeNull();
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ orgId: 'org-1', tierKey: 'gold', interval: 'monthly', at: 0 }));
    expect(readPendingCheckout('org-1', 1)).toBeNull();
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ orgId: 'org-1', tierKey: 'free', interval: 'monthly', at: 0 }));
    expect(readPendingCheckout('org-1', 1)).toBeNull();
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ orgId: 'org-1', tierKey: 't20', interval: 'weekly', at: 0 }));
    expect(readPendingCheckout('org-1', 1)).toBeNull();
  });

  it('une trace datée dans le futur ne vit pas indéfiniment', () => {
    writePendingCheckout({ orgId: 'org-1', tierKey: 't20', interval: 'monthly', at: 5_000 });
    expect(readPendingCheckout('org-1', 1_000)).toBeNull();
  });

  it('survit à une valeur corrompue', () => {
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, '{pas du json');
    expect(readPendingCheckout('org-1')).toBeNull();
  });

  it('clear efface la trace', () => {
    writePendingCheckout({ orgId: 'org-1', tierKey: 't10', interval: 'monthly', at: Date.now() });
    clearPendingCheckout();
    expect(sessionStorage.getItem(PENDING_CHECKOUT_KEY)).toBeNull();
  });
});
