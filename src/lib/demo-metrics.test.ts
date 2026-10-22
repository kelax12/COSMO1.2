// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])) },
}));

import {
  DEMO_DEVICE_ID_KEY,
  recordDemoVisit,
  recordDemoConversionIfAny,
  clearDemoMetricsTraces,
} from './demo-metrics';
import { COOKIE_CONSENT_KEY, COOKIE_CONSENT_AT_KEY } from './cookie-consent';

function accept(): void {
  localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
  localStorage.setItem(COOKIE_CONSENT_AT_KEY, String(Date.now()));
}

beforeEach(() => {
  rpc.mockClear();
  localStorage.clear();
});

// 🔴 Loi I&L art. 82 : l'identifiant d'appareil finit rattaché au compte.
describe('identifiant de démo, sous consentement (2026-10-13)', () => {
  it("sans réponse au bandeau : rien n'est créé, rien n'est envoyé", () => {
    recordDemoVisit();
    expect(localStorage.getItem(DEMO_DEVICE_ID_KEY)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('après un refus : idem', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'refused');
    recordDemoVisit();
    expect(localStorage.getItem(DEMO_DEVICE_ID_KEY)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('après acceptation : identifiant posé et visite comptée', () => {
    accept();
    recordDemoVisit();
    expect(localStorage.getItem(DEMO_DEVICE_ID_KEY)).not.toBeNull();
    expect(rpc).toHaveBeenCalledWith('record_demo_visit', expect.anything());
  });

  it("un identifiant posé AVANT le correctif n'est jamais rattaché sans consentement : il est effacé", () => {
    localStorage.setItem(DEMO_DEVICE_ID_KEY, '00000000-0000-4000-8000-000000000000');
    recordDemoConversionIfAny();
    expect(rpc).not.toHaveBeenCalled();
    expect(localStorage.getItem(DEMO_DEVICE_ID_KEY)).toBeNull();
  });

  it('avec consentement, la conversion est marquée', () => {
    accept();
    localStorage.setItem(DEMO_DEVICE_ID_KEY, '00000000-0000-4000-8000-000000000000');
    recordDemoConversionIfAny();
    expect(rpc).toHaveBeenCalledWith('record_demo_conversion', expect.anything());
  });

  it('clearDemoMetricsTraces efface la clé', () => {
    localStorage.setItem(DEMO_DEVICE_ID_KEY, 'x');
    clearDemoMetricsTraces(localStorage);
    expect(localStorage.getItem(DEMO_DEVICE_ID_KEY)).toBeNull();
  });
});
