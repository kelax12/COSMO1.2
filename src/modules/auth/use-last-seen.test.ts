// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

const h = vi.hoisted(() => ({
  configured: true,
  rpc: vi.fn((_name: string) => Promise.resolve({ error: null as null | { message: string } })),
  conversion: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return h.configured;
  },
  supabase: { rpc: (name: string) => h.rpc(name) },
}));
vi.mock('@/lib/demo-metrics', () => ({ recordDemoConversionIfAny: () => h.conversion() }));

import { touchLastSeen, resetLastSeen, useLastSeen } from './use-last-seen';
import { createAuthEvents } from './auth-events';
import { appModeStore } from '@/lib/app-mode.store';

const asUser = (id: string) => ({ id }) as unknown as SupabaseUser;

beforeEach(() => {
  h.configured = true;
  appModeStore.setDemo(false);
  resetLastSeen();
});

describe('touchLastSeen', () => {
  it('pinge une fois par utilisateur et par chargement, et marque la conversion démo', () => {
    touchLastSeen('u1');
    touchLastSeen('u1');
    touchLastSeen('u2');
    expect(h.rpc.mock.calls.map((c) => c[0])).toEqual(['touch_last_seen', 'touch_last_seen']);
    expect(h.conversion).toHaveBeenCalledTimes(2);
  });

  it('no-op en démo et sans Supabase', () => {
    appModeStore.setDemo(true);
    touchLastSeen('u1');
    appModeStore.setDemo(false);
    h.configured = false;
    touchLastSeen('u1');
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.conversion).not.toHaveBeenCalled();
  });

  it('resetLastSeen rouvre le ping pour un re-login dans la même page', () => {
    touchLastSeen('u1');
    resetLastSeen();
    touchLastSeen('u1');
    expect(h.rpc).toHaveBeenCalledTimes(2);
  });
});

describe('useLastSeen', () => {
  it('écoute sessionOpened et signedOut, se désabonne au démontage', () => {
    const events = createAuthEvents();
    const view = renderHook(() => useLastSeen(events));
    events.emit('sessionOpened', asUser('u1'));
    events.emit('sessionOpened', asUser('u1'));
    expect(h.rpc).toHaveBeenCalledTimes(1);
    events.emit('signedOut', undefined);
    events.emit('sessionOpened', asUser('u1'));
    expect(h.rpc).toHaveBeenCalledTimes(2);
    view.unmount();
    resetLastSeen();
    events.emit('sessionOpened', asUser('u1'));
    expect(h.rpc).toHaveBeenCalledTimes(2);
  });
});
