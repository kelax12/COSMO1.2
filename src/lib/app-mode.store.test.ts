import { describe, it, expect, vi, afterEach } from 'vitest';
import { appModeStore } from './app-mode.store';

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
});
