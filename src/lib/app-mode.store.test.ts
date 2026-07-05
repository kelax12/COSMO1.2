// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { appModeStore, useIsDemo, wasDemoPersisted } from './app-mode.store';

// Singleton module-level : on remet l'état initial (démo — pas d'env Supabase
// en environnement de test) après chaque test pour éviter les fuites d'état.
afterEach(() => {
  appModeStore.setDemo(true);
});

describe('appModeStore', () => {
  it('starts in demo mode when Supabase env vars are absent (test env)', () => {
    expect(appModeStore.isDemo).toBe(true);
  });

  it('notifies subscribers on mode change with the new value', () => {
    const listener = vi.fn();
    const unsubscribe = appModeStore.subscribe(listener);
    appModeStore.setDemo(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(false);
    expect(appModeStore.isDemo).toBe(false);
    unsubscribe();
  });

  it('does NOT notify when the value does not change (no-op setDemo)', () => {
    const listener = vi.fn();
    const unsubscribe = appModeStore.subscribe(listener);
    appModeStore.setDemo(true); // déjà true
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = appModeStore.subscribe(listener);
    unsubscribe();
    appModeStore.setDemo(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('useIsDemo se synchronise avec les changements du store', () => {
    const { result } = renderHook(() => useIsDemo());
    expect(result.current).toBe(true);
    act(() => appModeStore.setDemo(false));
    expect(result.current).toBe(false);
  });

  it('tolère un localStorage indisponible (mode privé) sans jeter', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(wasDemoPersisted()).toBe(false);
    getSpy.mockRestore();

    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => appModeStore.setDemo(true)).not.toThrow();
    setSpy.mockRestore();
  });

  it('wasDemoPersisted reflète le flag localStorage cosmo_demo_active', () => {
    localStorage.setItem('cosmo_demo_active', '1');
    expect(wasDemoPersisted()).toBe(true);
    localStorage.removeItem('cosmo_demo_active');
    expect(wasDemoPersisted()).toBe(false);
  });
});
