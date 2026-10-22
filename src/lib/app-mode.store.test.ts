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

  // Safari en navigation privée fait JETER localStorage au lieu de renvoyer
  // null. Le mode démo doit dégrader proprement, jamais faire écran blanc.
  it('wasDemoPersisted: localStorage qui jette → false, sans propager', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(wasDemoPersisted()).toBe(false);
    spy.mockRestore();
  });

  it('setDemo: localStorage qui jette → bascule quand même le mode en mémoire', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    appModeStore.setDemo(false);
    expect(appModeStore.isDemo).toBe(false);
    appModeStore.setDemo(true);
    expect(appModeStore.isDemo).toBe(true);

    setSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

// Le mode initial du singleton est calculé UNE FOIS à l'import du module.
// Le vérifier demande donc de ré-importer le module avec d'autres variables
// d'environnement — sinon la branche « Supabase configuré » n'est jamais
// évaluée et l'app pourrait démarrer en démo chez un vrai utilisateur sans
// qu'aucun test ne le voie.
describe('mode initial du singleton (évalué à l’import)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('variables Supabase présentes et aucune démo persistée → mode production', async () => {
    localStorage.removeItem('cosmo_demo_active');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();

    const mod = await import('./app-mode.store');
    expect(mod.appModeStore.isDemo).toBe(false);
  });

  it('variables présentes MAIS démo persistée → démo restaurée (F5 pendant une démo)', async () => {
    localStorage.setItem('cosmo_demo_active', '1');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();

    const mod = await import('./app-mode.store');
    expect(mod.appModeStore.isDemo).toBe(true);
    localStorage.removeItem('cosmo_demo_active');
  });

  it('URL littérale "undefined" (env mal injectée) → traitée comme absente', async () => {
    localStorage.removeItem('cosmo_demo_active');
    vi.stubEnv('VITE_SUPABASE_URL', 'undefined');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();

    const mod = await import('./app-mode.store');
    expect(mod.appModeStore.isDemo).toBe(true);
  });
});
